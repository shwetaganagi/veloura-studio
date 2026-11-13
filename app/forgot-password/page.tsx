"use client";

import { useState } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setMessage(""); setError(false);
    try {
      const response = await fetch("/api/auth/forgot-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
      const data = await response.json(); setMessage(data.message || "Please try again."); setError(!response.ok);
    } catch { setMessage("Unable to connect. Please try again."); setError(true); } finally { setLoading(false); }
  }
  return <main className="auth-page"><section className="auth-card"><Link href="/" className="auth-brand">Veloura Studio</Link><p className="eyebrow">ACCOUNT HELP</p><h1>Forgot your password?</h1><p className="auth-description">Enter the email address on your account and we’ll send a link to reset your password.</p><form className="auth-form" onSubmit={submit}><label htmlFor="email">Email address</label><input id="email" type="email" autoComplete="email" required maxLength={255} value={email} onChange={e => setEmail(e.target.value)} />{message && <p className={error ? "auth-message" : "auth-success"} role={error ? "alert" : "status"}>{message}</p>}<button className="auth-submit" disabled={loading}>{loading ? "Sending…" : "Send reset link"}</button></form><p className="auth-switch"><Link href="/login">Return to sign in</Link></p><Link href="/" className="auth-back">← Back to shopping</Link></section></main>;
}
