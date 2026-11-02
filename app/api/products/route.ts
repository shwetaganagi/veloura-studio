import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function GET() {
  try {
    const result = await pool.query(`
      SELECT
        id,
        name,
        description,
        price_paise,
        image_url,
        category,
        stock_quantity
      FROM products
      WHERE is_active = TRUE
      ORDER BY id ASC
    `);

    const products = result.rows.map((product) => ({
      id: product.id.toString(),
      name: product.name,
      description: product.description,
      price: Number(product.price_paise) / 100,
      image: product.image_url,
      category: product.category,
      stockQuantity: product.stock_quantity,
    }));

    return NextResponse.json({ success: true, products });
  } catch (error) {
    console.error("Failed to fetch products:", error);

    return NextResponse.json(
      { success: false, message: "Unable to fetch products." },
      { status: 500 }
    );
  }
}
