import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import type { PoolClient } from "pg";
import { pool } from "@/lib/db";
import {
  SESSION_COOKIE_NAME,
  verifyAdminSession,
} from "@/lib/auth/admin";
import {
  hasInventoryLifecycleSchema,
  recordInventoryMovement,
} from "@/lib/inventory";
import { hasCouponSchema } from "@/lib/coupons";

const allowedStatuses = [
  "pending",
  "confirmed",
  "preparing",
  "shipped",
  "delivered",
  "cancelled",
];

const allowedTransitions: Record<string, string[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["preparing", "shipped", "delivered", "cancelled"],
  preparing: ["shipped", "delivered", "cancelled"],
  shipped: ["delivered", "cancelled"],
  delivered: [],
  cancelled: [],
};

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

async function deductWhatsAppOrderStock(
  client: PoolClient,
  orderId: string
) {
  const itemsResult = await client.query<{
    product_id: string | null;
    quantity: number;
  }>(
    `SELECT product_id::text AS product_id, quantity
     FROM order_items
     WHERE order_id = $1
     ORDER BY product_id`,
    [orderId]
  );
  if (itemsResult.rows.length === 0 || itemsResult.rows.some((item) => !item.product_id)) {
    throw new Error("ORDER_ITEMS_MISSING_PRODUCT");
  }

  const quantities = new Map<string, number>();
  for (const item of itemsResult.rows) {
    const productId = item.product_id!;
    quantities.set(productId, (quantities.get(productId) ?? 0) + Number(item.quantity));
  }
  const productIds = [...quantities.keys()].sort((a, b) => BigInt(a) < BigInt(b) ? -1 : 1);
  const productsResult = await client.query<{
    id: string;
    name: string;
    stock_quantity: number;
  }>(
    `SELECT id::text AS id, name, stock_quantity
     FROM products
     WHERE id = ANY($1::bigint[])
     ORDER BY id
     FOR UPDATE`,
    [productIds]
  );
  if (productsResult.rows.length !== productIds.length) {
    throw new Error("ORDER_PRODUCT_UNAVAILABLE");
  }

  const reservationsResult = await client.query<{
    product_id: string;
    quantity: string | number;
  }>(
    `SELECT product_id::text AS product_id, SUM(quantity)::bigint AS quantity
     FROM payment_inventory_reservations
     WHERE product_id = ANY($1::bigint[])
       AND status = 'reserved'
       AND expires_at > NOW()
     GROUP BY product_id`,
    [productIds]
  );
  const reserved = new Map(
    reservationsResult.rows.map((row) => [row.product_id, BigInt(row.quantity)])
  );

  for (const product of productsResult.rows) {
    const quantity = quantities.get(product.id)!;
    const available = BigInt(product.stock_quantity) -
      (reserved.get(product.id) ?? BigInt(0));
    if (available < BigInt(quantity)) {
      throw new Error(`INSUFFICIENT_STOCK:${product.name}`);
    }
  }

  for (const product of productsResult.rows) {
    const quantity = quantities.get(product.id)!;
    const updated = await client.query<{ stock_quantity: number }>(
      `UPDATE products
       SET stock_quantity = stock_quantity - $2, updated_at = NOW()
       WHERE id = $1
       RETURNING stock_quantity`,
      [product.id, quantity]
    );
    const stockAfter = Number(updated.rows[0]?.stock_quantity);
    if (!Number.isSafeInteger(stockAfter) || stockAfter < 0) {
      throw new Error("INVALID_STOCK_BALANCE");
    }
    await recordInventoryMovement(client, {
      productId: product.id,
      orderId,
      movementType: "sale",
      quantityChange: -quantity,
      stockBefore: stockAfter + quantity,
      stockAfter,
      reason: `WhatsApp order #${orderId} confirmed by administrator`,
      idempotencyKey: `order:${orderId}:sale:${product.id}`,
      actor: "admin",
    });
  }
}

async function restockCancelledOrder(
  client: PoolClient,
  orderId: string
) {
  const salesResult = await client.query<{
    product_id: string;
    quantity_change: number;
  }>(
    `SELECT product_id::text AS product_id, quantity_change
     FROM inventory_movements
     WHERE order_id = $1
       AND movement_type = 'sale'
     ORDER BY product_id
     FOR UPDATE`,
    [orderId]
  );
  if (salesResult.rows.length === 0) return;

  const quantities = new Map<string, number>();
  for (const sale of salesResult.rows) {
    quantities.set(
      sale.product_id,
      (quantities.get(sale.product_id) ?? 0) + Math.abs(Number(sale.quantity_change))
    );
  }
  const productIds = [...quantities.keys()].sort((a, b) => BigInt(a) < BigInt(b) ? -1 : 1);
  const productsResult = await client.query<{
    id: string;
    stock_quantity: number;
  }>(
    `SELECT id::text AS id, stock_quantity
     FROM products
     WHERE id = ANY($1::bigint[])
     ORDER BY id
     FOR UPDATE`,
    [productIds]
  );
  if (productsResult.rows.length !== productIds.length) {
    throw new Error("ORDER_PRODUCT_UNAVAILABLE");
  }

  for (const product of productsResult.rows) {
    const quantity = quantities.get(product.id)!;
    const before = Number(product.stock_quantity);
    const after = before + quantity;
    if (!Number.isSafeInteger(after) || after > 1_000_000) {
      throw new Error("INVALID_STOCK_BALANCE");
    }
    await client.query(
      `UPDATE products
       SET stock_quantity = $1, updated_at = NOW()
       WHERE id = $2`,
      [after, product.id]
    );
    await recordInventoryMovement(client, {
      productId: product.id,
      orderId,
      movementType: "restock",
      quantityChange: quantity,
      stockBefore: before,
      stockAfter: after,
      reason: `Cancelled order #${orderId}; administrator confirmed returned items are physically available`,
      idempotencyKey: `order:${orderId}:restock:${product.id}`,
      actor: "admin",
    });
  }
}

