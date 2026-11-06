--
-- PostgreSQL database dump
--

\restrict yxltiSYVaC6YdjgK6dsTOWbKYGBh0UNmadf3agXKzkfyx47rEZh0uGr3Dhmys0p

-- Dumped from database version 17.11 (Debian 17.11-1.pgdg13+2)
-- Dumped by pg_dump version 17.11 (Debian 17.11-1.pgdg13+2)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: products; Type: TABLE DATA; Schema: public; Owner: veloura_user
--

INSERT INTO public.products (id, name, description, price_paise, image_url, category, stock_quantity, is_active, created_at, updated_at) OVERRIDING SYSTEM VALUE VALUES (2, 'Blue Bow Keychain', 'Handmade blue bow keychain.', 9900, '/products/blue-bow-keychain.jpeg', 'Keychains', 10, true, '2026-11-01 11:43:23.502026+00', '2026-11-01 11:43:23.502026+00');
INSERT INTO public.products (id, name, description, price_paise, image_url, category, stock_quantity, is_active, created_at, updated_at) OVERRIDING SYSTEM VALUE VALUES (11, 'Lovely Frame', 'Beautiful handmade flower frame', 34900, '/products/Lovely-Frame.jpeg', 'Home Decor', 5, true, '2026-11-02 15:38:31.693897+00', '2026-11-02 15:38:31.693897+00');
INSERT INTO public.products (id, name, description, price_paise, image_url, category, stock_quantity, is_active, created_at, updated_at) OVERRIDING SYSTEM VALUE VALUES (6, 'Blue Lamp', 'Handmade decorative blue lamp', 84900, '/products/Blue-lamp.jpeg', 'Home Decor', 5, true, '2026-11-02 15:38:31.684832+00', '2026-11-02 15:38:31.684832+00');
INSERT INTO public.products (id, name, description, price_paise, image_url, category, stock_quantity, is_active, created_at, updated_at) OVERRIDING SYSTEM VALUE VALUES (7, 'Evil Eye Bouquet', 'Handmade evil eye bouquet', 44900, '/products/Evil-Eye-Bouquet.jpeg', 'Flower Bouquets', 5, true, '2026-11-02 15:38:31.690153+00', '2026-11-02 15:38:31.690153+00');
INSERT INTO public.products (id, name, description, price_paise, image_url, category, stock_quantity, is_active, created_at, updated_at) OVERRIDING SYSTEM VALUE VALUES (12, 'Pink Flower Bouquet', 'Handmade pink flower bouquet', 29900, '/products/Pink-Flower-Bouquet.jpeg', 'Flower Bouquets', 5, true, '2026-11-02 15:38:31.694554+00', '2026-11-02 15:38:31.694554+00');
INSERT INTO public.products (id, name, description, price_paise, image_url, category, stock_quantity, is_active, created_at, updated_at) OVERRIDING SYSTEM VALUE VALUES (9, 'Forever Love', 'Handmade forever love gift', 94900, '/products/Forever-Love.jpeg', 'Gifts', 5, true, '2026-11-02 15:38:31.69216+00', '2026-11-02 15:38:31.69216+00');
INSERT INTO public.products (id, name, description, price_paise, image_url, category, stock_quantity, is_active, created_at, updated_at) OVERRIDING SYSTEM VALUE VALUES (8, 'Flower Frame', 'Handmade flower frame', 99900, '/products/Flower-Frame.jpeg', 'Home Decor', 5, true, '2026-11-02 15:38:31.69119+00', '2026-11-02 15:38:31.69119+00');
INSERT INTO public.products (id, name, description, price_paise, image_url, category, stock_quantity, is_active, created_at, updated_at) OVERRIDING SYSTEM VALUE VALUES (14, 'Red Black Bouquet', 'Handmade red and black bouquet', 24900, '/products/Red-Black-Bouquet.jpeg', 'Flower Bouquets', 5, true, '2026-11-02 15:38:31.695907+00', '2026-11-02 15:38:31.695907+00');
INSERT INTO public.products (id, name, description, price_paise, image_url, category, stock_quantity, is_active, created_at, updated_at) OVERRIDING SYSTEM VALUE VALUES (13, 'Purple Tulip Bouquet', 'Handmade purple tulip bouquet', 74900, '/products/Purple-tulip-bouquet.jpeg', 'Flower Bouquets', 5, true, '2026-11-02 15:38:31.695171+00', '2026-11-02 15:38:31.695171+00');
INSERT INTO public.products (id, name, description, price_paise, image_url, category, stock_quantity, is_active, created_at, updated_at) OVERRIDING SYSTEM VALUE VALUES (15, 'Red Flower Bouquet', 'Handmade red flower bouquet', 54900, '/products/Red-flower-bouquet.jpeg', 'Flower Bouquets', 5, true, '2026-11-02 15:38:31.696604+00', '2026-11-02 15:38:31.696604+00');
INSERT INTO public.products (id, name, description, price_paise, image_url, category, stock_quantity, is_active, created_at, updated_at) OVERRIDING SYSTEM VALUE VALUES (18, 'Sunflower Bouquet', 'Beautiful handmade sunflower bouquet', 75900, '/products/Sunflower-Bouquet.jpeg', 'Flower Bouquets', 5, true, '2026-11-02 15:38:31.698205+00', '2026-11-02 15:38:31.698205+00');
INSERT INTO public.products (id, name, description, price_paise, image_url, category, stock_quantity, is_active, created_at, updated_at) OVERRIDING SYSTEM VALUE VALUES (16, 'Single Purple Bouquet', 'Single purple handmade flower bouquet', 25900, '/products/Single-Purplr-Bouquet.jpeg', 'Flower Bouquets', 5, true, '2026-11-02 15:38:31.697121+00', '2026-11-02 15:38:31.697121+00');
INSERT INTO public.products (id, name, description, price_paise, image_url, category, stock_quantity, is_active, created_at, updated_at) OVERRIDING SYSTEM VALUE VALUES (17, 'Single Sunflower Bouquet', 'Single handmade sunflower bouquet', 29500, '/products/Single-Sunflower-Bouquet.jpeg', 'Flower Bouquets', 5, true, '2026-11-02 15:38:31.697692+00', '2026-11-02 15:38:31.697692+00');
INSERT INTO public.products (id, name, description, price_paise, image_url, category, stock_quantity, is_active, created_at, updated_at) OVERRIDING SYSTEM VALUE VALUES (10, 'Red Rose Frame', 'Handmade red rose frame', 94900, '/products/Frame-Red-Rose.jpeg', 'Home Decor', 5, true, '2026-11-02 15:38:31.693158+00', '2026-11-02 15:38:31.693158+00');
INSERT INTO public.products (id, name, description, price_paise, image_url, category, stock_quantity, is_active, created_at, updated_at) OVERRIDING SYSTEM VALUE VALUES (1, 'Yellow Flower Keychain', 'Handmade yellow flower keychain.', 9900, '/products/yellow-flower-keychain.jpeg', 'Keychains', 10, true, '2026-11-01 11:43:23.502026+00', '2026-11-01 11:43:23.502026+00');
INSERT INTO public.products (id, name, description, price_paise, image_url, category, stock_quantity, is_active, created_at, updated_at) OVERRIDING SYSTEM VALUE VALUES (3, 'Blue Handmade Flower', 'Handmade blue flower crafted with care.', 14900, '/products/blue-flower.jpeg', 'Flowers', 10, true, '2026-11-01 11:43:23.502026+00', '2026-11-01 11:43:23.502026+00');
INSERT INTO public.products (id, name, description, price_paise, image_url, category, stock_quantity, is_active, created_at, updated_at) OVERRIDING SYSTEM VALUE VALUES (4, 'Pink Handmade Flower', 'Handmade pink flower crafted with care.', 14900, '/products/pink-flower.jpeg', 'Flowers', 10, true, '2026-11-01 11:43:23.502026+00', '2026-11-01 11:43:23.502026+00');
INSERT INTO public.products (id, name, description, price_paise, image_url, category, stock_quantity, is_active, created_at, updated_at) OVERRIDING SYSTEM VALUE VALUES (5, 'Pink Scrunchie', 'Handmade pink scrunchie.', 16900, '/products/pink-scrunchie.jpeg', 'Accessories', 10, true, '2026-11-01 11:43:23.502026+00', '2026-11-01 11:43:23.502026+00');


--
-- Name: products_id_seq; Type: SEQUENCE SET; Schema: public; Owner: veloura_user
--

SELECT pg_catalog.setval('public.products_id_seq', 18, true);


--
-- PostgreSQL database dump complete
--

\unrestrict yxltiSYVaC6YdjgK6dsTOWbKYGBh0UNmadf3agXKzkfyx47rEZh0uGr3Dhmys0p

