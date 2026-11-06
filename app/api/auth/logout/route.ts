import { NextResponse } from "next/server";
import {
  CUSTOMER_SESSION_COOKIE,
  CUSTOMER_SESSION_COOKIE_OPTIONS,
} from "@/lib/auth/customer";

export async function POST() {
  const response = NextResponse.json({
    success: true,
    message: "Logged out successfully.",
  });

  response.cookies.set(CUSTOMER_SESSION_COOKIE, "", {
    ...CUSTOMER_SESSION_COOKIE_OPTIONS,
    maxAge: 0,
  });

  return response;
}
