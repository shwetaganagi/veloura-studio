BEGIN;

LOCK TABLE public.products IN SHARE ROW EXCLUSIVE MODE;

CREATE TEMPORARY TABLE catalogue_stock_shuffle_plan
ON COMMIT DROP
AS
SELECT id AS product_id, stock_quantity AS stock_before, stock_quantity AS stock_after
FROM public.products
WITH NO DATA;

DO $migration$
DECLARE
  fixed_product RECORD;
  partner_product_id BIGINT;
  partner_stock_after INTEGER;
BEGIN
  INSERT INTO pg_temp.catalogue_stock_shuffle_plan (product_id, stock_before, stock_after)
  SELECT shuffled.id,
         shuffled.stock_quantity,
         ((ROW_NUMBER() OVER (ORDER BY random()) - 1) % 5 + 1)::INTEGER
  FROM public.products shuffled
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.inventory_movements movement
    WHERE movement.idempotency_key = 'catalogue-stock-shuffle-20261113:' || shuffled.id::TEXT
  );

  -- Randomly assigned buckets are balanced. Resolve any unchanged assignments
  -- by swapping with a compatible product, preserving those bucket totals.
  FOR fixed_product IN
    SELECT product_id, stock_before, stock_after
    FROM pg_temp.catalogue_stock_shuffle_plan
    WHERE stock_before = stock_after
    ORDER BY random()
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_temp.catalogue_stock_shuffle_plan
      WHERE product_id = fixed_product.product_id
        AND stock_before = stock_after
    ) THEN
      CONTINUE;
    END IF;

    SELECT partner.product_id, partner.stock_after
    INTO partner_product_id, partner_stock_after
    FROM pg_temp.catalogue_stock_shuffle_plan partner
    WHERE partner.product_id <> fixed_product.product_id
      AND fixed_product.stock_before <> partner.stock_after
      AND partner.stock_before <> fixed_product.stock_after
    ORDER BY random()
    LIMIT 1;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Could not resolve an unchanged stock assignment';
    END IF;

    UPDATE pg_temp.catalogue_stock_shuffle_plan plan
    SET stock_after = CASE
      WHEN plan.product_id = fixed_product.product_id THEN partner_stock_after
      ELSE fixed_product.stock_after
    END
    WHERE plan.product_id IN (fixed_product.product_id, partner_product_id);
  END LOOP;

  IF EXISTS (
    SELECT 1
    FROM pg_temp.catalogue_stock_shuffle_plan
    WHERE stock_before = stock_after
  ) THEN
    RAISE EXCEPTION 'Stock shuffle left unchanged quantities';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_temp.catalogue_stock_shuffle_plan plan
    JOIN (
      SELECT product_id, SUM(quantity)::INTEGER AS quantity
      FROM public.payment_inventory_reservations
      WHERE status = 'reserved' AND expires_at > NOW()
      GROUP BY product_id
    ) reservations ON reservations.product_id = plan.product_id
    WHERE reservations.quantity > plan.stock_after
  ) THEN
    RAISE EXCEPTION 'Shuffled stock would fall below an active checkout reservation';
  END IF;

  UPDATE public.products product
  SET stock_quantity = plan.stock_after,
      updated_at = NOW()
  FROM pg_temp.catalogue_stock_shuffle_plan plan
  WHERE product.id = plan.product_id;

  INSERT INTO public.inventory_movements (
    product_id, movement_type, quantity_change, stock_before, stock_after,
    reason, idempotency_key, actor
  )
  SELECT plan.product_id,
         'adjustment',
         plan.stock_after - plan.stock_before,
         plan.stock_before,
         plan.stock_after,
         'Catalogue-wide stock shuffle requested by owner',
         'catalogue-stock-shuffle-20261113:' || plan.product_id::TEXT,
         'admin'
  FROM pg_temp.catalogue_stock_shuffle_plan plan;
END
$migration$;

COMMIT;
