import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { pool } from "@/lib/db";
import {
  createCustomerSession,
  CUSTOMER_SESSION_COOKIE,
  CUSTOMER_SESSION_COOKIE_OPTIONS,
} from "@/lib/auth/customer";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const email =
      typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password =
      typeof body.password === "string" ? body.password : "";

    if (!email || !password || password.length > 72) {
      return NextResponse.json(
        { success: false, message: "Enter a valid email and password." },
        { status: 400 }
      );
    }

    const result = await pool.query(
      `SELECT id, full_name, email, password_hash, email_verified
       FROM customers
       WHERE LOWER(email) = LOWER($1)
       LIMIT 1`,
      [email]
    );

    const customer = result.rows[0];

    if (!customer || !(await bcrypt.compare(password, customer.password_hash))) {
      return NextResponse.json(
        { success: false, message: "Invalid email or password." },
        { status: 401 }
      );
    }

    const token = await createCustomerSession(String(customer.id));

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
