
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();

  const [notice, setNotice] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    if (params.get("registered") === "1") {
      setNotice("Account created successfully! Please sign in.");
    }
  }, []);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.message || "Login failed. Please try again.");
        return;
      }

      router.push("/");
      router.refresh();
    } catch {
      setMessage("Unable to connect. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <Link href="/" className="auth-brand">
          Veloura Studio
        </Link>

        <p className="eyebrow">WELCOME BACK</p>
        <h1>Sign in to your account</h1>
        <p className="auth-description">
          Sign in to explore your orders and continue shopping.
        </p>

        {notice && (
          <p
            style={{
              color: "#287a45",
              background: "#edf8ef",
              padding: "12px",
              fontSize: "12px",
              textAlign: "center",
            }}
            role="status"
          >
            {notice}
          </p>
        )}

        <form onSubmit={handleLogin} className="auth-form">
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
            placeholder="Enter your password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
          />

          <div className="auth-forgot">
            <Link href="/forgot-password">Forgot password?</Link>
          </div>

          {message && <p className="auth-message">{message}</p>}

          <button type="submit" className="auth-submit" disabled={loading}>
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <p className="auth-switch">
          Don&apos;t have an account?{" "}
          <Link href="/register">Create an account</Link>
        </p>

        <Link href="/" className="auth-back">
          ← Back to shopping
        </Link>
      </section>
    </main>
  );
}
