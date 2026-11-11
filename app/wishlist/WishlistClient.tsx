"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Heart, House, Store, UserRound } from "lucide-react";
import { useWishlist } from "@/lib/useWishlist";

type CustomerAuthStatus = "loading" | "logged-in" | "logged-out" | "error";

type WishlistProduct = {
  id: number;
  name: string;
  price: number;
  image: string;
};

const pendingCartProductKey = "veloura_wishlist_cart_product";

export default function WishlistClient() {
  const router = useRouter();
  const [authStatus, setAuthStatus] =
    useState<CustomerAuthStatus>("loading");
  const [authError, setAuthError] = useState("");
  const [products, setProducts] = useState<WishlistProduct[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productsError, setProductsError] = useState("");
  const [actionError, setActionError] = useState("");
  const [imageErrors, setImageErrors] = useState<number[]>([]);
  const wishlist = useWishlist(authStatus);

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

        const data: { success?: boolean; message?: string } =
          await response.json();
        if (!response.ok || !data.success) {
          throw new Error(data.message ?? "Unable to check your account.");
        }

        setAuthStatus("logged-in");
      } catch (error) {
        if (!cancelled) {
          console.error("Wishlist customer session check failed:", error);
          setAuthError(
            error instanceof Error
              ? error.message
              : "Account status is currently unavailable."
          );
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
    let cancelled = false;

    async function loadProducts() {
      try {
        const response = await fetch("/api/products");
        const data: {
          success?: boolean;
          products?: Array<{
            id: string;
            name: string;
            price: number;
            image: string | null;
          }>;
          message?: string;
        } = await response.json();

        if (!response.ok || !data.success || !data.products) {
          throw new Error(data.message ?? "Unable to load wishlist products.");
        }

        const mappedProducts = data.products.map((product) => ({
          id: Number(product.id),
          name: product.name,
          price: Number(product.price),
          image: product.image ?? "",
        }));

        if (!cancelled) setProducts(mappedProducts);
      } catch (error) {
        if (!cancelled) {
          setProductsError(
            error instanceof Error
              ? error.message
              : "Unable to load wishlist products."
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

  const favouriteProducts = useMemo(
    () => products.filter((product) => wishlist.productIds.includes(product.id)),
    [products, wishlist.productIds]
  );

  async function addProductToCart(productId: number) {
    setActionError("");
    try {
      window.sessionStorage.setItem(
        pendingCartProductKey,
        String(productId)
      );
      router.push("/");
    } catch (error) {
      console.error("Wishlist cart handoff failed:", error);
      setActionError("Unable to add this product to your bag. Please try again.");
    }
  }

  return (
    <main className="wishlist-page">
      <header className="site-header wishlist-header">
        <Link className="brand" href="/" aria-label="Veloura Studio home">
          veloura studio <span>♡</span>
        </Link>

        <nav className="wishlist-page-nav" aria-label="Main navigation">
          <Link href="/">
            <House size={16} aria-hidden="true" />
            <span>Home</span>
          </Link>
          <Link href="/#shop">
            <Store size={16} aria-hidden="true" />
            <span>Shop</span>
          </Link>
          <Link href="/account#profile">
            <UserRound size={16} aria-hidden="true" />
            <span>My Account</span>
          </Link>
        </nav>

        <Link
          className="wishlist-button is-active"
          href="/wishlist"
          aria-label={`Wishlist, ${wishlist.productIds.length} items`}
          aria-current="page"
        >
          <Heart size={19} fill="currentColor" aria-hidden="true" />
          <span className="wishlist-count">{wishlist.productIds.length}</span>
        </Link>
      </header>

      <section className="wishlist-section">
        <div className="section-heading">
          <p className="eyebrow">YOUR LITTLE COLLECTION</p>
          <h1>Wishlist ♡</h1>
          <p>Keep the handmade pieces you love close by.</p>
        </div>

        {authError && (
          <p className="wishlist-message" role="alert">{authError}</p>
        )}
        {wishlist.error && (
          <p className="wishlist-message" role="alert">{wishlist.error}</p>
        )}
        {actionError && (
          <p className="wishlist-message" role="alert">{actionError}</p>
        )}
        {productsError && (
          <p className="wishlist-message" role="alert">{productsError}</p>
        )}

        {(productsLoading || !wishlist.isReady || wishlist.isSyncing) && (
          <p className="wishlist-loading" role="status">
            Gathering your favourites… ♡
          </p>
        )}

        {!productsLoading &&
          !productsError &&
          wishlist.isReady &&
          !wishlist.isSyncing &&
          favouriteProducts.length === 0 && (
            <div className="wishlist-empty">
              <span className="wishlist-empty-heart" aria-hidden="true">♡</span>
              <h2>Your wishlist is waiting for a little love ♡</h2>
              <p>Save a favourite from the collection and it will be waiting here.</p>
              <Link className="primary-button" href="/#shop">
                Explore the collection
              </Link>
            </div>
          )}

        {!productsLoading &&
          !wishlist.isSyncing &&
          favouriteProducts.length > 0 && (
          <div className="product-grid wishlist-grid">
            {favouriteProducts.map((product) => (
              <article className="product-card wishlist-product-card" key={product.id}>
                <div className="product-art">
                  {!imageErrors.includes(product.id) && product.image ? (
                    <Image
                      className="product-image"
                      src={product.image}
                      alt={product.name}
                      width={400}
                      height={420}
                      sizes="(max-width: 600px) 45vw, (max-width: 900px) 30vw, 260px"
                      onError={() =>
                        setImageErrors((current) =>
                          current.includes(product.id)
                            ? current
                            : [...current, product.id]
                        )
                      }
                    />
                  ) : (
                    <span className="product-emoji" aria-hidden="true">♡</span>
                  )}
                </div>

                <div className="product-info">
                  <div className="product-title-row">
                    <h2>{product.name}</h2>
                    <span className="product-price">₹{product.price}</span>
                  </div>

                  <button
                    className="add-button wishlist-cart-button"
                    type="button"
                    onClick={() => void addProductToCart(product.id)}
                  >
                    Add to Cart
                  </button>
                  <button
                    className="wishlist-remove-button"
                    type="button"
                    disabled={wishlist.pendingProductIds.includes(product.id)}
                    onClick={() => void wishlist.removeFromWishlist(product.id)}
                  >
                    Remove from Wishlist
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
