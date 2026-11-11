BEGIN;

ALTER TABLE order_items
  ADD COLUMN product_id BIGINT
    REFERENCES products(id) ON DELETE SET NULL;

WITH uniquely_named_products AS (
  SELECT name, MIN(id) AS product_id
  FROM products
  GROUP BY name
  HAVING COUNT(*) = 1
)
UPDATE order_items oi
SET product_id = products.product_id
FROM uniquely_named_products products
WHERE oi.product_name = products.name;

CREATE INDEX order_items_product_order_idx
  ON order_items (product_id, order_id)
  WHERE product_id IS NOT NULL;

CREATE TABLE customer_reviews (
  id BIGSERIAL PRIMARY KEY,
  customer_id BIGINT NOT NULL
    REFERENCES customers(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL
    REFERENCES products(id) ON DELETE CASCADE,
  order_id BIGINT NOT NULL
    REFERENCES orders(id) ON DELETE CASCADE,
  display_name VARCHAR(80) NOT NULL,
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title VARCHAR(120) NOT NULL,
  review_text VARCHAR(3000) NOT NULL,
  photo_data BYTEA,
  photo_mime VARCHAR(32)
    CHECK (photo_mime IS NULL OR photo_mime IN ('image/jpeg', 'image/png', 'image/webp')),
  moderation_status TEXT NOT NULL DEFAULT 'visible'
    CHECK (moderation_status IN ('visible', 'hidden')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT customer_reviews_photo_pair_check
    CHECK ((photo_data IS NULL) = (photo_mime IS NULL)),
  CONSTRAINT customer_reviews_one_per_purchase
    UNIQUE (customer_id, product_id, order_id)
);

CREATE INDEX customer_reviews_product_visible_created_idx
  ON customer_reviews (product_id, created_at DESC)
  WHERE moderation_status = 'visible';
CREATE INDEX customer_reviews_customer_product_idx
  ON customer_reviews (customer_id, product_id, created_at DESC);
CREATE INDEX customer_reviews_order_product_idx
  ON customer_reviews (order_id, product_id);

CREATE TABLE customer_review_moderation_log (
  id BIGSERIAL PRIMARY KEY,
  review_id BIGINT NOT NULL
    REFERENCES customer_reviews(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('hidden', 'restored')),
  admin_identity TEXT NOT NULL DEFAULT 'admin',
  reason VARCHAR(500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX customer_review_moderation_log_review_created_idx
  ON customer_review_moderation_log (review_id, created_at DESC);

COMMIT;
