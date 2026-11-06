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

    const fullName =
      typeof body.fullName === "string" ? body.fullName.trim() : "";
    const email =
      typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password =
      typeof body.password === "string" ? body.password : "";

    if (fullName.length < 2 || fullName.length > 150) {
      return NextResponse.json(
        { success: false, message: "Enter a name between 2 and 150 characters." },
        { status: 400 }
      );
    }

    if (
      email.length > 255 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      return NextResponse.json(
        { success: false, message: "Enter a valid email address." },
        { status: 400 }
      );
    }

    if (password.length < 8 || password.length > 72) {
      return NextResponse.json(
        { success: false, message: "Password must be between 8 and 72 characters." },
        { status: 400 }
      );
    }

    const existingCustomer = await pool.query(
      "SELECT id FROM customers WHERE LOWER(email) = LOWER($1) LIMIT 1",
      [email]
    );

    if (existingCustomer.rowCount && existingCustomer.rowCount > 0) {
      return NextResponse.json(
        { success: false, message: "This email is already registered. Please log in." },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const result = await pool.query(
      `INSERT INTO customers (full_name, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, full_name, email, email_verified`,
      [fullName, email, passwordHash]
    );

    const customer = result.rows[0];
    const token = await createCustomerSession(String(customer.id));

    const response = NextResponse.json(
      {
        success: true,
        message: "Your account has been created successfully.",
        customer: {
          id: String(customer.id),
          fullName: customer.full_name,
          email: customer.email,
          emailVerified: customer.email_verified,
        },
      },
      { status: 201 }
    );

    response.cookies.set(
      CUSTOMER_SESSION_COOKIE,
      token,
      CUSTOMER_SESSION_COOKIE_OPTIONS
    );

    return response;
  } catch (error) {
    console.error("Customer registration error:", error);

    return NextResponse.json(
      { success: false, message: "Unable to create your account right now." },
      { status: 500 }
    );
  }
}
