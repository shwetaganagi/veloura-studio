"use client";

import { useEffect, useState } from "react";

type Product = {
  id: number;
  name: string;
  description: string;
  price: number;
  image: string;
  category: string;
  stockQuantity: number;
  emoji: string;
  color: string;
  tag: string;
};
type CartItem = Product & { quantity: number };

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
const whatsappNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "";

export default function ShopClient() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [customizationNotes, setCustomizationNotes] = useState("");
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");
  const [orderSuccess, setOrderSuccess] = useState("");
  const [whatsappOrderUrl, setWhatsappOrderUrl] = useState("");
const handleCheckout = async (event: React.FormEvent<HTMLFormElement>) => {
  event.preventDefault();
  setCheckoutError("");
  setOrderSuccess("");
  setWhatsappOrderUrl("");

  if (cart.length === 0) {
    setCheckoutError("Your cart is empty.");
    return;
  }

  setCheckoutLoading(true);

  try {
    const response = await fetch("/api/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        customerName,
        phone,
        deliveryAddress,
        customizationNotes,
        items: cart.map((item) => ({
          productId: Number(item.id),
          quantity: item.quantity,
        })),
      }),
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.error || "Unable to place your order.");
    }

    const orderId = result.order.id;
    const orderTotal = Number(result.order.subtotal);
    const orderItems = cart.map(
      (item) => `${item.name} x ${item.quantity}`
    );

    const whatsappMessage = [
      "Hello Veloura Studio! 💗",
      "",
      "I have placed an order through your website.",
      `Order ID: #${orderId}`,
      "",
      "Order details:",
      ...orderItems,
      "",
      `Total: ₹${orderTotal.toFixed(2)}`,
      "",
      `Customer name: ${customerName}`,
      `Phone: ${phone}`,
      `Delivery address: ${deliveryAddress}`,
      customizationNotes
        ? `Customization notes: ${customizationNotes}`
        : "",
      "",
      "Please confirm my order. Thank you! ♡",
    ]
      .filter(Boolean)
      .join("\n");

    const cleanWhatsappNumber = whatsappNumber.replace(/\D/g, "");
    if (cleanWhatsappNumber) {
      setWhatsappOrderUrl(
        `https://wa.me/${cleanWhatsappNumber}?text=${encodeURIComponent(
          whatsappMessage
        )}`
      );
    }

    setOrderSuccess(
      `Order #${orderId} placed successfully! Total: ₹${orderTotal.toFixed(2)}`
    );

    setCart([]);
    setCustomerName("");
    setPhone("");
    setDeliveryAddress("");
    setCustomizationNotes("");
  } catch (error) {
    setCheckoutError(
      error instanceof Error
        ? error.message
        : "Something went wrong. Please try again."
    );
  } finally {
    setCheckoutLoading(false);
  }
};
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productsError, setProductsError] = useState("");
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
    let cancelled = false;

    async function loadProducts() {
      try {
        setProductsLoading(true);
        setProductsError("");

        const response = await fetch("/api/products");
        const data: {
          success: boolean;
          products?: Array<{
            id: string;
            name: string;
            description: string | null;
            price: number;
            image: string | null;
            category: string | null;
            stockQuantity: number;
          }>;
          message?: string;
        } = await response.json();

        if (!response.ok || !data.success || !data.products) {
          throw new Error(data.message ?? "Unable to load products.");
        }

        const mappedProducts: Product[] = data.products.map((product) => {
          const name = product.name.toLowerCase();
          let emoji = "🎀";
          if (name.includes("yellow") || name.includes("flower")) emoji = "🌸";
          if (name.includes("keychain")) emoji = "🌼";
          if (name.includes("bow") || name.includes("scrunchie")) emoji = "🎀";

          let color = "product-pink";
          if (name.includes("yellow")) color = "product-yellow";
          else if (name.includes("blue")) {
            color = name.includes("flower") ? "product-peach" : "product-lilac";
          }

          let tag = "Handmade";
          if (name.includes("bow")) tag = "Cute Favourite";
          else if (name.includes("scrunchie")) tag = "Soft & Pretty";
          else if (name.includes("pink")) tag = "Made with Love";

          return {
            id: Number(product.id),
            name: product.name,
            description: product.description ?? "Carefully handmade, especially for you.",
            price: Number(product.price),
            image: product.image ?? "",
            category: product.category ?? "Handmade",
            stockQuantity: Number(product.stockQuantity ?? 0),
            emoji,
            color,
            tag,
          };
        });

        if (!cancelled) setProducts(mappedProducts);
      } catch (error) {
        if (!cancelled) {
          setProductsError(
            error instanceof Error
              ? error.message
              : "We couldn't load the collection. Please try again."
          );
        }
      } finally {
        if (!cancelled) setProductsLoading(false);
      }
    }

    void loadProducts();

    return () => {
      cancelled = true;
    };
  }, []);

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
              src="/products/Veloura Creations Floral Embroidery Logo.jpeg"
              alt="Veloura.creations"
              className="hero-logo-image"
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

        {productsLoading && (
          <p className="shop-note" role="status">Loading our handmade collection… ♡</p>
        )}

        {!productsLoading && productsError && (
          <div className="shop-note" role="alert">
            <p>{productsError}</p>
            <button
              className="add-button"
              type="button"
              onClick={() => window.location.reload()}
            >
              Try again
            </button>
          </div>
        )}

        {!productsLoading && !productsError && products.length === 0 && (
          <p className="shop-note">No products are available right now. Please check back soon ♡</p>
        )}

        {!productsLoading && !productsError && products.length > 0 && (
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
                  {product.description || "Carefully handmade, especially for you."}
                </p>

                <button
                  className="add-button"
                  type="button"
                  onClick={() => addToCart(product)}
                  disabled={product.stockQuantity <= 0}
                >
                  {product.stockQuantity <= 0 ? "Sold out" : "Add to bag +"}
                </button>
              </div>
            </article>
            ))}
          </div>
        )}

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

        <small>© 2026 Veloura Studio</small>
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
                    onClick={() => {
                        setCheckoutOpen(true);
                        setCheckoutError("");
                        setOrderSuccess("");
                    }}
                    >
                    Order through Website ♡
                    </button>

                    <button
                    className="checkout-button"
                    type="button"
                    onClick={orderOnInstagram}
                    style={{ marginTop: "10px" }}
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

      {checkoutOpen && (
        <div
          className="cart-overlay"
          onClick={() => {
            if (!checkoutLoading) setCheckoutOpen(false);
          }}
        >
          <section
            className="cart-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Website checkout"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="cart-header">
              <div>
                <p className="eyebrow">ALMOST YOURS ♡</p>
                <h2>Checkout</h2>
              </div>

              <button
                className="cart-close"
                type="button"
                onClick={() => setCheckoutOpen(false)}
                disabled={checkoutLoading}
                aria-label="Close checkout"
              >
                ×
              </button>
            </div>

            {orderSuccess ? (
              <div className="empty-cart">
                <span aria-hidden="true">💗</span>
                <h3>Thank you for your order!</h3>
                <p>{orderSuccess}</p>
                <p>
                  We have saved your order. You can now send the order details
                  directly to us on WhatsApp.
                </p>

                {whatsappOrderUrl ? (
                  <a
                    className="checkout-button"
                    href={whatsappOrderUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Send Order on WhatsApp ↗
                  </a>
                ) : (
                  <p className="order-confirmation" role="alert">
                    WhatsApp ordering is temporarily unavailable. Please contact
                    us on Instagram instead.
                  </p>
                )}

                <a
                  className="checkout-button"
                  href={instagramDmUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Contact us on Instagram ↗
                </a>

                <button
                  className="primary-button"
                  type="button"
                  onClick={() => {
                    setCheckoutOpen(false);
                    setOrderSuccess("");
                  }}
                  style={{ marginTop: "12px" }}
                >
                  Continue shopping
                </button>
              </div>
            ) : (
              <form onSubmit={handleCheckout}>
                <div className="cart-items">
                  <h3>Your order</h3>

                  {cart.map((item) => (
                    <div className="cart-item" key={item.id}>
                      <div className="cart-item-details">
                        <h3>{item.name}</h3>
                        <p>
                          ₹{item.price} × {item.quantity}
                        </p>
                      </div>

                      <strong>₹{item.price * item.quantity}</strong>
                    </div>
                  ))}

                  <div className="cart-total">
                    <span>Total</span>
                    <strong>₹{total}</strong>
                  </div>
                </div>

                <div
                  style={{
                    display: "grid",
                    gap: "14px",
                    marginTop: "20px",
                  }}
                >
                  <label>
                    Full name *
                    <input
                      type="text"
                      value={customerName}
                      onChange={(event) => setCustomerName(event.target.value)}
                      required
                      maxLength={120}
                      autoComplete="name"
                      placeholder="Enter your full name"
                      style={{ width: "100%", padding: "12px", marginTop: "6px" }}
                    />
                  </label>

                  <label>
                    Phone number *
                    <input
  type="tel"
  value={phone}
  onChange={(event) =>
    setPhone(event.target.value.replace(/\D/g, "").slice(0, 10))
  }
  required
  maxLength={10}
  inputMode="numeric"
  pattern="[6-9][0-9]{9}"
  autoComplete="tel"
  placeholder="Enter your 10-digit mobile number"
  style={{ width: "100%", padding: "12px", marginTop: "6px" }}
/>
                  </label>

                  <label>
                    Delivery address *
                    <textarea
                      value={deliveryAddress}
                      onChange={(event) => setDeliveryAddress(event.target.value)}
                      required
                      maxLength={1000}
                      autoComplete="street-address"
                      placeholder="House number, street, city, PIN code"
                      rows={3}
                      style={{ width: "100%", padding: "12px", marginTop: "6px" }}
                    />
                  </label>

                  <label>
                    Customization notes (optional)
                    <textarea
                      value={customizationNotes}
                      onChange={(event) => setCustomizationNotes(event.target.value)}
                      maxLength={1000}
                      placeholder="Colours, gift messages, or special requests"
                      rows={3}
                      style={{ width: "100%", padding: "12px", marginTop: "6px" }}
                    />
                  </label>
                </div>

                {checkoutError && (
                  <p className="order-confirmation" role="alert">
                    {checkoutError}
                  </p>
                )}

                <button
                  className="checkout-button"
                  type="submit"
                  disabled={checkoutLoading || cart.length === 0}
                  style={{ marginTop: "20px" }}
                >
                  {checkoutLoading ? "Placing your order..." : `Place Order · ₹${total}`}
                </button>

                <p className="checkout-small">
                  Your order details will be saved to our order database. Payment and delivery arrangements will be confirmed separately.
                </p>
              </form>
            )}
          </section>
        </div>
      )}

    </main>
  );
}