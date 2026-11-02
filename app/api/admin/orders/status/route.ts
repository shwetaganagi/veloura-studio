import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { pool } from "@/lib/db";
import {
  SESSION_COOKIE_NAME,
  verifyAdminSession,
} from "@/lib/auth/admin";

const allowedStatuses = [
  "pending",
  "confirmed",
  "preparing",
  "shipped",
  "delivered",
  "cancelled",
];

export async function PATCH(request: Request) {
  try {
    // 1. Verify the administrator's session
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    if (!token || !(await verifyAdminSession(token))) {
      return NextResponse.json(
        {
          success: false,
          message: "Unauthorized. Please log in as an administrator.",
        },
        { status: 401 }
      );
    }

    // 2. Read and validate the request body
    let body: { orderId?: unknown; status?: unknown };

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, message: "Invalid request body." },
        { status: 400 }
      );
    }

    const orderId = Number(body.orderId);
    const status = body.status;

    // 3. Validate the order ID
    if (!Number.isSafeInteger(orderId) || orderId <= 0) {
      return NextResponse.json(
        { success: false, message: "Invalid order ID." },
        { status: 400 }
      );
    }

    // 4. Validate the requested status
    if (
      typeof status !== "string" ||
      !allowedStatuses.includes(status)
    ) {
      return NextResponse.json(
        { success: false, message: "Invalid order status." },
        { status: 400 }
      );
    }

    // 5. Update the order only after authentication and validation
    const result = await pool.query(
      `UPDATE orders
       SET status = $1
       WHERE id = $2
       RETURNING id, status`,
      [status, orderId]
    );

    if (result.rowCount === 0) {
      return NextResponse.json(
        { success: false, message: "Order not found." },
        { status: 404 }
      );
    }

    // 6. Return the updated order
    return NextResponse.json({
      success: true,
      order: result.rows[0],
    });
  } catch (error) {
    console.error("Failed to update order status:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to update order status.",
      },
      { status: 500 }
    );
  }
}