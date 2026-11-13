import test from "node:test";
import assert from "node:assert/strict";
import { isValidCustomerPassword } from "../../lib/auth/password-policy.ts";

test("password policy accepts passphrases of at least 12 characters within bcrypt's byte limit", () => {
  assert.equal(isValidCustomerPassword("garden petals 2026"), true);
  assert.equal(isValidCustomerPassword("123456789012"), true);
});

test("password policy rejects short values and values exceeding 72 UTF-8 bytes", () => {
  assert.equal(isValidCustomerPassword("short"), false);
  assert.equal(isValidCustomerPassword("🌸".repeat(19)), false);
  assert.equal(isValidCustomerPassword("🌸".repeat(18)), true);
});
