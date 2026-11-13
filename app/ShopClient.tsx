"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Grid2X2,
  Heart,
  House,
  LogIn,
  LogOut,
  Menu,
  MessageCircle,
  Package,
  ShoppingBag,
  Star,
  Store,
  UserPlus,
  UserRound,
  X,
} from "lucide-react";
import { useWishlist } from "@/lib/useWishlist";

type Product = {
  id: number;
  name: string;
  description: string;
  price: number;
  image: string;
  category: string;
  stockQuantity: number;
  lowStockThreshold: number;
  averageRating: number;
  reviewCount: number;
  emoji: string;
  color: string;
  tag: string;
};
type CartItem = Product & { quantity: number };

type RazorpayCheckoutResult = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

type RazorpayCheckoutOptions = {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  prefill: {
    name: string;
    contact: string;
  };
  theme: {
    color: string;
  };
  handler: (result: RazorpayCheckoutResult) => void;
  modal: {
    ondismiss: () => void;
  };
};

type RazorpayCheckoutInstance = {
  open: () => void;
  on: (
    event: "payment.failed",
    handler: (response: unknown) => void
  ) => void;
};

type RazorpayConstructor = new (
  options: RazorpayCheckoutOptions
) => RazorpayCheckoutInstance;

declare global {
  interface Window {
    Razorpay?: RazorpayConstructor;
  }
}

let razorpayScriptPromise: Promise<boolean> | undefined;

function loadRazorpayCheckout() {
  if (window.Razorpay) {
    return Promise.resolve(true);
  }

  if (!razorpayScriptPromise) {
    razorpayScriptPromise = new Promise((resolve) => {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      script.onload = () => {
        const loaded = Boolean(window.Razorpay);
        if (!loaded) {
          razorpayScriptPromise = undefined;
          script.remove();
        }
        resolve(loaded);
      };
      script.onerror = () => {
        razorpayScriptPromise = undefined;
        script.remove();
        resolve(false);
      };
      document.body.appendChild(script);
    });
  }

  return razorpayScriptPromise;
}

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
] as const;

type CategoryName = (typeof categories)[number]["name"];
type SelectedCategory = CategoryName | "All Products";

function resolveProductCategory(
  category: string | null,
  name: string,
  description: string,
  image: string
): CategoryName {
  const normalizedCategory = category?.trim().toLowerCase() ?? "";
  if (normalizedCategory === "jewellery" || normalizedCategory === "jewelry") {
    return "Jewellery";
  }
  if (normalizedCategory === "little surprises") {
    return "Little Surprises";
  }

  const productDetails = `${name} ${description} ${image}`.toLowerCase();
  if (
    productDetails.includes("frame") ||
    productDetails.includes("forever love")
  ) {
    return "Birthday Gifts";
  }
  if (
    productDetails.includes("lamp") ||
    productDetails.includes("diya") ||
    productDetails.includes("hanging")
  ) {
    return "Little Surprises";
  }
  if (productDetails.includes("birthday")) return "Birthday Gifts";
  if (productDetails.includes("phone cover") || productDetails.includes("phone case")) {
    return "Phone Covers";
  }
  if (productDetails.includes("keychain") || productDetails.includes("key chain")) {
    return "Keychains";
  }
  if (productDetails.includes("bouquet")) return "Flower Bouquets";
  if (
    productDetails.includes("jewellery") ||
    productDetails.includes("jewelry") ||
    productDetails.includes("necklace") ||
    productDetails.includes("bracelet") ||
    productDetails.includes("earring")
  ) {
    return "Jewellery";
  }
  if (
    productDetails.includes("scrunchie") ||
    productDetails.includes("hair accessory") ||
    productDetails.includes("hair clip") ||
    productDetails.includes("hairband") ||
    productDetails.includes("hair band") ||
    productDetails.includes("bow")
  ) {
    return "Hair Accessories";
  }

  const categoryAliases: Record<string, CategoryName> = {
    "flower bouquets": "Flower Bouquets",
    bouquets: "Flower Bouquets",
    flowers: "Handmade Flowers",
    "handmade flowers": "Handmade Flowers",
    keychain: "Keychains",
    keychains: "Keychains",
    "key chain": "Keychains",
    "key chains": "Keychains",
    jewellery: "Jewellery",
    jewelry: "Jewellery",
    "hair accessories": "Hair Accessories",
    "hair accessory": "Hair Accessories",
    accessories: "Hair Accessories",
    "birthday gifts": "Birthday Gifts",
    birthday: "Birthday Gifts",
    "phone covers": "Phone Covers",
    "phone cover": "Phone Covers",
    "phone cases": "Phone Covers",
    "phone case": "Phone Covers",
    "little surprises": "Little Surprises",
    gifts: "Little Surprises",
    gift: "Little Surprises",
    "home decor": "Little Surprises",
  };
  const categoryMatch = categoryAliases[normalizedCategory];
  if (categoryMatch) return categoryMatch;

  if (productDetails.includes("flower")) return "Handmade Flowers";
  if (productDetails.includes("gift") || productDetails.includes("surprise")) {
    return "Little Surprises";
  }

  return "Little Surprises";
}

