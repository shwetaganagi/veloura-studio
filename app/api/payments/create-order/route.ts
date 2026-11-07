import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getCustomerSession } from "@/lib/auth/customer";
import { getRazorpay } from "@/lib/payments/razorpay";
import type { Orders } from "razorpay/dist/types/orders";

const RESERVATION_MINUTES = 15;

type CartItemInput = {
  productId: number;
  quantity: number;
};

type CreateOrderInput = {
  customerName: string;
  phone: string;
  deliveryAddress: string;
  customizationNotes?: string;
  items: CartItemInput[];
};

type OrderCreationErrorCode =
  | "INVALID_INPUT"
  | "UNAVAILABLE_PRODUCT"
  | "INSUFFICIENT_STOCK"
  | "INVALID_PRODUCT_PRICE"
  | "ORDER_TOTAL_TOO_LARGE";

class OrderCreationError extends Error {
  constructor(public readonly code: OrderCreationErrorCode) {
    super(code);
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseOrderInput(value: unknown): {
  input: CreateOrderInput;
  quantities: Map<number, number>;
} {
  if (!isObject(value)) {
    throw new OrderCreationError("INVALID_INPUT");
  }

  const customerName =
    typeof value.customerName === "string" ? value.customerName.trim() : "";
  const phone = typeof value.phone === "string" ? value.phone.trim() : "";
  const deliveryAddress =
    typeof value.deliveryAddress === "string"
      ? value.deliveryAddress.trim()
      : "";
  const customizationNotes =
    typeof value.customizationNotes === "string"
      ? value.customizationNotes.trim()
      : "";

  if (
    !customerName ||
    customerName.length > 150 ||
    !/^[6-9]\d{9}$/.test(phone) ||
    !deliveryAddress ||
    deliveryAddress.length > 2000 ||
    customizationNotes.length > 2000 ||
    !Array.isArray(value.items) ||
    value.items.length === 0 ||
    value.items.length > 100
  ) {
    throw new OrderCreationError("INVALID_INPUT");
  }

  const quantities = new Map<number, number>();

  for (const item of value.items) {
    if (
      !isObject(item) ||
      !Number.isSafeInteger(item.productId) ||
      Number(item.productId) <= 0 ||
      !Number.isSafeInteger(item.quantity) ||
      Number(item.quantity) <= 0 ||
      Number(item.quantity) > 100
    ) {
      throw new OrderCreationError("INVALID_INPUT");
    }

    const productId = Number(item.productId);
    const quantity = (quantities.get(productId) ?? 0) + Number(item.quantity);
    if (quantity > 100) {
      throw new OrderCreationError("INVALID_INPUT");
    }
    quantities.set(productId, quantity);
  }

  return {
    input: {
      customerName,
      phone,
      deliveryAddress,
      customizationNotes,
      items: [...quantities].map(([productId, quantity]) => ({
        productId,
        quantity,
      })),
    },
    quantities,
  };
}

function isUniqueViolation(error: unknown) {
  return isObject(error) && error.code === "23505";
}

function getRequestFingerprint(
  input: CreateOrderInput,
  customerId: string | null
) {
  const canonicalInput = {
    customerId,
    customerName: input.customerName,
    phone: input.phone,
    deliveryAddress: input.deliveryAddress,
    customizationNotes: input.customizationNotes ?? "",
    items: [...input.items].sort((a, b) => a.productId - b.productId),
  };

  return createHash("sha256").update(JSON.stringify(canonicalInput)).digest("hex");
}

export async function POST(request: Request) {
  let parsed: ReturnType<typeof parseOrderInput>;
  let idempotencyKey: string;

  try {
    parsed = parseOrderInput(await request.json());
    idempotencyKey = request.headers.get("Idempotency-Key") ?? "";
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        idempotencyKey
      )
    ) {
      throw new OrderCreationError("INVALID_INPUT");
    }
  } catch (error) {
    if (error instanceof OrderCreationError) {
      return NextResponse.json(
        { success: false, message: "Please check your checkout details." },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, message: "Invalid JSON request." },
      { status: 400 }
    );
  }

