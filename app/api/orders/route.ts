import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

type OrderItemInput = {
  productId: number;
  quantity: number;
};

type CreateOrderInput = {
  customerName: string;
  phone: string;
  deliveryAddress: string;
  customizationNotes?: string;
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

  const deliveryAddress =
    typeof body.deliveryAddress === "string"
      ? body.deliveryAddress.trim()
      : "";

  const customizationNotes =
    typeof body.customizationNotes === "string"
      ? body.customizationNotes.trim()
      : "";

  if (!customerName || !phone || !deliveryAddress) {
    return NextResponse.json(
      {
        success: false,
        message: "Customer name, phone number, and delivery address are required.",
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

    let subtotalPaise = 0;

    const orderItems = productResult.rows.map((product) => {
      const quantity = quantities.get(Number(product.id))!;

      if (Number(product.stock_quantity) < quantity) {
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
        productName: product.name as string,
        quantity,
        unitPricePaise,
      };
    });

    const orderResult = await client.query(
      `INSERT INTO orders (
         customer_name,
         phone,
         delivery_address,
         customization_notes,
         subtotal_paise,
         status
       )
       VALUES ($1, $2, $3, $4, $5, 'pending')
       RETURNING id, status, created_at`,
      [
        customerName,
        phone,
        deliveryAddress,
        customizationNotes || null,
        subtotalPaise,
      ]
    );

    const order = orderResult.rows[0];

    for (const item of orderItems) {
      await client.query(
        `INSERT INTO order_items (
           order_id,
           product_name,
           quantity,
           unit_price_paise
         )
         VALUES ($1, $2, $3, $4)`,
        [
          order.id,
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
          subtotal: subtotalPaise / 100,
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