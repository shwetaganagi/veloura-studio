"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type AdminReview = {
  id: string;
  productId: number;
  productName: string;
  displayName: string;
  rating: number;
  title: string;
  reviewText: string;
  moderationStatus: "visible" | "hidden";
  createdAt: string;
  hasPhoto: boolean;
};

export default function AdminReviewsDashboard() {
  const [reviews, setReviews] = useState<AdminReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const loadReviews = useCallback(async () => {
    setError("");
    try {
      const response = await fetch("/api/admin/reviews", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message ?? "Unable to load reviews.");
      }
      setReviews(data.reviews as AdminReview[]);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Unable to load reviews."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      void loadReviews();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [loadReviews]);

  async function moderate(review: AdminReview) {
    const action = review.moderationStatus === "visible" ? "hide" : "restore";
    const reason = window.prompt(
      action === "hide"
        ? "Optional note for hiding this review:"
        : "Optional note for restoring this review:"
    );
    if (reason === null) return;

    setUpdatingId(review.id);
    setError("");
    try {
      const response = await fetch("/api/admin/reviews", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewId: review.id, action, reason }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message ?? "Unable to update review moderation.");
      }
      setReviews((current) =>
        current.map((entry) =>
          entry.id === review.id
            ? { ...entry, moderationStatus: data.review.moderationStatus }
            : entry
        )
      );
    } catch (moderationError) {
      setError(
        moderationError instanceof Error
          ? moderationError.message
          : "Unable to update review moderation."
      );
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <main className="admin-reviews-page">
      <header className="admin-reviews-header">
        <div>
          <p>Veloura Studio · Admin</p>
          <h1>Customer reviews</h1>
          <span>Hide or restore customer feedback without deleting it.</span>
        </div>
        <Link href="/admin/orders">Manage orders</Link>
      </header>

      {error && <p className="review-error" role="alert">{error}</p>}
      {loading ? (
        <p role="status">Loading customer reviews…</p>
      ) : reviews.length === 0 ? (
        <div className="review-empty-state">
          <span aria-hidden="true">♡</span>
          <h2>No customer reviews yet</h2>
        </div>
      ) : (
        <div className="admin-review-list">
          {reviews.map((review) => (
            <article className="admin-review-card" key={review.id}>
              <div className="admin-review-meta">
                <div>
                  <Link href={`/product/${review.productId}`}>
                    {review.productName}
                  </Link>
                  <span>{review.displayName} · {review.rating}/5 stars</span>
                </div>
                <span className={`moderation-status ${review.moderationStatus}`}>
                  {review.moderationStatus}
                </span>
              </div>
              <h2>{review.title}</h2>
              <p>{review.reviewText}</p>
              {review.hasPhoto && (
                <img
                  src={`/api/reviews/${review.id}/photo`}
                  alt={`Customer photo for ${review.productName}`}
                  className="customer-review-photo"
                />
              )}
              <div className="admin-review-actions">
                <time dateTime={review.createdAt}>
                  {new Date(review.createdAt).toLocaleDateString("en-IN")}
                </time>
                <button
                  type="button"
                  disabled={updatingId === review.id}
                  onClick={() => void moderate(review)}
                >
                  {updatingId === review.id
                    ? "Saving…"
                    : review.moderationStatus === "visible"
                      ? "Hide review"
                      : "Restore review"}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
