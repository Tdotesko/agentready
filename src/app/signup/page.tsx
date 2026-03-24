"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function SignupForm() {
  const params = useSearchParams();
  const selectedPlan = params.get("plan") || "pro";
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
      // 1. Create account
      const signupRes = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const signupData = await signupRes.json();
      if (!signupRes.ok) { setError(signupData.error); setLoading(false); return; }

      // 2. Create Stripe checkout session
      const checkoutRes = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: selectedPlan }),
      });
      const checkoutData = await checkoutRes.json();
      if (!checkoutRes.ok) { setError(checkoutData.error); setLoading(false); return; }

      // 3. Redirect to Stripe
      window.location.href = checkoutData.url;
    } catch {
      setError("Something went wrong. Try again.");
      setLoading(false);
    }
  }

  const planNames: Record<string, string> = { starter: "Starter ($29/mo)", pro: "Pro ($99/mo)", agency: "Agency ($249/mo)" };

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <a href="/" className="flex items-center gap-2.5 mb-10">
          <span className="w-7 h-7 rounded-md bg-[var(--accent)] flex items-center justify-center text-[11px] font-bold text-black">A</span>
          <span className="text-sm font-semibold text-white">AgentReady</span>
        </a>

        <h1 className="text-xl font-bold text-white mb-1">Create your account</h1>
        <p className="text-sm text-[var(--text-secondary)] mb-6">
          Plan: <span className="text-[var(--accent)]">{planNames[selectedPlan] || "Pro ($99/mo)"}</span>
          {selectedPlan !== "pro" && (
            <> &middot; <a href="/signup?plan=pro" className="underline hover:text-white">change</a></>
          )}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="text-xs text-[var(--text-secondary)] block mb-1.5">Email</label>
            <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
              className="w-full rounded-lg bg-[var(--bg-raised)] border border-[var(--border-light)] px-4 py-2.5 text-sm text-white placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--accent-border)]"
              placeholder="you@company.com" />
          </div>
          <div>
            <label htmlFor="pass" className="text-xs text-[var(--text-secondary)] block mb-1.5">Password</label>
            <input id="pass" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8}
              className="w-full rounded-lg bg-[var(--bg-raised)] border border-[var(--border-light)] px-4 py-2.5 text-sm text-white placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--accent-border)]"
              placeholder="Min 8 characters" />
          </div>

          {error && <p className="text-sm text-[var(--red)]">{error}</p>}

          <button type="submit" disabled={loading}
            className="w-full py-2.5 rounded-lg bg-[var(--accent)] text-black text-sm font-semibold hover:brightness-110 disabled:opacity-40 transition cursor-pointer disabled:cursor-not-allowed">
            {loading ? "Setting up..." : "Sign up and pay"}
          </button>
        </form>

        <p className="text-xs text-[var(--text-dim)] mt-6 text-center">
          Already have an account? <a href="/login" className="text-[var(--accent)] hover:underline">Sign in</a>
        </p>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <SignupForm />
    </Suspense>
  );
}
