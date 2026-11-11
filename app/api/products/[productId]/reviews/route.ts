import { NextRequest, NextResponse, connection } from "next/server";
import type { PoolClient } from "pg";
import { getCustomerSession } from "@/lib/auth/customer";
import { pool } from "@/lib/db";
import {
  getReviewRateLimitKey,
  isJsonObject,
  MAX_REVIEW_REQUEST_BYTES,
  parseRating,
  parseReviewPhoto,
  validateDisplayName,
  validateReviewText,
} from "@/lib/reviews/validation";

type RouteContext = {
  params: Promise<{ productId: string }>;
};

function parseProductId(value: string) {
  const productId = Number(value);
  return Number.isSafeInteger(productId) && productId > 0 ? productId : null;
}

export async function GET(_request: NextRequest, { params }: RouteContext) {
  await connection();

  const { productId: rawProductId } = await params;
  const productId = parseProductId(rawProductId);
  if (!productId) {
    return NextResponse.json(
      { success: false, message: "Invalid product." },
      { status: 400 }
    );
  }

  try {
    const productResult = await pool.query(
      `SELECT id FROM products WHERE id = $1 AND is_active = TRUE LIMIT 1`,
      [productId]
    );
    if (productResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, message: "Product not found." },
        { status: 404 }
      );
    }

    const [summaryResult, reviewsResult] = await Promise.all([
      pool.query(
        `SELECT
           COUNT(*)::integer AS review_count,
           COALESCE(AVG(rating), 0)::numeric(3, 2) AS average_rating,
           COUNT(*) FILTER (WHERE rating = 5)::integer AS five_star,
           COUNT(*) FILTER (WHERE rating = 4)::integer AS four_star,
           COUNT(*) FILTER (WHERE rating = 3)::integer AS three_star,
           COUNT(*) FILTER (WHERE rating = 2)::integer AS two_star,
           COUNT(*) FILTER (WHERE rating = 1)::integer AS one_star
         FROM customer_reviews
         WHERE product_id = $1 AND moderation_status = 'visible'`,
        [productId]
      ),
      pool.query(
        `SELECT
           id,
           display_name AS "displayName",
           rating,
           title,
           review_text AS "reviewText",
           created_at AS "createdAt",
           photo_data IS NOT NULL AS "hasPhoto",
           EXISTS (
             SELECT 1
             FROM orders reviewed_order
             WHERE reviewed_order.id = customer_reviews.order_id
               AND reviewed_order.status = 'delivered'
           ) AS "verifiedPurchase"
         FROM customer_reviews
         WHERE product_id = $1 AND moderation_status = 'visible'
         ORDER BY created_at DESC
         LIMIT 200`,
        [productId]
      ),
    ]);

    const summaryRow = summaryResult.rows[0];
    const summary = {
      averageRating: Number(summaryRow.average_rating),
      totalReviews: Number(summaryRow.review_count),
      distribution: [
        { rating: 5, count: Number(summaryRow.five_star) },
        { rating: 4, count: Number(summaryRow.four_star) },
        { rating: 3, count: Number(summaryRow.three_star) },
        { rating: 2, count: Number(summaryRow.two_star) },
        { rating: 1, count: Number(summaryRow.one_star) },
      ].map((entry) => ({
        ...entry,
        percentage:
          summaryRow.review_count > 0
            ? Math.round((entry.count / Number(summaryRow.review_count)) * 100)
            : 0,
      })),
    };

    const session = await getCustomerSession();
    let eligibleOrders: Array<{
      orderId: string;
      reviewed: boolean;
      reviewId: string | null;
    }> = [];
    let myReviews: Array<{
      id: string;
      orderId: string;
      rating: number;
      title: string;
      reviewText: string;
      moderationStatus: "visible" | "hidden";
      hasPhoto: boolean;
    }> = [];

    if (session) {
      const [eligibleResult, ownReviewsResult] = await Promise.all([
        pool.query(
          `SELECT
             o.id AS "orderId",
             cr.id AS "reviewId",
             cr.id IS NOT NULL AS reviewed
           FROM orders o
           JOIN order_items oi
             ON oi.order_id = o.id AND oi.product_id = $2
           LEFT JOIN customer_reviews cr
             ON cr.order_id = o.id
            AND cr.product_id = $2
            AND cr.customer_id = $1
           WHERE o.customer_id = $1
             AND o.status = 'delivered'
           ORDER BY o.created_at DESC`,
          [session.customerId, productId]
        ),
        pool.query(
          `SELECT
             id,
             order_id AS "orderId",
             display_name AS "displayName",
             rating,
             title,
             review_text AS "reviewText",
             moderation_status AS "moderationStatus",
             photo_data IS NOT NULL AS "hasPhoto"
           FROM customer_reviews
           WHERE product_id = $1 AND customer_id = $2
           ORDER BY created_at DESC`,
          [productId, session.customerId]
        ),
      ]);

      eligibleOrders = eligibleResult.rows.map((row) => ({
        orderId: String(row.orderId),
        reviewed: row.reviewed,
        reviewId: row.reviewId === null ? null : String(row.reviewId),
      }));
      myReviews = ownReviewsResult.rows.map((row) => ({
        id: String(row.id),
        orderId: row.orderId === null ? "" : String(row.orderId),
        displayName: row.displayName,
        rating: Number(row.rating),
        title: row.title,
        reviewText: row.reviewText,
        moderationStatus: row.moderationStatus,
        hasPhoto: row.hasPhoto,
      }));
    }

    return NextResponse.json({
      success: true,
      summary,
      reviews: reviewsResult.rows.map((review) => ({
        ...review,
        id: String(review.id),
        rating: Number(review.rating),
      })),
      eligibleOrders,
      myReviews,
    });
  } catch (error) {
    console.error("Product reviews could not be loaded:", error);
    return NextResponse.json(
      { success: false, message: "Unable to load product reviews." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  await connection();

  const { productId: rawProductId } = await params;
  const productId = parseProductId(rawProductId);
  if (!productId) {
    return NextResponse.json(
      { success: false, message: "Invalid product." },
      { status: 400 }
    );
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_REVIEW_REQUEST_BYTES) {
    return NextResponse.json(
      { success: false, message: "Review photos must be 2 MB or smaller." },
      { status: 413 }
    );
  }

  let formData: FormData;
  let photo;
  try {
    formData = await request.formData();
    const rawPhoto = formData.get("photo");
    photo = await parseReviewPhoto(rawPhoto);
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error ? error.message : "Invalid review upload.",
      },
      { status: 400 }
    );
  }

  const session = await getCustomerSession();
  const rawOrderId = formData.get("orderId");
  const orderId =
    typeof rawOrderId === "string" && /^\d{1,18}$/.test(rawOrderId)
      ? rawOrderId
      : null;
  if (rawOrderId !== null && orderId === null) {
    return NextResponse.json(
      { success: false, message: "Choose a valid delivered order." },
      { status: 400 }
    );
  }
  if (orderId && !session) {
    return NextResponse.json(
      { success: false, message: "Sign in to mark a review as a verified purchase." },
      { status: 401 }
    );
  }

  const rawDisplayName = formData.get("displayName");
  const ratingValue = formData.get("rating");
  const rating =
    typeof ratingValue === "string" ? parseRating(ratingValue) : null;
  const title = formData.get("title");
  const reviewText = formData.get("reviewText");

  if (typeof rawDisplayName !== "string") {
    return NextResponse.json(
      { success: false, message: "Enter your name." },
      { status: 400 }
    );
  }
  const cleanDisplayName = rawDisplayName.trim().replace(/\s+/g, " ");
  const displayNameError = validateDisplayName(cleanDisplayName);
  if (displayNameError) {
    return NextResponse.json(
      { success: false, message: displayNameError },
      { status: 400 }
    );
  }
  if (rating === null) {
    return NextResponse.json(
      { success: false, message: "Choose a rating from 1 to 5 stars." },
      { status: 400 }
    );
  }
  if (typeof title !== "string" || typeof reviewText !== "string") {
    return NextResponse.json(
      { success: false, message: "Enter a review title and written review." },
      { status: 400 }
    );
  }

  const cleanTitle = title.trim();
  const cleanReviewText = reviewText.trim();
  const validationError = validateReviewText(cleanTitle, cleanReviewText);
  if (validationError) {
    return NextResponse.json(
      { success: false, message: validationError },
      { status: 400 }
    );
  }

  let submitterKey: string | null;
  try {
    submitterKey = getReviewRateLimitKey(request.headers);
  } catch (error) {
    console.error("Review rate limiting could not be configured:", error);
    return NextResponse.json(
      { success: false, message: "Unable to submit your review right now." },
      { status: 500 }
    );
  }
  if (!submitterKey) {
    return NextResponse.json(
      { success: false, message: "Unable to verify this request. Please try again." },
      { status: 400 }
    );
  }

  let client: PoolClient | undefined;
  try {
    client = await pool.connect();
    await client.query("BEGIN");
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtext($1)::bigint)",
      [submitterKey]
    );

    const rateLimit = await client.query(
      `SELECT
         COUNT(*) FILTER (
           WHERE created_at >= NOW() - INTERVAL '1 hour'
         )::integer AS recent_count,
         COUNT(*) FILTER (
           WHERE product_id = $2
             AND created_at >= NOW() - INTERVAL '10 minutes'
         )::integer AS recent_product_count
       FROM customer_reviews
       WHERE submission_ip_hash = $1
         AND created_at >= NOW() - INTERVAL '1 hour'`,
      [submitterKey, productId]
    );
    const recentCount = Number(rateLimit.rows[0].recent_count);
    const recentProductCount = Number(rateLimit.rows[0].recent_product_count);
    if (recentCount >= 5 || recentProductCount >= 1) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        {
          success: false,
          message: "Please wait before submitting another review.",
        },
        {
          status: 429,
          headers: {
            "Retry-After": recentProductCount >= 1 ? "600" : "3600",
          },
        }
      );
    }

    const productResult = await client.query(
      `SELECT id FROM products WHERE id = $1 AND is_active = TRUE LIMIT 1`,
      [productId]
    );
    if (productResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { success: false, message: "Product not found." },
        { status: 404 }
      );
    }

    const inserted = await client.query(
      `INSERT INTO customer_reviews (
         customer_id,
         product_id,
         order_id,
         display_name,
         rating,
         title,
         review_text,
         photo_data,
         photo_mime,
         submission_ip_hash
       )
       SELECT
         $1::bigint,
         product.id,
         $3::bigint,
         $4,
         $5,
         $6,
         $7,
         $8,
         $9,
         $10
       FROM products product
       WHERE product.id = $2
         AND product.is_active = TRUE
         AND (
           $3::bigint IS NULL
           OR (
             $1::bigint IS NOT NULL
             AND EXISTS (
               SELECT 1
               FROM orders customer_order
               JOIN order_items item
                 ON item.order_id = customer_order.id
                AND item.product_id = product.id
               WHERE customer_order.id = $3
                 AND customer_order.customer_id = $1::bigint
                 AND customer_order.status = 'delivered'
             )
           )
         )
       RETURNING id`,
      [
        session?.customerId ?? null,
        productId,
        orderId,
        cleanDisplayName,
        rating,
        cleanTitle,
        cleanReviewText,
        photo?.data ?? null,
        photo?.mimeType ?? null,
        submitterKey,
      ]
    );

    if (inserted.rows.length === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        {
          success: false,
          message: "The selected order is not an eligible delivered purchase.",
        },
        { status: 403 }
      );
    }

    await client.query("COMMIT");
    return NextResponse.json(
      { success: true, reviewId: String(inserted.rows[0].id) },
      { status: 201 }
    );
  } catch (error) {
    if (client) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("Review submission transaction could not be rolled back:", rollbackError);
      }
    }
    if (
      isJsonObject(error) &&
      error.code === "23505"
    ) {
      return NextResponse.json(
        { success: false, message: "You have already reviewed this purchase." },
        { status: 409 }
      );
    }

    console.error("Product review could not be submitted:", error);
    return NextResponse.json(
      { success: false, message: "Unable to submit your review." },
      { status: 500 }
    );
  } finally {
    client?.release();
  }
}
