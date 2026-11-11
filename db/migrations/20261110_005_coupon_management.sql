BEGIN;

CREATE TABLE coupons (
  id BIGSERIAL PRIMARY KEY,
  code VARCHAR(40) NOT NULL UNIQUE
    CHECK (code ~ '^[A-Z0-9][A-Z0-9_-]{2,39}$'),
  discount_type TEXT NOT NULL
    CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value INTEGER NOT NULL CHECK (discount_value > 0),
  minimum_order_paise BIGINT NOT NULL DEFAULT 0
    CHECK (minimum_order_paise >= 0),
  maximum_discount_paise BIGINT
    CHECK (maximum_discount_paise IS NULL OR maximum_discount_paise > 0),
  starts_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  usage_limit INTEGER CHECK (usage_limit IS NULL OR usage_limit > 0),
  per_customer_limit INTEGER NOT NULL DEFAULT 1
    CHECK (per_customer_limit BETWEEN 1 AND 1000000),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT coupons_percentage_discount_check
    CHECK (discount_type <> 'percentage' OR discount_value <= 100),
  CONSTRAINT coupons_dates_check CHECK (expires_at > starts_at)
);

CREATE INDEX coupons_active_dates_idx
  ON coupons (is_active, starts_at, expires_at);

ALTER TABLE orders
  ADD COLUMN coupon_id BIGINT REFERENCES coupons(id) ON DELETE SET NULL,
  ADD COLUMN coupon_code VARCHAR(40),
  ADD COLUMN coupon_discount_paise BIGINT NOT NULL DEFAULT 0
    CHECK (coupon_discount_paise >= 0);

CREATE TABLE coupon_redemptions (
  id BIGSERIAL PRIMARY KEY,
  coupon_id BIGINT NOT NULL REFERENCES coupons(id) ON DELETE RESTRICT,
  order_id BIGINT NOT NULL UNIQUE REFERENCES orders(id) ON DELETE RESTRICT,
  customer_id BIGINT REFERENCES customers(id) ON DELETE SET NULL,
  customer_key CHAR(64) NOT NULL
    CHECK (customer_key ~ '^[0-9a-f]{64}$'),
  code_snapshot VARCHAR(40) NOT NULL,
  subtotal_paise BIGINT NOT NULL CHECK (subtotal_paise > 0),
  discount_paise BIGINT NOT NULL CHECK (discount_paise > 0),
  status TEXT NOT NULL
    CHECK (status IN ('reserved', 'redeemed', 'released', 'expired')),
  expires_at TIMESTAMPTZ,
  redeemed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT coupon_redemptions_discount_check
    CHECK (discount_paise < subtotal_paise)
);

CREATE INDEX coupon_redemptions_coupon_status_idx
  ON coupon_redemptions (coupon_id, status, expires_at);
CREATE INDEX coupon_redemptions_customer_usage_idx
  ON coupon_redemptions (coupon_id, customer_key, status, expires_at);
CREATE INDEX coupon_redemptions_order_idx
  ON coupon_redemptions (order_id);

COMMIT;
