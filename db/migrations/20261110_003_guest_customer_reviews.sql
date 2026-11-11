BEGIN;

ALTER TABLE customer_reviews
  ALTER COLUMN customer_id DROP NOT NULL,
  ALTER COLUMN order_id DROP NOT NULL,
  DROP CONSTRAINT customer_reviews_one_per_purchase;

ALTER TABLE customer_reviews
  ADD CONSTRAINT customer_reviews_order_requires_customer
    CHECK (order_id IS NULL OR customer_id IS NOT NULL),
  ADD COLUMN submission_ip_hash CHAR(64)
    CHECK (submission_ip_hash IS NULL OR submission_ip_hash ~ '^[0-9a-f]{64}$');

CREATE UNIQUE INDEX customer_reviews_one_per_purchase_idx
  ON customer_reviews (customer_id, product_id, order_id)
  WHERE customer_id IS NOT NULL AND order_id IS NOT NULL;

CREATE INDEX customer_reviews_rate_limit_idx
  ON customer_reviews (submission_ip_hash, created_at DESC, product_id)
  WHERE submission_ip_hash IS NOT NULL;

COMMIT;
