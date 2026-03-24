"use client";

import { useState } from "react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError(""); setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
      const data = await res.json();
      if (!res.ok) setError(data.error);
      else setSent(true);
    } catch { setError("Something went wrong."); }
    finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <a href="/" className="flex items-center gap-2.5 mb-12">
          <img src="/logo.png" alt="CartParse" className="h-10 w-auto" />
        </a>

        {sent ? (
          <div>
            <h1 className="text-2xl font-bold text-white mb-2">Check your email</h1>
            <p className="text-sm text-[var(--text-secondary)] mb-6">If an account exists for {email}, we sent a password reset link. It expires in 1 hour.</p>
            <a href="/login" className="text-sm text-[var(--accent)] hover:underline">Back to sign in</a>
          </div>
        ) : (
          <div>
            <h1 className="text-2xl font-bold text-white mb-2">Reset your password</h1>
            <p className="text-sm text-[var(--text-secondary)] mb-8">Enter your email and we will send you a reset link.</p>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="email" className="text-xs font-medium text-[var(--text-secondary)] block mb-2">Email address</label>
                <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus
                  className="w-full rounded-xl bg-[var(--bg-raised)] border border-[var(--border-light)] px-4 py-3 text-sm text-white placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--accent-border)] focus:shadow-[0_0_0_3px_var(--accent-soft)] transition"
                  placeholder="you@company.com" />
              </div>
              {error && <p className="text-sm text-[var(--red)]">{error}</p>}
              <button type="submit" disabled={loading} className="w-full py-3 rounded-xl btn-primary text-sm cursor-pointer disabled:cursor-not-allowed">
                {loading ? "Sending..." : "Send reset link"}
              </button>
            </form>
            <p className="text-sm text-[var(--text-dim)] mt-8 text-center">
              <a href="/login" className="text-[var(--accent)] hover:underline font-medium">Back to sign in</a>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
