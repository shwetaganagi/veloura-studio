import { cookies } from "next/headers";
import { NextResponse, connection } from "next/server";
import {
  SESSION_COOKIE_NAME,
  verifyAdminSession,
} from "@/lib/auth/admin";
import { pool } from "@/lib/db";

type RouteContext = {
  params: Promise<{ reviewId: string }>;
};

export async function GET(_request: Request, { params }: RouteContext) {
  await connection();

  const { reviewId: rawReviewId } = await params;
  const reviewId = Number(rawReviewId);
  if (!Number.isSafeInteger(reviewId) || reviewId <= 0) {
    return NextResponse.json(
      { success: false, message: "Invalid review photo." },
      { status: 400 }
    );
  }

  try {
    const cookieStore = await cookies();
    const adminToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    const isAdmin = Boolean(
      adminToken && (await verifyAdminSession(adminToken))
    );
    const result = await pool.query<{
      photo_data: Buffer;
      photo_mime: string;
    }>(
      `SELECT photo_data, photo_mime
       FROM customer_reviews
       WHERE id = $1
         AND (moderation_status = 'visible' OR $2::boolean)
         AND photo_data IS NOT NULL`,
      [reviewId, isAdmin]
    );
    const photo = result.rows[0];
    if (!photo) {
      return NextResponse.json(
        { success: false, message: "Review photo not found." },
        { status: 404 }
      );
    }

    return new NextResponse(new Uint8Array(photo.photo_data), {
      headers: {
        "Content-Type": photo.photo_mime,
        "Content-Length": String(photo.photo_data.length),
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("Customer review photo could not be loaded:", error);
    return NextResponse.json(
      { success: false, message: "Unable to load review photo." },
      { status: 500 }
    );
  }
}
