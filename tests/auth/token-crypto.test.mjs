import test from "node:test";
import assert from "node:assert/strict";
import { createOpaqueAuthToken, hashAuthToken } from "../../lib/auth/token-crypto.ts";

test("opaque auth tokens have sufficient random URL-safe material and are stored as hashes", () => {
  const { token, tokenHash } = createOpaqueAuthToken();
  assert.match(token, /^[A-Za-z0-9_-]{43}$/);
  assert.match(tokenHash, /^[a-f0-9]{64}$/);
  assert.notEqual(token, tokenHash);
  assert.equal(hashAuthToken(token), tokenHash);
});

test("auth token hashing is deterministic and distinguishes different tokens", () => {
  assert.equal(hashAuthToken("token-one"), hashAuthToken("token-one"));
  assert.notEqual(hashAuthToken("token-one"), hashAuthToken("token-two"));
});
