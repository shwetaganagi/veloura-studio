import { NextRequest, NextResponse, connection } from "next/server";
import { cookies } from "next/headers";
import {
  SESSION_COOKIE_NAME,
  verifyAdminSession,
} from "@/lib/auth/admin";
import { pool } from "@/lib/db";
import type { PoolClient } from "pg";
import { isJsonObject } from "@/lib/reviews/validation";

async function isAdminAuthenticated() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  return Boolean(token && (await verifyAdminSession(token)));
}

export async function GET() {
  await connection();

  try {
    if (!(await isAdminAuthenticated())) {
      return NextResponse.json(
        { success: false, message: "Administrator login required." },
        { status: 401 }
      );
    }

    const result = await pool.query(
      `SELECT
         review.id,
         review.product_id AS "productId",
         product.name AS "productName",
         review.display_name AS "displayName",
         review.rating,
         review.title,
         review.review_text AS "reviewText",
         review.moderation_status AS "moderationStatus",
         review.created_at AS "createdAt",
         review.photo_data IS NOT NULL AS "hasPhoto"
       FROM customer_reviews review
       JOIN products product ON product.id = review.product_id
       ORDER BY review.created_at DESC
       LIMIT 500`
    );

    return NextResponse.json({
      success: true,
      reviews: result.rows.map((review) => ({
        ...review,
        id: String(review.id),
        productId: Number(review.productId),
        rating: Number(review.rating),
      })),
    });
  } catch (error) {
    console.error("Admin reviews could not be loaded:", error);
    return NextResponse.json(
      { success: false, message: "Unable to load reviews." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  await connection();

  if (!(await isAdminAuthenticated())) {
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
      { success: false, message: "Invalid moderation request." },
      { status: 400 }
    );
  }

  if (!isJsonObject(body)) {
    return NextResponse.json(
      { success: false, message: "Invalid moderation request." },
      { status: 400 }
    );
  }

  const reviewId = Number(body.reviewId);
  const action = body.action;
  const reason =
    typeof body.reason === "string" ? body.reason.trim() : "";

  if (!Number.isSafeInteger(reviewId) || reviewId <= 0) {
    return NextResponse.json(
      { success: false, message: "Invalid review ID." },
      { status: 400 }
    );
  }
  if (action !== "hide" && action !== "restore") {
    return NextResponse.json(
      { success: false, message: "Choose hide or restore." },
      { status: 400 }
    );
  }
  if (reason.length > 500) {
    return NextResponse.json(
      { success: false, message: "Moderation notes cannot exceed 500 characters." },
      { status: 400 }
    );
  }

  const nextStatus = action === "hide" ? "hidden" : "visible";
  const auditAction = action === "hide" ? "hidden" : "restored";
  let client: PoolClient | undefined;

  try {
    client = await pool.connect();
    await client.query("BEGIN");
    const updated = await client.query(
      `UPDATE customer_reviews
       SET moderation_status = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, moderation_status`,
      [nextStatus, reviewId]
    );

    if (updated.rows.length === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { success: false, message: "Review not found." },
        { status: 404 }
      );
    }

    await client.query(
      `INSERT INTO customer_review_moderation_log (
         review_id, action, admin_identity, reason
       )
       VALUES ($1, $2, 'admin', $3)`,
      [reviewId, auditAction, reason || null]
    );

    await client.query("COMMIT");
    return NextResponse.json({
      success: true,
      review: {
        id: String(updated.rows[0].id),
        moderationStatus: updated.rows[0].moderation_status,
      },
    });
  } catch (error) {
    if (client) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("Admin review moderation rollback failed:", rollbackError);
      }
    }
    console.error("Admin review moderation failed:", error);
    return NextResponse.json(
      { success: false, message: "Unable to moderate this review." },
      { status: 500 }
    );
  } finally {
    client?.release();
  }
}
