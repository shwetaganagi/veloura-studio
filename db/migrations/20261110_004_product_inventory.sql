BEGIN;

CREATE TABLE inventory_settings (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  low_stock_threshold INTEGER NOT NULL DEFAULT 5
    CHECK (low_stock_threshold BETWEEN 0 AND 1000000),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO inventory_settings (id, low_stock_threshold)
VALUES (1, 5);

CREATE TABLE inventory_movements (
  id BIGSERIAL PRIMARY KEY,
  product_id BIGINT NOT NULL
    REFERENCES products(id) ON DELETE RESTRICT,
  order_id BIGINT
    REFERENCES orders(id) ON DELETE RESTRICT,
  movement_type TEXT NOT NULL
    CHECK (movement_type IN ('opening', 'production', 'adjustment', 'sale', 'restock')),
  quantity_change INTEGER NOT NULL CHECK (quantity_change <> 0),
  stock_before INTEGER NOT NULL CHECK (stock_before >= 0),
  stock_after INTEGER NOT NULL CHECK (stock_after >= 0),
  reason VARCHAR(500) NOT NULL CHECK (length(trim(reason)) > 0),
  idempotency_key VARCHAR(160) NOT NULL UNIQUE,
  actor TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT inventory_movements_balance_check
    CHECK (stock_after = stock_before + quantity_change)
);

CREATE INDEX inventory_movements_product_created_idx
  ON inventory_movements (product_id, created_at DESC);
CREATE INDEX inventory_movements_order_idx
  ON inventory_movements (order_id, created_at DESC)
  WHERE order_id IS NOT NULL;
CREATE INDEX inventory_movements_type_created_idx
  ON inventory_movements (movement_type, created_at DESC);

INSERT INTO inventory_movements (
  product_id,
  movement_type,
  quantity_change,
  stock_before,
  stock_after,
  reason,
  idempotency_key,
  actor
)
SELECT
  id,
  'opening',
  stock_quantity,
  0,
  stock_quantity,
  'Opening balance when inventory tracking was enabled',
  'opening:' || id::text,
  'system'
FROM products
WHERE stock_quantity > 0;

COMMIT;
