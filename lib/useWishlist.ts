"use client";

import { useCallback, useEffect, useState } from "react";

type CustomerAuthStatus = "loading" | "logged-in" | "logged-out" | "error";

const GUEST_WISHLIST_KEY = "veloura_guest_wishlist";

function parseWishlistIds(value: unknown): number[] {
  if (!Array.isArray(value)) return [];

  return [...new Set(
    value.filter(
      (id): id is number =>
        typeof id === "number" && Number.isSafeInteger(id) && id > 0
    )
  )];
}

function readGuestWishlist(): number[] {
  const storedWishlist = window.localStorage.getItem(GUEST_WISHLIST_KEY);
  if (!storedWishlist) return [];

  try {
    return parseWishlistIds(JSON.parse(storedWishlist));
  } catch {
    throw new Error("Your saved favourites could not be read from this browser.");
  }
}

function saveGuestWishlist(productIds: number[]) {
  window.localStorage.setItem(GUEST_WISHLIST_KEY, JSON.stringify(productIds));
}

export function useWishlist(authStatus: CustomerAuthStatus) {
  const [productIds, setProductIds] = useState<number[]>([]);
  const [isReady, setIsReady] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingProductIds, setPendingProductIds] = useState<number[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      try {
        setProductIds(readGuestWishlist());
      } catch (readError) {
        console.error("Guest wishlist could not be loaded:", readError);
        setError(
          readError instanceof Error
            ? readError.message
            : "Your saved favourites could not be loaded."
        );
      } finally {
        setIsReady(true);
      }
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!isReady || authStatus === "loading" || authStatus === "error") return;

    if (authStatus === "logged-out") {
      const frame = window.requestAnimationFrame(() => {
        try {
          setProductIds(readGuestWishlist());
          setError("");
        } catch (readError) {
          console.error("Guest wishlist could not be loaded:", readError);
          setError(
            readError instanceof Error
              ? readError.message
              : "Your saved favourites could not be loaded."
          );
        }
      });

      return () => window.cancelAnimationFrame(frame);
    }

    let cancelled = false;

    async function syncCustomerWishlist() {
      setIsSyncing(true);
      setError("");

      try {
        const response = await fetch("/api/wishlist", { cache: "no-store" });
        const data: { success?: boolean; productIds?: unknown; message?: string } =
          await response.json();

        if (!response.ok || !data.success || !Array.isArray(data.productIds)) {
          throw new Error(data.message ?? "Unable to load your wishlist.");
        }

        const guestIds = readGuestWishlist();
        const savedIds = parseWishlistIds(data.productIds);
        const mergedIds = [...new Set([...savedIds, ...guestIds])];

        if (guestIds.length > 0) {
          const saveResponse = await fetch("/api/wishlist", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ productIds: mergedIds }),
          });
          const saveData: { success?: boolean; message?: string } =
            await saveResponse.json();

          if (!saveResponse.ok || !saveData.success) {
            throw new Error(saveData.message ?? "Unable to save your guest favourites.");
          }
        }

        if (cancelled) return;

        setProductIds(mergedIds);
        window.localStorage.removeItem(GUEST_WISHLIST_KEY);
      } catch (syncError) {
        if (!cancelled) {
          console.error("Customer wishlist could not be synchronized:", syncError);
          setError(
            syncError instanceof Error
              ? syncError.message
              : "Unable to synchronize your wishlist."
          );
        }
      } finally {
        if (!cancelled) setIsSyncing(false);
      }
    }

    void syncCustomerWishlist();

    return () => {
      cancelled = true;
    };
  }, [authStatus, isReady]);

  const setFavourite = useCallback(
    async (productId: number, shouldBeFavourite: boolean) => {
      if (!Number.isSafeInteger(productId) || productId <= 0) {
        setError("This product cannot be added to your wishlist.");
        return;
      }
      if (authStatus === "error") {
        setError("Unable to verify your account. Please refresh and try again.");
        return;
      }

      setPendingProductIds((current) =>
        current.includes(productId) ? current : [...current, productId]
      );
      setError("");

      try {
        if (authStatus === "logged-in") {
          const response = await fetch("/api/wishlist", {
            method: shouldBeFavourite ? "POST" : "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ productId }),
          });
          const data: { success?: boolean; message?: string } =
            await response.json();

          if (!response.ok || !data.success) {
            throw new Error(data.message ?? "Unable to update your wishlist.");
          }
        }

        if (authStatus === "logged-in") {
          setProductIds((current) =>
            shouldBeFavourite
              ? [...new Set([...current, productId])]
              : current.filter((id) => id !== productId)
          );
        } else {
          const next = shouldBeFavourite
            ? [...new Set([...productIds, productId])]
            : productIds.filter((id) => id !== productId);

          try {
            saveGuestWishlist(next);
          } catch (storageError) {
            console.error("Guest wishlist could not be saved:", storageError);
            throw new Error("Your favourites could not be saved in this browser.");
          }

          setProductIds(next);
        }
      } catch (updateError) {
        console.error("Wishlist update failed:", updateError);
        setError(
          updateError instanceof Error
            ? updateError.message
            : "Unable to update your wishlist."
        );
      } finally {
        setPendingProductIds((current) =>
          current.filter((id) => id !== productId)
        );
      }
    },
    [authStatus, productIds]
  );

  const addToWishlist = useCallback(
    (productId: number) => setFavourite(productId, true),
    [setFavourite]
  );
  const removeFromWishlist = useCallback(
    (productId: number) => setFavourite(productId, false),
    [setFavourite]
  );

  return {
    productIds,
    isReady,
    isSyncing,
    pendingProductIds,
    error,
    addToWishlist,
    removeFromWishlist,
  };
}
