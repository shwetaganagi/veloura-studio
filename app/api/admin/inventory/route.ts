import { NextRequest, NextResponse, connection } from "next/server";
import { cookies } from "next/headers";
import type { PoolClient } from "pg";
import {
  SESSION_COOKIE_NAME,
  verifyAdminSession,
} from "@/lib/auth/admin";
import { pool } from "@/lib/db";
import { isJsonObject } from "@/lib/reviews/validation";

type LockedProduct = {
  id: string;
  name: string;
  stock_quantity: number;
};

async function isAdminAuthenticated() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  return Boolean(token && (await verifyAdminSession(token)));
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ success: false, message }, { status });
}

export async function GET(request: NextRequest) {
  await connection();
  if (!(await isAdminAuthenticated())) {
    return jsonError("Administrator login required.", 401);
  }

  const search = (request.nextUrl.searchParams.get("search") ?? "").trim().slice(0, 100);
  const category = (request.nextUrl.searchParams.get("category") ?? "").trim().slice(0, 100);

  try {
    const [settingsResult, productsResult, movementsResult] = await Promise.all([
      pool.query(
        `SELECT low_stock_threshold AS "lowStockThreshold"
         FROM inventory_settings
         WHERE id = 1`
      ),
      pool.query(
        `SELECT
           product.id::text AS id,
           product.name,
           product.category,
           product.price_paise::text AS "pricePaise",
           product.image_url AS image,
           product.stock_quantity AS "stockQuantity",
           COALESCE(reservations.quantity, 0)::integer AS "reservedQuantity",
           GREATEST(product.stock_quantity - COALESCE(reservations.quantity, 0), 0)::integer AS "availableQuantity"
         FROM products product
         LEFT JOIN LATERAL (
           SELECT SUM(reservation.quantity)::integer AS quantity
           FROM payment_inventory_reservations reservation
           WHERE reservation.product_id = product.id
             AND reservation.status = 'reserved'
             AND reservation.expires_at > NOW()
         ) reservations ON TRUE
         WHERE product.is_active = TRUE
           AND ($1::text = '' OR product.name ILIKE '%' || $1 || '%')
           AND ($2::text = '' OR product.category = $2)
         ORDER BY product.name, product.id`,
        [search, category]
      ),
      pool.query(
        `SELECT
           movement.id::text AS id,
           movement.product_id::text AS "productId",
           product.name AS "productName",
           movement.order_id::text AS "orderId",
           movement.movement_type AS "movementType",
           movement.quantity_change AS "quantityChange",
           movement.stock_before AS "stockBefore",
           movement.stock_after AS "stockAfter",
           movement.reason,
           movement.actor,
           movement.created_at AS "createdAt"
         FROM inventory_movements movement
         JOIN products product ON product.id = movement.product_id
         ORDER BY movement.created_at DESC, movement.id DESC
         LIMIT 100`
      ),
    ]);

    const threshold = Number(settingsResult.rows[0]?.lowStockThreshold);
    if (!Number.isSafeInteger(threshold) || threshold < 0) {
      throw new Error("Inventory low-stock threshold is missing or invalid.");
    }

    const allProductsResult = await pool.query(
      `SELECT
         COUNT(*)::integer AS "totalProducts",
         COALESCE(SUM(GREATEST(product.stock_quantity - COALESCE(reservations.quantity, 0), 0)), 0)::integer AS "availableStock",
         COUNT(*) FILTER (
           WHERE GREATEST(product.stock_quantity - COALESCE(reservations.quantity, 0), 0) > 0
             AND GREATEST(product.stock_quantity - COALESCE(reservations.quantity, 0), 0) <= $1
         )::integer AS "lowStockProducts",
         COUNT(*) FILTER (
           WHERE GREATEST(product.stock_quantity - COALESCE(reservations.quantity, 0), 0) = 0
         )::integer AS "outOfStockProducts"
       FROM products product
       LEFT JOIN LATERAL (
         SELECT SUM(reservation.quantity)::integer AS quantity
         FROM payment_inventory_reservations reservation
         WHERE reservation.product_id = product.id
           AND reservation.status = 'reserved'
           AND reservation.expires_at > NOW()
       ) reservations ON TRUE
       WHERE product.is_active = TRUE`,
      [threshold]
    );

    const categoriesResult = await pool.query(
      `SELECT DISTINCT category
       FROM products
       WHERE is_active = TRUE AND category IS NOT NULL
       ORDER BY category`
    );

    return NextResponse.json({
      success: true,
      lowStockThreshold: threshold,
      stats: allProductsResult.rows[0],
      categories: categoriesResult.rows.map((row) => row.category as string),
      products: productsResult.rows,
      movements: movementsResult.rows,
    });
  } catch (error) {
    console.error("Admin inventory could not be loaded:", error);
    return jsonError("Unable to load inventory. Check the inventory migrations.", 500);
  }
}

export async function PATCH(request: NextRequest) {
  await connection();
  if (!(await isAdminAuthenticated())) {
    return jsonError("Administrator login required.", 401);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid inventory settings request.", 400);
  }

  if (
    !isJsonObject(body) ||
    !Number.isSafeInteger(body.lowStockThreshold) ||
    Number(body.lowStockThreshold) < 0 ||
    Number(body.lowStockThreshold) > 1_000_000
  ) {
    return jsonError("Low-stock threshold must be a whole number from 0 to 1,000,000.", 400);
  }

  try {
    const result = await pool.query(
      `UPDATE inventory_settings
       SET low_stock_threshold = $1, updated_at = NOW()
       WHERE id = 1
       RETURNING low_stock_threshold AS "lowStockThreshold"`,
      [Number(body.lowStockThreshold)]
    );
    if (result.rows.length === 0) {
      throw new Error("Inventory settings row is missing.");
    }
    return NextResponse.json({ success: true, settings: result.rows[0] });
  } catch (error) {
    console.error("Inventory low-stock threshold could not be updated:", error);
    return jsonError("Unable to save the low-stock threshold.", 500);
  }
}

