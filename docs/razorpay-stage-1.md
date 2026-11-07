# Razorpay backend foundation (Stage 1)

## Configuration

Set these server-side environment variables before enabling the payment routes:

- `RAZORPAY_KEY_ID` — public checkout identifier; returned by the payment-order endpoint for the later customer UI.
- `RAZORPAY_KEY_SECRET` — server-only credential used for authenticated SDK calls and Checkout signature verification.
- `RAZORPAY_WEBHOOK_SECRET` — server-only secret configured for the Razorpay webhook endpoint.

Do not prefix either secret with `NEXT_PUBLIC_` or expose them to the browser. No credential values belong in this document.

## Migration

`db/migrations/20260403_001_razorpay_stage_1.sql` is the single Stage 1 migration. Apply it only after review, backup, and a successful staging test. It is wrapped in a transaction; execute the complete file once using the approved database migration process. Do not apply it directly to production as part of this stage. The webhook ledger definition was revised during Stage 1 review; if an earlier version of this migration has already been applied anywhere, do not rerun or overwrite it there—prepare and review a separate forward migration for that database. The payment endpoints require this schema; the existing WhatsApp order route does not query the new tables and does not depend on this migration.

The new `orders.payment_method` and `orders.payment_status` columns are nullable and have no default, so old rows retain unknown/legacy meaning instead of being mislabeled. New online orders set both fields explicitly. The existing WhatsApp order route is unchanged: it does not reserve/decrement stock differently, set the new payment fields, or query the new tables. Instagram is unchanged.

The migration adds a required SHA-256 request fingerprint to each payment attempt. Reusing an idempotency key for different normalized customer, account, address, or cart data is rejected. It also adds:

- `payment_attempts`, with a unique idempotency key and unique Razorpay order/payment IDs.
- `payment_inventory_reservations`, tracking stock held for each online attempt.
- `payment_webhook_events`, deduplicating Razorpay events by event ID, retaining only the provider identifiers/status/amount/currency and a payload digest needed for retries and reconciliation. Raw webhook bodies are not stored.
- Indexes for order lookup, active reservation checks, expiration, and webhook history.

## Server endpoints

- `POST /api/payments/create-order` accepts customer/contact/delivery details and product IDs/quantities. It recalculates prices from PostgreSQL, reserves available inventory, creates the local order and attempt, and then creates a Razorpay order. A UUID `Idempotency-Key` header is required. Replaying a pending key returns the existing provider order; callers must use a new key after a failed/expired attempt.
- `POST /api/payments/verify` accepts `razorpay_order_id`, `razorpay_payment_id`, and `razorpay_signature`. It checks the Checkout HMAC, fetches the payment through the server SDK, verifies the order association, amount and INR currency, and records payment only when the provider reports it captured. Authorization alone is not treated as payment.
- `POST /api/payments/webhook` verifies `X-Razorpay-Signature` against the exact raw body and uses `x-razorpay-event-id` for deduplication. It handles `payment.captured` and `payment.failed`; captured status is terminal against late failure events.

Webhook event statuses distinguish retryable `pending`, terminal `processed`, `ignored`, `inventory_conflict`, and `invalid`, and `manual_review`. A pending event is retried when the provider redelivers the same event ID; it is not short-circuited by deduplication. Database failures roll back and return `503`; unmatched attempts are durably retained as pending and also return `503` to request provider retry. Signed malformed events are retained as invalid and acknowledged. Amount/order mismatches and event-ID payload changes are retained for manual review and acknowledged to avoid futile automatic retries. The event ledger stores extracted provider identifiers and payment details, a payload digest, and the first conflicting event details when a reused event ID has changed content; it does not store raw webhook bodies. This stage does not include a scheduled internal retry worker; reconcile any pending rows after provider retries are exhausted.

The stock reservation window is 15 minutes. Expired holds no longer count against available stock and are marked expired during subsequent payment-order creation. Failure events release active reservations. Captured payments commit the reservation and decrement stock in a transaction using product row locks. If a valid capture arrives after a reservation expires and remaining stock cannot satisfy it, the payment remains recorded as captured and the reservation is marked `inventory_conflict` for manual resolution; this stage does not implement refunds or an admin resolution screen. Repeated verification and webhook deliveries return the persisted settlement result, including that conflict state, without decrementing stock again.

The existing WhatsApp flow retains its prior stock check (locks products and compares requested quantity with `stock_quantity`) but does not decrement or reserve stock. Accordingly, it is intentionally not coupled to online reservations; the legacy WhatsApp inventory model cannot account for stock consumed by off-site/manual sales, which remains an inventory reconciliation risk.

## Stage boundary and operational notes

The customer checkout UI and admin dashboard are intentionally unchanged. Therefore customers cannot initiate Razorpay from the website until a later stage wires the payment-order endpoint and Checkout script into the UI. Orders created through the existing `/api/orders` checkout leave the new payment fields `NULL`, because off-site payment is not verified by this system. Historical rows also remain unclassified (`NULL`). The Instagram DM path is untouched.

There is no scheduled cleanup dependency: expired holds are excluded from availability calculations by timestamp, and stale rows are marked expired on the next payment-order request. A low-traffic store may retain stale rows until that request; this does not keep stock unavailable.
