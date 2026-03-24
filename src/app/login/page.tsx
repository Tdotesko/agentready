"use client";

import { useState } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); setLoading(false); return; }

      window.location.href = "/dashboard";
    } catch {
      setError("Something went wrong. Try again.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <a href="/" className="flex items-center gap-2.5 mb-10">
          <span className="w-7 h-7 rounded-md bg-[var(--accent)] flex items-center justify-center text-[11px] font-bold text-black">A</span>
          <span className="text-sm font-semibold text-white">AgentReady</span>
        </a>

        <h1 className="text-xl font-bold text-white mb-1">Sign in</h1>
        <p className="text-sm text-[var(--text-secondary)] mb-6">Access your reports and dashboard.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="text-xs text-[var(--text-secondary)] block mb-1.5">Email</label>
            <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
              className="w-full rounded-lg bg-[var(--bg-raised)] border border-[var(--border-light)] px-4 py-2.5 text-sm text-white placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--accent-border)]"
              placeholder="you@company.com" />
          </div>
          <div>
            <label htmlFor="pass" className="text-xs text-[var(--text-secondary)] block mb-1.5">Password</label>
            <input id="pass" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
              className="w-full rounded-lg bg-[var(--bg-raised)] border border-[var(--border-light)] px-4 py-2.5 text-sm text-white placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--accent-border)]"
              placeholder="Your password" />
          </div>

          {error && <p className="text-sm text-[var(--red)]">{error}</p>}

          <button type="submit" disabled={loading}
            className="w-full py-2.5 rounded-lg bg-[var(--accent)] text-black text-sm font-semibold hover:brightness-110 disabled:opacity-40 transition cursor-pointer disabled:cursor-not-allowed">
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <p className="text-xs text-[var(--text-dim)] mt-6 text-center">
          No account yet? <a href="/signup" className="text-[var(--accent)] hover:underline">Sign up</a>
        </p>
      </div>
    </div>
  );
}
