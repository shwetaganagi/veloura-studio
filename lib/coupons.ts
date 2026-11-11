import "server-only";

import { createHash } from "node:crypto";
import type { PoolClient } from "pg";

type CouponDatabase = Pick<PoolClient, "query">;

type CouponRow = {
  id: string;
  code: string;
  discount_type: "percentage" | "fixed";
  discount_value: number;
  minimum_order_paise: string | number;
  maximum_discount_paise: string | number | null;
  starts_at: Date | string;
  expires_at: Date | string;
  usage_limit: number | null;
  per_customer_limit: number;
  is_active: boolean;
};

export type CouponErrorCode =
  | "SCHEMA_UNAVAILABLE"
  | "INVALID_CODE"
  | "INACTIVE"
  | "NOT_STARTED"
  | "EXPIRED"
  | "MINIMUM_NOT_MET"
  | "USAGE_LIMIT_REACHED"
  | "CUSTOMER_LIMIT_REACHED"
  | "ZERO_TOTAL";

export class CouponValidationError extends Error {
  constructor(
    public readonly code: CouponErrorCode,
    message: string
  ) {
    super(message);
    this.name = "CouponValidationError";
  }
}

export type ValidCoupon = {
  id: string;
  code: string;
  discountType: "percentage" | "fixed";
  discountValue: number;
  minimumOrderPaise: number;
  maximumDiscountPaise: number | null;
  startsAt: Date;
  expiresAt: Date;
  usageLimit: number | null;
  perCustomerLimit: number;
  discountPaise: number;
};

export function normalizeCouponCode(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim().toUpperCase();
}

export async function hasCouponSchema(database: CouponDatabase) {
  const result = await database.query<{ available: boolean }>(
    `SELECT to_regclass('public.coupons') IS NOT NULL
       AND to_regclass('public.coupon_redemptions') IS NOT NULL AS available`
  );
  return result.rows[0]?.available === true;
}

export function getCouponCustomerKey(customerId: string | null, phone: string) {
  const identity = customerId
    ? `customer:${customerId}`
    : `phone:${phone.replace(/\D/g, "")}`;
  if (identity === "phone:") return null;
  return createHash("sha256").update(identity).digest("hex");
}

export async function validateCoupon(
  database: CouponDatabase,
  options: {
    code: string;
    subtotalPaise: number;
    customerKey: string | null;
    lock?: boolean;
  }
): Promise<ValidCoupon> {
  const code = normalizeCouponCode(options.code);
  if (!/^[A-Z0-9][A-Z0-9_-]{2,39}$/.test(code)) {
    throw new CouponValidationError("INVALID_CODE", "Enter a valid coupon code.");
  }
  if (!Number.isSafeInteger(options.subtotalPaise) || options.subtotalPaise <= 0) {
    throw new CouponValidationError("INVALID_CODE", "Your order total is invalid.");
  }

  const result = await database.query<CouponRow>(
    `SELECT id::text AS id, code, discount_type, discount_value,
            minimum_order_paise, maximum_discount_paise, starts_at,
            expires_at, usage_limit, per_customer_limit, is_active
     FROM coupons
     WHERE code = $1
     ${options.lock ? "FOR UPDATE" : ""}`,
    [code]
  );
  const row = result.rows[0];
  if (!row) {
    throw new CouponValidationError("INVALID_CODE", "This coupon code is not valid.");
  }
  if (!row.is_active) {
    throw new CouponValidationError("INACTIVE", "This coupon is not currently active.");
  }

  const now = Date.now();
  const startsAt = new Date(row.starts_at);
  const expiresAt = new Date(row.expires_at);
  if (startsAt.getTime() > now) {
    throw new CouponValidationError("NOT_STARTED", "This coupon is not available yet.");
  }
  if (expiresAt.getTime() <= now) {
    throw new CouponValidationError("EXPIRED", "This coupon has expired.");
  }

  const minimumOrderPaise = Number(row.minimum_order_paise);
  const maximumDiscountPaise =
    row.maximum_discount_paise === null
      ? null
      : Number(row.maximum_discount_paise);
  if (options.subtotalPaise < minimumOrderPaise) {
    throw new CouponValidationError(
      "MINIMUM_NOT_MET",
      `Add ${formatCouponRupees(minimumOrderPaise - options.subtotalPaise)} more to use this coupon.`
    );
  }

  const usageResult = await database.query<{ usage_count: number }>(
    `SELECT COUNT(*)::integer AS usage_count
     FROM coupon_redemptions
     WHERE coupon_id = $1
       AND (
         status = 'redeemed'
         OR (status = 'reserved' AND expires_at > NOW())
       )`,
    [row.id]
  );
  if (
    row.usage_limit !== null &&
    Number(usageResult.rows[0].usage_count) >= row.usage_limit
  ) {
    throw new CouponValidationError("USAGE_LIMIT_REACHED", "This coupon has reached its usage limit.");
  }

  if (options.customerKey) {
    const customerUsageResult = await database.query<{ usage_count: number }>(
      `SELECT COUNT(*)::integer AS usage_count
       FROM coupon_redemptions
       WHERE coupon_id = $1
         AND customer_key = $2
         AND (
           status = 'redeemed'
           OR (status = 'reserved' AND expires_at > NOW())
         )`,
      [row.id, options.customerKey]
    );
    if (Number(customerUsageResult.rows[0].usage_count) >= row.per_customer_limit) {
      throw new CouponValidationError(
        "CUSTOMER_LIMIT_REACHED",
        "You have already used this coupon the maximum number of times."
      );
    }
  }

  let discountPaise =
    row.discount_type === "percentage"
      ? Number(
          (BigInt(options.subtotalPaise) * BigInt(row.discount_value)) /
            BigInt(100)
        )
      : row.discount_value;
  if (maximumDiscountPaise !== null) {
    discountPaise = Math.min(discountPaise, maximumDiscountPaise);
  }
  discountPaise = Math.min(discountPaise, options.subtotalPaise);
  if (discountPaise <= 0 || discountPaise >= options.subtotalPaise) {
    throw new CouponValidationError(
      "ZERO_TOTAL",
      "This coupon cannot be used because it would make the order total zero."
    );
  }

  return {
    id: row.id,
    code: row.code,
    discountType: row.discount_type,
    discountValue: Number(row.discount_value),
    minimumOrderPaise,
    maximumDiscountPaise,
    startsAt,
    expiresAt,
    usageLimit: row.usage_limit,
    perCustomerLimit: row.per_customer_limit,
    discountPaise,
  };
}

export function formatCouponRupees(paise: number) {
  return `₹${(paise / 100).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
