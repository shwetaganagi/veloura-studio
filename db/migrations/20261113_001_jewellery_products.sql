BEGIN;

-- Add the newly saved jewellery images while preserving existing catalogue rows.
WITH jewellery_candidates (name, description, price_paise, image_url, category, stock_quantity, is_active) AS (
  VALUES
    ('Forever Love Embrace Pendant Set', 'A heartwarming pendant necklace paired with matching stud earrings.', 18900, '/products/1. Forever Love hugging Pendant Set.jpeg', 'Jewellery', 5, TRUE),
    ('Antique Elegance Layered Jhumka Earrings', 'A statement pair of traditional earrings with intricate detail and graceful movement.', 18900, '/products/Antique Elegance Layered Jhumka Earrings.jpeg', 'Jewellery', 2, TRUE),
    ('Antique Tribal Chandbali Earrings', 'A statement pair of traditional earrings with intricate detail and graceful movement.', 18900, '/products/Antique Tribal Chandbali Earrings.jpeg', 'Jewellery', 5, TRUE),
    ('Blush Blossom Bow Earrings', 'An elegant pair of earrings with a delicate, polished finish.', 9900, '/products/Blush Blossom Bow Earrings.jpeg', 'Jewellery', 4, TRUE),
    ('Blush Floral Pearl Pendant Jewellery Set', 'A coordinated jewellery set with a graceful, occasion-ready finish.', 18900, '/products/Blush Floral Pearl Pendant Jewellery Set.jpeg', 'Jewellery', 1, TRUE),
    ('Blush Heart Pearl Royal Jewellery Set', 'A coordinated jewellery set with a graceful, occasion-ready finish.', 18900, '/products/Blush Heart Pearl Royal Jewellery Set.jpeg', 'Jewellery', 2, TRUE),
    ('Butterfly Dreams Pearl Drop Earrings', 'An elegant pair of earrings with a delicate, polished finish.', 9900, '/products/Butterfly Dreams Pearl Drop Earrings.jpeg', 'Jewellery', 3, TRUE),
    ('Butterfly Kiss Pearl Drop Studs', 'An elegant pair of earrings with a delicate, polished finish.', 9900, '/products/Butterfly Kiss Pearl Drop Studs.jpeg', 'Jewellery', 2, TRUE),
    ('Celeste Bloom Earrings', 'An elegant pair of earrings with a delicate, polished finish.', 9900, '/products/Celeste Bloom Earrings.jpeg', 'Jewellery', 4, TRUE),
    ('Classic Heart Gold Pendant Jewellery Set', 'A coordinated jewellery set with a graceful, occasion-ready finish.', 18900, '/products/Classic Heart Gold Pendant Jewellery Set.jpeg', 'Jewellery', 3, TRUE),
    ('Crystal Circle Elegance Earrings', 'An elegant pair of earrings with a delicate, polished finish.', 9900, '/products/Crystal Circle Elegance Earrings.jpeg', 'Jewellery', 4, TRUE),
    ('Crystal Dew Earrings', 'An elegant pair of earrings with a delicate, polished finish.', 9900, '/products/Crystal Dew Earrings.jpeg', 'Jewellery', 1, TRUE),
    ('Crystal Heart Glow Necklace & Earring Set', 'A coordinated jewellery set with a graceful, occasion-ready finish.', 18900, '/products/Crystal Heart Glow Necklace & Earring Set.jpeg', 'Jewellery', 5, TRUE),
    ('Crystal Heartbeat Silver Earrings', 'An elegant pair of earrings with a delicate, polished finish.', 9900, '/products/Crystal Heartbeat Silver Earrings.jpeg', 'Jewellery', 4, TRUE),
    ('Elegant Crystal Heart Pendant Set', 'A coordinated jewellery set with a graceful, occasion-ready finish.', 18900, '/products/Elegant Crystal Heart Pendant Set.jpeg', 'Jewellery', 3, TRUE),
    ('Enchanted Butterfly Pearl Jewellery Set', 'A coordinated jewellery set with a graceful, occasion-ready finish.', 18900, '/products/Enchanted Butterfly Pearl Jewellery Set.jpeg', 'Jewellery', 1, TRUE),
    ('Eternal Love Gold Pendant Jewellery Set', 'A coordinated jewellery set with a graceful, occasion-ready finish.', 18900, '/products/Eternal Love Gold Pendant Jewellery Set.jpeg', 'Jewellery', 4, TRUE),
    ('Floral Grace Crescent Jhumka Earrings', 'A statement pair of traditional earrings with intricate detail and graceful movement.', 18900, '/products/Floral Grace Crescent Jhumka Earrings.jpeg', 'Jewellery', 5, TRUE),
    ('Forever Hearts Gold Necklace & Ring Set', 'A coordinated necklace and ring set with an elegant, occasion-ready finish.', 18900, '/products/Forever Hearts Gold Necklace & Ring Set.jpeg', 'Jewellery', 5, TRUE),
    ('Forever Love Heart Pearl Earrings', 'An elegant pair of earrings with a delicate, polished finish.', 9900, '/products/Forever Love Heart Pearl Earrings.jpeg', 'Jewellery', 4, TRUE),
    ('Golden Bow & Floral Elegance Jewellery Set', 'A coordinated jewellery set with a graceful, occasion-ready finish.', 18900, '/products/Golden Bow & Floral Elegance Jewellery Set.jpeg', 'Jewellery', 1, TRUE),
    ('Golden Bow & Heart Pendant Set', 'A coordinated jewellery set with a graceful, occasion-ready finish.', 18900, '/products/Golden Bow & Heart Pendant Set.jpeg', 'Jewellery', 1, TRUE),
    ('Golden Butterfly Sparkle Necklace Set', 'A coordinated jewellery set with a graceful, occasion-ready finish.', 18900, '/products/Golden Butterfly Sparkle Necklace Set.jpeg', 'Jewellery', 2, TRUE),
    ('Golden Garden Floral Vine Jewellery Set', 'A coordinated jewellery set with a graceful, occasion-ready finish.', 18900, '/products/Golden Garden Floral Vine Jewellery Set.jpeg', 'Jewellery', 3, TRUE),
    ('Golden Heart Love Ring & Studs Set', 'An elegant pair of earrings with a delicate, polished finish.', 9900, '/products/Golden Heart Love Ring & Studs Set.jpeg', 'Jewellery', 3, TRUE),
    ('Golden Moonlight Butterfly Jewellery Set', 'A coordinated jewellery set with a graceful, occasion-ready finish.', 18900, '/products/Golden Moonlight Butterfly Jewellery Set.jpeg', 'Jewellery', 1, TRUE),
    ('Golden Petal White Floral Jewellery Set', 'A coordinated jewellery set with a graceful, occasion-ready finish.', 18900, '/products/Golden Petal White Floral Jewellery Set.jpeg', 'Jewellery', 3, TRUE),
    ('Heritage Silver Ghungroo Hoop Earrings', 'A statement pair of traditional earrings with intricate detail and graceful movement.', 18900, '/products/Heritage Silver Ghungroo Hoop Earrings.jpeg', 'Jewellery', 2, TRUE),
    ('Midnight Charm Oxidised Jhumka Earrings', 'A statement pair of traditional earrings with intricate detail and graceful movement.', 18900, '/products/Midnight Charm Oxidised Jhumka Earrings.jpeg', 'Jewellery', 5, TRUE),
    ('Minimal Silver Teardrop Earrings', 'An elegant pair of earrings with a delicate, polished finish.', 9900, '/products/Minimal Silver Teardrop Earrings.jpeg', 'Jewellery', 5, TRUE),
    ('Mirror Majesty Diamond Jhumka Earrings', 'A statement pair of traditional earrings with intricate detail and graceful movement.', 18900, '/products/Mirror Majesty Diamond Jhumka Earrings.jpeg', 'Jewellery', 2, TRUE),
    ('Moonlight Mandala Oxidised Earrings', 'A statement pair of traditional earrings with intricate detail and graceful movement.', 18900, '/products/Moonlight Mandala Oxidised Earrings.jpeg', 'Jewellery', 1, TRUE),
    ('Noor Vintage Jhumkas with Rosé Loop Earrings', 'A statement pair of traditional earrings with intricate detail and graceful movement.', 18900, '/products/Noor Vintage Jhumkas with Rosé Loop Earrings.jpeg', 'Jewellery', 4, TRUE),
    ('Pastel Bloom Multicolour Floral Jewellery Set', 'A coordinated jewellery set with a graceful, occasion-ready finish.', 18900, '/products/Pastel Bloom Multicolour Floral Jewellery Set.jpeg', 'Jewellery', 1, TRUE),
    ('Pearl Aura Earrings', 'An elegant pair of earrings with a delicate, polished finish.', 9900, '/products/Pearl Aura Earrings.jpeg', 'Jewellery', 2, TRUE),
    ('Petal Charm Pearl Stud Earrings', 'An elegant pair of earrings with a delicate, polished finish.', 9900, '/products/Petal Charm Pearl Stud Earrings.jpeg', 'Jewellery', 3, TRUE),
    ('Pink Blossom Charm Necklace & Earring Set', 'A coordinated jewellery set with a graceful, occasion-ready finish.', 18900, '/products/Pink Blossom Charm Necklace & Earring Set.jpeg', 'Jewellery', 3, TRUE),
    ('Pink Blossom Crystal Jewellery Set', 'A coordinated jewellery set with a graceful, occasion-ready finish.', 18900, '/products/Pink Blossom Crystal Jewellery Set.jpeg', 'Jewellery', 5, TRUE),
    ('Riya Royal Jhumkas', 'A statement pair of traditional earrings with intricate detail and graceful movement.', 18900, '/products/Riya Royal Jhumkas.jpeg', 'Jewellery', 4, TRUE),
    ('Royal Charm Multicolour Traditional Jewellery Set', 'A coordinated jewellery set with a graceful, occasion-ready finish.', 18900, '/products/Royal Charm Multicolour Traditional Jewellery Set.jpeg', 'Jewellery', 1, TRUE),
    ('Royal Heritage Oxidised Chandbali Earrings', 'A statement pair of traditional earrings with intricate detail and graceful movement.', 18900, '/products/Royal Heritage Oxidised Chandbali Earrings.jpeg', 'Jewellery', 3, TRUE),
    ('Royal Oxidised Silver Jhumka Earrings', 'A statement pair of traditional earrings with intricate detail and graceful movement.', 18900, '/products/Royal Oxidised Silver Jhumka Earrings.jpeg', 'Jewellery', 4, TRUE),
    ('Royal Peacock Oxidised Dangle Earrings', 'An elegant pair of earrings with a delicate, polished finish.', 18900, '/products/Royal Peacock Oxidised Dangle Earrings.jpeg', 'Jewellery', 3, TRUE),
    ('Sunshine Daisy Yellow Floral Jewellery Set', 'A coordinated jewellery set with a graceful, occasion-ready finish.', 18900, '/products/Sunshine Daisy Yellow Floral Jewellery Set.jpeg', 'Jewellery', 2, TRUE),
    ('Sweetheart Duo Pendant Set', 'A coordinated jewellery set with a graceful, occasion-ready finish.', 18900, '/products/Sweetheart Duo Pendant Set.jpeg', 'Jewellery', 1, TRUE),
    ('Twin Hearts Crystal Pendant Set', 'A coordinated jewellery set with a graceful, occasion-ready finish.', 18900, '/products/Twin Hearts Crystal Pendant Set.jpeg', 'Jewellery', 5, TRUE),
    ('Golden Promise Heart Set', 'A coordinated heart necklace, ring and matching earrings set.', 18900, '/products/WhatsApp Image 2026-11-13 at 17.11.09.jpeg', 'Jewellery', 2, TRUE)
)
INSERT INTO public.products (name, description, price_paise, image_url, category, stock_quantity, is_active)
SELECT candidate.name, candidate.description, candidate.price_paise, candidate.image_url, candidate.category, candidate.stock_quantity, candidate.is_active
FROM jewellery_candidates candidate
WHERE NOT EXISTS (
  SELECT 1
  FROM public.products existing
  WHERE existing.image_url = candidate.image_url
);