const instagramUrl = "https://www.instagram.com/veloura.studio_26/";
const instagramDmUrl = "https://ig.me/m/veloura.studio_26";
const whatsappNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "";

export default function ShopClient() {
  const router = useRouter();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [customizationNotes, setCustomizationNotes] = useState("");
  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string;
    discountPaise: number;
    subtotalPaise: number;
  } | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState("");
  const [checkoutMethod, setCheckoutMethod] = useState<"whatsapp" | "razorpay">(
    "whatsapp"
  );
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");
  const [stockMessage, setStockMessage] = useState("");
  const [orderSuccess, setOrderSuccess] = useState("");
  const [orderSuccessMethod, setOrderSuccessMethod] = useState<
    "whatsapp" | "razorpay" | null
  >(null);
  const [paymentNotice, setPaymentNotice] = useState("");
  const [whatsappOrderUrl, setWhatsappOrderUrl] = useState("");
  const razorpayRequestRef = useRef<{ fingerprint: string; key: string } | null>(
    null
  );

  function clearCheckoutDetails() {
    setCart([]);
    setCustomerName("");
    setCustomerEmail("");
    setPhone("");
    setDeliveryAddress("");
    setCustomizationNotes("");
    setCouponInput("");
    setAppliedCoupon(null);
    setCouponError("");
    razorpayRequestRef.current = null;
  }

  async function applyCoupon() {
    if (!couponInput.trim()) {
      setCouponError("Enter a coupon code to apply.");
      return;
    }
    if (cart.length === 0) {
      setCouponError("Add a product to your bag before applying a coupon.");
      return;
    }

    setCouponLoading(true);
    setCouponError("");
    try {
      const response = await fetch("/api/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: couponInput,
          ...(/^[6-9]\d{9}$/.test(phone) ? { phone } : {}),
          items: cart.map((item) => ({
            productId: Number(item.id),
            quantity: item.quantity,
          })),
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || "Unable to apply this coupon.");
      }
      setAppliedCoupon({
        code: result.coupon.code,
        discountPaise: Number(result.coupon.discountPaise),
        subtotalPaise: Number(result.subtotalPaise),
      });
      setCouponInput(result.coupon.code);
    } catch (error) {
      setAppliedCoupon(null);
      setCouponError(
        error instanceof Error ? error.message : "Unable to apply this coupon."
      );
    } finally {
      setCouponLoading(false);
    }
  }

  async function handleRazorpayCheckout() {
    if (cart.length === 0) {
      setCheckoutError("Your cart is empty.");
      return;
    }

    setCheckoutLoading(true);
    setCheckoutError("");
    setPaymentNotice("");

    const checkoutInput = {
      customerName,
      email: customerEmail.trim(),
      phone,
      deliveryAddress,
      customizationNotes,
      ...(appliedCoupon ? { couponCode: appliedCoupon.code } : {}),
      items: cart.map((item) => ({
        productId: Number(item.id),
        quantity: item.quantity,
      })),
    };
    const fingerprint = JSON.stringify(checkoutInput);
    if (razorpayRequestRef.current?.fingerprint !== fingerprint) {
      razorpayRequestRef.current = {
        fingerprint,
        key: crypto.randomUUID(),
      };
    }
    const idempotencyKey = razorpayRequestRef.current.key;

    try {
      const scriptLoaded = await loadRazorpayCheckout();
      if (!scriptLoaded || !window.Razorpay) {
        throw new Error(
          "Online payment could not be loaded. Please try WhatsApp ordering instead."
        );
      }

      const createResponse = await fetch("/api/payments/create-order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify(checkoutInput),
      });
      const orderData = await createResponse.json();

      if (
        !createResponse.ok ||
        !orderData.success ||
        typeof orderData.keyId !== "string" ||
        typeof orderData.orderId !== "string" ||
        !Number.isSafeInteger(orderData.amount) ||
        orderData.amount <= 0 ||
        orderData.currency !== "INR"
      ) {
        throw new Error(
          orderData.message || "Unable to prepare online payment."
        );
      }

      let callbackReceived = false;
      const checkout = new window.Razorpay({
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency,
        name: "Veloura Studio",
        description: "Handmade order",
        order_id: orderData.orderId,
        prefill: {
          name: customerName,
          contact: phone,
        },
        theme: {
          color: "#9b5b67",
        },
        handler: async (result) => {
          callbackReceived = true;
          setCheckoutLoading(true);
          setPaymentNotice("");

          try {
            const verifyResponse = await fetch("/api/payments/verify", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify(result),
            });
            const verifyData = await verifyResponse.json();

            if (
              verifyData.success &&
              verifyData.paid === true &&
              typeof verifyData.inventoryConflict === "boolean"
            ) {
              setOrderSuccessMethod("razorpay");
              setOrderSuccess(
                verifyData.inventoryConflict
                  ? `Payment received for order ${orderData.orderId}. The studio is reviewing stock availability and will contact you about fulfilment.`
                  : `Payment verified for order ${orderData.orderId}. Thank you for your purchase!`
              );
              clearCheckoutDetails();
              return;
            }

            setPaymentNotice(
              verifyData.pending
                ? `Payment for order ${orderData.orderId} is still being confirmed. Please do not pay again yet.`
                : `We could not confirm payment for order ${orderData.orderId}. Please contact the studio before trying again.`
            );
          } catch {
            setPaymentNotice(
              `We could not confirm payment status for order ${orderData.orderId}. Please do not pay again; contact the studio with this order number.`
            );
          } finally {
            setCheckoutLoading(false);
          }
        },
        modal: {
          ondismiss: () => {
            if (!callbackReceived) {
              setPaymentNotice(
                `Checkout was closed. Payment for order ${orderData.orderId} is not confirmed. You can try again or choose WhatsApp ordering.`
              );
              setCheckoutLoading(false);
            }
          },
        },
      });

      checkout.on("payment.failed", () => {
        callbackReceived = true;
        setCheckoutLoading(false);
        setPaymentNotice(
          `The payment for order ${orderData.orderId} was not completed. You can try again or choose WhatsApp ordering.`
        );
      });

      checkout.open();
    } catch (error) {
      setCheckoutError(
        error instanceof Error
          ? error.message
          : "Unable to start online payment. Please try again."
      );
      setCheckoutLoading(false);
    }
  }

