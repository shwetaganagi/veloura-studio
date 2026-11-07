import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import Razorpay from "razorpay";

let razorpayClient: Razorpay | undefined;

function requiredSecret(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is not configured.`);
  }

  return value;
}

export function getRazorpay() {
  const keyId = requiredSecret("RAZORPAY_KEY_ID");
  const keySecret = requiredSecret("RAZORPAY_KEY_SECRET");

  razorpayClient ??= new Razorpay({ key_id: keyId, key_secret: keySecret });

  return { client: razorpayClient, keyId };
}

function matchesHmac(
  secret: string,
  value: string | Buffer,
  signature: string
) {
  if (!/^[a-f0-9]{64}$/i.test(signature)) {
    return false;
  }

  const expected = createHmac("sha256", secret).update(value).digest();
  const received = Buffer.from(signature, "hex");

  return received.length === expected.length && timingSafeEqual(expected, received);
}

export function verifyCheckoutSignature(
  orderId: string,
  paymentId: string,
  signature: string
) {
  const secret = requiredSecret("RAZORPAY_KEY_SECRET");
  return matchesHmac(secret, `${orderId}|${paymentId}`, signature);
}

export function verifyWebhookSignature(rawBody: Buffer, signature: string) {
  const secret = requiredSecret("RAZORPAY_WEBHOOK_SECRET");
  return matchesHmac(secret, rawBody, signature);
}
