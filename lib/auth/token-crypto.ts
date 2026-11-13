import { createHash, randomBytes } from "node:crypto";

export function hashAuthToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function createOpaqueAuthToken() {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashAuthToken(token) };
}
