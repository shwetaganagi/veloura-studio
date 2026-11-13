import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { pool } from "@/lib/db";
import { enforceAuthRateLimit, hashAuthToken } from "@/lib/auth/flows";
import { CUSTOMER_PASSWORD_ERROR, isValidCustomerPassword } from "@/lib/auth/password-policy";

export async function POST(request: NextRequest) {
  try {
    if (!(await enforceAuthRateLimit(request, "reset"))) return NextResponse.json({ success: false, message: "Too many requests. Please try again later." }, { status: 429 });
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ success: false, message: "Enter valid reset details." }, { status: 400 });
    const token = typeof body.token === "string" ? body.token : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (!isValidCustomerPassword(password)) return NextResponse.json({ success: false, message: CUSTOMER_PASSWORD_ERROR }, { status: 400 });
    if (!/^[A-Za-z0-9_-]{40,60}$/.test(token)) return NextResponse.json({ success: false, message: "This reset link is invalid, expired, or already used." }, { status: 400 });
    const passwordHash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      `WITH consumed AS (
         UPDATE customer_auth_tokens SET used_at = NOW()
         WHERE token_hash = $1 AND purpose = 'reset_password' AND used_at IS NULL AND expires_at > NOW()
         RETURNING customer_id
       )
       UPDATE customers SET password_hash = $2, auth_session_version = auth_session_version + 1
       WHERE id IN (SELECT customer_id FROM consumed) RETURNING id`,
      [hashAuthToken(token), passwordHash]
    );
    if (!result.rowCount) return NextResponse.json({ success: false, message: "This reset link is invalid, expired, or already used." }, { status: 400 });
    return NextResponse.json({ success: true, message: "Your password has been updated. You can now sign in." });
  } catch (error) {
    console.error("Password reset failed:", error instanceof Error ? error.message : "unknown error");
    return NextResponse.json({ success: false, message: "Unable to reset your password right now." }, { status: 500 });
  }
}
