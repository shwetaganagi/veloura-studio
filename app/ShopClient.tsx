"use client";

import { useEffect, useState } from "react";

type Product = {
  id: number;
  name: string;
  price: number;
  emoji: string;
  color: string;
  tag: string;
  image: string;
};

type CartItem = Product & { quantity: number };

const products: Product[] = [
  {
    id: 1,
    name: "Yellow Flower Keychain",
    price: 199,
    emoji: "🌼",
    color: "product-yellow",
    tag: "Handmade",
    image: "/products/yellow-flower-keychain.jpeg",
  },
  {
    id: 2,
    name: "Blue Bow Keychain",
    price: 99,
    emoji: "🎀",
    color: "product-lilac",
    tag: "Cute Favourite",
    image: "/products/blue-bow-keychain.jpeg",
  },
  {
    id: 3,
    name: "Blue Handmade Flower",
    price: 249,
    emoji: "🌷",
    color: "product-peach",
    tag: "Handmade",
    image: "/products/blue-flower.jpeg",
  },
  {
    id: 4,
    name: "Pink Handmade Flower",
    price: 249,
    emoji: "🌸",
    color: "product-pink",
    tag: "Made with Love",
    image: "/products/pink-flower.jpeg",
  },
  {
    id: 5,
    name: "Pink Scrunchie",
    price: 149,
    emoji: "🎀",
    color: "product-pink",
    tag: "Soft & Pretty",
    image: "/products/pink-scrunchie.jpeg",
  },
];

const categories = [
  {
    name: "Flower Bouquets",
    emoji: "💐",
    description: "Blooms made with love",
  },
  {
    name: "Handmade Flowers",
    emoji: "🌷",
    description: "Flowers that last forever",
  },
  {
    name: "Keychains",
    emoji: "🧸",
    description: "Little things to carry",
  },
  {
    name: "Jewellery",
    emoji: "💗",
    description: "Pretty little treasures",
  },
  {
    name: "Hair Accessories",
    emoji: "🎀",
    description: "Add a little charm",
  },
  {
    name: "Birthday Gifts",
    emoji: "🎁",
    description: "Make their day special",
  },
  {
    name: "Phone Covers",
    emoji: "📱",
    description: "Dress up your phone",
  },
  {
    name: "Little Surprises",
    emoji: "💌",
    description: "Gifts from the heart",
  },
];

const instagramUrl = "https://www.instagram.com/veloura.studio_26/";
const instagramDmUrl = "https://ig.me/m/veloura.studio_26";

