"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CUSTOMER_PASSWORD_ERROR, isValidCustomerPassword } from "@/lib/auth/password-policy";

function ResetPasswordContent() {
  const params = useSearchParams(); const token = params.get("token") || "";
  const [password, setPassword] = useState(""); const [confirm, setConfirm] = useState(""); const [message, setMessage] = useState(""); const [done, setDone] = useState(false); const [loading, setLoading] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage(""); if (password !== confirm) { setMessage("Passwords do not match."); return; } if (!isValidCustomerPassword(password)) { setMessage(CUSTOMER_PASSWORD_ERROR); return; }
    setLoading(true);
    try { const response = await fetch("/api/auth/reset-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, password }) }); const data = await response.json(); setMessage(data.message || "Please try again."); setDone(response.ok); }
    catch { setMessage("Unable to connect. Please try again."); } finally { setLoading(false); }
  }
  return <main className="auth-page"><section className="auth-card"><Link href="/" className="auth-brand">Veloura Studio</Link><p className="eyebrow">ACCOUNT SECURITY</p><h1>Choose a new password</h1><p className="auth-description">Your reset link is valid for one hour and can only be used once. Use at least 12 characters.</p>{done ? <div className="auth-result" role="status"><p>{message}</p><Link href="/login">Sign in with your new password</Link></div> : <form className="auth-form" onSubmit={submit}><label htmlFor="password">New password</label><input id="password" type="password" autoComplete="new-password" minLength={12} maxLength={72} required value={password} onChange={e => setPassword(e.target.value)} /><label htmlFor="confirm">Confirm new password</label><input id="confirm" type="password" autoComplete="new-password" minLength={12} maxLength={72} required value={confirm} onChange={e => setConfirm(e.target.value)} />{message && <p className="auth-message" role="alert">{message}</p>}<button className="auth-submit" disabled={loading || !token}>{loading ? "Updating…" : "Update password"}</button>{!token && <p className="auth-message" role="alert">This reset link is missing or invalid. Request a new one below.</p>}</form>}<p className="auth-switch"><Link href="/forgot-password">Request another reset link</Link></p><Link href="/" className="auth-back">← Back to shopping</Link></section></main>;
}

export default function ResetPasswordPage() { return <main className="auth-page"><Suspense fallback={<section className="auth-card">Loading…</section>}><ResetPasswordContent /></Suspense></main>; }