-- Record opening stock in the existing inventory ledger when it is installed.
DO $migration$
BEGIN
  IF to_regclass('public.inventory_movements') IS NOT NULL THEN
    INSERT INTO public.inventory_movements (
      product_id, movement_type, quantity_change, stock_before, stock_after,
      reason, idempotency_key, actor
    )
    SELECT
      product.id,
      'opening',
      product.stock_quantity,
      0,
      product.stock_quantity,
      'Opening balance for new jewellery product',
      'opening:' || product.id::text,
      'system'
    FROM public.products product
    WHERE product.category = 'Jewellery'
      AND product.image_url = ANY (ARRAY[
        '/products/1. Forever Love hugging Pendant Set.jpeg',
        '/products/Antique Elegance Layered Jhumka Earrings.jpeg',
        '/products/Antique Tribal Chandbali Earrings.jpeg',
        '/products/Blush Blossom Bow Earrings.jpeg',
        '/products/Blush Floral Pearl Pendant Jewellery Set.jpeg',
        '/products/Blush Heart Pearl Royal Jewellery Set.jpeg',
        '/products/Butterfly Dreams Pearl Drop Earrings.jpeg',
        '/products/Butterfly Kiss Pearl Drop Studs.jpeg',
        '/products/Celeste Bloom Earrings.jpeg',
        '/products/Classic Heart Gold Pendant Jewellery Set.jpeg',
        '/products/Crystal Circle Elegance Earrings.jpeg',
        '/products/Crystal Dew Earrings.jpeg',
        '/products/Crystal Heart Glow Necklace & Earring Set.jpeg',
        '/products/Crystal Heartbeat Silver Earrings.jpeg',
        '/products/Elegant Crystal Heart Pendant Set.jpeg',
        '/products/Enchanted Butterfly Pearl Jewellery Set.jpeg',
        '/products/Eternal Love Gold Pendant Jewellery Set.jpeg',
        '/products/Floral Grace Crescent Jhumka Earrings.jpeg',
        '/products/Forever Hearts Gold Necklace & Ring Set.jpeg',
        '/products/Forever Love Heart Pearl Earrings.jpeg',
        '/products/Golden Bow & Floral Elegance Jewellery Set.jpeg',
        '/products/Golden Bow & Heart Pendant Set.jpeg',
        '/products/Golden Butterfly Sparkle Necklace Set.jpeg',
        '/products/Golden Garden Floral Vine Jewellery Set.jpeg',
        '/products/Golden Heart Love Ring & Studs Set.jpeg',
        '/products/Golden Moonlight Butterfly Jewellery Set.jpeg',
        '/products/Golden Petal White Floral Jewellery Set.jpeg',
        '/products/Heritage Silver Ghungroo Hoop Earrings.jpeg',
        '/products/Midnight Charm Oxidised Jhumka Earrings.jpeg',
        '/products/Minimal Silver Teardrop Earrings.jpeg',
        '/products/Mirror Majesty Diamond Jhumka Earrings.jpeg',
        '/products/Moonlight Mandala Oxidised Earrings.jpeg',
        '/products/Noor Vintage Jhumkas with Rosé Loop Earrings.jpeg',
        '/products/Pastel Bloom Multicolour Floral Jewellery Set.jpeg',
        '/products/Pearl Aura Earrings.jpeg',
        '/products/Petal Charm Pearl Stud Earrings.jpeg',
        '/products/Pink Blossom Charm Necklace & Earring Set.jpeg',
        '/products/Pink Blossom Crystal Jewellery Set.jpeg',
        '/products/Riya Royal Jhumkas.jpeg',
        '/products/Royal Charm Multicolour Traditional Jewellery Set.jpeg',
        '/products/Royal Heritage Oxidised Chandbali Earrings.jpeg',
        '/products/Royal Oxidised Silver Jhumka Earrings.jpeg',
        '/products/Royal Peacock Oxidised Dangle Earrings.jpeg',
        '/products/Sunshine Daisy Yellow Floral Jewellery Set.jpeg',
        '/products/Sweetheart Duo Pendant Set.jpeg',
        '/products/Twin Hearts Crystal Pendant Set.jpeg',
        '/products/WhatsApp Image 2026-11-13 at 17.11.09.jpeg'
      ]::text[])
      AND NOT EXISTS (
        SELECT 1
        FROM public.inventory_movements movement
        WHERE movement.idempotency_key = 'opening:' || product.id::text
      );
  END IF;
END
$migration$;

COMMIT;
