import "server-only";

import { pool } from "@/lib/db";
import { createOpaqueAuthToken, hashAuthToken } from "@/lib/auth/token-crypto";

export { hashAuthToken };

export type AuthTokenPurpose = "verify_email" | "reset_password";

export async function issueAuthToken(customerId: string, purpose: AuthTokenPurpose) {
  const { token, tokenHash } = createOpaqueAuthToken();
  const expiresInHours = purpose === "verify_email" ? 24 : 1;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))", [customerId, purpose]);
    await client.query(
      `UPDATE customer_auth_tokens SET used_at = NOW()
       WHERE customer_id = $1 AND purpose = $2 AND used_at IS NULL`,
      [customerId, purpose]
    );
    await client.query(
      `INSERT INTO customer_auth_tokens (customer_id, purpose, token_hash, expires_at)
       VALUES ($1, $2, $3, NOW() + ($4 || ' hours')::interval)`,
      [customerId, purpose, tokenHash, String(expiresInHours)]
    );
    await client.query("COMMIT");
    return token;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function consumeAuthToken(token: string, purpose: AuthTokenPurpose) {
  if (!/^[A-Za-z0-9_-]{40,60}$/.test(token)) return null;
  const result = await pool.query<{ customer_id: string }>(
    `UPDATE customer_auth_tokens SET used_at = NOW()
     WHERE token_hash = $1 AND purpose = $2 AND used_at IS NULL AND expires_at > NOW()
     RETURNING customer_id`,
    [hashAuthToken(token), purpose]
  );
  return result.rows[0]?.customer_id ?? null;
}

export async function enforceAuthRateLimit(request: Request, action: string) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim();
  const address = forwarded || request.headers.get("x-real-ip") || "unknown";
  const key = hashAuthToken(`${action}:${address}`);
  const limits: Record<string, { count: number; seconds: number }> = {
    register: { count: 5, seconds: 3600 },
    login: { count: 10, seconds: 900 },
    verify: { count: 10, seconds: 3600 },
    forgot: { count: 5, seconds: 3600 },
    reset: { count: 10, seconds: 3600 },
  };
  const limit = limits[action];
  const result = await pool.query<{ allowed: boolean }>(
    `INSERT INTO customer_auth_rate_limits (key_hash, window_started_at, request_count)
     VALUES ($1, NOW(), 1)
     ON CONFLICT (key_hash) DO UPDATE SET
       window_started_at = CASE WHEN customer_auth_rate_limits.window_started_at <= NOW() - ($2 * INTERVAL '1 second') THEN NOW() ELSE customer_auth_rate_limits.window_started_at END,
       request_count = CASE WHEN customer_auth_rate_limits.window_started_at <= NOW() - ($2 * INTERVAL '1 second') THEN 1 ELSE customer_auth_rate_limits.request_count + 1 END
     RETURNING request_count <= $3 AS allowed`,
    [key, limit.seconds, limit.count]
  );
  return result.rows[0]?.allowed === true;
}

export async function sendAuthEmail(to: string, subject: string, html: string) {
  return sendTransactionalEmail(to, subject, html);
}

export async function sendTransactionalEmail(to: string, subject: string, html: string, idempotencyKey?: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) throw new Error("Email delivery is not configured.");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
    },
    body: JSON.stringify({ from, to: [to], subject, html }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Email delivery failed (${response.status}).`);
}

export function escapeEmailHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
}

export function welcomeEmailHtml(name: string, verificationUrl: string) {
  const safeName = escapeEmailHtml(name);
  const safeUrl = escapeEmailHtml(verificationUrl);
  return `<!doctype html><html><body style="margin:0;background:#fff0ed;font-family:Arial,sans-serif;color:#3b292d"><div style="max-width:560px;margin:32px auto;padding:36px 28px;background:#fff9f6;border:1px solid #f0deda"><p style="font-family:Georgia,serif;font-size:25px;text-align:center">Veloura Studio</p><h1 style="font-family:Georgia,serif;font-size:26px;font-weight:500;text-align:center">Welcome, ${safeName}!</h1><p style="line-height:1.7;text-align:center">We’re so glad you’re here. Verify your email address to activate your account and keep track of your orders.</p><p style="text-align:center;margin:30px 0"><a href="${safeUrl}" style="display:inline-block;padding:14px 24px;background:#3b292d;color:white;text-decoration:none">Verify email address</a></p><p style="font-size:12px;color:#8d7779;line-height:1.6">This link expires in 24 hours. If you didn’t create this account, you can ignore this email.</p></div></body></html>`;
}

export function loginNoticeHtml(name: string) {
  return `<!doctype html><html><body style="margin:0;background:#fff0ed;font-family:Arial,sans-serif;color:#3b292d"><div style="max-width:560px;margin:32px auto;padding:36px 28px;background:#fff9f6;border:1px solid #f0deda"><p style="font-family:Georgia,serif;font-size:25px;text-align:center">Veloura Studio</p><h1 style="font-family:Georgia,serif;font-size:26px;font-weight:500;text-align:center">New sign-in</h1><p style="line-height:1.7">Hi ${escapeEmailHtml(name)}, your Veloura Studio account was just signed in to successfully. If this wasn’t you, reset your password as soon as possible.</p></div></body></html>`;
}

export function orderEmailHtml(title: string, order: { id: string; customerName: string; phone: string; email: string; address: string; totalPaise: number; items: Array<{ name: string; quantity: number; unitPricePaise: number }>; notes?: string; paymentPending?: boolean }) {
  const rows = order.items.map((item) => `<tr><td style="padding:8px;border-bottom:1px solid #eee">${escapeEmailHtml(item.name)} × ${item.quantity}</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:right">₹${((item.unitPricePaise * item.quantity) / 100).toFixed(2)}</td></tr>`).join("");
  return `<!doctype html><html><body style="margin:0;background:#fff0ed;font-family:Arial,sans-serif;color:#3b292d"><div style="max-width:600px;margin:32px auto;padding:32px 24px;background:#fff9f6;border:1px solid #f0deda"><p style="font-family:Georgia,serif;font-size:25px;text-align:center">Veloura Studio</p><h1 style="font-family:Georgia,serif;font-size:25px;font-weight:500">${escapeEmailHtml(title)} · #${escapeEmailHtml(order.id)}</h1><p>Thank you, ${escapeEmailHtml(order.customerName)}. ${escapeEmailHtml(order.email)}</p>${order.paymentPending ? "<p>Your order is saved and your online payment is still pending. We’ll begin processing after payment is confirmed.</p>" : ""}<table style="width:100%;border-collapse:collapse">${rows}</table><p style="text-align:right;font-size:18px"><strong>Total: ₹${(order.totalPaise / 100).toFixed(2)}</strong></p><p>Phone: ${escapeEmailHtml(order.phone)}<br>Delivery address: ${escapeEmailHtml(order.address)}</p>${order.notes ? `<p>Notes: ${escapeEmailHtml(order.notes)}</p>` : ""}</div></body></html>`;
}