  let razorpay: ReturnType<typeof getRazorpay>;
  try {
    razorpay = getRazorpay();
  } catch {
    console.error("Razorpay is not configured for payment order creation.");
    return NextResponse.json(
      { success: false, message: "Online payment is temporarily unavailable." },
      { status: 503 }
    );
  }

  const customerSession = await getCustomerSession();
  const requestFingerprint = getRequestFingerprint(
    parsed.input,
    customerSession?.customerId ?? null
  );
  const client = await pool.connect();
  let orderId: string | null = null;
  let attemptId: string | null = null;
  let amountPaise = 0;
  let existingAttempt:
    | {
        id: string;
        order_id: string;
        request_fingerprint: string;
        razorpay_order_id: string | null;
        amount_paise: string | number;
        currency: string;
        status: string;
        expires_at: Date;
      }
    | undefined;

  try {
    await client.query("BEGIN");
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
      [idempotencyKey]
    );

    await client.query(
      `UPDATE payment_attempts
       SET status = 'expired', updated_at = NOW()
       WHERE status IN ('creating', 'pending')
         AND expires_at <= NOW()`
    );
    await client.query(
      `UPDATE orders o
       SET payment_status = 'expired'
       FROM payment_attempts pa
       WHERE pa.order_id = o.id
         AND pa.status = 'expired'
         AND o.payment_status = 'pending'`
    );
    await client.query(
      `UPDATE payment_inventory_reservations
       SET status = 'expired', updated_at = NOW()
       WHERE status = 'reserved'
         AND expires_at <= NOW()`
    );

    const existingResult = await client.query<NonNullable<typeof existingAttempt>>(
      `SELECT id, order_id, request_fingerprint, razorpay_order_id, amount_paise, currency, status, expires_at
       FROM payment_attempts
       WHERE idempotency_key = $1
       FOR UPDATE`,
      [idempotencyKey]
    );
    existingAttempt = existingResult.rows[0];

    if (existingAttempt) {
      await client.query("COMMIT");
      if (existingAttempt.request_fingerprint !== requestFingerprint) {
        return NextResponse.json(
          {
            success: false,
            message: "This idempotency key was already used for different checkout details.",
          },
          { status: 409 }
        );
      }

      if (
        existingAttempt.status === "pending" &&
        existingAttempt.razorpay_order_id
      ) {
        return NextResponse.json({
          success: true,
          keyId: razorpay.keyId,
          orderId: existingAttempt.razorpay_order_id,
          amount: Number(existingAttempt.amount_paise),
          currency: existingAttempt.currency,
          attemptId: existingAttempt.id,
        });
      }

      return NextResponse.json(
        {
          success: false,
          message:
            existingAttempt.status === "creating"
              ? "Payment setup is still processing. Please retry shortly."
              : "This payment attempt cannot be reused. Start a new attempt.",
        },
        { status: 409 }
      );
    }

    const productIds = [...parsed.quantities.keys()].sort((a, b) => a - b);
    const productResult = await client.query<{
      id: string;
      name: string;
      price_paise: number;
      stock_quantity: number;
    }>(
      `SELECT id, name, price_paise, stock_quantity
       FROM products
       WHERE id = ANY($1::bigint[])
         AND is_active = TRUE
       ORDER BY id
       FOR UPDATE`,
      [productIds]
    );

    if (productResult.rows.length !== productIds.length) {
      throw new OrderCreationError("UNAVAILABLE_PRODUCT");
    }

    const reservedResult = await client.query<{
      product_id: string;
      reserved_quantity: string | number;
    }>(
      `SELECT product_id, SUM(quantity)::bigint AS reserved_quantity
       FROM payment_inventory_reservations
       WHERE product_id = ANY($1::bigint[])
         AND status = 'reserved'
         AND expires_at > NOW()
       GROUP BY product_id`,
      [productIds]
    );
    const reservedByProduct = new Map(
      reservedResult.rows.map((row) => [
        row.product_id,
        BigInt(row.reserved_quantity),
      ])
    );
    let subtotalPaise = 0;

