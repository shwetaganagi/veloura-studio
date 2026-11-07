import "server-only";

import type { PoolClient } from "pg";
import { getCaptureReplayDisposition } from "@/lib/payments/webhook-state";

type PaymentEvent = {
  paymentId: string;
  orderId: string;
  amountPaise: number;
  currency: string;
};

type AttemptRow = {
  id: string;
  order_id: string;
  amount_paise: string | number;
  currency: string;
  status: string;
  razorpay_payment_id: string | null;
};

export class PaymentSettlementError extends Error {
  constructor(
    public readonly code:
      | "ATTEMPT_NOT_FOUND"
      | "PAYMENT_DETAILS_MISMATCH"
      | "PAYMENT_ALREADY_CAPTURED"
  ) {
    super(code);
  }
}

async function lockAttempt(
  client: PoolClient,
  attemptId: string
): Promise<AttemptRow> {
  const result = await client.query<AttemptRow>(
    `SELECT id, order_id, amount_paise, currency, status, razorpay_payment_id
     FROM payment_attempts
     WHERE id = $1
     FOR UPDATE`,
    [attemptId]
  );

  const attempt = result.rows[0];
  if (!attempt) {
    throw new PaymentSettlementError("ATTEMPT_NOT_FOUND");
  }

  return attempt;
}

function matchesAttempt(attempt: AttemptRow, payment: PaymentEvent) {
  return (
    attempt.order_id === payment.orderId &&
    Number(attempt.amount_paise) === payment.amountPaise &&
    attempt.currency === payment.currency
  );
}

export async function markPaymentCaptured(
  client: PoolClient,
  attemptId: string,
  payment: PaymentEvent
) {
  const attempt = await lockAttempt(client, attemptId);

  if (!matchesAttempt(attempt, payment)) {
    throw new PaymentSettlementError("PAYMENT_DETAILS_MISMATCH");
  }

  const captureReplay = getCaptureReplayDisposition(
    attempt.status,
    attempt.razorpay_payment_id,
    payment.paymentId,
    false
  );
  if (captureReplay.kind === "different_payment") {
    throw new PaymentSettlementError("PAYMENT_ALREADY_CAPTURED");
  }
  if (captureReplay.kind === "duplicate") {
    const reservationResult = await client.query<{ has_conflict: boolean }>(
      `SELECT EXISTS (
         SELECT 1
         FROM payment_inventory_reservations
         WHERE payment_attempt_id = $1
           AND status = 'inventory_conflict'
       ) AS has_conflict`,
      [attemptId]
    );

    return {
      alreadyProcessed: true,
      inventoryConflict:
        reservationResult.rows[0]?.has_conflict ?? captureReplay.inventoryConflict,
    };
  }

  if (
    attempt.razorpay_payment_id &&
    attempt.razorpay_payment_id !== payment.paymentId &&
    attempt.status !== "failed" &&
    attempt.status !== "expired"
  ) {
    throw new PaymentSettlementError("PAYMENT_ALREADY_CAPTURED");
  }

  const orderResult = await client.query<{ payment_status: string | null }>(
    `SELECT payment_status
     FROM orders
     WHERE id = $1
     FOR UPDATE`,
    [attempt.order_id]
  );

  if (!orderResult.rows[0]) {
    throw new PaymentSettlementError("ATTEMPT_NOT_FOUND");
  }

  if (orderResult.rows[0].payment_status === "paid") {
    throw new PaymentSettlementError("PAYMENT_ALREADY_CAPTURED");
  }

  const reservationResult = await client.query<{
    id: string;
    product_id: string | null;
    quantity: number;
  }>(
    `SELECT id, product_id, quantity
     FROM payment_inventory_reservations
     WHERE payment_attempt_id = $1
     ORDER BY product_id NULLS LAST
     FOR UPDATE`,
    [attemptId]
  );

  const reservations = reservationResult.rows;
  const productIds = reservations
    .map((reservation) => reservation.product_id)
    .filter((productId): productId is string => productId !== null);
  let inventoryConflict =
    reservations.length === 0 || productIds.length !== reservations.length;

  if (!inventoryConflict) {
    const stockResult = await client.query<{
      id: string;
      stock_quantity: number;
    }>(
      `SELECT id, stock_quantity
       FROM products
       WHERE id = ANY($1::bigint[])
       ORDER BY id
       FOR UPDATE`,
      [productIds]
    );

    const stocks = new Map(
      stockResult.rows.map((row) => [row.id, BigInt(row.stock_quantity)])
    );
    const reservedResult = await client.query<{
      product_id: string;
      reserved_quantity: string | number;
    }>(
      `SELECT product_id, SUM(quantity)::bigint AS reserved_quantity
       FROM payment_inventory_reservations
       WHERE payment_attempt_id <> $1
         AND product_id = ANY($2::bigint[])
         AND status = 'reserved'
         AND expires_at > NOW()
       GROUP BY product_id`,
      [attemptId, productIds]
    );
    const otherReservations = new Map(
      reservedResult.rows.map((row) => [
        row.product_id,
        BigInt(row.reserved_quantity),
      ])
    );

    inventoryConflict = reservations.some((reservation) => {
      const productId = reservation.product_id!;
      const stock = stocks.get(productId);
      return (
        stock === undefined ||
        stock - (otherReservations.get(productId) ?? BigInt(0)) <
          BigInt(reservation.quantity)
      );
    });

    if (!inventoryConflict) {
      for (const reservation of reservations) {
        await client.query(
          `UPDATE products
           SET stock_quantity = stock_quantity - $2
           WHERE id = $1`,
          [reservation.product_id, reservation.quantity]
        );
      }
    }
  }

  await client.query(
    `UPDATE payment_inventory_reservations
     SET status = $2, updated_at = NOW()
     WHERE payment_attempt_id = $1
       AND status <> 'committed'`,
    [attemptId, inventoryConflict ? "inventory_conflict" : "committed"]
  );

  await client.query(
    `UPDATE payment_attempts
     SET status = 'captured',
         razorpay_payment_id = $2,
         captured_at = NOW(),
         updated_at = NOW()
     WHERE id = $1`,
    [attemptId, payment.paymentId]
  );

  await client.query(
    `UPDATE orders
     SET payment_method = 'razorpay',
         payment_status = 'paid'
     WHERE id = $1`,
    [attempt.order_id]
  );

  return { alreadyProcessed: false, inventoryConflict };
}

export async function markPaymentFailed(
  client: PoolClient,
  attemptId: string,
  payment: PaymentEvent
) {
  const attempt = await lockAttempt(client, attemptId);

  if (!matchesAttempt(attempt, payment)) {
    throw new PaymentSettlementError("PAYMENT_DETAILS_MISMATCH");
  }

  if (attempt.status === "captured") {
    return { ignored: true };
  }

  if (
    attempt.status === "failed" &&
    attempt.razorpay_payment_id === payment.paymentId
  ) {
    return { ignored: true };
  }

  await client.query(
    `UPDATE payment_attempts
     SET status = 'failed',
         razorpay_payment_id = $2,
         failed_at = NOW(),
         updated_at = NOW()
     WHERE id = $1`,
    [attemptId, payment.paymentId]
  );
  await client.query(
    `UPDATE payment_inventory_reservations
     SET status = 'released', updated_at = NOW()
     WHERE payment_attempt_id = $1
       AND status = 'reserved'`,
    [attemptId]
  );
  await client.query(
    `UPDATE orders
     SET payment_status = 'failed'
     WHERE id = $1
       AND payment_status IS DISTINCT FROM 'paid'`,
    [attempt.order_id]
  );

  return { ignored: false };
}
