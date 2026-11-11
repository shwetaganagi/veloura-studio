import { NextRequest, NextResponse, connection } from "next/server";
import { getCustomerSession } from "@/lib/auth/customer";
import { pool } from "@/lib/db";
import {
  MAX_REVIEW_REQUEST_BYTES,
  parseRating,
  parseReviewPhoto,
  validateDisplayName,
  validateReviewText,
} from "@/lib/reviews/validation";

type RouteContext = {
  params: Promise<{ reviewId: string }>;
};

function parseReviewId(value: string) {
  const reviewId = Number(value);
  return Number.isSafeInteger(reviewId) && reviewId > 0 ? reviewId : null;
}

export async function PUT(request: NextRequest, { params }: RouteContext) {
  await connection();

  const { reviewId: rawReviewId } = await params;
  const reviewId = parseReviewId(rawReviewId);
  if (!reviewId) {
    return NextResponse.json(
      { success: false, message: "Invalid review." },
      { status: 400 }
    );
  }

  const session = await getCustomerSession();
  if (!session) {
    return NextResponse.json(
      { success: false, message: "Please log in to edit your review." },
      { status: 401 }
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
    photo = await parseReviewPhoto(formData.get("photo"));
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

  const ratingValue = formData.get("rating");
  const rating =
    typeof ratingValue === "string" ? parseRating(ratingValue) : null;
  const displayName = formData.get("displayName");
  const title = formData.get("title");
  const reviewText = formData.get("reviewText");
  const removePhoto = formData.get("removePhoto") === "true";

  if (rating === null) {
    return NextResponse.json(
      { success: false, message: "Choose a rating from 1 to 5 stars." },
      { status: 400 }
    );
  }
  if (typeof displayName !== "string") {
    return NextResponse.json(
      { success: false, message: "Enter your name." },
      { status: 400 }
    );
  }
  if (typeof title !== "string" || typeof reviewText !== "string") {
    return NextResponse.json(
      { success: false, message: "Enter a review title and written review." },
      { status: 400 }
    );
  }

  const cleanDisplayName = displayName.trim().replace(/\s+/g, " ");
  const displayNameError = validateDisplayName(cleanDisplayName);
  if (displayNameError) {
    return NextResponse.json(
      { success: false, message: displayNameError },
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

  try {
    const updated = await pool.query(
      `UPDATE customer_reviews
       SET display_name = $1,
           rating = $2,
           title = $3,
           review_text = $4,
           photo_data = CASE
             WHEN $5::boolean THEN NULL
             WHEN $6::bytea IS NOT NULL THEN $6
             ELSE photo_data
           END,
           photo_mime = CASE
             WHEN $5::boolean THEN NULL
             WHEN $7::text IS NOT NULL THEN $7
             ELSE photo_mime
           END,
           updated_at = NOW()
       WHERE id = $8 AND customer_id = $9
       RETURNING id`,
      [
        cleanDisplayName,
        rating,
        cleanTitle,
        cleanReviewText,
        removePhoto,
        photo?.data ?? null,
        photo?.mimeType ?? null,
        reviewId,
        session.customerId,
      ]
    );

    if (updated.rows.length === 0) {
      return NextResponse.json(
        { success: false, message: "Review not found or you cannot edit it." },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Customer review could not be updated:", error);
    return NextResponse.json(
      { success: false, message: "Unable to update your review." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: RouteContext
) {
  await connection();

  const { reviewId: rawReviewId } = await params;
  const reviewId = parseReviewId(rawReviewId);
  if (!reviewId) {
    return NextResponse.json(
      { success: false, message: "Invalid review." },
      { status: 400 }
    );
  }

  const session = await getCustomerSession();
  if (!session) {
    return NextResponse.json(
      { success: false, message: "Please log in to delete your review." },
      { status: 401 }
    );
  }

  try {
    const deleted = await pool.query(
      `DELETE FROM customer_reviews
       WHERE id = $1 AND customer_id = $2
       RETURNING id`,
      [reviewId, session.customerId]
    );

    if (deleted.rows.length === 0) {
      return NextResponse.json(
        { success: false, message: "Review not found or you cannot delete it." },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Customer review could not be deleted:", error);
    return NextResponse.json(
      { success: false, message: "Unable to delete your review." },
      { status: 500 }
    );
  }
}