    const orderItems = productResult.rows.map((product) => {
      const quantity = parsed.quantities.get(Number(product.id));
      const availableStock =
        BigInt(product.stock_quantity) -
        (reservedByProduct.get(product.id) ?? BigInt(0));

      if (
        quantity === undefined ||
        availableStock < BigInt(quantity)
      ) {
        throw new OrderCreationError("INSUFFICIENT_STOCK");
      }

      const unitPricePaise = Number(product.price_paise);
      if (!Number.isSafeInteger(unitPricePaise) || unitPricePaise < 0) {
        throw new OrderCreationError("INVALID_PRODUCT_PRICE");
      }

      subtotalPaise += unitPricePaise * quantity;
      if (!Number.isSafeInteger(subtotalPaise)) {
        throw new OrderCreationError("ORDER_TOTAL_TOO_LARGE");
      }

      return {
        productId: product.id,
        productName: product.name,
        quantity,
        unitPricePaise,
      };
    });

    if (subtotalPaise <= 0) {
      throw new OrderCreationError("INVALID_PRODUCT_PRICE");
    }

    const orderResult = await client.query<{ id: string }>(
      `INSERT INTO orders (
         customer_id,
         customer_name,
         phone,
         delivery_address,
         customization_notes,
         subtotal_paise,
         status,
         payment_method,
         payment_status
       )
       VALUES ($1, $2, $3, $4, $5, $6, 'pending', 'razorpay', 'pending')
       RETURNING id`,
      [
        customerSession?.customerId ?? null,
        parsed.input.customerName,
        parsed.input.phone,
        parsed.input.deliveryAddress,
        parsed.input.customizationNotes || null,
        subtotalPaise,
      ]
    );
    orderId = orderResult.rows[0].id;

    for (const item of orderItems) {
      await client.query(
        `INSERT INTO order_items (
           order_id,
           product_name,
           quantity,
           unit_price_paise
         )
         VALUES ($1, $2, $3, $4)`,
        [orderId, item.productName, item.quantity, item.unitPricePaise]
      );
    }

    const attemptResult = await client.query<{
      id: string;
      expires_at: Date;
    }>(
      `INSERT INTO payment_attempts (
         order_id,
         idempotency_key,
         request_fingerprint,
         amount_paise,
         currency,
         status,
         expires_at
       )
       VALUES ($1, $2, $3, $4, 'INR', 'creating', NOW() + ($5 * INTERVAL '1 minute'))
       RETURNING id, expires_at`,
      [
        orderId,
        idempotencyKey,
        requestFingerprint,
        subtotalPaise,
        RESERVATION_MINUTES,
      ]
    );
    attemptId = attemptResult.rows[0].id;
    amountPaise = subtotalPaise;

    for (const item of orderItems) {
      await client.query(
        `INSERT INTO payment_inventory_reservations (
           payment_attempt_id,
           product_id,
           product_name,
           quantity,
           status,
           expires_at
         )
         VALUES ($1, $2, $3, $4, 'reserved', $5)`,
        [
          attemptId,
          item.productId,
          item.productName,
          item.quantity,
          attemptResult.rows[0].expires_at,
        ]
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);

    if (
      isUniqueViolation(error) &&
      isObject(error) &&
      error.constraint === "payment_attempts_idempotency_key_key"
    ) {
      const retryResult = await pool.query<NonNullable<typeof existingAttempt>>(
        `SELECT id, order_id, request_fingerprint, razorpay_order_id, amount_paise, currency, status, expires_at
         FROM payment_attempts
         WHERE idempotency_key = $1`,
        [idempotencyKey]
      );
      const retryAttempt = retryResult.rows[0];
      if (retryAttempt?.request_fingerprint !== requestFingerprint) {
        return NextResponse.json(
          {
            success: false,
            message: "This idempotency key was already used for different checkout details.",
          },
          { status: 409 }
        );
      }

      if (retryAttempt?.status === "pending" && retryAttempt.razorpay_order_id) {
        return NextResponse.json({
          success: true,
          keyId: razorpay.keyId,
          orderId: retryAttempt.razorpay_order_id,
          amount: Number(retryAttempt.amount_paise),
          currency: retryAttempt.currency,
          attemptId: retryAttempt.id,
        });
      }
      return NextResponse.json(
        { success: false, message: "This payment attempt is still processing." },
        { status: 409 }
      );
    }

    if (error instanceof OrderCreationError) {
      const responses: Record<OrderCreationErrorCode, readonly [number, string]> = {
        INVALID_INPUT: [400, "Please check your checkout details."],
        UNAVAILABLE_PRODUCT: [400, "One or more products are unavailable."],
        INSUFFICIENT_STOCK: [409, "There is not enough available stock."],
        INVALID_PRODUCT_PRICE: [500, "A product has an invalid online price."],
        ORDER_TOTAL_TOO_LARGE: [400, "The order total is too large."],
      };
      const response = responses[error.code];
      return NextResponse.json(
        { success: false, message: response[1] },
        { status: response[0] }
      );
    }

    console.error("Unable to prepare a Razorpay payment order.");
    return NextResponse.json(
      { success: false, message: "Unable to prepare online payment." },
      { status: 500 }
    );
  } finally {
    client.release();
  }

