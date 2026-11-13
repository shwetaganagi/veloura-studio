BEGIN;

-- Add newly saved keychains, standalone flowers, and potted floral gifts.
-- Image paths make this migration safe to rerun without duplicating products.
WITH new_products (name, description, price_paise, image_url, category, stock_quantity, is_active) AS (
  VALUES
    ('Midnight Star & Pearl Keychain', 'A plush black-and-ivory star finished with a satin bow and pearl detail.', 9900, '/products/Black & White Star Keychain.jpeg', 'Keychains', 3, TRUE),
    ('Velvet Whiskers Keychain', 'A soft black cat charm with rosy ears and a bright red bow.', 9900, '/products/Black Cat Keychain.jpeg', 'Keychains', 2, TRUE),
    ('Cherry Charm Duo Keychain', 'A playful pair of plush red cherries with a leafy green stem.', 9900, '/products/Cherry Keychain.jpeg', 'Keychains', 4, TRUE),
    ('Cloud Nine Bow Keychain', 'A fluffy little cloud with a cheerful red bow.', 9900, '/products/Cloud Keychain.jpeg', 'Keychains', 1, TRUE),
    ('Cloverheart Frog Keychain', 'A cheerful green frog holding a bright red heart.', 9900, '/products/Cute Green Frog Keychain.jpeg', 'Keychains', 5, TRUE),
    ('Goalbound Football Keychain', 'A miniature plush football paired with a classic black bow.', 9900, '/products/Football Keychain.jpeg', 'Keychains', 2, TRUE),
    ('Panda Pudding Keychain', 'A cuddly panda charm with a soft, cloudlike finish.', 9900, '/products/Panda Keychain.jpeg', 'Keychains', 3, TRUE),
    ('Pearl Daisy Keepsake Keychain', 'A white plush daisy accented with a pearl, ribbon, and tiny leaf.', 9900, '/products/Pearl Daisy Flower Keychain.jpeg', 'Keychains', 4, TRUE),
    ('Rosy Stardust Keychain', 'A pink star nestled inside a soft ivory border.', 9900, '/products/Pink & Ivory Star Keychain.jpeg', 'Keychains', 1, TRUE),
    ('Bunny Blush Keepsake Keychain', 'A sweet white bunny charm with rosy cheeks and a little red bow.', 9900, '/products/Pink Bunny Keychain.jpeg', 'Keychains', 5, TRUE),
    ('Petal Kiss Keychain', 'A blush-pink flower charm finished with a pearl centre.', 9900, '/products/Pink Flower Keychain.jpeg', 'Keychains', 3, TRUE),
    ('Scarlet Ribbon Bow Keychain', 'A bright red plush bow made into a charming everyday accessory.', 9900, '/products/Red Bow Keychain.jpeg', 'Keychains', 2, TRUE),
    ('Sweetheart Bow Keepsake', 'A plush red heart dressed with an ivory bow and pearl accent.', 9900, '/products/Red Heart Bow Keychain.jpeg', 'Keychains', 4, TRUE),
    ('Scarlet Rose Charm Keychain', 'A plush red rose with green leaves and a delicate ivory bow.', 9900, '/products/Red Rose Keychain.jpeg', 'Keychains', 1, TRUE),
    ('Crimson Web Hero Keychain', 'A bold red-and-black web hero face rendered as a soft charm.', 9900, '/products/Spider-Man Keychain.jpeg', 'Keychains', 5, TRUE),
    ('Heartweb Keepsake Keychain', 'An airy white web charm centred with a bright red heart.', 9900, '/products/Spiderman keychain.jpeg', 'Keychains', 2, TRUE),
    ('Honeyheart Teddy Keychain', 'A cuddly ivory teddy holding a red heart, finished with a matching bow.', 9900, '/products/Teddy Bear Heart Keychain.jpeg', 'Keychains', 3, TRUE),
    ('Rosewater Blush Rose', 'A sculpted pink pipe-cleaner rose with graceful green leaves.', 14900, '/products/Fuzzy Pink Pipe-Cleaner Rose.jpeg', 'Flowers', 2, TRUE),
    ('Crimson Hibiscus Bloom', 'A vivid red hibiscus with a golden stamen and leafy stem.', 14900, '/products/Fuzzy Red Hibiscus Craft.jpeg', 'Flowers', 4, TRUE),
    ('Sunlit Ivory Daisy', 'A bright ivory daisy with a sunny golden centre.', 14900, '/products/Fuzzy White Daisy in Sunlight.JPEG', 'Flowers', 1, TRUE),
    ('Blush Starlight Lily', 'A pink-and-ivory lily with a delicate golden centre.', 14900, '/products/Handcrafted Fuzzy Lily in Sunlight.jpeg', 'Flowers', 5, TRUE),
    ('Amethyst Tulip Grace', 'A handcrafted purple tulip with a softly textured finish.', 14900, '/products/Handcrafted Purple Pipe-Cleaner Tulip.jpeg', 'Flowers', 3, TRUE),
    ('Lavender Orchid Trio', 'Three lavender-and-ivory orchids arranged with graceful green leaves.', 14900, '/products/Handcrafted Purple-White Orchid Arrangement.JPEG', 'Flowers', 2, TRUE),
    ('Golden Hour Sunflower', 'A cheerful golden sunflower with a rich brown centre and green leaves.', 14900, '/products/Handmade Chenille Sunflower in Warm Light.jpeg', 'Flowers', 4, TRUE),
    ('Violet Morning Bloom', 'A handcrafted violet bloom with a sunny centre and leafy stem.', 14900, '/products/Handmade Purple Chenille Flower in Sunlight.JPEG', 'Flowers', 1, TRUE),
    ('Pastel Lotus Reverie', 'A soft pink-and-ivory lotus with a fresh bud and rounded leaves.', 14900, '/products/Pastel Chenille Lotus Bloom.jpeg', 'Flowers', 5, TRUE),
    ('Scarlet Bloom Rose', 'A rich red pipe-cleaner rose with sculpted green leaves.', 14900, '/products/Scarlet Bloom Pipe-Cleaner Rose.jpeg', 'Flowers', 3, TRUE),
    ('Sunbeam in a Veloura Pot', 'A handcrafted sunflower sculpture presented in a keepsake Veloura Studio pot.', 29900, '/products/Crocheted Sunflower in Veloura Pot.jpeg', 'Little Surprises', 4, TRUE),
    ('Lavender Dawn Tulip Pot', 'A lavender tulip arranged in a soft chenille pot with a Veloura Studio tag.', 29900, '/products/Handmade Lavender Tulip in Cozy Studio Pot.jpeg', 'Little Surprises', 1, TRUE),
    ('Blush & Ivory Tulip Trio Pot', 'Three pastel tulips arranged together in a keepsake pot.', 29900, '/products/Pastel Crocheted Tulip Pot Arrangement.jpeg', 'Little Surprises', 3, TRUE),
    ('Veloura Crimson Rose Pot', 'A sculpted red rose with two buds, presented in a handcrafted pot.', 29900, '/products/Veloura Studio Chenille Rose Pot.jpeg', 'Little Surprises', 2, TRUE)
)
INSERT INTO public.products (name, description, price_paise, image_url, category, stock_quantity, is_active)
SELECT candidate.name, candidate.description, candidate.price_paise, candidate.image_url,
       candidate.category, candidate.stock_quantity, candidate.is_active
