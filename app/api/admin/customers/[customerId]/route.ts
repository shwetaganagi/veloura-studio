import { cookies } from "next/headers";
import { NextRequest, NextResponse, connection } from "next/server";
import { pool } from "@/lib/db";
import {
  SESSION_COOKIE_NAME,
  verifyAdminSession,
} from "@/lib/auth/admin";

async function isAdminAuthenticated() {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  return Boolean(token && (await verifyAdminSession(token)));
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ customerId: string }> }
) {
  await connection();

  if (!(await isAdminAuthenticated())) {
    return NextResponse.json(
      { success: false, message: "Administrator login required." },
      { status: 401 }
    );
  }

  const { customerId } = await context.params;
  if (!/^[1-9]\d{0,18}$/.test(customerId)) {
    return NextResponse.json(
      { success: false, message: "Customer not found." },
      { status: 404 }
    );
  }

  try {
    const [customerResult, ordersResult, addressesResult] = await Promise.all([
      pool.query(
        `SELECT c.id::text AS id,
                c.full_name AS "fullName",
                c.email,
                COALESCE(c.phone, latest_order.phone) AS phone,
                c.created_at AS "registeredAt",
                COALESCE(order_stats.total_orders, 0)::integer AS "totalOrders",
                COALESCE(order_stats.amount_spent_paise, 0)::text AS "amountSpentPaise",
                order_stats.last_purchase_at AS "lastPurchaseAt"
         FROM customers c
         LEFT JOIN LATERAL (
           SELECT COUNT(*)::integer AS total_orders,
                  COALESCE(
                    SUM(subtotal_paise) FILTER (
                      WHERE status IN ('confirmed', 'preparing', 'shipped', 'delivered')
                        AND (payment_status IS NULL OR payment_status = 'paid')
                    ),
                    0
                  )::bigint AS amount_spent_paise,
                  MAX(created_at) FILTER (
                    WHERE status IN ('confirmed', 'preparing', 'shipped', 'delivered')
                      AND (payment_status IS NULL OR payment_status = 'paid')
                  ) AS last_purchase_at
           FROM orders
           WHERE customer_id = c.id
         ) order_stats ON TRUE
         LEFT JOIN LATERAL (
           SELECT phone
           FROM orders
           WHERE customer_id = c.id AND phone IS NOT NULL AND phone <> ''
           ORDER BY created_at DESC
           LIMIT 1
         ) latest_order ON TRUE
         WHERE c.id = $1`,
        [customerId]
      ),
      pool.query(
        `SELECT
           o.id::text AS id,
           o.customer_name AS "customerName",
           o.phone,
           o.delivery_address AS "deliveryAddress",
           o.subtotal_paise::text AS "subtotalPaise",
           o.status,
           COALESCE(o.payment_status, 'not_recorded') AS "paymentStatus",
           o.payment_method AS "paymentMethod",
           o.created_at AS "createdAt",
           COALESCE(
             json_agg(
               json_build_object(
                 'productName', oi.product_name,
                 'quantity', oi.quantity,
                 'unitPricePaise', oi.unit_price_paise
               ) ORDER BY oi.id
             ) FILTER (WHERE oi.id IS NOT NULL),
             '[]'::json
           ) AS items
         FROM orders o
         LEFT JOIN order_items oi ON oi.order_id = o.id
         WHERE o.customer_id = $1
         GROUP BY o.id
         ORDER BY o.created_at DESC`,
        [customerId]
      ),
      pool.query(
        `SELECT delivery_address AS address,
                MAX(created_at) AS "lastUsedAt",
                COUNT(*)::integer AS "orderCount"
         FROM orders
         WHERE customer_id = $1
           AND delivery_address IS NOT NULL
           AND BTRIM(delivery_address) <> ''
         GROUP BY delivery_address
         ORDER BY MAX(created_at) DESC
         LIMIT 20`,
        [customerId]
      ),
    ]);

    if (customerResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, message: "Customer not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      customer: customerResult.rows[0],
      orders: ordersResult.rows,
      addresses: addressesResult.rows,
    });
  } catch (error) {
    console.error("Admin customer profile could not be loaded:", error);
    return NextResponse.json(
      { success: false, message: "Unable to load this customer profile." },
      { status: 500 }
    );
  }
}