const handleCheckout = async (event: React.FormEvent<HTMLFormElement>) => {
  event.preventDefault();
  setCheckoutError("");
  setOrderSuccess("");
  setOrderSuccessMethod(null);
  setPaymentNotice("");
  setWhatsappOrderUrl("");

  if (checkoutMethod === "razorpay") {
    await handleRazorpayCheckout();
    return;
  }

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
        email: customerEmail.trim(),
        phone,
        deliveryAddress,
        customizationNotes,
        ...(appliedCoupon ? { couponCode: appliedCoupon.code } : {}),
        items: cart.map((item) => ({
          productId: Number(item.id),
          quantity: item.quantity,
        })),
      }),
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.error || result.message || "Unable to place your order.");
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
      ...(result.order.couponCode
        ? [
            `Subtotal: ₹${Number(result.order.subtotalBeforeDiscount).toFixed(2)}`,
            `Coupon (${result.order.couponCode}): -₹${Number(result.order.discount).toFixed(2)}`,
          ]
        : []),
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

    setOrderSuccessMethod("whatsapp");
    clearCheckoutDetails();
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
  const [selectedCategory, setSelectedCategory] =
    useState<SelectedCategory>("All Products");
  const [productsLoading, setProductsLoading] = useState(true);
  const [productsError, setProductsError] = useState("");
  const [cartOpen, setCartOpen] = useState(false);
  const [orderCopied, setOrderCopied] = useState(false);
  const [imageErrors, setImageErrors] = useState<number[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("home");
  const [authStatus, setAuthStatus] = useState<
    "loading" | "logged-in" | "logged-out" | "error"
  >("loading");
  const wishlist = useWishlist(authStatus);
  const [authError, setAuthError] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);
  const [wishlistCartError, setWishlistCartError] = useState("");

  const itemCount = cart.reduce(
    (sum, item) => sum + item.quantity,
    0
  );

  const total = cart.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );
  const appliedDiscount =
    appliedCoupon && appliedCoupon.subtotalPaise === Math.round(total * 100)
      ? appliedCoupon.discountPaise / 100
      : 0;
  const payableTotal = Math.max(total - appliedDiscount, 0);

  const visibleProducts =
    selectedCategory === "All Products"
      ? products
      : products.filter((product) => product.category === selectedCategory);

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
            lowStockThreshold: number;
            averageRating: number;
            reviewCount: number;
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
            category: resolveProductCategory(
              product.category,
              product.name,
              product.description ?? "",
              product.image ?? ""
            ),
            stockQuantity: Number(product.stockQuantity ?? 0),
            lowStockThreshold: Number(product.lowStockThreshold ?? 5),
            averageRating: Number(product.averageRating ?? 0),
            reviewCount: Number(product.reviewCount ?? 0),
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

  useEffect(() => {
    let cancelled = false;

    async function checkCustomerSession() {
      try {
        const response = await fetch("/api/auth/me", { cache: "no-store" });

        if (cancelled) return;

        if (response.status === 401) {
          setAuthStatus("logged-out");
          return;
        }

        const data = await response.json();
        if (!response.ok || !data.success) {
          throw new Error(data.message || "Unable to check your account.");
        }

        setAuthStatus("logged-in");
      } catch (error) {
        if (!cancelled) {
          console.error("Customer session check failed:", error);
          setAuthError("Account status is currently unavailable.");
          setAuthStatus("error");
        }
      }
    }

    void checkCustomerSession();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function updateActiveSection() {
      const categoriesTop =
        document.getElementById("categories")?.getBoundingClientRect().top ??
        Number.POSITIVE_INFINITY;
      const shopTop =
        document.getElementById("shop")?.getBoundingClientRect().top ??
        Number.POSITIVE_INFINITY;

      if (shopTop <= 150) {
        setActiveSection("shop");
      } else if (categoriesTop <= 150) {
        setActiveSection("categories");
      } else {
        setActiveSection("home");
      }
    }

    window.addEventListener("scroll", updateActiveSection, { passive: true });
    updateActiveSection();

    return () => window.removeEventListener("scroll", updateActiveSection);
  }, []);

  async function handleLogout() {
    setLoggingOut(true);
    setAuthError("");

    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to log out.");
      }

      setAuthStatus("logged-out");
      setMenuOpen(false);
      router.refresh();
    } catch (error) {
      console.error("Customer logout failed:", error);
      setAuthError(
        error instanceof Error ? error.message : "Unable to log out."
      );
    } finally {
      setLoggingOut(false);
    }
  }

  function closeNavigation(section?: string) {
    if (section) setActiveSection(section);
    setMenuOpen(false);
  }

  function selectCategory(category: SelectedCategory, scrollToProducts = false) {
    setSelectedCategory(category);
    if (scrollToProducts) {
      document.getElementById("shop")?.scrollIntoView({ behavior: "smooth" });
    }
  }

  const addToCart = useCallback((product: Product) => {
    const existingItem = cart.find((item) => item.id === product.id);
    if (product.stockQuantity <= 0) {
      setStockMessage(`${product.name} is currently out of stock.`);
      return;
    }
    if (existingItem && existingItem.quantity >= product.stockQuantity) {
      setStockMessage(`Only ${product.stockQuantity} ${product.name} available.`);
      return;
    }

    setCart((currentCart) => {
      const currentItem = currentCart.find(
        (item) => item.id === product.id
      );

      if (currentItem) {
        return currentCart.map((item) =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }

      return [...currentCart, { ...product, quantity: 1 }];
    });

    setAppliedCoupon(null);
    setCouponError("");
    setCartOpen(true);
    setOrderCopied(false);
    setStockMessage("");
  }, [cart]);

  useEffect(() => {
    if (products.length === 0) return;

    const frame = window.requestAnimationFrame(() => {
      try {
        const pendingProductId = window.sessionStorage.getItem(
          "veloura_wishlist_cart_product"
        );
        if (!pendingProductId) return;

        window.sessionStorage.removeItem("veloura_wishlist_cart_product");
        const product = products.find(
          (candidate) => candidate.id === Number(pendingProductId)
        );

        if (!product) {
          setWishlistCartError(
            "That saved product is no longer available to add to your bag."
          );
          return;
        }

        addToCart(product);
      } catch (error) {
        console.error("Wishlist cart handoff could not be completed:", error);
        setWishlistCartError("Unable to add this favourite to your bag.");
      }
    });

    return () => window.cancelAnimationFrame(frame);
  }, [addToCart, products]);

  function changeQuantity(productId: number, change: number) {
    const item = cart.find((cartItem) => cartItem.id === productId);
    if (
      change > 0 &&
      item &&
      item.quantity + change > item.stockQuantity
    ) {
      setStockMessage(
        `Only ${item.stockQuantity} ${item.name} available right now.`
      );
      return;
    }

    setCart((currentCart) =>
      currentCart
        .map((item) =>
          item.id === productId
            ? { ...item, quantity: item.quantity + change }
            : item
        )
        .filter((item) => item.quantity > 0)
    );

    setAppliedCoupon(null);
    setCouponError("");
    setStockMessage("");
    setOrderCopied(false);
  }

  function removeFromCart(productId: number) {
    setCart((currentCart) =>
      currentCart.filter((item) => item.id !== productId)
    );

    setAppliedCoupon(null);
    setCouponError("");
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
          onClick={() => closeNavigation("home")}
        >
          veloura studio <span>♡</span>
        </a>

        <nav
          className={`main-nav${menuOpen ? " is-open" : ""}`}
          id="customer-navigation"
          aria-label="Main navigation"
        >
          <a
            href="#home"
            className={activeSection === "home" ? "active" : ""}
            aria-current={activeSection === "home" ? "page" : undefined}
            onClick={() => closeNavigation("home")}
          >
            <House size={16} aria-hidden="true" />
            <span>Home</span>
          </a>
          <a
            href="#shop"
            className={activeSection === "shop" ? "active" : ""}
            aria-current={activeSection === "shop" ? "page" : undefined}
            onClick={() => closeNavigation("shop")}
          >
            <Store size={16} aria-hidden="true" />
            <span>Shop</span>
          </a>
          <a
            href="#categories"
            className={activeSection === "categories" ? "active" : ""}
            aria-current={activeSection === "categories" ? "page" : undefined}
            onClick={() => closeNavigation("categories")}
          >
            <Grid2X2 size={16} aria-hidden="true" />
            <span>Categories</span>
          </a>
          <Link href="/account#orders" onClick={() => closeNavigation()}>
            <Package size={16} aria-hidden="true" />
            <span>My Orders</span>
          </Link>
          <Link href="/account#profile" onClick={() => closeNavigation()}>
            <UserRound size={16} aria-hidden="true" />
            <span>My Account</span>
          </Link>
          <Link href="/wishlist" onClick={() => closeNavigation()}>
            <Heart size={16} aria-hidden="true" />
            <span>Wishlist ({wishlist.productIds.length})</span>
          </Link>
          <a
            href={instagramDmUrl}
            target="_blank"
            rel="noreferrer"
            onClick={() => closeNavigation()}
          >
            <MessageCircle size={16} aria-hidden="true" />
            <span>Contact Us</span>
          </a>
          {authStatus !== "loading" && (
            <div className="nav-auth-mobile">
              {authStatus === "logged-in" ? (
                <>
                  <Link href="/account#profile" onClick={() => closeNavigation()}>
                    <UserRound size={16} aria-hidden="true" />
                    <span>Account</span>
                  </Link>
                  <button
                    type="button"
                    onClick={handleLogout}
                    disabled={loggingOut}
                  >
                    <LogOut size={16} aria-hidden="true" />
                    <span>{loggingOut ? "Logging out…" : "Logout"}</span>
                  </button>
                </>
              ) : (
                <>
                  <Link href="/login" onClick={() => closeNavigation()}>
                    <LogIn size={16} aria-hidden="true" />
                    <span>Login</span>
                  </Link>
                  <Link href="/register" onClick={() => closeNavigation()}>
                    <UserPlus size={16} aria-hidden="true" />
                    <span>Register</span>
                  </Link>
                </>
              )}
            </div>
          )}
        </nav>

        <div className="nav-utilities">
          <div className="nav-auth-desktop">
            {authStatus === "logged-in" ? (
              <>
                <Link href="/account#profile" aria-label="My account">
                  <UserRound size={17} aria-hidden="true" />
                  <span>Account</span>
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={loggingOut}
                  aria-label="Log out"
                  title={loggingOut ? "Logging out…" : "Log out"}
                >
                  <LogOut size={17} aria-hidden="true" />
                </button>
              </>
            ) : authStatus === "logged-out" || authStatus === "error" ? (
              <>
                <Link href="/login" aria-label="Log in">
                  <LogIn size={17} aria-hidden="true" />
                  <span>Login</span>
                </Link>
                <Link href="/register" aria-label="Register">
                  <UserPlus size={17} aria-hidden="true" />
                  <span>Register</span>
                </Link>
              </>
            ) : null}
          </div>
          {authError && (
            <span className="nav-auth-error" role="alert">
              {authError}
            </span>
          )}
          <Link
            className="wishlist-button"
            href="/wishlist"
            aria-label={`Wishlist, ${wishlist.productIds.length} items`}
          >
            <Heart
              size={19}
              fill={wishlist.productIds.length > 0 ? "currentColor" : "none"}
              aria-hidden="true"
            />
            <span className="wishlist-count">{wishlist.productIds.length}</span>
          </Link>
          <button
            className="cart-button"
            type="button"
            onClick={() => setCartOpen(true)}
            aria-label={`Open shopping bag, ${itemCount} items`}
          >
            <ShoppingBag size={18} aria-hidden="true" />
            <span className="cart-count">{itemCount}</span>
          </button>
          <button
            className="mobile-menu-toggle"
            type="button"
            aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={menuOpen}
            aria-controls="customer-navigation"
            onClick={() => setMenuOpen((isOpen) => !isOpen)}
          >
            {menuOpen ? (
              <X size={21} aria-hidden="true" />
            ) : (
              <Menu size={21} aria-hidden="true" />
            )}
          </button>
        </div>
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
          <button
            className={`category-card category-all${selectedCategory === "All Products" ? " is-selected" : ""}`}
            type="button"
            aria-pressed={selectedCategory === "All Products"}
            onClick={() => selectCategory("All Products", true)}
          >
            <span className="category-emoji" aria-hidden="true">🛍️</span>
            <h3>All Products</h3>
            <p>Browse the whole collection</p>
          </button>
          {categories.map((category) => (
            <button
              className={`category-card${selectedCategory === category.name ? " is-selected" : ""}`}
              type="button"
              key={category.name}
              aria-pressed={selectedCategory === category.name}
              onClick={() => selectCategory(category.name, true)}
            >
              <span className="category-emoji" aria-hidden="true">
                {category.emoji}
              </span>

              <h3>{category.name}</h3>
              <p>{category.description}</p>
            </button>
          ))}
        </div>
      </section>

      <section className="section shop-section" id="shop">
        <div className="section-heading">
          <p className="eyebrow">THE HANDMADE COLLECTION</p>
          <h2>Little things you&apos;ll love ♡</h2>
          <p>Each piece is made with care and a whole lot of love.</p>
        </div>

        <nav className="shop-category-filters" aria-label="Filter products by category">
          <ul className="shop-category-list">
            <li>
              <button
                className={`shop-category-filter${selectedCategory === "All Products" ? " is-selected" : ""}`}
                type="button"
                aria-pressed={selectedCategory === "All Products"}
                onClick={() => selectCategory("All Products")}
              >
                All Products
              </button>
            </li>
            {categories.map((category) => (
              <li key={category.name}>
                <button
                  className={`shop-category-filter${selectedCategory === category.name ? " is-selected" : ""}`}
                  type="button"
                  aria-pressed={selectedCategory === category.name}
                  onClick={() => selectCategory(category.name)}
                >
                  {category.name}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {!productsLoading && !productsError && products.length > 0 && (
          <div className="shop-results" role="status" aria-live="polite">
            <p className="shop-selected-category">
              Showing <strong>{selectedCategory}</strong>
            </p>
            {(visibleProducts.length > 0 || selectedCategory === "All Products") && (
              <p className="shop-product-count">
                {visibleProducts.length}{" "}
                {visibleProducts.length === 1 ? "product" : "products"}
                {selectedCategory === "All Products"
                  ? " in the collection"
                  : ` in ${selectedCategory}`}
              </p>
            )}
          </div>
        )}

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
          <div className="shop-empty-state" role="status">
            <h3>No products found</h3>
            <p>There are currently no products in this category.</p>
          </div>
        )}

        {!productsLoading &&
          !productsError &&
          products.length > 0 &&
          visibleProducts.length === 0 && (
            <div className="shop-empty-state" role="status">
              <h3>No products found</h3>
              <p>There are currently no products in this category.</p>
            </div>
          )}

        {!productsLoading && !productsError && visibleProducts.length > 0 && (
          <div className="product-grid">
            {visibleProducts.map((product) => (
            <article className="product-card" key={product.id}>
              <div className={`product-art ${product.color}`}>
                <span className="product-tag">{product.tag}</span>
                <button
                  className={`wishlist-heart${wishlist.productIds.includes(product.id) ? " is-favourite" : ""}`}
                  type="button"
                  aria-label={
                    wishlist.productIds.includes(product.id)
                      ? `Remove ${product.name} from wishlist`
                      : `Add ${product.name} to wishlist`
                  }
                  aria-pressed={wishlist.productIds.includes(product.id)}
                  disabled={
                    wishlist.isSyncing ||
                    wishlist.pendingProductIds.includes(product.id)
                  }
                  onClick={() =>
                    void (wishlist.productIds.includes(product.id)
                      ? wishlist.removeFromWishlist(product.id)
                      : wishlist.addToWishlist(product.id))
                  }
                >
                  <Heart
                    size={19}
                    fill={wishlist.productIds.includes(product.id) ? "currentColor" : "none"}
                    aria-hidden="true"
                  />
                </button>

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
                <p className={`product-stock-status ${product.stockQuantity <= 0 ? "out" : product.stockQuantity <= product.lowStockThreshold ? "low" : "in"}`}>
                  {product.stockQuantity <= 0
                    ? "Out of Stock"
                    : product.stockQuantity <= product.lowStockThreshold
                      ? `Only ${product.stockQuantity} left`
                      : "In Stock"}
                </p>
                <div className="product-title-row">
                  <h3>
                    <Link href={`/product/${product.id}`}>{product.name}</Link>
                  </h3>
                  <span className="product-price">
                    ₹{product.price}
                  </span>
                </div>

                <p className="product-description">
                  {product.description || "Carefully handmade, especially for you."}
                </p>

                <Link
                  className="product-rating"
                  href={`/product/${product.id}#reviews`}
                  aria-label={
                    product.reviewCount > 0
                      ? `${product.averageRating.toFixed(1)} out of 5 stars, ${product.reviewCount} reviews`
                      : "Be the first to review this product"
                  }
                >
                  <span className="product-rating-stars" aria-hidden="true">
                    {Array.from({ length: 5 }, (_, index) => (
                      <Star
                        key={index}
                        size={14}
                        fill={index < Math.round(product.averageRating) ? "currentColor" : "none"}
                      />
                    ))}
                  </span>
                  <span>
                    {product.reviewCount > 0
                      ? `${product.averageRating.toFixed(1)} · ${product.reviewCount} ${product.reviewCount === 1 ? "review" : "reviews"}`
                      : "Be the first to review"}
                  </span>
                </Link>

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

        {wishlist.error && (
          <p className="wishlist-message" role="alert">{wishlist.error}</p>
        )}
        {wishlistCartError && (
          <p className="wishlist-message" role="alert">{wishlistCartError}</p>
        )}
        {stockMessage && (
          <p className="product-stock-message" role="status">{stockMessage}</p>
        )}

        {visibleProducts.length > 0 && (
          <p className="shop-note">More handmade surprises coming soon ♡</p>
        )}
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
                  {stockMessage && (
                    <p className="product-stock-message" role="status">{stockMessage}</p>
                  )}
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
                            disabled={item.quantity >= item.stockQuantity}
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
                <h3>
                  {orderSuccessMethod === "razorpay"
                    ? "Payment update"
                    : "Thank you for your order!"}
                </h3>
                <p>{orderSuccess}</p>

                {orderSuccessMethod === "whatsapp" && (
                  <>
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
                  </>
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
                    setOrderSuccessMethod(null);
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

                  <div className="checkout-coupon">
                    <label htmlFor="checkout-coupon-code">Have a coupon?</label>
                    <div className="checkout-coupon-entry">
                      <input
                        id="checkout-coupon-code"
                        type="text"
                        value={couponInput}
                        onChange={(event) => {
                          setCouponInput(event.target.value.toUpperCase());
                          setAppliedCoupon(null);
                          setCouponError("");
                        }}
                        maxLength={40}
                        autoComplete="off"
                        placeholder="Enter code"
                        disabled={couponLoading || checkoutLoading}
                      />
                      {appliedCoupon ? (
                        <button
                          type="button"
                          className="checkout-coupon-remove"
                          onClick={() => {
                            setAppliedCoupon(null);
                            setCouponError("");
                          }}
                          disabled={checkoutLoading}
                        >
                          Remove
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="checkout-coupon-apply"
                          onClick={() => void applyCoupon()}
                          disabled={couponLoading || checkoutLoading}
                        >
                          {couponLoading ? "Checking…" : "Apply"}
                        </button>
                      )}
                    </div>
                    {couponError && (
                      <p className="checkout-coupon-error" role="alert">{couponError}</p>
                    )}
                    {appliedCoupon && appliedDiscount > 0 && (
                      <p className="checkout-coupon-success" role="status">
                        {appliedCoupon.code} applied — you save ₹{appliedDiscount.toFixed(2)}.
                      </p>
                    )}
                  </div>

                  {appliedDiscount > 0 && (
                    <>
                      <div className="cart-total checkout-subtotal">
                        <span>Subtotal</span>
                        <strong>₹{total.toFixed(2)}</strong>
                      </div>
                      <div className="cart-total checkout-discount">
                        <span>Coupon · {appliedCoupon?.code}</span>
                        <strong>−₹{appliedDiscount.toFixed(2)}</strong>
                      </div>
                    </>
                  )}
                  <div className="cart-total">
                    <span>Total</span>
                    <strong>₹{payableTotal.toFixed(2)}</strong>
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
                    Email address *
                    <input
                      type="email"
                      value={customerEmail}
                      onChange={(event) => setCustomerEmail(event.target.value)}
                      required
                      maxLength={255}
                      autoComplete="email"
                      placeholder="Where should we send your order updates?"
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

                <fieldset className="payment-method-options">
                  <legend>Choose how you&apos;d like to order</legend>
                  <label>
                    <input
                      type="radio"
                      name="checkoutMethod"
                      value="whatsapp"
                      checked={checkoutMethod === "whatsapp"}
                      onChange={() => setCheckoutMethod("whatsapp")}
                      disabled={checkoutLoading}
                    />
                    <span>
                      <strong>Order via WhatsApp</strong>
                      <small>We&apos;ll confirm your order in a message.</small>
                    </span>
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="checkoutMethod"
                      value="razorpay"
                      checked={checkoutMethod === "razorpay"}
                      onChange={() => setCheckoutMethod("razorpay")}
                      disabled={checkoutLoading}
                    />
                    <span>
                      <strong>Pay Online with Razorpay</strong>
                      <small>Secure checkout with supported payment methods.</small>
                    </span>
                  </label>
                </fieldset>

                {paymentNotice && (
                  <p className="order-confirmation" role="status">
                    {paymentNotice}
                  </p>
                )}

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
                  {checkoutLoading
                    ? checkoutMethod === "razorpay"
                      ? "Preparing secure checkout..."
                      : "Placing your order..."
                    : checkoutMethod === "razorpay"
                      ? `Pay Online · ₹${payableTotal.toFixed(2)}`
                      : `Place WhatsApp Order · ₹${payableTotal.toFixed(2)}`}
                </button>

                <p className="checkout-small">
                  {checkoutMethod === "razorpay"
                    ? "Your payment is confirmed only after our server verifies it with Razorpay."
                    : "Your order details will be saved to our order database. Payment and delivery arrangements will be confirmed separately."}
                </p>
              </form>
            )}
          </section>
        </div>
      )}

    </main>
  );
}
