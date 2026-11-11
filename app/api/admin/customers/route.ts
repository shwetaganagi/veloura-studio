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

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, "\\$&");
}

const SORT_EXPRESSIONS: Record<string, string> = {
  recent: "c.created_at DESC, c.id DESC",
  oldest: "c.created_at ASC, c.id ASC",
  orders: '"totalOrders" DESC, c.created_at DESC',
  spent: '"amountSpentPaise" DESC, c.created_at DESC',
  name: "LOWER(c.full_name) ASC, c.id ASC",
};

export async function GET(request: NextRequest) {
  await connection();

  if (!(await isAdminAuthenticated())) {
    return NextResponse.json(
      { success: false, message: "Administrator login required." },
      { status: 401 }
    );
  }

  const search = (request.nextUrl.searchParams.get("search") ?? "").trim().slice(0, 100);
  const segment = request.nextUrl.searchParams.get("segment") ?? "all";
  const sort = request.nextUrl.searchParams.get("sort") ?? "recent";
  const parsedPage = Number(request.nextUrl.searchParams.get("page") ?? 1);
  const page = Number.isSafeInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const pageSize = 25;

  if (!["all", "new", "repeat"].includes(segment) || !SORT_EXPRESSIONS[sort]) {
    return NextResponse.json(
      { success: false, message: "Invalid customer filters." },
      { status: 400 }
    );
  }

  const values: (string | number)[] = [];
  const predicates: string[] = [];
  if (search) {
    values.push(`%${escapeLike(search)}%`);
    predicates.push(
      `(c.full_name ILIKE $${values.length} ESCAPE '\\' OR c.email ILIKE $${values.length} ESCAPE '\\' OR COALESCE(c.phone, order_stats.latest_phone, '') ILIKE $${values.length} ESCAPE '\\')`
    );
  }
  if (segment === "new") {
    predicates.push("c.created_at >= NOW() - INTERVAL '30 days'");
  } else if (segment === "repeat") {
    predicates.push("COALESCE(order_stats.total_orders, 0) >= 2");
  }
  const whereClause = predicates.length ? `WHERE ${predicates.join(" AND ")}` : "";

  try {
    const [summaryResult, countResult] = await Promise.all([
      pool.query(
        `WITH order_stats AS (
           SELECT customer_id, COUNT(*)::integer AS total_orders
           FROM orders
           WHERE customer_id IS NOT NULL
           GROUP BY customer_id
         )
         SELECT
           (SELECT COUNT(*)::integer FROM customers) AS "totalCustomers",
           (SELECT COUNT(*)::integer FROM customers
            WHERE created_at >= NOW() - INTERVAL '30 days') AS "newCustomers",
           (SELECT COUNT(*)::integer FROM order_stats
            WHERE total_orders >= 2) AS "repeatCustomers",
           COALESCE((SELECT SUM(total_orders)::integer FROM order_stats), 0)
             AS "totalCustomerOrders"`
      ),
      pool.query(
        `WITH order_stats AS (
           SELECT customer_id,
                  COUNT(*)::integer AS total_orders,
                    (ARRAY_AGG(phone ORDER BY created_at DESC)
                      FILTER (WHERE phone IS NOT NULL AND phone <> ''))[1] AS latest_phone,
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
           WHERE customer_id IS NOT NULL
           GROUP BY customer_id
         )
         SELECT COUNT(*)::integer AS total
         FROM customers c
         LEFT JOIN order_stats ON order_stats.customer_id = c.id
         ${whereClause}`,
        values
      ),
    ]);

    const total = Number(countResult.rows[0].total);
    const offset = (page - 1) * pageSize;
    const listValues = [...values, pageSize, offset];
    const listResult = await pool.query(
      `WITH order_stats AS (
         SELECT customer_id,
                COUNT(*)::integer AS total_orders,
                (ARRAY_AGG(phone ORDER BY created_at DESC)
                  FILTER (WHERE phone IS NOT NULL AND phone <> ''))[1] AS latest_phone,
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
         WHERE customer_id IS NOT NULL
         GROUP BY customer_id
       )
       SELECT
         c.id::text AS id,
         c.full_name AS "fullName",
         c.email,
         COALESCE(c.phone, order_stats.latest_phone) AS phone,
         c.created_at AS "registeredAt",
         COALESCE(order_stats.total_orders, 0)::integer AS "totalOrders",
         COALESCE(order_stats.amount_spent_paise, 0)::bigint AS "amountSpentPaise",
         order_stats.last_purchase_at AS "lastPurchaseAt"
       FROM customers c
       LEFT JOIN order_stats ON order_stats.customer_id = c.id
       ${whereClause}
       ORDER BY ${SORT_EXPRESSIONS[sort]}
       LIMIT $${listValues.length - 1} OFFSET $${listValues.length}`,
      listValues
    );

    return NextResponse.json({
      success: true,
      customers: listResult.rows,
      summary: summaryResult.rows[0],
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (error) {
    console.error("Admin customers could not be loaded:", error);
    return NextResponse.json(
      { success: false, message: "Unable to load customer records." },
      { status: 500 }
    );
  }
}
