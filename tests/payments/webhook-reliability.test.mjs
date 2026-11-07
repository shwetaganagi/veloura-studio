import assert from "node:assert/strict";
import test from "node:test";
import {
  getCaptureReplayDisposition,
  getWebhookEventDisposition,
  getWebhookHttpStatus,
  webhookPaymentMatchesAttempt,
} from "../../lib/payments/webhook-state.ts";

test("completed event IDs are deduplicated without reprocessing", () => {
  for (const status of [
    "processed",
    "ignored",
    "inventory_conflict",
    "manual_review",
    "invalid",
  ]) {
    assert.equal(getWebhookEventDisposition(status, true), "duplicate");
  }
});

test("pending unmatched events remain eligible for retry", () => {
  assert.equal(getWebhookEventDisposition("pending", true), "process");
  assert.equal(getWebhookHttpStatus("pending"), 503);
  assert.equal(getWebhookHttpStatus("manual_review"), 200);
});

test("changed payload for an existing event ID is quarantined", () => {
  assert.equal(getWebhookEventDisposition("pending", false), "manual_review");
  assert.equal(getWebhookEventDisposition("processed", false), "manual_review");
});

test("payment/order/amount/currency mismatches do not match an attempt", () => {
  const attempt = {
    orderId: "42",
    amountPaise: 12500,
    currency: "INR",
  };
  assert.equal(webhookPaymentMatchesAttempt(attempt, attempt), true);
  assert.equal(
    webhookPaymentMatchesAttempt({ ...attempt, amountPaise: 12501 }, attempt),
    false
  );
  assert.equal(
    webhookPaymentMatchesAttempt({ ...attempt, orderId: "43" }, attempt),
    false
  );
  assert.equal(
    webhookPaymentMatchesAttempt({ ...attempt, currency: "USD" }, attempt),
    false
  );
});

test("capture replay preserves the recorded inventory outcome", () => {
  assert.deepEqual(
    getCaptureReplayDisposition("captured", "pay_123456", "pay_123456", false),
    { kind: "duplicate", inventoryConflict: false }
  );
  assert.deepEqual(
    getCaptureReplayDisposition("captured", "pay_123456", "pay_123456", true),
    { kind: "duplicate", inventoryConflict: true }
  );
  assert.deepEqual(
    getCaptureReplayDisposition("pending", null, "pay_123456", false),
    { kind: "continue" }
  );
});