export async function PATCH(request: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token || !(await verifyAdminSession(token))) {
    return NextResponse.json(
      { success: false, message: "Unauthorized. Please log in as an administrator." },
      { status: 401 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, message: "Invalid request body." }, { status: 400 });
  }

  if (!isObject(body)) {
    return NextResponse.json({ success: false, message: "Invalid request body." }, { status: 400 });
  }
  const orderId = Number(body.orderId);
  const status = body.status;
  if (!Number.isSafeInteger(orderId) || orderId <= 0) {
    return NextResponse.json({ success: false, message: "Invalid order ID." }, { status: 400 });
  }
  if (typeof status !== "string" || !allowedStatuses.includes(status)) {
    return NextResponse.json({ success: false, message: "Invalid order status." }, { status: 400 });
  }
  if (body.restockConfirmed !== undefined && typeof body.restockConfirmed !== "boolean") {
    return NextResponse.json({ success: false, message: "Invalid restock confirmation." }, { status: 400 });
  }

  let client: PoolClient | undefined;
  try {
    client = await pool.connect();
    await client.query("BEGIN");
    const inventorySchemaReady = await hasInventoryLifecycleSchema(client);
    const orderResult = await client.query<{
      id: string;
      status: string;
      payment_method: string | null;
      payment_status: string | null;
    }>(inventorySchemaReady ? `
       SELECT id::text AS id, status, payment_method, payment_status
       FROM orders
       WHERE id = $1
       FOR UPDATE
    ` : `
      SELECT id::text AS id, status, NULL::text AS payment_method,
             NULL::text AS payment_status
      FROM orders
      WHERE id = $1
      FOR UPDATE
    `,
      [orderId]
    );
    const order = orderResult.rows[0];
    if (!order) {
      await client.query("ROLLBACK");
      return NextResponse.json({ success: false, message: "Order not found." }, { status: 404 });
    }
    if (status === order.status) {
      await client.query("COMMIT");
      return NextResponse.json({ success: true, order: { id: order.id, status: order.status } });
    }
    if (!allowedTransitions[order.status]?.includes(status)) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { success: false, message: `Order status cannot move from ${order.status} to ${status}.` },
        { status: 409 }
      );
    }

    if (
      status === "cancelled" &&
      order.payment_status !== "paid" &&
      await hasCouponSchema(client)
    ) {
      await client.query(
        `UPDATE coupon_redemptions
         SET status = 'released', updated_at = NOW()
         WHERE order_id = $1
           AND status IN ('reserved', 'redeemed')`,
        [order.id]
      );
    }

    if (!inventorySchemaReady) {
      if (order.status === "pending" && status !== "cancelled") {
        await client.query("ROLLBACK");
        return NextResponse.json(
          {
            success: false,
            message: "Order confirmation requires the approved payment and inventory migrations so stock can be checked and recorded safely.",
          },
          { status: 409 }
        );
      }
      if (status === "cancelled" && order.status !== "pending" && body.restockConfirmed === true) {
        await client.query("ROLLBACK");
        return NextResponse.json(
          {
            success: false,
            message: "Restocking requires the approved inventory ledger migration. The order was not changed.",
          },
          { status: 409 }
        );
      }

      const updateResult = await client.query(
        `UPDATE orders
         SET status = $1
         WHERE id = $2
         RETURNING id::text AS id, status`,
        [status, order.id]
      );
      await client.query("COMMIT");
      return NextResponse.json({ success: true, order: updateResult.rows[0] });
    }

    if (order.status === "pending" && status !== "cancelled") {
      if (order.payment_method === "razorpay" && order.payment_status !== "paid") {
        await client.query("ROLLBACK");
        return NextResponse.json(
          { success: false, message: "Online payment must be captured before confirming this order." },
          { status: 409 }
        );
      }
      if (order.payment_method !== "razorpay") {
        await deductWhatsAppOrderStock(client, order.id);
      }
    }

    if (status === "cancelled" && body.restockConfirmed === true) {
      await restockCancelledOrder(client, order.id);
    }

    const updateResult = await client.query(
      `UPDATE orders
       SET status = $1
       WHERE id = $2
       RETURNING id::text AS id, status`,
      [status, order.id]
    );
    await client.query("COMMIT");
    return NextResponse.json({ success: true, order: updateResult.rows[0] });
  } catch (error) {
    if (client) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("Order status transaction could not be rolled back:", rollbackError);
      }
    }
    if (error instanceof Error && error.message.startsWith("INSUFFICIENT_STOCK:")) {
      return NextResponse.json(
        { success: false, message: `${error.message.slice("INSUFFICIENT_STOCK:".length)} does not have enough available stock to confirm this order.` },
        { status: 409 }
      );
    }
    if (error instanceof Error && error.message === "ORDER_ITEMS_MISSING_PRODUCT") {
      return NextResponse.json(
        { success: false, message: "This order's items are not linked to products. Apply the approved order-item product-reference migration before confirming it." },
        { status: 409 }
      );
    }
    if (error instanceof Error && error.message === "ORDER_PRODUCT_UNAVAILABLE") {
      return NextResponse.json(
        { success: false, message: "One or more products in this order are no longer available." },
        { status: 409 }
      );
    }
    console.error("Failed to update order status:", error);
    return NextResponse.json(
      { success: false, message: "Unable to update order status." },
      { status: 500 }
    );
  } finally {
    client?.release();
  }
}
