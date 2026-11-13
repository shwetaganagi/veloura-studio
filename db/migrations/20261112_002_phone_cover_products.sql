BEGIN;

-- Add the phone cover images already present in public/products to the catalog.
-- The image URL check makes this safe to run more than once.
WITH phone_covers(name, image_url) AS (
  VALUES
    ('Blue Bunny Blossom Case', '/products/Blue Bunny Blossom Case.jpeg'),
    ('Blue Daisy Blossom Phone Case', '/products/Blue Daisy Blossom Phone Case.jpeg'),
    ('Bunny Bow Charm Case', '/products/Bunny Bow Charm Case.jpeg'),
    ('Cherry Blossom Love Case', '/products/Cherry Blossom Love Case.jpeg'),
    ('Golden Sunflower Glow Case', '/products/Golden Sunflower Glow Case.jpeg'),
    ('Lavender Tulip Dream Case', '/products/Lavender Tulip Dream Case.jpeg'),
    ('Pastel Butterfly Garden Phone Case', '/products/Pastel Butterfly Garden Phone Case.jpeg'),
    ('Pik Heart Blossom Phone Case', '/products/Pik Heart Blossom Phone Case.jpeg'),
    ('Pink Butterfly Bow Case', '/products/Pink Butterfly Bow Case.jpeg'),
    ('Pink Lily & Butterfly Bow Case', '/products/Pink Lily & Butterfly Bow Case.jpeg'),
    ('Pink Love Bloom Case', '/products/Pink Love Bloom Case.jpeg'),
    ('Pink Tulip Bouquet Phone Case', '/products/Pink Tulip Bouquet Phone Case.jpeg'),
    ('Pink Tulip Trio Phone Case', '/products/Pink Tulip Trio Phone Case.jpeg'),
    ('Purple Butterfly Floral Phone Case', '/products/Purple Butterfly Floral Phone Case.jpeg'),
    ('Purple Lavender Bouquet Phone Case', '/products/Purple Lavender Bouquet Phone Case.jpeg'),
    ('Red & Pink Rose Bouquet Phone Case', '/products/Red & Pink Rose Bouquet Phone Case.jpeg'),
    ('Sweet Lily Bloom Case', '/products/Sweet Lily Bloom Case.jpeg'),
    ('White Daisy Garden Phone Case', '/products/White Daisy Garden Phone Case.jpeg'),
    ('Yellow Sunflower Garden Phone Case', '/products/Yellow Sunflower Garden Phone Case.jpeg')
)
INSERT INTO products (
  name,
  description,
  price_paise,
  image_url,
  category,
  stock_quantity,
  is_active
)
SELECT
  phone_covers.name,
  'Decorative phone cover.',
  49900,
  phone_covers.image_url,
  'Phone Covers',
  5,
  TRUE
FROM phone_covers
WHERE NOT EXISTS (
  SELECT 1 FROM products existing WHERE existing.image_url = phone_covers.image_url
);

-- Keep the inventory ledger aligned when inventory tracking has been installed.
DO $migration$
BEGIN
  IF to_regclass('public.inventory_movements') IS NOT NULL THEN
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
      product.id,
      'opening',
      product.stock_quantity,
      0,
      product.stock_quantity,
      'Opening balance for added phone cover',
      'opening:' || product.id::text,
      'system'
    FROM products product
    WHERE product.category = 'Phone Covers'
      AND product.image_url IN (
        '/products/Blue Bunny Blossom Case.jpeg',
        '/products/Blue Daisy Blossom Phone Case.jpeg',
        '/products/Bunny Bow Charm Case.jpeg',
        '/products/Cherry Blossom Love Case.jpeg',
        '/products/Golden Sunflower Glow Case.jpeg',
        '/products/Lavender Tulip Dream Case.jpeg',
        '/products/Pastel Butterfly Garden Phone Case.jpeg',
        '/products/Pik Heart Blossom Phone Case.jpeg',
        '/products/Pink Butterfly Bow Case.jpeg',
        '/products/Pink Lily & Butterfly Bow Case.jpeg',
        '/products/Pink Love Bloom Case.jpeg',
        '/products/Pink Tulip Bouquet Phone Case.jpeg',
        '/products/Pink Tulip Trio Phone Case.jpeg',
        '/products/Purple Butterfly Floral Phone Case.jpeg',
        '/products/Purple Lavender Bouquet Phone Case.jpeg',
        '/products/Red & Pink Rose Bouquet Phone Case.jpeg',
        '/products/Sweet Lily Bloom Case.jpeg',
        '/products/White Daisy Garden Phone Case.jpeg',
        '/products/Yellow Sunflower Garden Phone Case.jpeg'
      )
      AND NOT EXISTS (
        SELECT 1 FROM inventory_movements movement
        WHERE movement.idempotency_key = 'opening:' || product.id::text
      );
  END IF;
END
$migration$;

COMMIT;