FROM new_products candidate
WHERE NOT EXISTS (
  SELECT 1
  FROM public.products existing
  WHERE LOWER(existing.image_url) = LOWER(candidate.image_url)
);

-- Add opening inventory entries only for products introduced by this migration.
DO $migration$
BEGIN
  IF to_regclass('public.inventory_movements') IS NOT NULL THEN
    INSERT INTO public.inventory_movements (
      product_id, movement_type, quantity_change, stock_before, stock_after,
      reason, idempotency_key, actor
    )
    SELECT product.id,
           'opening',
           product.stock_quantity,
           0,
           product.stock_quantity,
           'Opening balance for new keychain, flower, or potted floral product',
           'opening:' || product.id::TEXT,
           'system'
    FROM public.products product
    WHERE product.image_url = ANY (ARRAY[
      '/products/Black & White Star Keychain.jpeg',
      '/products/Black Cat Keychain.jpeg',
      '/products/Cherry Keychain.jpeg',
      '/products/Cloud Keychain.jpeg',
      '/products/Crocheted Sunflower in Veloura Pot.jpeg',
      '/products/Cute Green Frog Keychain.jpeg',
      '/products/Football Keychain.jpeg',
      '/products/Fuzzy Pink Pipe-Cleaner Rose.jpeg',
      '/products/Fuzzy Red Hibiscus Craft.jpeg',
      '/products/Fuzzy White Daisy in Sunlight.JPEG',
      '/products/Handcrafted Fuzzy Lily in Sunlight.jpeg',
      '/products/Handcrafted Purple Pipe-Cleaner Tulip.jpeg',
      '/products/Handcrafted Purple-White Orchid Arrangement.JPEG',
      '/products/Handmade Chenille Sunflower in Warm Light.jpeg',
      '/products/Handmade Lavender Tulip in Cozy Studio Pot.jpeg',
      '/products/Handmade Purple Chenille Flower in Sunlight.JPEG',
      '/products/Panda Keychain.jpeg',
      '/products/Pastel Chenille Lotus Bloom.jpeg',
      '/products/Pastel Crocheted Tulip Pot Arrangement.jpeg',
      '/products/Pearl Daisy Flower Keychain.jpeg',
      '/products/Pink & Ivory Star Keychain.jpeg',
      '/products/Pink Bunny Keychain.jpeg',
      '/products/Pink Flower Keychain.jpeg',
      '/products/Red Bow Keychain.jpeg',
      '/products/Red Heart Bow Keychain.jpeg',
      '/products/Red Rose Keychain.jpeg',
      '/products/Scarlet Bloom Pipe-Cleaner Rose.jpeg',
      '/products/Spider-Man Keychain.jpeg',
      '/products/Spiderman keychain.jpeg',
      '/products/Teddy Bear Heart Keychain.jpeg',
      '/products/Veloura Studio Chenille Rose Pot.jpeg'
    ]::TEXT[])
      AND NOT EXISTS (
        SELECT 1
        FROM public.inventory_movements movement
        WHERE movement.idempotency_key = 'opening:' || product.id::TEXT
      );
  END IF;
END
$migration$;

COMMIT;
