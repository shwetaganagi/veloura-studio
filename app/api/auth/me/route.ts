import { NextResponse } from "next/server";
import { connection } from "next/server";
import { pool } from "@/lib/db";
import { getCustomerSession } from "@/lib/auth/customer";

export async function GET() {
  await connection();

  try {
    const session = await getCustomerSession();

    if (!session) {
      return NextResponse.json(
        { success: false, customer: null },
        { status: 401 }
      );
    }

    const result = await pool.query(
      `SELECT id, full_name, email, phone, email_verified
        FROM customers
        WHERE id = $1
        LIMIT 1`,
      [session.customerId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, customer: null },
        { status: 401 }
      );
    }

    const customer = result.rows[0];

    return NextResponse.json({
      success: true,
      customer: {
      id: String(customer.id),
      fullName: customer.full_name,
      email: customer.email,
      phone: customer.phone ?? "",
      emailVerified: customer.email_verified,
    },
    });
  } catch (error) {
    console.error("Customer session check error:", error);

    return NextResponse.json(
      { success: false, message: "Unable to check customer session." },
      { status: 500 }
    );
  }
}
