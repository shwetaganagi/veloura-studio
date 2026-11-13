
"use client";

import { useState } from "react";
import Link from "next/link";
import { CUSTOMER_PASSWORD_ERROR, isValidCustomerPassword } from "@/lib/auth/password-policy";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleRegister(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    setMessage("");

    if (password !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }

    if (!isValidCustomerPassword(password)) {
      setMessage(CUSTOMER_PASSWORD_ERROR);
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
        fullName: name.trim(),
        email: email.trim(),
        password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.message || "Registration failed. Please try again.");
        return;
      }

      setSubmitted(true);
    } catch {
      setMessage("Unable to connect. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card register-card">
        <Link href="/" className="auth-brand">
          Veloura Studio
        </Link>

        <p className="eyebrow">JOIN OUR LITTLE WORLD</p>

        <h1>Create your account</h1>

        <p className="auth-description">
          Create an account to enjoy a more personal shopping experience
          and keep track of your orders.
        </p>

        {submitted ? (
          <div className="auth-result" role="status">
            <strong>Check your inbox</strong>
            <p>If this email can be registered, a verification link will be sent. Open it within 24 hours to activate your account. If it doesn’t arrive, please try again later.</p>
            <Link href="/login">Return to sign in</Link>
          </div>
        ) : <form onSubmit={handleRegister} className="auth-form">
          <label htmlFor="name">Full name</label>

          <input
            id="name"
            type="text"
            placeholder="Enter your full name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoComplete="name"
            minLength={2}
            maxLength={150}
            required
          />

          <label htmlFor="email">Email address</label>

          <input
            id="email"
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            required
          />

          <label htmlFor="password">Password</label>

          <input
            id="password"
            type="password"
            placeholder="Use at least 12 characters"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
            minLength={12}
            maxLength={72}
            required
          />

          <label htmlFor="confirmPassword">Confirm password</label>

          <input
            id="confirmPassword"
            type="password"
            placeholder="Enter your password again"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            autoComplete="new-password"
            minLength={12}
            maxLength={72}
            required
          />

          {message && (
            <p className="auth-message" role="alert">
              {message}
            </p>
          )}

          <button
            type="submit"
            className="auth-submit"
            disabled={loading}
          >
            {loading ? "Creating account..." : "Create Account"}
          </button>
        </form>}

        <p className="auth-switch">
          Already have an account?{" "}
          <Link href="/login">Sign in</Link>
        </p>

        <Link href="/" className="auth-back">
          ← Back to shopping
        </Link>
      </section>
    </main>
  );
}
