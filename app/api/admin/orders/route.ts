
import { NextResponse, connection } from "next/server";
import { cookies } from "next/headers";
import { pool } from "@/lib/db";
import {
  SESSION_COOKIE_NAME,
  verifyAdminSession,
} from "@/lib/auth/admin";

export async function GET() {
  await connection();
  try {
    // Ensure this handler runs at request time.

    // 1. Read the admin session cookie.
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    // 2. Reject requests without a valid admin session.
    if (!token || !(await verifyAdminSession(token))) {
      return NextResponse.json(
        {
          success: false,
          message: "Unauthorized. Please log in as an administrator.",
        },
        { status: 401 }
      );
    }

    // 3. Fetch orders only after authentication succeeds.
    const result = await pool.query(`
      SELECT
        o.id,
        o.customer_name,
        o.phone,
        o.delivery_address,
        o.customization_notes,
        o.subtotal_paise,
        o.status,
        o.created_at,
        COALESCE(
          json_agg(
            json_build_object(
              'productName', oi.product_name,
              'quantity', oi.quantity,
              'unitPricePaise', oi.unit_price_paise
            )
          ) FILTER (WHERE oi.id IS NOT NULL),
          '[]'::json
        ) AS items
      FROM orders o
      LEFT JOIN order_items oi ON oi.order_id = o.id
      GROUP BY o.id
      ORDER BY o.created_at DESC;
    `);

    // 4. Return orders to the authenticated administrator.
    return NextResponse.json({
      success: true,
      orders: result.rows,
    });
  } catch (error) {
    console.error("Failed to fetch admin orders:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to retrieve orders.",
      },
      { status: 500 }
    );
  }
}
