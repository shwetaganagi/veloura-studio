import { NextResponse } from "next/server";
import { pool } from "@/lib/db";


export async function GET() {
  try {
    const result = await pool.query(
      "SELECT current_database() AS database, current_user AS username, version() AS version"
    );

    return NextResponse.json({
      success: true,
      message: "Database connection successful",
      database: result.rows[0].database,
      username: result.rows[0].username,
      version: result.rows[0].version.split(" ")[1],
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
