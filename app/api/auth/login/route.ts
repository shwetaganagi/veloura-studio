import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { pool } from "@/lib/db";
import { enforceAuthRateLimit, loginNoticeHtml, sendAuthEmail } from "@/lib/auth/flows";
import {
  createCustomerSession,
  CUSTOMER_SESSION_COOKIE,
  CUSTOMER_SESSION_COOKIE_OPTIONS,
} from "@/lib/auth/customer";

export async function POST(request: NextRequest) {
  try {
    if (!(await enforceAuthRateLimit(request, "login"))) {
      return NextResponse.json({ success: false, message: "Too many attempts. Please try again later." }, { status: 429 });
    }
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ success: false, message: "Enter a valid email and password." }, { status: 400 });

    const email =
      typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password =
      typeof body.password === "string" ? body.password : "";

    if (!email || email.length > 255 || !password || password.length > 72) {
      return NextResponse.json(
        { success: false, message: "Enter a valid email and password." },
        { status: 400 }
      );
    }

    const result = await pool.query(
      `SELECT id, full_name, email, password_hash, email_verified, auth_session_version
       FROM customers
       WHERE LOWER(email) = LOWER($1)
       LIMIT 1`,
      [email]
    );

    const customer = result.rows[0];

    const passwordMatches = customer
      ? await bcrypt.compare(password, customer.password_hash)
      : (await bcrypt.hash(password, 12), false);
    if (!customer || !passwordMatches || !customer.email_verified) {
      return NextResponse.json(
        { success: false, message: "Invalid email or password." },
        { status: 401 }
      );
    }

    const token = await createCustomerSession(String(customer.id), Number(customer.auth_session_version));

    try {
      await sendAuthEmail(customer.email, "New sign-in to your Veloura Studio account", loginNoticeHtml(customer.full_name));
    } catch {
      console.error("Login notification email delivery failed.");
    }

    const response = NextResponse.json({
      success: true,
      message: "Login successful.",
      customer: {
        id: String(customer.id),
        fullName: customer.full_name,
        email: customer.email,
        emailVerified: customer.email_verified,
      },
    });

    response.cookies.set(
      CUSTOMER_SESSION_COOKIE,
      token,
      CUSTOMER_SESSION_COOKIE_OPTIONS
    );

    return response;
  } catch (error) {
    console.error("Customer login error:", error);

    return NextResponse.json(
      { success: false, message: "Unable to log in right now." },
      { status: 500 }
    );
  }
}
