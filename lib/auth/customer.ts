import "server-only";

import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

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

export async function createCustomerSession(customerId: string) {
  return new SignJWT({ role: "customer" })
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

    return {
      customerId: payload.sub,
    };
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
