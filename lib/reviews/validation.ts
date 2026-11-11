import { createHmac } from "node:crypto";
import { isIP } from "node:net";

export const MAX_REVIEW_PHOTO_BYTES = 2 * 1024 * 1024;
export const MAX_REVIEW_REQUEST_BYTES = MAX_REVIEW_PHOTO_BYTES + 64 * 1024;

export type ReviewPhoto = {
  data: Buffer;
  mimeType: "image/jpeg" | "image/png" | "image/webp";
};

export function parseRating(value: string) {
  const rating = Number(value);
  return Number.isInteger(rating) && rating >= 1 && rating <= 5
    ? rating
    : null;
}

export function validateReviewText(title: string, reviewText: string) {
  if (title.length < 3 || title.length > 120) {
    return "Review title must contain between 3 and 120 characters.";
  }
  if (reviewText.length < 10 || reviewText.length > 3000) {
    return "Review text must contain between 10 and 3000 characters.";
  }
  return null;
}

export function validateDisplayName(displayName: string) {
  if (displayName.length < 2 || displayName.length > 80) {
    return "Your name must contain between 2 and 80 characters.";
  }
  return null;
}

export function getReviewRateLimitKey(headers: Headers) {
  const forwardedFor = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const remoteAddress =
    headers.get("x-real-ip")?.trim() ||
    headers.get("cf-connecting-ip")?.trim() ||
    forwardedFor;
  if (!remoteAddress || !isIP(remoteAddress)) {
    return null;
  }

  const secret =
    process.env.CUSTOMER_SESSION_SECRET || process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("A configured session secret is required for review rate limiting.");
  }

  return createHmac("sha256", secret)
    .update(remoteAddress.toLowerCase())
    .digest("hex");
}

export async function parseReviewPhoto(
  value: FormDataEntryValue | null
): Promise<ReviewPhoto | null> {
  if (value === null || typeof value === "string" || value.size === 0) {
    return null;
  }
  if (value.size > MAX_REVIEW_PHOTO_BYTES) {
    throw new Error("Review photos must be 2 MB or smaller.");
  }

  const data = Buffer.from(await value.arrayBuffer());
  const isJpeg =
    value.type === "image/jpeg" &&
    data.length >= 3 &&
    data[0] === 0xff &&
    data[1] === 0xd8 &&
    data[2] === 0xff;
  const isPng =
    value.type === "image/png" &&
    data.length >= 8 &&
    data.subarray(0, 8).equals(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    );
  const isWebp =
    value.type === "image/webp" &&
    data.length >= 12 &&
    data.toString("ascii", 0, 4) === "RIFF" &&
    data.toString("ascii", 8, 12) === "WEBP";

  if (!isJpeg && !isPng && !isWebp) {
    throw new Error("Upload a valid JPEG, PNG, or WebP image.");
  }

  return {
    data,
    mimeType: value.type as ReviewPhoto["mimeType"],
  };
}

export function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
