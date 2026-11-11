"use client";

import { ChangeEvent, FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Heart, Star } from "lucide-react";

type Product = {
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
};

type Review = {
  id: string;
  displayName: string;
  rating: number;
  title: string;
  reviewText: string;
  createdAt: string;
  hasPhoto: boolean;
  verifiedPurchase: boolean;
};

type OwnedReview = {
  id: string;
  orderId: string;
  displayName: string;
  rating: number;
  title: string;
  reviewText: string;
  moderationStatus: "visible" | "hidden";
  hasPhoto: boolean;
};

type EligibleOrder = {
  orderId: string;
  reviewed: boolean;
  reviewId: string | null;
};

type ReviewData = {
  summary: {
    averageRating: number;
    totalReviews: number;
    distribution: Array<{
      rating: number;
      count: number;
      percentage: number;
    }>;
  };
  reviews: Review[];
  eligibleOrders: EligibleOrder[];
  myReviews: OwnedReview[];
};

const emptyReviewData: ReviewData = {
  summary: {
    averageRating: 0,
    totalReviews: 0,
    distribution: [],
  },
  reviews: [],
  eligibleOrders: [],
  myReviews: [],
};

function Stars({ rating, size = 17 }: { rating: number; size?: number }) {
  return (
    <span className="review-stars" aria-label={`${rating} out of 5 stars`}>
      {Array.from({ length: 5 }, (_, index) => (
        <Star
          key={index}
          size={size}
          fill={index < Math.round(rating) ? "currentColor" : "none"}
          aria-hidden="true"
        />
      ))}
    </span>
  );
}

