import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { authEmailHtml, enforceAuthRateLimit, getAppBaseUrl, issueAuthToken, sendAuthEmail } from "@/lib/auth/flows";

const genericMessage = "If an account exists for that email, a password reset link will be sent shortly.";

export async function POST(request: NextRequest) {
  try {
    if (!(await enforceAuthRateLimit(request, "forgot"))) return NextResponse.json({ success: false, message: "Too many requests. Please try again later." }, { status: 429 });
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ success: false, message: "Enter a valid email address." }, { status: 400 });
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (email.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ success: false, message: "Enter a valid email address." }, { status: 400 });
    const result = await pool.query<{ id: string; email: string }>("SELECT id, email FROM customers WHERE LOWER(email) = $1 AND email_verified = TRUE LIMIT 1", [email]);
    if (result.rows[0]) {
      try {
        const token = await issueAuthToken(result.rows[0].id, "reset_password");
        const url = `${getAppBaseUrl(request)}/reset-password?token=${encodeURIComponent(token)}`;
        await sendAuthEmail(result.rows[0].email, "Reset your Veloura Studio password", authEmailHtml("Reset your password", "Choose a new password", url, "1 hour"));
      } catch (error) {
        console.error("Password reset email could not be sent:", error instanceof Error ? error.message : "unknown error");
      }
    }
    return NextResponse.json({ success: true, message: genericMessage });
  } catch (error) {
    console.error("Password reset request failed:", error instanceof Error ? error.message : "unknown error");
    return NextResponse.json({ success: false, message: "Unable to process your request right now." }, { status: 500 });
  }
}
