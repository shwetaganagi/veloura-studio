import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import type { PoolClient } from "pg";
import { pool } from "@/lib/db";
import { verifyWebhookSignature } from "@/lib/payments/razorpay";
import {
  markPaymentCaptured,
  markPaymentFailed,
  PaymentSettlementError,
} from "@/lib/payments/settlement";
import {
  getWebhookHttpStatus,
  getWebhookEventDisposition,
  webhookPaymentMatchesAttempt,
} from "@/lib/payments/webhook-state";
import type { WebhookProcessingStatus } from "@/lib/payments/webhook-state";

const MAX_WEBHOOK_BODY_BYTES = 64 * 1024;

async function readBoundedBody(request: Request) {
  const declaredLength = Number(request.headers.get("content-length"));
  if (
    Number.isFinite(declaredLength) &&
    declaredLength > MAX_WEBHOOK_BODY_BYTES
  ) {
    return null;
  }

  if (!request.body) {
    return Buffer.alloc(0);
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    totalBytes += value.byteLength;
    if (totalBytes > MAX_WEBHOOK_BODY_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }

  return Buffer.concat(chunks);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function POST(request: Request) {
  let rawBody: Buffer | null;
  try {
    rawBody = await readBoundedBody(request);
  } catch {
    return NextResponse.json(
      { success: false, message: "Unable to read webhook request." },
      { status: 400 }
    );
  }

  if (!rawBody) {
    return NextResponse.json(
      { success: false, message: "Webhook request is too large." },
      { status: 413 }
    );
  }

  const signature = request.headers.get("x-razorpay-signature") ?? "";
  let isSignatureValid: boolean;
  try {
    isSignatureValid = verifyWebhookSignature(rawBody, signature);
  } catch {
    console.error("Razorpay webhook secret is not configured.");
    return NextResponse.json(
      { success: false, message: "Webhook verification is unavailable." },
      { status: 503 }
    );
  }

  if (!isSignatureValid) {
    return NextResponse.json(
      { success: false, message: "Invalid webhook signature." },
      { status: 401 }
    );
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody.toString("utf8"));
  } catch {
    return NextResponse.json(
      { success: false, message: "Invalid webhook payload." },
      { status: 400 }
    );
  }

  if (!isObject(payload) || typeof payload.event !== "string") {
    return NextResponse.json(
      { success: false, message: "Invalid webhook payload." },
      { status: 400 }
    );
  }

  if (
    payload.event !== "payment.captured" &&
    payload.event !== "payment.failed"
  ) {
    return NextResponse.json({ success: true, ignored: true });
  }

  const eventId = request.headers.get("x-razorpay-event-id") ?? "";
  const eventPayload = isObject(payload.payload) ? payload.payload : null;
  const paymentPayload =
    eventPayload && isObject(eventPayload.payment) ? eventPayload.payment : null;
  const entity =
    paymentPayload && isObject(paymentPayload.entity)
      ? paymentPayload.entity
      : null;
  const paymentId = typeof entity?.id === "string" ? entity.id : "";
  const orderId = typeof entity?.order_id === "string" ? entity.order_id : "";
  const currency = typeof entity?.currency === "string" ? entity.currency : null;
  const amountPaise =
    typeof entity?.amount === "number" ? entity.amount : Number.NaN;
  const providerStatus =
    typeof entity?.status === "string" ? entity.status : null;
  const expectedStatus =
    payload.event === "payment.captured" ? "captured" : "failed";

  if (!/^[A-Za-z0-9_-]{1,100}$/.test(eventId)) {
    return NextResponse.json(
      { success: false, message: "Invalid webhook event identifier." },
      { status: 400 }
    );
  }

  const payloadFingerprint = createHash("sha256").update(rawBody).digest("hex");
  const validEvent =
    /^pay_[A-Za-z0-9]{6,}$/i.test(paymentId) &&
    /^order_[A-Za-z0-9]{6,}$/i.test(orderId) &&
    Number.isSafeInteger(amountPaise) &&
    amountPaise > 0 &&
    currency === "INR" &&
    providerStatus === expectedStatus;

  let client: PoolClient;
  try {
    client = await pool.connect();
  } catch {
    console.error("Unable to connect to the database for a Razorpay webhook.");
    return NextResponse.json(
      { success: false, retryable: true, message: "Webhook processing is temporarily unavailable." },
      { status: 503 }
    );
  }

  try {
    await client.query("BEGIN");
    const eventInsert = await client.query<{ event_id: string }>(
      `INSERT INTO payment_webhook_events (
         event_id,
         event_type,
         payment_id,
         razorpay_order_id,
         amount_paise,
         currency,
         provider_payment_status,
         payload_fingerprint,
         processing_status
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')
       ON CONFLICT (event_id) DO NOTHING
       RETURNING event_id`,
      [
        eventId,
        payload.event,
        paymentId.length <= 64 ? paymentId || null : null,
        orderId.length <= 64 ? orderId || null : null,
        Number.isSafeInteger(amountPaise) && amountPaise > 0 ? amountPaise : null,
        currency,
        providerStatus,
        payloadFingerprint,
      ]
    );

    const existingEventResult = await client.query<{
      processing_status: WebhookProcessingStatus;
      payload_fingerprint: string;
    }>(
      `SELECT processing_status, payload_fingerprint
         FROM payment_webhook_events
       WHERE event_id = $1
       FOR UPDATE`,
      [eventId]
    );
    const existingEvent = existingEventResult.rows[0];
    if (!existingEvent) {
      throw new Error("Webhook event was not persisted.");
    }

    const payloadMatches =
      existingEvent.payload_fingerprint === payloadFingerprint;
    const disposition = getWebhookEventDisposition(
      existingEvent.processing_status,
      payloadMatches
    );

    if (disposition === "manual_review") {
      await client.query(
        `UPDATE payment_webhook_events
         SET processing_status = 'manual_review',
             processing_error = 'event_id_payload_mismatch',
             conflicting_event_data = COALESCE(conflicting_event_data, $2::jsonb),
             processed_at = NOW()
         WHERE event_id = $1`,
        [
          eventId,
          JSON.stringify({
            eventType: payload.event,
            paymentId: paymentId || null,
            orderId: orderId || null,
            amountPaise: Number.isSafeInteger(amountPaise) ? amountPaise : null,
            currency,
            providerPaymentStatus: providerStatus,
          }),
        ]
      );
      await client.query("COMMIT");
      console.error("A Razorpay event ID was received with different payload content.");
      return NextResponse.json({
        success: true,
        manualReview: true,
        reason: "event_id_payload_mismatch",
      });
    }

    if (disposition === "duplicate") {
      await client.query("COMMIT");
      return NextResponse.json({
        success: true,
        duplicate: eventInsert.rowCount === 0,
        processingStatus: existingEvent.processing_status,
        inventoryConflict:
          existingEvent.processing_status === "inventory_conflict",
        manualReview: existingEvent.processing_status === "manual_review",
      });
    }

    if (!validEvent) {
      await client.query(
        `UPDATE payment_webhook_events
         SET processing_status = 'invalid',
             processing_error = 'invalid_payment_event_payload',
             processed_at = NOW()
         WHERE event_id = $1`,
        [eventId]
      );
      await client.query("COMMIT");
      return NextResponse.json({
        success: true,
        ignored: true,
        processingStatus: "invalid",
      });
    }

    const attemptResult = await client.query<{
      id: string;
      order_id: string;
      amount_paise: string | number;
      currency: string;
    }>(
      `SELECT id, order_id, amount_paise, currency
       FROM payment_attempts
       WHERE razorpay_order_id = $1
       FOR UPDATE`,
      [orderId]
    );
    const attempt = attemptResult.rows[0];

    if (!attempt) {
      await client.query(
        `UPDATE payment_webhook_events
         SET processing_status = 'pending',
             processing_error = 'payment_attempt_not_found',
             processed_at = NULL
         WHERE event_id = $1`,
        [eventId]
      );
      await client.query("COMMIT");
      console.error("A valid Razorpay event is waiting for its payment attempt.");
      return NextResponse.json(
        { success: false, retryable: true, message: "Payment attempt is not available yet." },
        { status: getWebhookHttpStatus("pending") }
      );
    }

    if (
      !webhookPaymentMatchesAttempt(
        { orderId, amountPaise, currency: currency ?? "" },
        {
          orderId: attempt.order_id,
          amountPaise: Number(attempt.amount_paise),
          currency: attempt.currency,
        }
      )
    ) {
      await client.query(
        `UPDATE payment_webhook_events
         SET payment_attempt_id = $2,
             processing_status = 'manual_review',
             processing_error = 'payment_details_mismatch',
             processed_at = NOW()
         WHERE event_id = $1`,
        [eventId, attempt.id]
      );
      await client.query("COMMIT");
      console.error("A Razorpay event does not match its local payment attempt.");
      return NextResponse.json({
        success: true,
        manualReview: true,
        reason: "payment_details_mismatch",
      });
    }

    let processingStatus: WebhookProcessingStatus = "processed";
    let processingError: string | null = null;

    try {
      const payment = {
        paymentId,
        orderId: attempt.order_id,
        amountPaise,
        currency: currency ?? "",
      };

      if (payload.event === "payment.captured") {
        const result = await markPaymentCaptured(client, attempt.id, payment);
        if (result.inventoryConflict) {
          processingStatus = "inventory_conflict";
        }
      } else {
        const result = await markPaymentFailed(client, attempt.id, payment);
        if (result.ignored) {
          processingStatus = "ignored";
        }
      }
    } catch (error) {
      if (!(error instanceof PaymentSettlementError)) {
        throw error;
      }
      if (error.code === "ATTEMPT_NOT_FOUND") {
        processingStatus = "pending";
        processingError = error.code.toLowerCase();
      } else {
        processingStatus = "manual_review";
        processingError = error.code.toLowerCase();
      }
    }

    await client.query(
      `UPDATE payment_webhook_events
       SET payment_attempt_id = $2,
           processing_status = $3,
           processing_error = $4,
           processed_at = CASE WHEN $3 = 'pending' THEN NULL ELSE NOW() END
       WHERE event_id = $1`,
      [eventId, attempt.id, processingStatus, processingError]
    );
    await client.query("COMMIT");

    if (processingStatus === "inventory_conflict") {
      console.error("A captured Razorpay payment requires inventory resolution.");
    }

    if (processingStatus === "pending") {
      return NextResponse.json(
        { success: false, retryable: true, message: "Payment event requires retry." },
        { status: getWebhookHttpStatus(processingStatus) }
      );
    }
    if (processingStatus === "manual_review") {
      console.error("A Razorpay event requires manual payment review.");
      return NextResponse.json({
        success: true,
        manualReview: true,
        reason: processingError,
      });
    }

    return NextResponse.json({
      success: true,
      received: true,
      processingStatus,
    });
  } catch {
    await client.query("ROLLBACK").catch(() => undefined);
    console.error("Unable to process a Razorpay webhook event.");
    return NextResponse.json(
      { success: false, retryable: true, message: "Unable to process payment webhook." },
      { status: 503 }
    );
  } finally {
    client.release();
  }
}