function formatReviewDate(value: string) {
  return new Date(value).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function ProductDetailClient({
  productId,
}: {
  productId: string;
}) {
  const router = useRouter();
  const [product, setProduct] = useState<Product | null>(null);
  const [reviewData, setReviewData] = useState<ReviewData>(emptyReviewData);
  const [loading, setLoading] = useState(true);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [error, setError] = useState("");
  const [reviewsError, setReviewsError] = useState("");
  const [formError, setFormError] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState("");
  const [reviewText, setReviewText] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [editingReviewId, setEditingReviewId] = useState<string | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [removeExistingPhoto, setRemoveExistingPhoto] = useState(false);
  const [savingReview, setSavingReview] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);

  const refreshReviews = useCallback(async () => {
    try {
      const response = await fetch(`/api/products/${productId}/reviews`, {
        cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message ?? "Unable to load reviews.");
      }
      setReviewData(data as ReviewData);
      setReviewsError("");
    } catch (loadError) {
      setReviewsError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load reviews."
      );
    } finally {
      setReviewsLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    let cancelled = false;

    async function loadProduct() {
      try {
        const response = await fetch("/api/products");
        const data = await response.json();
        if (!response.ok || !data.success || !Array.isArray(data.products)) {
          throw new Error(data.message ?? "Unable to load this product.");
        }
        const found = data.products.find(
          (entry: Product) => String(entry.id) === productId
        );
        if (!found) {
          throw new Error("This product is no longer available.");
        }
        if (!cancelled) setProduct(found as Product);
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load this product."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    const frame = window.requestAnimationFrame(() => {
      void loadProduct();
      void refreshReviews();
    });
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
    };
  }, [productId, refreshReviews]);

  function resetForm() {
    setDisplayName("");
    setRating(0);
    setTitle("");
    setReviewText("");
    setSelectedOrderId("");
    setEditingReviewId(null);
    setPhoto(null);
    setRemoveExistingPhoto(false);
    setFormError("");
  }

  function startEditing(review: OwnedReview) {
    setDisplayName(review.displayName);
    setRating(review.rating);
    setTitle(review.title);
    setReviewText(review.reviewText);
    setSelectedOrderId(review.orderId);
    setEditingReviewId(review.id);
    setPhoto(null);
    setRemoveExistingPhoto(false);
    setFormError("");
    document.getElementById("review-form")?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }

  async function submitReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    if (!displayName.trim()) {
      setFormError("Enter your name before submitting your review.");
      return;
    }
    if (rating < 1 || rating > 5) {
      setFormError("Choose a rating from 1 to 5 stars.");
      return;
    }

    const formData = new FormData();
    formData.set("displayName", displayName);
    formData.set("rating", String(rating));
    formData.set("title", title);
    formData.set("reviewText", reviewText);
    if (photo) formData.set("photo", photo);
    if (editingReviewId) {
      if (removeExistingPhoto) formData.set("removePhoto", "true");
    } else if (selectedOrderId) {
      formData.set("orderId", selectedOrderId);
    }

    setSavingReview(true);
    try {
      const response = await fetch(
        editingReviewId
          ? `/api/reviews/${editingReviewId}`
          : `/api/products/${productId}/reviews`,
        {
          method: editingReviewId ? "PUT" : "POST",
          body: formData,
        }
      );
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message ?? "Unable to save your review.");
      }
      resetForm();
      await refreshReviews();
    } catch (saveError) {
      setFormError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to save your review."
      );
    } finally {
      setSavingReview(false);
    }
  }

  async function deleteReview(reviewId: string) {
    if (!window.confirm("Delete your review? This cannot be undone.")) return;
    setFormError("");
    try {
      const response = await fetch(`/api/reviews/${reviewId}`, {
        method: "DELETE",
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message ?? "Unable to delete your review.");
      }
      if (editingReviewId === reviewId) resetForm();
      await refreshReviews();
    } catch (deleteError) {
      setFormError(
        deleteError instanceof Error
          ? deleteError.message
          : "Unable to delete your review."
      );
    }
  }

  function handlePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] ?? null;
    setPhoto(selected);
    if (selected) setRemoveExistingPhoto(false);
  }

  function addToBag() {
    if (!product) return;
    try {
      window.sessionStorage.setItem("veloura_wishlist_cart_product", product.id);
      router.push("/");
    } catch (storageError) {
      console.error("Product could not be handed to the cart:", storageError);
      setFormError("Unable to add this product to your bag. Please try again.");
    }
  }

  if (loading) {
    return <main className="product-detail-page"><p role="status">Loading this handmade treasure…</p></main>;
  }

  if (error || !product) {
    return (
      <main className="product-detail-page">
        <p className="review-error" role="alert">{error || "Product not found."}</p>
        <Link className="review-back-link" href="/">← Back to the collection</Link>
      </main>
    );
  }

  const eligibleOrders = reviewData.eligibleOrders.filter((order) => !order.reviewed);
  const ownVisibleReviewIds = new Set(
    reviewData.reviews
      .filter((review) =>
        reviewData.myReviews.some((owned) => owned.id === review.id)
      )
      .map((review) => review.id)
  );
  const privateReviews = reviewData.myReviews.filter(
    (review) => !ownVisibleReviewIds.has(review.id)
  );

  return (
    <main className="product-detail-page">
      <Link className="review-back-link" href="/">
        <ArrowLeft size={17} aria-hidden="true" /> Back to the collection
      </Link>

      <section className="product-detail-panel">
        <div className="product-detail-image-wrap">
          {product.image && !imageFailed ? (
            <img
              src={product.image}
              alt={product.name}
              className="product-detail-image"
              onError={() => setImageFailed(true)}
            />
          ) : (
            <span className="product-detail-placeholder" aria-hidden="true">🎀</span>
          )}
        </div>
        <div className="product-detail-copy">
          <p className="product-detail-eyebrow">{product.category || "Handmade with love"}</p>
          <h1>{product.name}</h1>
          <div className="product-detail-rating">
            <Stars rating={reviewData.summary.averageRating} size={19} />
            <span>
              {reviewData.summary.totalReviews > 0
                ? `${reviewData.summary.averageRating.toFixed(1)} (${reviewData.summary.totalReviews} ${reviewData.summary.totalReviews === 1 ? "review" : "reviews"})`
                : "No reviews yet"}
            </span>
          </div>
          <p className="product-detail-description">
            {product.description || "Carefully handmade, especially for you."}
          </p>
          <p className="product-detail-price">₹{Number(product.price).toLocaleString("en-IN")}</p>
          <p className={`product-stock-status detail ${product.stockQuantity <= 0 ? "out" : product.stockQuantity <= product.lowStockThreshold ? "low" : "in"}`}>
            {product.stockQuantity <= 0
              ? "Out of Stock"
              : product.stockQuantity <= product.lowStockThreshold
                ? `Only ${product.stockQuantity} left in stock`
                : "In Stock"}
          </p>
          <button
            type="button"
            className="add-button product-detail-add"
            disabled={product.stockQuantity <= 0}
            onClick={addToBag}
          >
            {product.stockQuantity <= 0 ? "Sold out" : "Add to bag +"}
          </button>
          <Link className="product-detail-wishlist" href="/wishlist">
            <Heart size={16} aria-hidden="true" /> Explore your wishlist
          </Link>
        </div>
      </section>

      <section className="product-reviews-section" id="reviews">
        <div className="product-reviews-heading">
          <p className="product-detail-eyebrow">Little notes from our customers</p>
          <h2>Reviews & ratings</h2>
        </div>

        {reviewsLoading ? (
          <p role="status">Gathering all the lovely reviews…</p>
        ) : reviewsError ? (
          <p className="review-error" role="alert">{reviewsError}</p>
        ) : (
          <>
            <div className="review-summary">
              <div className="review-summary-score">
                <strong>{reviewData.summary.averageRating.toFixed(1)}</strong>
                <Stars rating={reviewData.summary.averageRating} size={18} />
                <span>
                  {reviewData.summary.totalReviews} customer{" "}
                  {reviewData.summary.totalReviews === 1 ? "review" : "reviews"}
                </span>
              </div>
              <div className="review-distribution">
                {reviewData.summary.distribution.map((row) => (
                  <div className="review-rating-row" key={row.rating}>
                    <span>{row.rating} <Star size={13} fill="currentColor" aria-hidden="true" /></span>
                    <div className="review-rating-track" aria-hidden="true">
                      <span style={{ width: `${row.percentage}%` }} />
                    </div>
                    <span>{row.count}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="review-list">
              {reviewData.reviews.map((review) => {
                const owned = reviewData.myReviews.find((entry) => entry.id === review.id);
                return (
                  <article className="customer-review-card" key={review.id}>
                    <div className="customer-review-topline">
                      <div>
                        <strong>{review.displayName}</strong>
                        {review.verifiedPurchase && (
                          <span className="verified-purchase">Verified Purchase</span>
                        )}
                      </div>
                      <time dateTime={review.createdAt}>{formatReviewDate(review.createdAt)}</time>
                    </div>
                    <Stars rating={review.rating} />
                    <h3>{review.title}</h3>
                    <p>{review.reviewText}</p>
                    {review.hasPhoto && (
                      <img
                        className="customer-review-photo"
                        src={`/api/reviews/${review.id}/photo`}
                        alt={`Customer photo for ${product.name}`}
                        loading="lazy"
                      />
                    )}
                    {owned && (
                      <div className="review-owner-actions">
                        <button type="button" onClick={() => startEditing(owned)}>Edit review</button>
                        <button type="button" onClick={() => void deleteReview(owned.id)}>Delete review</button>
                      </div>
                    )}
                  </article>
                );
              })}

              {privateReviews.map((review) => (
                <article className="customer-review-card private-review-card" key={review.id}>
                  <span className="review-moderation-note">Your review is hidden from the public.</span>
                  <Stars rating={review.rating} />
                  <h3>{review.title}</h3>
                  <p>{review.reviewText}</p>
                  {review.hasPhoto && (
                    <span className="review-moderation-note">A photo is attached to this review.</span>
                  )}
                  <div className="review-owner-actions">
                    <button type="button" onClick={() => startEditing(review)}>Edit review</button>
                    <button type="button" onClick={() => void deleteReview(review.id)}>Delete review</button>
                  </div>
                </article>
              ))}

              {reviewData.reviews.length === 0 && privateReviews.length === 0 && (
                <div className="review-empty-state">
                  <span aria-hidden="true">♡</span>
                  <h3>Be the first to share a little love</h3>
                  <p>Your honest review helps others find their favorite handmade pieces.</p>
                </div>
              )}
            </div>

            <form className="review-form" id="review-form" onSubmit={submitReview}>
                <div>
                  <p className="product-detail-eyebrow">
                    {editingReviewId ? "Update your review" : "No purchase or sign-in required"}
                  </p>
                  <h3>{editingReviewId ? "Edit your review" : "Share your experience"}</h3>
                </div>
                <label>
                  Your name
                  <input
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    autoComplete="name"
                    minLength={2}
                    maxLength={80}
                    required
                  />
                </label>
                {!editingReviewId && eligibleOrders.length > 0 && (
                  <label>
                    Delivered order (optional)
                    <select
                      value={selectedOrderId}
                      onChange={(event) => setSelectedOrderId(event.target.value)}
                    >
                      <option value="">No verified purchase</option>
                      {eligibleOrders.map((order) => (
                        <option value={order.orderId} key={order.orderId}>
                          Order #{order.orderId}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <fieldset className="review-star-picker">
                  <legend>Your rating</legend>
                  <div role="group" aria-label="Choose a rating from 1 to 5 stars">
                    {Array.from({ length: 5 }, (_, index) => {
                      const value = index + 1;
                      return (
                        <button
                          type="button"
                          key={value}
                          aria-label={`${value} star${value === 1 ? "" : "s"}`}
                          aria-pressed={rating === value}
                          className={rating === value ? "is-selected" : undefined}
                          onClick={() => setRating(value)}
                        >
                          <Star size={25} fill={value <= rating ? "currentColor" : "none"} />
                        </button>
                      );
                    })}
                  </div>
                  <span className="review-rating-choice" aria-live="polite">
                    {rating > 0 ? `${rating} out of 5` : "Select 1 to 5 stars"}
                  </span>
                </fieldset>
                <label>
                  Review title
                  <input
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    minLength={3}
                    maxLength={120}
                    required
                  />
                </label>
                <label>
                  Your review
                  <textarea
                    value={reviewText}
                    onChange={(event) => setReviewText(event.target.value)}
                    minLength={10}
                    maxLength={3000}
                    rows={5}
                    required
                  />
                </label>
                <label>
                  Add a product photo (optional, up to 2 MB)
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handlePhotoChange}
                  />
                </label>
                {editingReviewId &&
                  reviewData.myReviews.find((review) => review.id === editingReviewId)?.hasPhoto && (
                    <label className="review-remove-photo">
                      <input
                        type="checkbox"
                        checked={removeExistingPhoto}
                        onChange={(event) => setRemoveExistingPhoto(event.target.checked)}
                      />
                      Remove existing photo
                    </label>
                  )}
                {formError && <p className="review-error" role="alert">{formError}</p>}
                <div className="review-form-actions">
                  <button className="add-button" type="submit" disabled={savingReview}>
                    {savingReview
                      ? "Saving…"
                      : editingReviewId
                        ? "Save changes"
                        : "Submit review"}
                  </button>
                  {editingReviewId && (
                    <button className="review-cancel-button" type="button" onClick={resetForm}>
                      Cancel
                    </button>
                  )}
                </div>
            </form>
          </>
        )}
      </section>
    </main>
  );
}
