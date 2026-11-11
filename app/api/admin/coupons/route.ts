import { cookies } from "next/headers";
import { NextRequest, NextResponse, connection } from "next/server";
import { pool } from "@/lib/db";
import {
  SESSION_COOKIE_NAME,
  verifyAdminSession,
} from "@/lib/auth/admin";
import { normalizeCouponCode } from "@/lib/coupons";
import type { PoolClient } from "pg";

type CouponInput = {
  code: string;
  discountType: "percentage" | "fixed";
  discountValue: number;
  minimumOrderPaise: number;
  maximumDiscountPaise: number | null;
  startsAt: Date;
  expiresAt: Date;
  usageLimit: number | null;
  perCustomerLimit: number;
  isActive: boolean;
};

async function isAdminAuthenticated() {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  return Boolean(token && (await verifyAdminSession(token)));
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseRupees(value: unknown, nullable = false): number | null {
  if (nullable && (value === null || value === "")) return null;
  if (typeof value !== "string" && typeof value !== "number") return Number.NaN;
  const stringValue = String(value).trim();
  if (!/^\d{1,9}(?:\.\d{1,2})?$/.test(stringValue)) return Number.NaN;
  const amount = Math.round(Number(stringValue) * 100);
  return Number.isSafeInteger(amount) ? amount : Number.NaN;
}

function parseLimit(value: unknown, nullable = false) {
  if (nullable && (value === null || value === "")) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : Number.NaN;
}

function parseCouponInput(value: unknown): CouponInput | null {
  if (!isObject(value)) return null;
  const code = normalizeCouponCode(value.code);
  const discountType = value.discountType;
  const discountValue =
    discountType === "percentage"
      ? Number(value.discountValue)
      : parseRupees(value.discountValue);
  const minimumOrderPaise = parseRupees(value.minimumOrder);
  const maximumDiscountPaise = parseRupees(value.maximumDiscount, true);
  const startsAt =
    typeof value.startsAt === "string" ? new Date(value.startsAt) : new Date(Number.NaN);
  const expiresAt =
    typeof value.expiresAt === "string" ? new Date(value.expiresAt) : new Date(Number.NaN);
  const usageLimit = parseLimit(value.usageLimit, true);
  const perCustomerLimit = parseLimit(value.perCustomerLimit);
  const isActive = value.isActive;

  if (
    !/^[A-Z0-9][A-Z0-9_-]{2,39}$/.test(code) ||
    (discountType !== "percentage" && discountType !== "fixed") ||
    typeof discountValue !== "number" ||
    !Number.isSafeInteger(discountValue) ||
    discountValue <= 0 ||
    (discountType === "percentage" && discountValue > 100) ||
    typeof minimumOrderPaise !== "number" ||
    !Number.isSafeInteger(minimumOrderPaise) ||
    minimumOrderPaise < 0 ||
    (maximumDiscountPaise !== null &&
      (!Number.isSafeInteger(maximumDiscountPaise) || maximumDiscountPaise <= 0)) ||
    Number.isNaN(startsAt.getTime()) ||
    Number.isNaN(expiresAt.getTime()) ||
    expiresAt <= startsAt ||
    (usageLimit !== null &&
      (!Number.isSafeInteger(usageLimit) || usageLimit <= 0)) ||
    typeof perCustomerLimit !== "number" ||
    !Number.isSafeInteger(perCustomerLimit) ||
    perCustomerLimit < 1 ||
    perCustomerLimit > 1_000_000 ||
    typeof isActive !== "boolean"
  ) {
    return null;
  }

  return {
    code,
    discountType,
    discountValue,
    minimumOrderPaise,
    maximumDiscountPaise,
    startsAt,
    expiresAt,
    usageLimit,
    perCustomerLimit,
    isActive,
  };
}

const COUPON_SELECT = `
  SELECT c.id::text AS id, c.code, c.discount_type AS "discountType",
         c.discount_value AS "discountValue",
         c.minimum_order_paise::text AS "minimumOrderPaise",
         c.maximum_discount_paise::text AS "maximumDiscountPaise",
         c.starts_at AS "startsAt", c.expires_at AS "expiresAt",
         c.usage_limit AS "usageLimit",
         c.per_customer_limit AS "perCustomerLimit",
         c.is_active AS "isActive", c.created_at AS "createdAt",
         COUNT(r.id) FILTER (
           WHERE r.status = 'redeemed'
             OR (r.status = 'reserved' AND r.expires_at > NOW())
         )::integer AS "usedCount",
         COALESCE(SUM(r.discount_paise) FILTER (
           WHERE r.status = 'redeemed'
         ), 0)::text AS "discountGivenPaise",
         CASE
           WHEN NOT c.is_active THEN 'inactive'
           WHEN c.starts_at > NOW() THEN 'scheduled'
           WHEN c.expires_at <= NOW() THEN 'expired'
           WHEN c.usage_limit IS NOT NULL AND COUNT(r.id) FILTER (
             WHERE r.status = 'redeemed'
               OR (r.status = 'reserved' AND r.expires_at > NOW())
           ) >= c.usage_limit THEN 'used_up'
           ELSE 'active'
         END AS status
  FROM coupons c
  LEFT JOIN coupon_redemptions r ON r.coupon_id = c.id
`;

const COUPON_GROUP = `
  GROUP BY c.id
`;

export async function GET(request: NextRequest) {
  await connection();
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json(
      { success: false, message: "Administrator login required." },
      { status: 401 }
    );
  }

  const search = (request.nextUrl.searchParams.get("search") ?? "").trim().slice(0, 100);
  const status = request.nextUrl.searchParams.get("status") ?? "all";
  if (!["all", "active", "expired", "scheduled", "inactive", "used_up"].includes(status)) {
    return NextResponse.json(
      { success: false, message: "Invalid coupon filter." },
      { status: 400 }
    );
  }

  const filters: string[] = [];
  const params: string[] = [];
  if (search) {
    params.push(`%${search.replace(/[\\%_]/g, "\\$&")}%`);
    filters.push(`c.code ILIKE $${params.length} ESCAPE '\\'`);
  }
  if (status !== "all") {
    filters.push(
      status === "active"
        ? "c.is_active AND c.starts_at <= NOW() AND c.expires_at > NOW() AND (c.usage_limit IS NULL OR (SELECT COUNT(*) FROM coupon_redemptions active_r WHERE active_r.coupon_id = c.id AND (active_r.status = 'redeemed' OR (active_r.status = 'reserved' AND active_r.expires_at > NOW()))) < c.usage_limit)"
        : status === "expired"
          ? "c.expires_at <= NOW()"
          : status === "scheduled"
            ? "c.is_active AND c.starts_at > NOW()"
            : status === "used_up"
              ? "c.is_active AND c.usage_limit IS NOT NULL AND (SELECT COUNT(*) FROM coupon_redemptions used_r WHERE used_r.coupon_id = c.id AND (used_r.status = 'redeemed' OR (used_r.status = 'reserved' AND used_r.expires_at > NOW()))) >= c.usage_limit"
              : "NOT c.is_active"
    );
  }
  const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

  try {
    const [stats, coupons] = await Promise.all([
      pool.query(
        `SELECT
           (SELECT COUNT(*)::integer FROM coupons) AS "totalCoupons",
           (SELECT COUNT(*)::integer
            FROM coupons c
            WHERE c.is_active
              AND c.starts_at <= NOW()
              AND c.expires_at > NOW()
              AND (
                c.usage_limit IS NULL
                OR (
                  SELECT COUNT(*)
                  FROM coupon_redemptions active_r
                  WHERE active_r.coupon_id = c.id
                    AND (
                      active_r.status = 'redeemed'
                      OR (active_r.status = 'reserved' AND active_r.expires_at > NOW())
                    )
                ) < c.usage_limit
              )
           ) AS "activeCoupons",
           (SELECT COUNT(*)::integer
            FROM coupons
            WHERE expires_at <= NOW()) AS "expiredCoupons",
           (SELECT COALESCE(SUM(discount_paise), 0)::text
            FROM coupon_redemptions
            WHERE status = 'redeemed') AS "totalDiscountsPaise"`
      ),
      pool.query(
        `${COUPON_SELECT}
         ${where}
         ${COUPON_GROUP}
         ORDER BY c.created_at DESC, c.id DESC
         LIMIT 500`,
        params
      ),
    ]);

    return NextResponse.json({
      success: true,
      coupons: coupons.rows,
      summary: stats.rows[0],
    });
  } catch (error) {
    console.error("Admin coupons could not be loaded:", error);
    return NextResponse.json(
      { success: false, message: "Unable to load coupons. Confirm the approved coupon migration is installed." },
      { status: 500 }
    );
  }
}

