"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

function VerifyEmailContent() {
  const token = useSearchParams().get("token") || ""; const [message, setMessage] = useState(""); const [success, setSuccess] = useState(false); const [loading, setLoading] = useState(false);
  async function verify() { setLoading(true); try { const response = await fetch("/api/auth/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) }); const data = await response.json(); setMessage(data.message); setSuccess(response.ok); } catch { setMessage("Unable to verify your email right now. Please try again."); } finally { setLoading(false); } }
  return <section className="auth-card"><Link href="/" className="auth-brand">Veloura Studio</Link><p className="eyebrow">EMAIL VERIFICATION</p><h1>{success ? "You’re all set" : "Verify your email"}</h1>{message ? <p className={success ? "auth-success" : "auth-message"} role={success ? "status" : "alert"}>{message}</p> : <p className="auth-description">Confirm your email address to activate your account.</p>}{success ? <Link href="/login" className="auth-submit auth-action-link">Continue to sign in</Link> : <><button className="auth-submit" disabled={!token || loading} onClick={verify}>{loading ? "Verifying…" : "Verify email address"}</button><p className="auth-switch"><Link href="/register">Request another verification link</Link></p></>}<Link href="/" className="auth-back">← Back to shopping</Link></section>;
}
export default function VerifyEmailPage() { return <main className="auth-page"><Suspense fallback={<section className="auth-card">Loading…</section>}><VerifyEmailContent /></Suspense></main>; }