  if (!orderId || !attemptId) {
    console.error("Razorpay order preparation ended without local identifiers.");
    return NextResponse.json(
      { success: false, message: "Unable to prepare online payment." },
      { status: 500 }
    );
  }

  let providerOrder: Orders.RazorpayOrder;
  try {
    providerOrder = await razorpay.client.orders.create({
      amount: amountPaise,
      currency: "INR",
      receipt: `vls-${attemptId}`,
      notes: {
        internal_order_id: orderId,
        payment_attempt_id: attemptId,
      },
    });

    if (
      !Number.isSafeInteger(Number(providerOrder.amount)) ||
      Number(providerOrder.amount) !== amountPaise ||
      providerOrder.currency !== "INR" ||
      !providerOrder.id
    ) {
      throw new Error("Razorpay returned an inconsistent order.");
    }
  } catch {
    const failureClient = await pool.connect();
    try {
      await failureClient.query("BEGIN");
      await failureClient.query(
        `UPDATE payment_attempts
         SET status = 'failed', failed_at = NOW(), updated_at = NOW()
         WHERE id = $1
           AND status = 'creating'`,
        [attemptId]
      );
      await failureClient.query(
        `UPDATE payment_inventory_reservations
         SET status = 'released', updated_at = NOW()
         WHERE payment_attempt_id = $1
           AND status = 'reserved'`,
        [attemptId]
      );
      await failureClient.query(
        `UPDATE orders
         SET payment_status = 'failed'
         WHERE id = $1
           AND payment_status = 'pending'`,
        [orderId]
      );
      await failureClient.query("COMMIT");
    } catch {
      await failureClient.query("ROLLBACK").catch(() => undefined);
      console.error("Unable to record Razorpay order creation failure.");
    } finally {
      failureClient.release();
    }
    console.error("Razorpay order creation failed.");
    return NextResponse.json(
      { success: false, message: "Unable to start online payment." },
      { status: 502 }
    );
  }

  const finalizeClient = await pool.connect();
  try {
    await finalizeClient.query("BEGIN");
    const updateResult = await finalizeClient.query(
      `UPDATE payment_attempts
       SET status = 'pending',
           razorpay_order_id = $2,
           updated_at = NOW()
       WHERE id = $1
         AND status = 'creating'`,
      [attemptId, providerOrder.id]
    );
    if (updateResult.rowCount !== 1) {
      throw new Error("Payment attempt is no longer in the creating state.");
    }
    await finalizeClient.query("COMMIT");
  } catch {
    await finalizeClient.query("ROLLBACK").catch(() => undefined);
    console.error("Unable to persist the Razorpay order reference.");
    return NextResponse.json(
      {
        success: false,
        message: "Payment setup is still processing. Please retry shortly.",
      },
      { status: 503 }
    );
  } finally {
    finalizeClient.release();
  }

  return NextResponse.json(
    {
      success: true,
      keyId: razorpay.keyId,
      orderId: providerOrder.id,
      amount: amountPaise,
      currency: "INR",
      attemptId,
    },
    { status: 201 }
  );
}
