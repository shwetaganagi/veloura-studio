"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || "Login failed. Please try again.");
        return;
      }

      router.replace("/admin/orders");
      router.refresh();
    } catch {
      setError("Unable to connect. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#faf6f1] px-5 py-12 text-[#392c28]">
      {/* Decorative background */}
      <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-[#ead8cb]/50 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-24 h-[28rem] w-[28rem] rounded-full bg-[#e9d4c5]/40 blur-3xl" />

      <section className="relative w-full max-w-md">
        {/* Brand */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full border border-[#ddc5b5] bg-white shadow-sm">
            <span className="font-serif text-2xl italic text-[#896653]">
              V
            </span>
          </div>

          <p className="text-xs font-medium uppercase tracking-[0.4em] text-[#997762]">
            Veloura Studio
          </p>

          <p className="mt-2 text-sm tracking-wide text-[#9c8b81]">
            Thoughtfully handmade, beautifully yours.
          </p>
        </div>

        {/* Login card */}
        <div className="rounded-[2rem] border border-[#eaded5] bg-white/95 p-8 shadow-[0_24px_80px_rgba(87,60,45,0.10)] sm:p-10">
          <div className="mb-8">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.25em] text-[#a07d69]">
              Admin Portal
            </p>

            <h1 className="font-serif text-4xl tracking-tight text-[#392c28]">
              Welcome back.
            </h1>

            <p className="mt-3 text-sm leading-6 text-[#8c7c73]">
              Sign in to manage your orders and keep your studio running
              beautifully.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label
                htmlFor="password"
                className="mb-2 block text-sm font-medium text-[#51413a]"
              >
                Admin password
              </label>

              <input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter your password"
                autoComplete="current-password"
                required
                maxLength={1024}
                className="w-full rounded-xl border border-[#e5d8cf] bg-[#fdfbf9] px-4 py-3.5 text-sm text-[#392c28] outline-none transition placeholder:text-[#b5a69d] hover:border-[#cfb6a5] focus:border-[#96715d] focus:ring-4 focus:ring-[#96715d]/10"
              />
            </div>

            {error && (
              <div
                role="alert"
                className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700"
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !password}
              className="flex w-full items-center justify-center rounded-xl bg-[#80604f] px-5 py-4 text-sm font-medium tracking-wide text-white shadow-sm transition duration-200 hover:bg-[#694c3e] hover:shadow-md focus:outline-none focus:ring-4 focus:ring-[#80604f]/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Signing you in..." : "Sign In"}
              {!loading && <span className="ml-2">→</span>}
            </button>
          </form>

          <div className="mt-8 flex items-center gap-3">
            <div className="h-px flex-1 bg-[#eee5de]" />
            <span className="text-[10px] uppercase tracking-[0.2em] text-[#b0a097]">
              Private access
            </span>
            <div className="h-px flex-1 bg-[#eee5de]" />
          </div>
        </div>

        <p className="mt-7 text-center text-xs tracking-wide text-[#a39389]">
          © 2026 Veloura Studio · Made with care
        </p>
      </section>
    </main>
  );
}