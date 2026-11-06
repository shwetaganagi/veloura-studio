import { NextResponse, NextRequest, connection } from "next/server";
import { pool } from "@/lib/db";
import {
  verifyCustomerSession,
  CUSTOMER_SESSION_COOKIE,
} from "@/lib/auth/customer";


export async function GET(request: NextRequest) {
  await connection();

  try {
    const token = request.cookies.get(CUSTOMER_SESSION_COOKIE)?.value;

    const session = token
      ? await verifyCustomerSession(token)
      : null;

    if (!session) {
      return NextResponse.json(
        { success: false, message: "Please log in to view your orders." },
        { status: 401 }
      );
    }

    const result = await pool.query(
      `SELECT
         o.id,
         o.customer_name,
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
       WHERE o.customer_id = $1
       GROUP BY o.id
       ORDER BY o.created_at DESC`,
      [session.customerId]
    );

    const orders = result.rows.map((order) => ({
      id: String(order.id),
      customerName: order.customer_name,
      total: Number(order.subtotal_paise) / 100,
      status: order.status,
      createdAt: order.created_at,
      items: order.items.map((item: {
        productName: string;
        quantity: number;
        unitPricePaise: number;
      }) => ({
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: Number(item.unitPricePaise) / 100,
      })),
    }));

    return NextResponse.json({
      success: true,
      orders,
    });
  } catch (error) {
    console.error("Customer orders error:", error);

    return NextResponse.json(
      { success: false, message: "Unable to load your orders." },
      { status: 500 }
    );
  }
}