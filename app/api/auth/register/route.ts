import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { pool } from "@/lib/db";
import { authEmailHtml, enforceAuthRateLimit, getAppBaseUrl, issueAuthToken, sendAuthEmail, welcomeEmailHtml } from "@/lib/auth/flows";
import { CUSTOMER_PASSWORD_ERROR, isValidCustomerPassword } from "@/lib/auth/password-policy";

export async function POST(request: NextRequest) {
  try {
    if (!(await enforceAuthRateLimit(request, "register"))) return NextResponse.json({ success: false, message: "Too many requests. Please try again later." }, { status: 429 });
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ success: false, message: "Enter valid registration details." }, { status: 400 });
    const fullName = typeof body.fullName === "string" ? body.fullName.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (fullName.length < 2 || fullName.length > 150) return NextResponse.json({ success: false, message: "Enter a name between 2 and 150 characters." }, { status: 400 });
    if (email.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ success: false, message: "Enter a valid email address." }, { status: 400 });
    if (!isValidCustomerPassword(password)) return NextResponse.json({ success: false, message: CUSTOMER_PASSWORD_ERROR }, { status: 400 });
    const passwordHash = await bcrypt.hash(password, 12);
    const inserted = await pool.query<{ id: string; email: string; email_verified: boolean }>(
      `INSERT INTO customers (full_name, email, password_hash, email_verified)
       VALUES ($1, $2, $3, FALSE) ON CONFLICT DO NOTHING RETURNING id, email, email_verified`,
      [fullName, email, passwordHash]
    );
    let customerId = inserted.rows[0]?.id;
    if (!customerId) {
      const existing = await pool.query<{ id: string; email_verified: boolean }>("SELECT id, email_verified FROM customers WHERE LOWER(email) = $1 LIMIT 1", [email]);
      if (!existing.rows[0] || existing.rows[0].email_verified) return NextResponse.json({ success: true, message: "If this email can be registered, a verification link will be sent shortly." });
      customerId = existing.rows[0].id;
    }
    try {
      const token = await issueAuthToken(String(customerId), "verify_email");
      const url = `${getAppBaseUrl(request)}/verify-email?token=${encodeURIComponent(token)}`;
      const customer = inserted.rows[0] ?? (await pool.query<{ email: string }>("SELECT email FROM customers WHERE id = $1", [customerId])).rows[0];
      if (inserted.rows[0]) {
        await sendAuthEmail(customer.email, "Welcome to Veloura Studio — verify your email", welcomeEmailHtml(fullName, url));
      } else {
        await sendAuthEmail(customer.email, "Verify your Veloura Studio account", authEmailHtml("Verify your email", "Verify email address", url, "24 hours"));
      }
    } catch (error) {
      console.error("Verification email could not be sent:", error instanceof Error ? error.message : "unknown error");
      return NextResponse.json({ success: true, message: "If this email can be registered, a verification link will be sent. If it doesn’t arrive, please try again later." });
    }
    return NextResponse.json({ success: true, message: "If this email can be registered, a verification link will be sent shortly." });
  } catch (error) {
    console.error("Customer registration error:", error instanceof Error ? error.message : "unknown error");
    return NextResponse.json({ success: false, message: "Unable to create your account right now." }, { status: 500 });
  }
}
