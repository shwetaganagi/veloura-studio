import { NextRequest, NextResponse, connection } from "next/server";
import { getCustomerSession } from "@/lib/auth/customer";
import { pool } from "@/lib/db";

type WishlistBody = {
  productId?: unknown;
  productIds?: unknown;
};

function isValidProductId(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function isWishlistBody(value: unknown): value is WishlistBody {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function getAuthenticatedCustomer() {
  const session = await getCustomerSession();
  if (!session) return null;

  return session.customerId;
}

export async function GET() {
  await connection();

  try {
    const customerId = await getAuthenticatedCustomer();
    if (!customerId) {
      return NextResponse.json(
        { success: false, message: "Please log in to view your wishlist." },
        { status: 401 }
      );
    }

    const result = await pool.query(
      `SELECT product_id
       FROM customer_wishlist
       WHERE customer_id = $1
       ORDER BY created_at DESC`,
      [customerId]
    );

    return NextResponse.json({
      success: true,
      productIds: result.rows.map((row) => Number(row.product_id)),
    });
  } catch (error) {
    console.error("Customer wishlist load failed:", error);
    return NextResponse.json(
      { success: false, message: "Unable to load your wishlist." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  await connection();

  try {
    const customerId = await getAuthenticatedCustomer();
    if (!customerId) {
      return NextResponse.json(
        { success: false, message: "Please log in to update your wishlist." },
        { status: 401 }
      );
    }

    const body: unknown = await request.json();
    if (!isWishlistBody(body) || !isValidProductId(body.productId)) {
      return NextResponse.json(
        { success: false, message: "Choose a valid product to save." },
        { status: 400 }
      );
    }

    await pool.query(
      `INSERT INTO customer_wishlist (customer_id, product_id)
       VALUES ($1, $2)
       ON CONFLICT (customer_id, product_id) DO NOTHING`,
      [customerId, body.productId]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "23503"
    ) {
      return NextResponse.json(
        { success: false, message: "That product is no longer available." },
        { status: 404 }
      );
    }

    console.error("Customer wishlist update failed:", error);
    return NextResponse.json(
      { success: false, message: "Unable to update your wishlist." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  await connection();

  try {
    const customerId = await getAuthenticatedCustomer();
    if (!customerId) {
      return NextResponse.json(
        { success: false, message: "Please log in to update your wishlist." },
        { status: 401 }
      );
    }

    const body: unknown = await request.json();
    if (!isWishlistBody(body) || !isValidProductId(body.productId)) {
      return NextResponse.json(
        { success: false, message: "Choose a valid product to remove." },
        { status: 400 }
      );
    }

    await pool.query(
      `DELETE FROM customer_wishlist
       WHERE customer_id = $1 AND product_id = $2`,
      [customerId, body.productId]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Customer wishlist removal failed:", error);
    return NextResponse.json(
      { success: false, message: "Unable to update your wishlist." },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  await connection();

  try {
    const customerId = await getAuthenticatedCustomer();
    if (!customerId) {
      return NextResponse.json(
        { success: false, message: "Please log in to update your wishlist." },
        { status: 401 }
      );
    }

    const body: unknown = await request.json();
    if (
      !isWishlistBody(body) ||
      !Array.isArray(body.productIds) ||
      body.productIds.length > 500 ||
      !body.productIds.every(isValidProductId)
    ) {
      return NextResponse.json(
        { success: false, message: "The wishlist contains invalid products." },
        { status: 400 }
      );
    }

    const productIds = [...new Set(body.productIds)];
    await pool.query(
      `INSERT INTO customer_wishlist (customer_id, product_id)
       SELECT $1, requested.product_id
       FROM unnest($2::BIGINT[]) AS requested(product_id)
       INNER JOIN products ON products.id = requested.product_id
       ON CONFLICT (customer_id, product_id) DO NOTHING`,
      [customerId, productIds]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "23503"
    ) {
      return NextResponse.json(
        { success: false, message: "One or more saved products are unavailable." },
        { status: 404 }
      );
    }

    console.error("Customer wishlist synchronization failed:", error);
    return NextResponse.json(
      { success: false, message: "Unable to synchronize your wishlist." },
      { status: 500 }
    );
  }
}
