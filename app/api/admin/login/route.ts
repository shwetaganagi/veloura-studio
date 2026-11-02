import { NextResponse } from "next/server";
import {
  createAdminSession,
  SESSION_COOKIE_NAME,
  SESSION_DURATION_SECONDS,
  verifyAdminPassword,
} from "@/lib/auth/admin";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (
      typeof body.password !== "string" ||
      body.password.length === 0 ||
      body.password.length > 1024
    ) {
      return NextResponse.json(
        { success: false, message: "Please enter a valid password." },
        { status: 400 }
      );
    }

    const passwordMatches = await verifyAdminPassword(body.password);

    if (!passwordMatches) {
      return NextResponse.json(
        { success: false, message: "Invalid password." },
        { status: 401 }
      );
    }

    const token = await createAdminSession();

    const response = NextResponse.json({
      success: true,
      message: "Login successful.",
    });

    response.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_DURATION_SECONDS,
    });

    return response;
  } catch (error) {
    console.error("Admin login failed:", error);

    return NextResponse.json(
      { success: false, message: "Unable to log in. Check the server configuration." },
      { status: 500 }
    );
  }
}