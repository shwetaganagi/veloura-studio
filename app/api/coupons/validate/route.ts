import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import {
  getCouponCustomerKey,
  hasCouponSchema,
  validateCoupon,
  CouponValidationError,
} from "@/lib/coupons";
import { getCustomerSession } from "@/lib/auth/customer";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, message: "Invalid coupon validation request." },
      { status: 400 }
    );
  }
  if (!isObject(body) || !Array.isArray(body.items) || body.items.length === 0 || body.items.length > 100) {
    return NextResponse.json(
      { success: false, message: "Your cart is empty or invalid." },
      { status: 400 }
    );
  }

  const code = typeof body.code === "string" ? body.code : "";
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  if (phone && !/^[6-9]\d{9}$/.test(phone)) {
    return NextResponse.json(
      { success: false, message: "Enter a valid phone number before applying the coupon." },
      { status: 400 }
    );
  }

  const quantities = new Map<number, number>();
  for (const value of body.items) {
    if (
      !isObject(value) ||
      !Number.isSafeInteger(value.productId) ||
      Number(value.productId) <= 0 ||
      !Number.isSafeInteger(value.quantity) ||
      Number(value.quantity) <= 0 ||
      Number(value.quantity) > 100
    ) {
      return NextResponse.json(
        { success: false, message: "Your cart contains an invalid product or quantity." },
        { status: 400 }
      );
    }
    const productId = Number(value.productId);
    const quantity = (quantities.get(productId) ?? 0) + Number(value.quantity);
    if (quantity > 100) {
      return NextResponse.json(
        { success: false, message: "The maximum quantity per product is 100." },
        { status: 400 }
      );
    }
    quantities.set(productId, quantity);
  }

  const client = await pool.connect();
  try {
    if (!(await hasCouponSchema(client))) {
      return NextResponse.json(
        {
          success: false,
          message: "Coupons are temporarily unavailable. Please try again later.",
        },
        { status: 503 }
      );
    }

    const ids = [...quantities.keys()].sort((a, b) => a - b);
    const products = await client.query<{
      id: string;
      price_paise: string | number;
    }>(
      `SELECT id::text AS id, price_paise
       FROM products
       WHERE id = ANY($1::bigint[]) AND is_active = TRUE`,
      [ids]
    );
    if (products.rows.length !== ids.length) {
      return NextResponse.json(
        { success: false, message: "One or more products in your cart are unavailable." },
        { status: 400 }
      );
    }

    let subtotalPaise = 0;
    for (const product of products.rows) {
      subtotalPaise +=
        Number(product.price_paise) * quantities.get(Number(product.id))!;
      if (!Number.isSafeInteger(subtotalPaise)) {
        return NextResponse.json(
          { success: false, message: "Your order total is too large." },
          { status: 400 }
        );
      }
    }

    const session = await getCustomerSession();
    const coupon = await validateCoupon(client, {
      code,
      subtotalPaise,
      customerKey: getCouponCustomerKey(session?.customerId ?? null, phone),
    });

    return NextResponse.json({
      success: true,
      coupon: {
        code: coupon.code,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        discountPaise: coupon.discountPaise,
      },
      subtotalPaise,
      totalPaise: subtotalPaise - coupon.discountPaise,
    });
  } catch (error) {
    if (error instanceof CouponValidationError) {
      return NextResponse.json(
        { success: false, code: error.code, message: error.message },
        { status: 400 }
      );
    }
    console.error("Coupon validation could not be completed:", error);
    return NextResponse.json(
      { success: false, message: "Unable to validate this coupon right now." },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
