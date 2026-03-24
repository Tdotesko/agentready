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
      const res = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
      const data = await res.json();
      if (!res.ok) { setError(data.error); setLoading(false); return; }
      window.location.href = "/dashboard";
    } catch { setError("Something went wrong. Try again."); setLoading(false); }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left panel */}
      <div className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm">
          <a href="/" className="flex items-center gap-2.5 mb-12">
            <span className="w-8 h-8 rounded-lg bg-[var(--accent)] flex items-center justify-center text-xs font-bold text-black">C</span>
            <span className="text-base font-semibold text-white">CartParse</span>
          </a>

          <h1 className="text-2xl font-bold text-white mb-2">Welcome back</h1>
          <p className="text-sm text-[var(--text-secondary)] mb-8">Sign in to access your dashboard and reports.</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="text-xs font-medium text-[var(--text-secondary)] block mb-2">Email address</label>
              <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus
                className="w-full rounded-xl bg-[var(--bg-raised)] border border-[var(--border-light)] px-4 py-3 text-sm text-white placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--accent-border)] focus:shadow-[0_0_0_3px_var(--accent-soft)] transition"
                placeholder="you@company.com" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="pass" className="text-xs font-medium text-[var(--text-secondary)]">Password</label>
                <a href="/forgot-password" className="text-xs text-[var(--accent)] hover:underline">Forgot password?</a>
              </div>
              <input id="pass" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
                className="w-full rounded-xl bg-[var(--bg-raised)] border border-[var(--border-light)] px-4 py-3 text-sm text-white placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--accent-border)] focus:shadow-[0_0_0_3px_var(--accent-soft)] transition"
                placeholder="Your password" />
            </div>

            {error && <p className="text-sm text-[var(--red)] bg-[var(--red-soft)] border border-[rgba(248,113,113,0.12)] rounded-lg px-4 py-2.5">{error}</p>}

            <button type="submit" disabled={loading}
              className="w-full py-3 rounded-xl btn-primary text-sm cursor-pointer disabled:cursor-not-allowed">
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>

          <p className="text-sm text-[var(--text-dim)] mt-8 text-center">
            No account yet? <a href="/signup?plan=free" className="text-[var(--accent)] hover:underline font-medium">Sign up free</a>
          </p>
        </div>
      </div>

      {/* Right panel (desktop only) */}
      <div className="hidden lg:flex w-[45%] bg-[var(--bg-raised)] border-l border-[var(--border)] items-center justify-center p-12">
        <div className="max-w-sm">
          <div className="text-6xl font-mono font-bold text-[var(--accent)] mb-4">73</div>
          <p className="text-lg font-semibold text-white mb-2">Average score improvement after 30 days</p>
          <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
            Our users typically see a 30-40 point increase in their agent readiness score within the first month of implementing our recommendations.
          </p>
          <div className="mt-8 flex items-center gap-6 text-xs text-[var(--text-dim)]">
            <div><span className="text-white font-semibold text-lg">12</span><br />pages scanned per report</div>
            <div className="w-px h-10 bg-[var(--border)]" />
            <div><span className="text-white font-semibold text-lg">6</span><br />platforms supported</div>
            <div className="w-px h-10 bg-[var(--border)]" />
            <div><span className="text-white font-semibold text-lg">&lt;3s</span><br />average scan time</div>
          </div>
        </div>
      </div>
    </div>
  );
}
