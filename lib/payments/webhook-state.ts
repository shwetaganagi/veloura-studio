export type WebhookProcessingStatus =
  | "pending"
  | "processed"
  | "ignored"
  | "inventory_conflict"
  | "manual_review"
  | "invalid";

export function getWebhookHttpStatus(status: WebhookProcessingStatus): 200 | 503 {
  return status === "pending" ? 503 : 200;
}

export function getWebhookEventDisposition(
  status: WebhookProcessingStatus,
  payloadMatches: boolean
): "process" | "duplicate" | "manual_review" {
  if (!payloadMatches) {
    return "manual_review";
  }

  return status === "pending" ? "process" : "duplicate";
}

export function webhookPaymentMatchesAttempt(
  event: {
    orderId: string;
    amountPaise: number;
    currency: string;
  },
  attempt: {
    orderId: string;
    amountPaise: number;
    currency: string;
  }
) {
  return (
    event.orderId === attempt.orderId &&
    event.amountPaise === attempt.amountPaise &&
    event.currency === attempt.currency
  );
}

export function getCaptureReplayDisposition(
  attemptStatus: string,
  recordedPaymentId: string | null,
  paymentId: string,
  inventoryConflict: boolean
):
  | { kind: "continue" }
  | { kind: "duplicate"; inventoryConflict: boolean }
  | { kind: "different_payment" } {
  if (attemptStatus !== "captured") {
    return { kind: "continue" };
  }

  if (recordedPaymentId === paymentId) {
    return { kind: "duplicate", inventoryConflict };
  }

  return { kind: "different_payment" };
}
