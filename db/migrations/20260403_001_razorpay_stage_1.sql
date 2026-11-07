BEGIN;

ALTER TABLE orders
  ADD COLUMN payment_method TEXT
    CHECK (payment_method IN ('razorpay', 'whatsapp')),
  ADD COLUMN payment_status TEXT
    CHECK (payment_status IN ('pending', 'paid', 'failed', 'expired', 'refunded'));

CREATE TABLE payment_attempts (
  id BIGSERIAL PRIMARY KEY,
  order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  idempotency_key VARCHAR(100) NOT NULL UNIQUE,
  request_fingerprint CHAR(64) NOT NULL
    CHECK (request_fingerprint ~ '^[0-9a-f]{64}$'),
  razorpay_order_id VARCHAR(64) UNIQUE,
  razorpay_payment_id VARCHAR(64) UNIQUE,
  amount_paise BIGINT NOT NULL CHECK (amount_paise > 0),
  currency CHAR(3) NOT NULL DEFAULT 'INR' CHECK (currency = 'INR'),
  status TEXT NOT NULL
    CHECK (status IN ('creating', 'pending', 'failed', 'captured', 'expired')),
  expires_at TIMESTAMPTZ NOT NULL,
  captured_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX payment_attempts_order_id_idx
  ON payment_attempts (order_id, created_at DESC);
CREATE UNIQUE INDEX payment_attempts_one_live_per_order_idx
  ON payment_attempts (order_id)
  WHERE status IN ('creating', 'pending', 'captured');
CREATE INDEX payment_attempts_expiry_idx
  ON payment_attempts (expires_at)
  WHERE status IN ('creating', 'pending');

CREATE TABLE payment_inventory_reservations (
  id BIGSERIAL PRIMARY KEY,
  payment_attempt_id BIGINT NOT NULL
    REFERENCES payment_attempts(id) ON DELETE RESTRICT,
  product_id BIGINT REFERENCES products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  status TEXT NOT NULL
    CHECK (status IN ('reserved', 'committed', 'released', 'expired', 'inventory_conflict')),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX payment_inventory_reservations_attempt_product_idx
  ON payment_inventory_reservations (payment_attempt_id, product_id)
  WHERE product_id IS NOT NULL;
CREATE INDEX payment_inventory_reservations_active_idx
  ON payment_inventory_reservations (product_id, expires_at)
  WHERE status = 'reserved';

CREATE TABLE payment_webhook_events (
  event_id VARCHAR(100) PRIMARY KEY,
  event_type TEXT NOT NULL
    CHECK (event_type IN ('payment.captured', 'payment.failed')),
  payment_id VARCHAR(64),
  razorpay_order_id VARCHAR(64),
  amount_paise BIGINT CHECK (amount_paise IS NULL OR amount_paise > 0),
  currency TEXT,
  provider_payment_status TEXT,
  payload_fingerprint CHAR(64) NOT NULL
    CHECK (payload_fingerprint ~ '^[0-9a-f]{64}$'),
  payment_attempt_id BIGINT REFERENCES payment_attempts(id) ON DELETE SET NULL,
  processing_status TEXT NOT NULL
    CHECK (processing_status IN (
      'pending',
      'processed',
      'ignored',
      'inventory_conflict',
      'manual_review',
      'invalid'
    )),
  processing_error TEXT,
    conflicting_event_data JSONB
      CHECK (
        conflicting_event_data IS NULL
        OR jsonb_typeof(conflicting_event_data) = 'object'
      ),
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX payment_webhook_events_payment_attempt_idx
  ON payment_webhook_events (payment_attempt_id, received_at DESC);
CREATE INDEX payment_webhook_events_pending_idx
  ON payment_webhook_events (received_at)
  WHERE processing_status = 'pending';
CREATE INDEX payment_webhook_events_manual_review_idx
  ON payment_webhook_events (received_at)
  WHERE processing_status = 'manual_review';
CREATE INDEX payment_webhook_events_provider_order_idx
  ON payment_webhook_events (razorpay_order_id, received_at DESC)
  WHERE razorpay_order_id IS NOT NULL;
CREATE INDEX payment_webhook_events_provider_payment_idx
  ON payment_webhook_events (payment_id, received_at DESC)
  WHERE payment_id IS NOT NULL;

COMMIT;
