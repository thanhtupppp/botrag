"use client";

import { useState } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setMessage(data.error || "Login failed");
        return;
      }

      setMessage("Check your email for the sign-in link.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen px-6 py-10 text-white">
      <div className="mx-auto flex max-w-md flex-col gap-6 rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur-xl">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-white/50">
            Auth
          </p>
          <h1 className="mt-3 text-3xl font-semibold">Đăng nhập</h1>
          <p className="mt-2 text-sm text-white/60">
            Nhập email để nhận magic link.
          </p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none placeholder:text-white/35 focus:border-violet-500/60"
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-full bg-violet-600 px-5 py-3 text-sm font-medium transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Sending..." : "Send magic link"}
          </button>
        </form>

        {message ? <p className="text-sm text-white/70">{message}</p> : null}
      </div>
    </main>
  );
}
