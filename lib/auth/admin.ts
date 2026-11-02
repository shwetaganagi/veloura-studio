import "server-only";

import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";

const SESSION_COOKIE_NAME = "veloura_admin_session";
const SESSION_DURATION_SECONDS = 60 * 60 * 8;

function getSessionSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET must contain at least 32 characters.");
  }

  return new TextEncoder().encode(secret);
}

export async function verifyAdminPassword(password: string) {
  const encodedHash = process.env.ADMIN_PASSWORD_HASH_B64;

  if (!encodedHash) {
    throw new Error("ADMIN_PASSWORD_HASH_B64 is not configured.");
  }

  const passwordHash = Buffer.from(encodedHash, "base64").toString("utf8");

  if (!/^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(passwordHash)) {
    throw new Error("The configured admin password hash is invalid.");
  }

  return bcrypt.compare(password, passwordHash);
}

export async function createAdminSession() {
  return new SignJWT({ role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(getSessionSecret());
}

export async function verifyAdminSession(token: string) {
  try {
    const { payload } = await jwtVerify(token, getSessionSecret(), {
      algorithms: ["HS256"],
    });

    return payload.role === "admin";
  } catch {
    return false;
  }
}

export { SESSION_COOKIE_NAME, SESSION_DURATION_SECONDS };