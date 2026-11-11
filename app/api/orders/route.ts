import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getCustomerSession } from "@/lib/auth/customer";
import { hasPaymentInventoryReservations } from "@/lib/inventory";
import {
  CouponValidationError,
  getCouponCustomerKey,
  hasCouponSchema,
  normalizeCouponCode,
  validateCoupon,
} from "@/lib/coupons";

type OrderItemInput = {
  productId: number;
  quantity: number;
};

type CreateOrderInput = {
  customerName: string;
  phone: string;
  deliveryAddress: string;
  customizationNotes?: string;
  couponCode?: string;
  items: OrderItemInput[];
};

export async function POST(request: Request) {
  let body: CreateOrderInput;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, message: "Invalid JSON request." },
      { status: 400 }
    );
  }

  const customerName =
    typeof body.customerName === "string" ? body.customerName.trim() : "";

  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  const isValidPhone = /^[6-9]\d{9}$/.test(phone);

  const deliveryAddress =
    typeof body.deliveryAddress === "string"
      ? body.deliveryAddress.trim()
      : "";

  const customizationNotes =
    typeof body.customizationNotes === "string"
      ? body.customizationNotes.trim()
      : "";
  const couponCode =
    typeof body.couponCode === "string" ? normalizeCouponCode(body.couponCode) : "";
  if (
    body.couponCode !== undefined &&
    (typeof body.couponCode !== "string" ||
      !/^[A-Z0-9][A-Z0-9_-]{2,39}$/.test(couponCode))
  ) {
    return NextResponse.json(
      { success: false, message: "Enter a valid coupon code." },
      { status: 400 }
    );
  }

  if (!customerName || !phone || !deliveryAddress) {
    return NextResponse.json(
      {
        success: false,
        message: "Customer name, phone number, and delivery address are required.",
      },
      { status: 400 }
    );
  }
  if (!isValidPhone) {
  return NextResponse.json(
    {
      success: false,
      message: "Please enter a valid 10-digit Indian mobile number.",
    },
    { status: 400 }
  );
}

  if (
    customerName.length > 150 ||
    phone.length > 30 ||
    deliveryAddress.length > 2000 ||
    customizationNotes.length > 2000
  ) {
    return NextResponse.json(
      { success: false, message: "One or more fields are too long." },
      { status: 400 }
    );
  }

  if (!Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json(
      { success: false, message: "Your shopping bag is empty." },
      { status: 400 }
    );
  }

  if (body.items.length > 100) {
    return NextResponse.json(
      { success: false, message: "Too many different products in one order." },
      { status: 400 }
    );
  }

  const quantities = new Map<number, number>();

  for (const item of body.items) {
    if (
      !item ||
      !Number.isSafeInteger(item.productId) ||
      item.productId <= 0 ||
      !Number.isSafeInteger(item.quantity) ||
      item.quantity <= 0 ||
      item.quantity > 100
    ) {
      return NextResponse.json(
        { success: false, message: "Invalid product or quantity." },
        { status: 400 }
      );
    }

    quantities.set(
      item.productId,
      (quantities.get(item.productId) ?? 0) + item.quantity
    );
  }

  if ([...quantities.values()].some((quantity) => quantity > 100)) {
    return NextResponse.json(
      {
        success: false,
        message: "The maximum quantity per product is 100.",
      },
      { status: 400 }
    );
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const productIds = [...quantities.keys()];

    const productResult = await client.query(
      `SELECT id, name, price_paise, stock_quantity
       FROM products
       WHERE id = ANY($1::bigint[])
         AND is_active = TRUE
       ORDER BY id
       FOR UPDATE`,
      [productIds]
    );

    if (productResult.rows.length !== productIds.length) {
      await client.query("ROLLBACK");

      return NextResponse.json(
        {
          success: false,
          message: "One or more products are unavailable. Please refresh your bag.",
        },
        { status: 400 }
      );
    }

    const reservationsAvailable = await hasPaymentInventoryReservations(client);
    const reservationsResult = reservationsAvailable
      ? await client.query<{
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
        )
      : { rows: [] };
    if (!reservationsAvailable) {
      console.warn(
        "WhatsApp order stock checks are using on-hand quantities because payment reservations are not installed."
      );
    }
    const reservedByProduct = new Map(
      reservationsResult.rows.map((row) => [
        row.product_id,
        BigInt(row.reserved_quantity),
      ])
    );

    let subtotalPaise = 0;

    const orderItems = productResult.rows.map((product) => {
      const quantity = quantities.get(Number(product.id))!;

      const availableStock =
        BigInt(product.stock_quantity) -
        (reservedByProduct.get(String(product.id)) ?? BigInt(0));
      if (availableStock < BigInt(quantity)) {
        throw new Error(`INSUFFICIENT_STOCK:${product.name}`);
      }

      const unitPricePaise = Number(product.price_paise);

      if (!Number.isSafeInteger(unitPricePaise) || unitPricePaise < 0) {
        throw new Error("INVALID_PRODUCT_PRICE");
      }

      subtotalPaise += unitPricePaise * quantity;

      if (!Number.isSafeInteger(subtotalPaise)) {
        throw new Error("ORDER_TOTAL_TOO_LARGE");
      }

      return {
        productId: Number(product.id),
        productName: product.name as string,
        quantity,
        unitPricePaise,
      };
    });

    const customerSession = await getCustomerSession();
    if (couponCode && !(await hasCouponSchema(client))) {
      throw new CouponValidationError(
        "SCHEMA_UNAVAILABLE",
        "Coupons are temporarily unavailable. Please place your order without a coupon."
      );
    }
    const coupon = couponCode
      ? await validateCoupon(client, {
          code: couponCode,
          subtotalPaise,
          customerKey: getCouponCustomerKey(customerSession?.customerId ?? null, phone),
          lock: true,
        })
      : null;
    const payablePaise = subtotalPaise - (coupon?.discountPaise ?? 0);

    const orderResult = coupon
      ? await client.query(
          `INSERT INTO orders (
             customer_id, customer_name, phone, delivery_address,
             customization_notes, subtotal_paise, coupon_id, coupon_code,
             coupon_discount_paise, status
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending')
           RETURNING id, status, created_at`,
          [
            customerSession?.customerId ?? null,
            customerName,
            phone,
            deliveryAddress,
            customizationNotes || null,
            payablePaise,
            coupon.id,
            coupon.code,
            coupon.discountPaise,
          ]
        )
      : await client.query(
          `INSERT INTO orders (
             customer_id, customer_name, phone, delivery_address,
             customization_notes, subtotal_paise, status
           )
           VALUES ($1, $2, $3, $4, $5, $6, 'pending')
           RETURNING id, status, created_at`,
          [
        customerSession?.customerId ?? null,
        customerName,
        phone,
        deliveryAddress,
        customizationNotes || null,
            subtotalPaise,
          ]
        );

    const order = orderResult.rows[0];

    if (coupon) {
      await client.query(
        `INSERT INTO coupon_redemptions (
           coupon_id, order_id, customer_id, customer_key, code_snapshot,
           subtotal_paise, discount_paise, status, expires_at, redeemed_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'redeemed', NULL, NOW())`,
        [
          coupon.id,
          order.id,
          customerSession?.customerId ?? null,
          getCouponCustomerKey(customerSession?.customerId ?? null, phone),
          coupon.code,
          subtotalPaise,
          coupon.discountPaise,
        ]
      );
    }

    for (const item of orderItems) {
      await client.query(
        `INSERT INTO order_items (
           order_id,
           product_id,
           product_name,
           quantity,
           unit_price_paise
         )
         VALUES ($1, $2, $3, $4, $5)`,
        [
          order.id,
          item.productId,
          item.productName,
          item.quantity,
          item.unitPricePaise,
        ]
      );
    }

    await client.query("COMMIT");

    return NextResponse.json(
      {
        success: true,
        message: "Order saved successfully.",
        order: {
          id: String(order.id),
          status: order.status,
          createdAt: order.created_at,
          subtotal: payablePaise / 100,
          subtotalBeforeDiscount: subtotalPaise / 100,
          discount: (coupon?.discountPaise ?? 0) / 100,
          couponCode: coupon?.code ?? null,
          items: orderItems.map((item) => ({
            name: item.productName,
            quantity: item.quantity,
            unitPrice: item.unitPricePaise / 100,
          })),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);

    if (error instanceof CouponValidationError) {
      return NextResponse.json(
        { success: false, code: error.code, error: error.message },
        { status: error.code === "SCHEMA_UNAVAILABLE" ? 503 : 400 }
      );
    }

    if (error instanceof Error && error.message.startsWith("INSUFFICIENT_STOCK:")) {
      return NextResponse.json(
        {
          success: false,
          message: `${error.message.replace("INSUFFICIENT_STOCK:", "")} does not have enough stock.`,
        },
        { status: 409 }
      );
    }

    if (error instanceof Error && error.message === "INVALID_PRODUCT_PRICE") {
      return NextResponse.json(
        { success: false, message: "A product has an invalid price." },
        { status: 500 }
      );
    }

    if (error instanceof Error && error.message === "ORDER_TOTAL_TOO_LARGE") {
      return NextResponse.json(
        { success: false, message: "The order total is too large." },
        { status: 400 }
      );
    }

    console.error("Failed to save order:", error);

    return NextResponse.json(
      { success: false, message: "Unable to save your order. Please try again." },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}