async function authenticateWrite() {
  return isAdminAuthenticated();
}

function databaseErrorCode(error: unknown) {
  return isObject(error) && typeof error.code === "string" ? error.code : "";
}

export async function POST(request: NextRequest) {
  await connection();
  if (!(await authenticateWrite())) {
    return NextResponse.json(
      { success: false, message: "Administrator login required." },
      { status: 401 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, message: "Invalid coupon details." },
      { status: 400 }
    );
  }
  const input = parseCouponInput(body);
  if (!input) {
    return NextResponse.json(
      { success: false, message: "Check the coupon code, discount, limits and date range." },
      { status: 400 }
    );
  }

  try {
    const result = await pool.query(
      `INSERT INTO coupons (
         code, discount_type, discount_value, minimum_order_paise,
         maximum_discount_paise, starts_at, expires_at, usage_limit,
         per_customer_limit, is_active
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id::text AS id`,
      [
        input.code,
        input.discountType,
        input.discountValue,
        input.minimumOrderPaise,
        input.maximumDiscountPaise,
        input.startsAt,
        input.expiresAt,
        input.usageLimit,
        input.perCustomerLimit,
        input.isActive,
      ]
    );
    return NextResponse.json(
      { success: true, couponId: result.rows[0].id },
      { status: 201 }
    );
  } catch (error) {
    if (databaseErrorCode(error) === "23505") {
      return NextResponse.json(
        { success: false, message: "A coupon with this code already exists." },
        { status: 409 }
      );
    }
    console.error("Admin coupon could not be created:", error);
    return NextResponse.json(
      { success: false, message: "Unable to create coupon." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  await connection();
  if (!(await authenticateWrite())) {
    return NextResponse.json(
      { success: false, message: "Administrator login required." },
      { status: 401 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, message: "Invalid coupon details." },
      { status: 400 }
    );
  }
  if (!isObject(body) || !/^[1-9]\d{0,18}$/.test(String(body.id ?? ""))) {
    return NextResponse.json(
      { success: false, message: "Choose a valid coupon." },
      { status: 400 }
    );
  }
  const input = parseCouponInput(body);
  if (!input) {
    return NextResponse.json(
      { success: false, message: "Check the coupon code, discount, limits and date range." },
      { status: 400 }
    );
  }

  let client: PoolClient | undefined;
  try {
    client = await pool.connect();
    await client.query("BEGIN");
    const current = await client.query<{ code: string }>(
      `SELECT code FROM coupons WHERE id = $1 FOR UPDATE`,
      [body.id]
    );
    if (!current.rows[0]) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { success: false, message: "Coupon not found." },
        { status: 404 }
      );
    }
    if (current.rows[0].code !== input.code) {
      const history = await client.query(
        "SELECT 1 FROM coupon_redemptions WHERE coupon_id = $1 LIMIT 1",
        [body.id]
      );
      if (history.rows.length) {
        await client.query("ROLLBACK");
        return NextResponse.json(
          { success: false, message: "Coupon code cannot be changed after it has redemption history." },
          { status: 409 }
        );
      }
    }
    await client.query(
      `UPDATE coupons
       SET code = $1, discount_type = $2, discount_value = $3,
           minimum_order_paise = $4, maximum_discount_paise = $5,
           starts_at = $6, expires_at = $7, usage_limit = $8,
           per_customer_limit = $9, is_active = $10, updated_at = NOW()
       WHERE id = $11`,
      [
        input.code,
        input.discountType,
        input.discountValue,
        input.minimumOrderPaise,
        input.maximumDiscountPaise,
        input.startsAt,
        input.expiresAt,
        input.usageLimit,
        input.perCustomerLimit,
        input.isActive,
        body.id,
      ]
    );
    await client.query("COMMIT");
    return NextResponse.json({ success: true });
  } catch (error) {
    if (client) await client.query("ROLLBACK").catch(() => undefined);
    if (databaseErrorCode(error) === "23505") {
      return NextResponse.json(
        { success: false, message: "A coupon with this code already exists." },
        { status: 409 }
      );
    }
    console.error("Admin coupon could not be updated:", error);
    return NextResponse.json(
      { success: false, message: "Unable to update coupon." },
      { status: 500 }
    );
  } finally {
    client?.release();
  }
}

export async function DELETE(request: NextRequest) {
  await connection();
  if (!(await authenticateWrite())) {
    return NextResponse.json(
      { success: false, message: "Administrator login required." },
      { status: 401 }
    );
  }
  const id = request.nextUrl.searchParams.get("id") ?? "";
  if (!/^[1-9]\d{0,18}$/.test(id)) {
    return NextResponse.json(
      { success: false, message: "Choose a valid coupon." },
      { status: 400 }
    );
  }

  let client: PoolClient | undefined;
  try {
    client = await pool.connect();
    await client.query("BEGIN");
    const coupon = await client.query(
      "SELECT id FROM coupons WHERE id = $1 FOR UPDATE",
      [id]
    );
    if (!coupon.rows.length) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { success: false, message: "Coupon not found." },
        { status: 404 }
      );
    }
    const history = await client.query(
      "SELECT 1 FROM coupon_redemptions WHERE coupon_id = $1 LIMIT 1",
      [id]
    );
    if (history.rows.length) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { success: false, message: "This coupon has redemption history and cannot be deleted. Deactivate it instead." },
        { status: 409 }
      );
    }
    await client.query("DELETE FROM coupons WHERE id = $1", [id]);
    await client.query("COMMIT");
    return NextResponse.json({ success: true });
  } catch (error) {
    if (client) await client.query("ROLLBACK").catch(() => undefined);
    console.error("Admin coupon could not be deleted:", error);
    return NextResponse.json(
      { success: false, message: "Unable to delete coupon." },
      { status: 500 }
    );
  } finally {
    client?.release();
  }
}
