import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { enforceAuthRateLimit, hashAuthToken } from "@/lib/auth/flows";

export async function POST(request: NextRequest) {
  try {
    if (!(await enforceAuthRateLimit(request, "verify"))) return NextResponse.json({ success: false, message: "Too many requests. Please try again later." }, { status: 429 });
    const body = await request.json().catch(() => null);
    const token = body && typeof body === "object" && !Array.isArray(body) ? body.token : null;
    if (typeof token !== "string") return NextResponse.json({ success: false, message: "This verification link is invalid or has expired." }, { status: 400 });
    if (!/^[A-Za-z0-9_-]{40,60}$/.test(token)) return NextResponse.json({ success: false, message: "This verification link is invalid, expired, or already used." }, { status: 400 });
    const result = await pool.query(
      `WITH consumed AS (
         UPDATE customer_auth_tokens SET used_at = NOW()
         WHERE token_hash = $1 AND purpose = 'verify_email' AND used_at IS NULL AND expires_at > NOW()
         RETURNING customer_id
       )
       UPDATE customers SET email_verified = TRUE
       WHERE id IN (SELECT customer_id FROM consumed) RETURNING id`,
      [hashAuthToken(token)]
    );
    if (!result.rowCount) return NextResponse.json({ success: false, message: "This verification link is invalid, expired, or already used." }, { status: 400 });
    return NextResponse.json({ success: true, message: "Your email is verified. You can now sign in." });
  } catch (error) {
    console.error("Email verification failed:", error instanceof Error ? error.message : "unknown error");
    return NextResponse.json({ success: false, message: "Unable to verify your email right now." }, { status: 500 });
  }
}