export async function POST(request: NextRequest) {
  await connection();
  if (!(await isAdminAuthenticated())) {
    return jsonError("Administrator login required.", 401);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid inventory update.", 400);
  }

  if (!isJsonObject(body)) {
    return jsonError("Invalid inventory update.", 400);
  }

  const productId = Number(body.productId);
  const expectedStock = Number(body.expectedStock);
  const quantity = Number(body.quantity);
  const action = body.action;
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  const idempotencyKey =
    typeof body.idempotencyKey === "string" ? body.idempotencyKey : "";

  if (!Number.isSafeInteger(productId) || productId <= 0) {
    return jsonError("Choose a valid product.", 400);
  }
  if (
    !Number.isSafeInteger(expectedStock) ||
    expectedStock < 0 ||
    expectedStock > 1_000_000
  ) {
    return jsonError("Refresh inventory and try again with a valid current stock value.", 400);
  }
  if (action !== "receive" && action !== "adjust") {
    return jsonError("Choose a valid stock action.", 400);
  }
  if (
    !Number.isSafeInteger(quantity) ||
    quantity < (action === "receive" ? 1 : 0) ||
    quantity > 1_000_000
  ) {
    return jsonError(
      action === "receive"
        ? "Stock received must be a whole number between 1 and 1,000,000."
        : "Stock quantity must be a whole number between 0 and 1,000,000.",
      400
    );
  }
  if (reason.length < 3 || reason.length > 500) {
    return jsonError("Enter a reason between 3 and 500 characters.", 400);
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(idempotencyKey)) {
    return jsonError("Invalid stock update request key.", 400);
  }

  let client: PoolClient | undefined;
  try {
    client = await pool.connect();
    await client.query("BEGIN");
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
      [`inventory:${idempotencyKey}`]
    );

    const priorMovement = await client.query(
      `SELECT product_id::text AS "productId",
              movement_type AS "movementType",
              quantity_change AS "quantityChange",
              stock_after AS "stockAfter",
              reason
       FROM inventory_movements
       WHERE idempotency_key = $1`,
      [`admin:${idempotencyKey}`]
    );
    if (priorMovement.rows.length > 0) {
      const previous = priorMovement.rows[0];
      const requestedType = action === "receive" ? "production" : "adjustment";
      const requestedChange =
        action === "receive"
          ? quantity
          : null;
      if (
        String(previous.productId) !== String(productId) ||
        previous.movementType !== requestedType ||
        previous.reason !== reason ||
        (requestedChange !== null &&
          Number(previous.quantityChange) !== requestedChange) ||
        (requestedChange === null && Number(previous.stockAfter) !== quantity)
      ) {
        await client.query("ROLLBACK");
        return jsonError("This update key was already used for a different stock change.", 409);
      }
      await client.query("COMMIT");
      return NextResponse.json({ success: true, duplicate: true });
    }

    const productResult = await client.query<LockedProduct>(
      `SELECT id, name, stock_quantity
       FROM products
       WHERE id = $1 AND is_active = TRUE
       FOR UPDATE`,
      [productId]
    );
    const product = productResult.rows[0];
    if (!product) {
      await client.query("ROLLBACK");
      return jsonError("Product not found.", 404);
    }

    const before = Number(product.stock_quantity);
    if (before !== expectedStock) {
      await client.query("ROLLBACK");
      return jsonError(
        "Stock changed since this page loaded. Inventory has been refreshed; review the current quantity before trying again.",
        409
      );
    }
    const after = action === "receive" ? before + quantity : quantity;
    if (!Number.isSafeInteger(after) || after > 1_000_000) {
      await client.query("ROLLBACK");
      return jsonError("The resulting stock quantity is too large.", 400);
    }
    if (action === "adjust") {
      const reservations = await client.query(
        `SELECT COALESCE(SUM(quantity), 0)::integer AS quantity
         FROM payment_inventory_reservations
         WHERE product_id = $1
           AND status = 'reserved'
           AND expires_at > NOW()`,
        [productId]
      );
      if (after < Number(reservations.rows[0].quantity)) {
        await client.query("ROLLBACK");
        return jsonError("Stock cannot be adjusted below quantities reserved for online checkout.", 409);
      }
    }

    const delta = after - before;
    if (delta === 0) {
      await client.query("ROLLBACK");
      return jsonError("Stock is already at that quantity; no adjustment was recorded.", 409);
    }

    await client.query(
      `UPDATE products
       SET stock_quantity = $1, updated_at = NOW()
       WHERE id = $2`,
      [after, productId]
    );
    const movement = await client.query(
      `INSERT INTO inventory_movements (
         product_id, movement_type, quantity_change, stock_before,
         stock_after, reason, idempotency_key, actor
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'admin')
       RETURNING id::text`,
      [
        productId,
        action === "receive" ? "production" : "adjustment",
        delta,
        before,
        after,
        reason,
        `admin:${idempotencyKey}`,
      ]
    );

    await client.query("COMMIT");
    return NextResponse.json(
      {
        success: true,
        movementId: movement.rows[0].id,
        product: { id: String(product.id), name: product.name, stockQuantity: after },
      },
      { status: 201 }
    );
  } catch (error) {
    if (client) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("Inventory update transaction could not be rolled back:", rollbackError);
      }
    }
    console.error("Inventory stock could not be updated:", error);
    return jsonError("Unable to update stock.", 500);
  } finally {
    client?.release();
  }
}
