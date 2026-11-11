import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function GET() {
  try {
    const inventorySchemaResult = await pool.query<{ ready: boolean }>(`
      SELECT
        to_regclass('public.inventory_settings') IS NOT NULL
        AND to_regclass('public.payment_inventory_reservations') IS NOT NULL
        AS ready
    `);
    const inventoryTrackingEnabled = inventorySchemaResult.rows[0]?.ready === true;
    if (!inventoryTrackingEnabled) {
      console.warn(
        "Inventory schema is not installed; serving current product stock without checkout reservations."
      );
    }

    const result = await pool.query(inventoryTrackingEnabled ? `
      SELECT
        products.id,
        products.name,
        products.description,
        products.price_paise,
        products.image_url,
        products.category,
        GREATEST(
          products.stock_quantity - COALESCE(reservations.quantity, 0),
          0
        )::integer AS stock_quantity,
        products.stock_quantity AS on_hand_quantity,
        COALESCE(reservations.quantity, 0)::integer AS reserved_quantity,
        inventory_settings.low_stock_threshold
        , COALESCE(review_summaries.average_rating, 0) AS average_rating
        , COALESCE(review_summaries.review_count, 0) AS review_count
      FROM products
      CROSS JOIN inventory_settings
      LEFT JOIN LATERAL (
        SELECT SUM(reservation.quantity)::integer AS quantity
        FROM payment_inventory_reservations reservation
        WHERE reservation.product_id = products.id
          AND reservation.status = 'reserved'
          AND reservation.expires_at > NOW()
      ) reservations ON TRUE
      LEFT JOIN (
        SELECT
          product_id,
          AVG(rating)::numeric(3, 2) AS average_rating,
          COUNT(*)::integer AS review_count
        FROM customer_reviews
        WHERE moderation_status = 'visible'
        GROUP BY product_id
      ) review_summaries ON review_summaries.product_id = products.id
      WHERE products.is_active = TRUE
      ORDER BY products.id ASC
    ` : `
      SELECT
        products.id,
        products.name,
        products.description,
        products.price_paise,
        products.image_url,
        products.category,
        products.stock_quantity,
        products.stock_quantity AS on_hand_quantity,
        0::integer AS reserved_quantity,
        5::integer AS low_stock_threshold,
        COALESCE(review_summaries.average_rating, 0) AS average_rating,
        COALESCE(review_summaries.review_count, 0) AS review_count
      FROM products
      LEFT JOIN (
        SELECT
          product_id,
          AVG(rating)::numeric(3, 2) AS average_rating,
          COUNT(*)::integer AS review_count
        FROM customer_reviews
        WHERE moderation_status = 'visible'
        GROUP BY product_id
      ) review_summaries ON review_summaries.product_id = products.id
      WHERE products.is_active = TRUE
      ORDER BY products.id ASC
    `);

    const products = result.rows.map((product) => ({
      id: product.id.toString(),
      name: product.name,
      description: product.description,
      price: Number(product.price_paise) / 100,
      image: product.image_url,
      category: product.category,
      stockQuantity: Number(product.stock_quantity),
      onHandQuantity: Number(product.on_hand_quantity),
      reservedQuantity: Number(product.reserved_quantity),
      lowStockThreshold: Number(product.low_stock_threshold),
      averageRating: Number(product.average_rating),
      reviewCount: Number(product.review_count),
    }));

    return NextResponse.json({
      success: true,
      inventoryTrackingEnabled,
      products,
    });
  } catch (error) {
    console.error("Failed to fetch products:", error);

    return NextResponse.json(
      { success: false, message: "Unable to fetch products." },
      { status: 500 }
    );
  }
}
