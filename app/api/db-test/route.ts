import { NextResponse, connection } from "next/server";
import { cookies } from "next/headers";
import { pool } from "@/lib/db";
import {
  SESSION_COOKIE_NAME,
  verifyAdminSession,
} from "@/lib/auth/admin";

export async function GET() {
  await connection();

  try {
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

    await pool.query("SELECT 1");

    return NextResponse.json({
      success: true,
      message: "Database connection successful",
    });
  } catch (error) {
    console.error("Database connection test failed:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Database connection failed. Check the server logs.",
      },
      { status: 500 }
    );
  }
}