export async function sendOrderEmails(order: Parameters<typeof orderEmailHtml>[1]) {
  const sends = [sendStoreOrderEmail(order), sendCustomerOrderEmail(order)];
  const results = await Promise.allSettled(sends);
  for (let i = 0; i < results.length; i += 1) {
    if (results[i].status === "rejected") console.error(`Order email ${i === 0 ? "store" : "customer"} delivery failed for order #${order.id}.`);
  }
}

export async function sendStoreOrderEmail(order: Parameters<typeof orderEmailHtml>[1]) {
  const storeTo = process.env.STORE_ORDER_EMAIL;
  if (!storeTo || !isValidEmailAddress(storeTo)) throw new Error("STORE_ORDER_EMAIL is not configured.");
  await sendTransactionalEmail(storeTo, `New Veloura order #${order.id}`, orderEmailHtml("New order", order), `order-${order.id}-store`);
}

export async function sendCustomerOrderEmail(order: Parameters<typeof orderEmailHtml>[1]) {
  await sendTransactionalEmail(order.email, `Order confirmation #${order.id}`, orderEmailHtml("Order confirmed", order), `order-${order.id}-customer`);
}

export async function getOrderEmailDetails(orderId: string, email: string) {
  const result = await pool.query<{
    id: string; customer_name: string; phone: string; delivery_address: string;
    subtotal_paise: string | number; customization_notes: string | null;
  }>("SELECT id, customer_name, phone, delivery_address, subtotal_paise, customization_notes FROM orders WHERE id = $1", [orderId]);
  const row = result.rows[0];
  if (!row) return null;
  const items = await pool.query<{ product_name: string; quantity: number; unit_price_paise: number }>(
    "SELECT product_name, quantity, unit_price_paise FROM order_items WHERE order_id = $1 ORDER BY id", [orderId]
  );
  return {
    id: String(row.id), customerName: row.customer_name, phone: row.phone, email,
    address: row.delivery_address, totalPaise: Number(row.subtotal_paise),
    items: items.rows.map((item) => ({ name: item.product_name, quantity: Number(item.quantity), unitPricePaise: Number(item.unit_price_paise) })),
    ...(row.customization_notes ? { notes: row.customization_notes } : {}),
  };
}

export function isValidEmailAddress(email: string) {
  return email.length <= 255 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function authEmailHtml(title: string, actionLabel: string, url: string, expires: string) {
  const safeUrl = url.replaceAll("&", "&amp;").replaceAll('"', "&quot;");
  return `<!doctype html><html><body style="margin:0;background:#fff0ed;font-family:Arial,sans-serif;color:#3b292d"><div style="max-width:560px;margin:32px auto;padding:36px 28px;background:#fff9f6;border:1px solid #f0deda"><p style="font-family:Georgia,serif;font-size:25px;text-align:center">Veloura Studio</p><h1 style="font-family:Georgia,serif;font-size:26px;font-weight:500;text-align:center">${title}</h1><p style="line-height:1.7;text-align:center">Use the button below to continue. This link expires in ${expires}.</p><p style="text-align:center;margin:30px 0"><a href="${safeUrl}" style="display:inline-block;padding:14px 24px;background:#3b292d;color:white;text-decoration:none">${actionLabel}</a></p><p style="font-size:12px;color:#8d7779;line-height:1.6">If you didn’t request this, you can ignore this email.</p></div></body></html>`;
}

export function getAppBaseUrl(request: Request) {
  const configured = process.env.APP_URL;
  if (!configured && process.env.NODE_ENV === "production") {
    throw new Error("APP_URL must be configured in production.");
  }
  const url = new URL(configured || new URL(request.url).origin);
  if (
    !["https:", "http:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    (process.env.NODE_ENV === "production" && url.protocol !== "https:")
  ) {
    throw new Error("APP_URL must be a secure origin without a path in production.");
  }
  return url.origin;
}
