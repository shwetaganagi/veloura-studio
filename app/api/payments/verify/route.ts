import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import {
  getRazorpay,
  verifyCheckoutSignature,
} from "@/lib/payments/razorpay";
import {
  markPaymentCaptured,
  markPaymentFailed,
  PaymentSettlementError,
} from "@/lib/payments/settlement";
import type { Orders } from "razorpay/dist/types/orders";
import type { Payments } from "razorpay/dist/types/payments";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    const value: unknown = await request.json();
    if (!isObject(value)) {
      throw new Error("Invalid body.");
    }
    body = value;
  } catch {
    return NextResponse.json(
      { success: false, message: "Invalid payment verification request." },
      { status: 400 }
    );
  }

  const orderId =
    typeof body.razorpay_order_id === "string"
      ? body.razorpay_order_id
      : "";
  const paymentId =
    typeof body.razorpay_payment_id === "string"
      ? body.razorpay_payment_id
      : "";
  const signature =
    typeof body.razorpay_signature === "string"
      ? body.razorpay_signature
      : "";

  if (
    !/^order_[A-Za-z0-9]{6,}$/i.test(orderId) ||
    !/^pay_[A-Za-z0-9]{6,}$/i.test(paymentId) ||
    !/^[a-f0-9]{64}$/i.test(signature)
  ) {
    return NextResponse.json(
      { success: false, message: "Invalid payment verification request." },
      { status: 400 }
    );
  }

  let razorpay: ReturnType<typeof getRazorpay>;
  let validSignature: boolean;
  try {
    razorpay = getRazorpay();
    validSignature = verifyCheckoutSignature(orderId, paymentId, signature);
  } catch {
    console.error("Razorpay is not configured for payment verification.");
    return NextResponse.json(
      { success: false, message: "Online payment verification is unavailable." },
      { status: 503 }
    );
  }

  if (!validSignature) {
    return NextResponse.json(
      { success: false, message: "Payment signature is invalid." },
      { status: 400 }
    );
  }

  const attemptResult = await pool.query<{
    id: string;
    order_id: string;
    amount_paise: string | number;
    currency: string;
  }>(
    `SELECT id, order_id, amount_paise, currency
     FROM payment_attempts
     WHERE razorpay_order_id = $1`,
    [orderId]
  );
  const attempt = attemptResult.rows[0];
  if (!attempt) {
    return NextResponse.json(
      { success: false, message: "Payment order was not found." },
      { status: 404 }
    );
  }

  let providerPayment: Payments.RazorpayPayment;
  let providerOrder: Orders.RazorpayOrder;
  try {
    [providerPayment, providerOrder] = await Promise.all([
      razorpay.client.payments.fetch(paymentId),
      razorpay.client.orders.fetch(orderId),
    ]);
  } catch {
    console.error("Unable to retrieve payment details from Razorpay.");
    return NextResponse.json(
      { success: false, message: "Unable to verify payment with the provider." },
      { status: 502 }
    );
  }

  const expectedAmount = Number(attempt.amount_paise);
  if (
    providerPayment.id !== paymentId ||
    providerPayment.order_id !== orderId ||
    providerOrder.id !== orderId ||
    !Number.isSafeInteger(Number(providerPayment.amount)) ||
    Number(providerPayment.amount) !== expectedAmount ||
    providerPayment.currency !== attempt.currency ||
    Number(providerOrder.amount) !== expectedAmount ||
    providerOrder.currency !== attempt.currency ||
    attempt.currency !== "INR"
  ) {
    return NextResponse.json(
      { success: false, message: "Payment details do not match the order." },
      { status: 400 }
    );
  }

  if (providerPayment.status !== "captured") {
    if (providerPayment.status === "failed") {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await markPaymentFailed(client, attempt.id, {
          paymentId,
          orderId: attempt.order_id,
          amountPaise: expectedAmount,
          currency: attempt.currency,
        });
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        console.error("Unable to record a failed Razorpay payment.");
        if (error instanceof PaymentSettlementError) {
          return NextResponse.json(
            { success: false, message: "Payment details do not match the order." },
            { status: 409 }
          );
        }
        return NextResponse.json(
          { success: false, message: "Unable to update payment status." },
          { status: 500 }
        );
      } finally {
        client.release();
      }

      return NextResponse.json(
        { success: false, message: "The payment was not completed." },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { success: false, pending: true, message: "Payment is not captured yet." },
      { status: 202 }
    );
  }

  const client = await pool.connect();
  let settlement: { alreadyProcessed: boolean; inventoryConflict: boolean };
  try {
    await client.query("BEGIN");
    settlement = await markPaymentCaptured(client, attempt.id, {
      paymentId,
      orderId: attempt.order_id,
      amountPaise: expectedAmount,
      currency: attempt.currency,
    });
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    if (error instanceof PaymentSettlementError) {
      return NextResponse.json(
        { success: false, message: "Payment details do not match the order." },
        { status: 409 }
      );
    }
    console.error("Unable to record a captured Razorpay payment.");
    return NextResponse.json(
      { success: false, message: "Unable to update payment status." },
      { status: 500 }
    );
  } finally {
    client.release();
  }

  if (settlement.inventoryConflict) {
    console.error("A captured Razorpay payment requires inventory resolution.");
  }

  return NextResponse.json({
    success: true,
    paid: true,
    alreadyProcessed: settlement.alreadyProcessed,
    inventoryConflict: settlement.inventoryConflict,
  });
}
