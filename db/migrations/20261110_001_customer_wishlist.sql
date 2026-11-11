BEGIN;

CREATE TABLE customer_wishlist (
  customer_id BIGINT NOT NULL
    REFERENCES customers(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL
    REFERENCES products(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (customer_id, product_id)
);

CREATE INDEX customer_wishlist_customer_created_idx
  ON customer_wishlist (customer_id, created_at DESC);

COMMIT;
