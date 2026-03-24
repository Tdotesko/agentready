"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

const PLANS: Record<string, { name: string; price: string; features: string[] }> = {
  free: { name: "Free", price: "$0", features: ["Preview scans", "Score and category grades", "1 store"] },
  growth: { name: "Growth", price: "$49/mo", features: ["5 stores", "Multi-page deep scan", "Fix code and reports"] },
  business: { name: "Business", price: "$149/mo", features: ["25 stores", "Competitor comparison", "Daily monitoring"] },
  enterprise: { name: "Enterprise", price: "$399/mo", features: ["Unlimited stores", "White-label reports", "Priority support"] },
};

function SignupForm() {
  const params = useSearchParams();
  const selectedPlan = params.get("plan") || "business";
  const plan = PLANS[selectedPlan] || PLANS.business;
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
      const signupRes = await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
      const signupData = await signupRes.json();
      if (!signupRes.ok) { setError(signupData.error); setLoading(false); return; }

      if (selectedPlan === "free") {
        window.location.href = "/dashboard";
        return;
      }

      const checkoutRes = await fetch("/api/stripe/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan: selectedPlan }) });
      const checkoutData = await checkoutRes.json();
      if (!checkoutRes.ok) { setError(checkoutData.error); setLoading(false); return; }

      window.location.href = checkoutData.url;
    } catch { setError("Something went wrong. Try again."); setLoading(false); }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left panel */}
      <div className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm">
          <a href="/" className="flex items-center gap-2.5 mb-12">
            <img src="/logo-icon.png" alt="CartParse" className="w-8 h-8 rounded-lg" />
            <span className="text-base font-semibold text-white">CartParse</span>
          </a>

          <h1 className="text-2xl font-bold text-white mb-2">Create your account</h1>
          <p className="text-sm text-[var(--text-secondary)] mb-8">
            {selectedPlan === "free" ? (
              <>Get started with a free account. <a href="/signup?plan=business" className="text-[var(--accent)] hover:underline">View paid plans</a></>
            ) : (
              <>You&apos;re signing up for the <span className="text-[var(--accent)] font-medium">{plan.name}</span> plan at <span className="text-white font-medium">{plan.price}</span>
              {selectedPlan !== "business" && <span className="text-[var(--text-dim)]"> &middot; <a href="/signup?plan=business" className="text-[var(--accent)] hover:underline">change plan</a></span>}</>
            )}
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="text-xs font-medium text-[var(--text-secondary)] block mb-2">Email address</label>
              <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus
                className="w-full rounded-xl bg-[var(--bg-raised)] border border-[var(--border-light)] px-4 py-3 text-sm text-white placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--accent-border)] focus:shadow-[0_0_0_3px_var(--accent-soft)] transition"
                placeholder="you@company.com" />
            </div>
            <div>
              <label htmlFor="pass" className="text-xs font-medium text-[var(--text-secondary)] block mb-2">Password</label>
              <input id="pass" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8}
                className="w-full rounded-xl bg-[var(--bg-raised)] border border-[var(--border-light)] px-4 py-3 text-sm text-white placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--accent-border)] focus:shadow-[0_0_0_3px_var(--accent-soft)] transition"
                placeholder="Min 8 characters" />
            </div>

            {error && <p className="text-sm text-[var(--red)] bg-[var(--red-soft)] border border-[rgba(248,113,113,0.12)] rounded-lg px-4 py-2.5">{error}</p>}

            <button type="submit" disabled={loading}
              className="w-full py-3 rounded-xl btn-primary text-sm cursor-pointer disabled:cursor-not-allowed">
              {loading ? "Setting up your account..." : selectedPlan === "free" ? "Create free account" : "Continue to payment"}
            </button>
          </form>

          {selectedPlan !== "free" && (
            <p className="text-[11px] text-[var(--text-dim)] mt-4 text-center leading-relaxed">
              You&apos;ll be redirected to Stripe for secure payment.
              Cancel anytime from your dashboard.
            </p>
          )}

          <p className="text-sm text-[var(--text-dim)] mt-8 text-center">
            Already have an account? <a href="/login" className="text-[var(--accent)] hover:underline font-medium">Sign in</a>
          </p>
        </div>
      </div>

      {/* Right panel */}
      <div className="hidden lg:flex w-[45%] bg-[var(--bg-raised)] border-l border-[var(--border)] items-center justify-center p-12">
        <div className="max-w-xs w-full">
          <p className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-widest mb-6">Your {plan.name} plan includes</p>

          <div className="space-y-4 mb-10">
            {plan.features.map((f, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-[var(--accent-soft)] border border-[var(--accent-border)] flex items-center justify-center shrink-0">
                  <span className="text-[10px] text-[var(--accent)]">&#10003;</span>
                </div>
                <span className="text-sm text-[var(--text)]">{f}</span>
              </div>
            ))}
          </div>

          {/* Plan switcher */}
          <div className="space-y-2">
            <p className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-widest mb-3">All plans</p>
            {Object.entries(PLANS).map(([key, p]) => (
              <a key={key} href={`/signup?plan=${key}`}
                className={`block px-4 py-3 rounded-xl border transition ${
                  key === selectedPlan
                    ? "bg-[var(--accent-soft)] border-[var(--accent-border)]"
                    : "bg-[var(--bg-elevated)] border-[var(--border)] hover:border-[var(--border-hover)]"
                }`}>
                <div className="flex items-center justify-between">
                  <span className={`text-sm font-medium ${key === selectedPlan ? "text-[var(--accent)]" : "text-[var(--text)]"}`}>{p.name}</span>
                  <span className="text-sm font-mono text-[var(--text-dim)]">{p.price}</span>
                </div>
              </a>
            ))}
          </div>
        </div>
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
