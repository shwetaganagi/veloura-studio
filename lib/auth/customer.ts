import "server-only";

import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { pool } from "@/lib/db";

export const CUSTOMER_SESSION_COOKIE = "veloura_customer_session";

const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 7;

function getCustomerSessionSecret(): Uint8Array {
  const secret = process.env.CUSTOMER_SESSION_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error(
      "CUSTOMER_SESSION_SECRET must contain at least 32 characters."
    );
  }

  return new TextEncoder().encode(secret);
}

export async function createCustomerSession(customerId: string, sessionVersion = 0) {
  return new SignJWT({ role: "customer", sv: sessionVersion })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(customerId)
    .setIssuer("veloura-studio")
    .setAudience("veloura-customers")
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(getCustomerSessionSecret());
}

export async function verifyCustomerSession(token: string) {
  try {
    const { payload } = await jwtVerify(
      token,
      getCustomerSessionSecret(),
      {
        algorithms: ["HS256"],
        issuer: "veloura-studio",
        audience: "veloura-customers",
      }
    );

    if (
      payload.role !== "customer" ||
      typeof payload.sub !== "string" ||
      !/^\d+$/.test(payload.sub)
    ) {
      return null;
    }

    const session = {
      customerId: payload.sub,
      sessionVersion: typeof payload.sv === "number" && Number.isInteger(payload.sv) ? payload.sv : 0,
    };
    const result = await pool.query<{ email_verified: boolean; auth_session_version: number }>(
      "SELECT email_verified, auth_session_version FROM customers WHERE id = $1 LIMIT 1",
      [session.customerId]
    );
    const customer = result.rows[0];
    return customer?.email_verified && Number(customer.auth_session_version) === session.sessionVersion
      ? session
      : null;
  } catch {
    return null;
  }
}

export async function getCustomerSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(CUSTOMER_SESSION_COOKIE)?.value;

  if (!token) {
    return null;
  }

  return verifyCustomerSession(token);
}

export const CUSTOMER_SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_DURATION_SECONDS,
};