export default function ShopClient() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [orderCopied, setOrderCopied] = useState(false);
  const [imageErrors, setImageErrors] = useState<number[]>([]);

  const itemCount = cart.reduce(
    (sum, item) => sum + item.quantity,
    0
  );

  const total = cart.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  useEffect(() => {
    document.body.style.overflow = cartOpen ? "hidden" : "";

    return () => {
      document.body.style.overflow = "";
    };
  }, [cartOpen]);

  function addToCart(product: Product) {
    setCart((currentCart) => {
      const existingItem = currentCart.find(
        (item) => item.id === product.id
      );

      if (existingItem) {
        return currentCart.map((item) =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }

      return [...currentCart, { ...product, quantity: 1 }];
    });

    setCartOpen(true);
    setOrderCopied(false);
  }

  function changeQuantity(productId: number, change: number) {
    setCart((currentCart) =>
      currentCart
        .map((item) =>
          item.id === productId
            ? { ...item, quantity: item.quantity + change }
            : item
        )
        .filter((item) => item.quantity > 0)
    );

    setOrderCopied(false);
  }

  function removeFromCart(productId: number) {
    setCart((currentCart) =>
      currentCart.filter((item) => item.id !== productId)
    );

    setOrderCopied(false);
  }

  function buildOrderMessage() {
    const orderLines = cart.map(
      (item) =>
        `${item.name} x ${item.quantity} = ₹${item.price * item.quantity}`
    );

    return [
      "Hello Veloura Studio! 💗",
      "",
      "I'd like to place an order:",
      "",
      ...orderLines,
      "",
      `Total: ₹${total}`,
      "",
      "Please confirm availability and delivery details.",
    ].join("\n");
  }

  async function orderOnInstagram() {
  if (cart.length === 0) return;

  const message = buildOrderMessage();

  try {
    await navigator.clipboard.writeText(message);
    setOrderCopied(true);
  } catch {
    setOrderCopied(false);
  }

  window.open(instagramDmUrl, "_blank", "noopener,noreferrer");
}

  function scrollToShop() {
    document
      .getElementById("shop")
      ?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <main id="home">
      <div className="announcement-bar">
        Thoughtfully handmade · Little things, big love ♡
      </div>

      <header className="site-header">
        <a
          className="brand"
          href="#home"
          aria-label="Veloura Studio home"
        >
          veloura studio <span>♡</span>
        </a>

        <nav className="main-nav" aria-label="Main navigation">
          <a href="#home">Home</a>
          <a href="#categories">Categories</a>
          <a href="#shop">Shop</a>
          <a href="#about">Our Story</a>
        </nav>

        <button
          className="cart-button"
          type="button"
          onClick={() => setCartOpen(true)}
          aria-label={`Open shopping bag, ${itemCount} items`}
        >
          Bag <span className="cart-count">{itemCount}</span>
        </button>
      </header>

      <section className="hero-section">
        <div className="hero-copy">
          <p className="eyebrow">LITTLE THINGS, BIG LOVE</p>

          <h1>
            Made by hand.
            <br />
            <span>Made for you.</span>
          </h1>

          <p className="hero-description">
            Thoughtful handmade gifts, pretty accessories, and little pieces
            of happiness made with love.
          </p>

          <button
            className="primary-button"
            type="button"
            onClick={scrollToShop}
          >
            Explore the collection <span aria-hidden="true">↗</span>
          </button>

          <p className="hero-note">
            ♡ Handmade with care · Created with love
          </p>
        </div>

        <div className="hero-art">
          <div className="hero-image-frame">
            <img
              src="/products/pink-flower.jpeg"
              alt="Pink handmade flower crafted by Veloura Studio"
              onError={(event) => {
                event.currentTarget.style.display = "none";
              }}
            />
          </div>

          <div className="hero-sticker" aria-label="Made with love">
            <span>made</span>
            <span>with ♡</span>
          </div>
        </div>
      </section>

      <section className="section categories-section" id="categories">
        <div className="section-heading">
          <p className="eyebrow">FIND YOUR FAVOURITE</p>
          <h2>A little something for everyone</h2>
          <p>
            Explore our collections and find something that feels just right.
          </p>
        </div>

        <div className="category-grid">
          {categories.map((category) => (
            <a
              className="category-card"
              href="#shop"
              key={category.name}
            >
              <span className="category-emoji" aria-hidden="true">
                {category.emoji}
              </span>

              <h3>{category.name}</h3>
              <p>{category.description}</p>
            </a>
          ))}
        </div>
      </section>

      <section className="section shop-section" id="shop">
        <div className="section-heading">
          <p className="eyebrow">THE HANDMADE COLLECTION</p>
          <h2>Little things you&apos;ll love ♡</h2>
          <p>Each piece is made with care and a whole lot of love.</p>
        </div>

        <div className="product-grid">
          {products.map((product) => (
            <article className="product-card" key={product.id}>
              <div className={`product-art ${product.color}`}>
                <span className="product-tag">{product.tag}</span>

                {!imageErrors.includes(product.id) ? (
                  <img
                    className="product-image"
                    src={product.image}
                    alt={product.name}
                    onError={() =>
                      setImageErrors((current) =>
                        current.includes(product.id)
                          ? current
                          : [...current, product.id]
                      )
                    }
                  />
                ) : (
                  <span className="product-emoji" aria-hidden="true">
                    {product.emoji}
                  </span>
                )}
              </div>

              <div className="product-info">
                <div className="product-title-row">
                  <h3>{product.name}</h3>
                  <span className="product-price">
                    ₹{product.price}
                  </span>
                </div>

                <p className="product-description">
                  Carefully handmade, especially for you.
                </p>

                <button
                  className="add-button"
                  type="button"
                  onClick={() => addToCart(product)}
                >
                  Add to bag +
                </button>
              </div>
            </article>
          ))}
        </div>

        <p className="shop-note">
          More handmade surprises coming soon ♡
        </p>
      </section>

      <section className="section about-section" id="about">
        <div className="about-decoration" aria-hidden="true">
          ♡ ✿ ♡
        </div>

        <div className="about-copy">
          <p className="eyebrow">A SMALL STUDIO WITH A BIG HEART</p>

          <h2>
            Made slowly.
            <br />
            <em>Loved endlessly.</em>
          </h2>

          <p>
            Veloura Studio is all about little handmade details that turn an
            ordinary day into something worth remembering. Every piece is
            created with care and meant to bring a smile.
          </p>

          <a
            className="primary-button"
            href={instagramUrl}
            target="_blank"
            rel="noreferrer"
          >
            Find us on Instagram ↗
          </a>
        </div>
      </section>

      <footer className="site-footer">
        <a className="footer-brand" href="#home">
          veloura studio ♡
        </a>

        <p>Little handmade things, made with love.</p>

        <a
          href={instagramUrl}
          target="_blank"
          rel="noreferrer"
        >
          Instagram ↗
        </a>

        <small>© {new Date().getFullYear()} Veloura Studio</small>
      </footer>

      {cartOpen && (
        <div
          className="cart-overlay"
          onClick={() => setCartOpen(false)}
        >
          <aside
            className="cart-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Your shopping bag"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="cart-header">
              <div>
                <p className="eyebrow">YOUR LITTLE FINDS</p>
                <h2>Your Bag ♡</h2>
              </div>

              <button
                className="cart-close"
                type="button"
                onClick={() => setCartOpen(false)}
                aria-label="Close shopping bag"
              >
                ×
              </button>
            </div>

            {cart.length === 0 ? (
              <div className="empty-cart">
                <span aria-hidden="true">🛍️</span>
                <h3>Your bag is waiting!</h3>

                <p>
                  Add something lovely from our handmade collection.
                </p>

                <button
                  className="primary-button"
                  type="button"
                  onClick={() => {
                    setCartOpen(false);
                    scrollToShop();
                  }}
                >
                  Explore the shop
                </button>
              </div>
            ) : (
              <>
                <div className="cart-items">
                  {cart.map((item) => (
                    <div className="cart-item" key={item.id}>
                      <div className={`cart-item-art ${item.color}`}>
                        {!imageErrors.includes(item.id) ? (
                          <img
                            src={item.image}
                            alt={item.name}
                            onError={() =>
                              setImageErrors((current) =>
                                current.includes(item.id)
                                  ? current
                                  : [...current, item.id]
                              )
                            }
                          />
                        ) : (
                          <span aria-hidden="true">
                            {item.emoji}
                          </span>
                        )}
                      </div>

                      <div className="cart-item-details">
                        <h3>{item.name}</h3>
                        <p>₹{item.price} each</p>

                        <div className="quantity-controls">
                          <button
                            type="button"
                            onClick={() =>
                              changeQuantity(item.id, -1)
                            }
                            aria-label={`Decrease ${item.name} quantity`}
                          >
                            −
                          </button>

                          <span>{item.quantity}</span>

                          <button
                            type="button"
                            onClick={() =>
                              changeQuantity(item.id, 1)
                            }
                            aria-label={`Increase ${item.name} quantity`}
                          >
                            +
                          </button>
                        </div>
                      </div>

                      <div className="cart-item-end">
                        <strong>
                          ₹{item.price * item.quantity}
                        </strong>

                        <button
                          className="remove-item"
                          type="button"
                          onClick={() => removeFromCart(item.id)}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="cart-summary">
                  <div className="cart-total">
                    <span>Total</span>
                    <strong>₹{total}</strong>
                  </div>

                  <p className="checkout-note">
                    Delivery charges, if any, can be confirmed through
                    Instagram.
                  </p>

                  <button
                    className="checkout-button"
                    type="button"
                    onClick={orderOnInstagram}
                  >
                    Order through Instagram ↗
                  </button>

                    {orderCopied && (
                    <p className="order-confirmation" role="status">
                        Your order summary is copied! Paste it into your Instagram
                        message and send it to Veloura Studio to complete your order. ♡
                    </p>
                    )}

                  <p className="checkout-small">
                    Your order is confirmed only after the studio replies
                    to your message.
                  </p>
                </div>
              </>
            )}
          </aside>
        </div>
      )}
    </main>
  );
}