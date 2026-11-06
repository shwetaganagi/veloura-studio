
import { NextRequest, NextResponse, connection } from "next/server";
import { pool } from "@/lib/db";
import {
  verifyCustomerSession,
  CUSTOMER_SESSION_COOKIE,
} from "@/lib/auth/customer";

export async function PATCH(request: NextRequest) {
  await connection();

  try {
    // Verify the logged-in customer
    const token = request.cookies.get(CUSTOMER_SESSION_COOKIE)?.value;

    const session = token
      ? await verifyCustomerSession(token)
      : null;

    if (!session) {
      return NextResponse.json(
        { success: false, message: "Please log in to update your profile." },
        { status: 401 }
      );
    }

    const body = await request.json();

    const fullName =
      typeof body.fullName === "string" ? body.fullName.trim() : "";

    const phone =
      typeof body.phone === "string" ? body.phone.trim() : "";

    // Validate name
    if (fullName.length < 2 || fullName.length > 150) {
      return NextResponse.json(
        {
          success: false,
          message: "Name must contain between 2 and 150 characters.",
        },
        { status: 400 }
      );
    }

    // Validate optional Indian mobile number
    if (phone && !/^[6-9]\d{9}$/.test(phone)) {
      return NextResponse.json(
        {
          success: false,
          message: "Enter a valid 10-digit Indian mobile number.",
        },
        { status: 400 }
      );
    }

    const result = await pool.query(
      `UPDATE customers
       SET full_name = $1,
           phone = $2,
           updated_at = NOW()
       WHERE id = $3
       RETURNING id, full_name, email, phone, email_verified`,
      [fullName, phone || null, session.customerId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, message: "Customer account not found." },
        { status: 404 }
      );
    }

    const customer = result.rows[0];

    return NextResponse.json({
      success: true,
      message: "Your profile has been updated successfully.",
      customer: {
        id: String(customer.id),
        fullName: customer.full_name,
        email: customer.email,
        phone: customer.phone ?? "",
        emailVerified: customer.email_verified,
      },
    });
  } catch (error) {
    console.error("Customer profile update error:", error);

    return NextResponse.json(
      { success: false, message: "Unable to update your profile." },
      { status: 500 }
    );
  }
}
