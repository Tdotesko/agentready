"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function ResetForm() {
  const params = useSearchParams();
  const token = params.get("token");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    if (password !== confirm) { setError("Passwords don't match."); return; }
    setError(""); setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, password }) });
      const data = await res.json();
      if (!res.ok) setError(data.error);
      else setDone(true);
    } catch { setError("Something went wrong."); }
    finally { setLoading(false); }
  }

  if (!token) return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="text-center"><p className="text-sm text-[var(--red)]">Invalid reset link. <a href="/forgot-password" className="text-[var(--accent)] hover:underline">Request a new one</a>.</p></div>
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <a href="/" className="flex items-center gap-2.5 mb-12">
          <img src="/logo.png" alt="CartParse" className="h-10 w-auto" />
        </a>

        {done ? (
          <div>
            <h1 className="text-2xl font-bold text-white mb-2">Password updated</h1>
            <p className="text-sm text-[var(--text-secondary)] mb-6">Your password has been reset. You can now sign in.</p>
            <a href="/login" className="px-5 py-2.5 rounded-xl btn-primary text-sm inline-block">Sign in</a>
          </div>
        ) : (
          <div>
            <h1 className="text-2xl font-bold text-white mb-2">Set a new password</h1>
            <p className="text-sm text-[var(--text-secondary)] mb-8">Enter your new password below.</p>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="pass" className="text-xs font-medium text-[var(--text-secondary)] block mb-2">New password</label>
                <input id="pass" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8}
                  className="w-full rounded-xl bg-[var(--bg-raised)] border border-[var(--border-light)] px-4 py-3 text-sm text-white placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--accent-border)] focus:shadow-[0_0_0_3px_var(--accent-soft)] transition"
                  placeholder="Min 8 characters" />
              </div>
              <div>
                <label htmlFor="confirm" className="text-xs font-medium text-[var(--text-secondary)] block mb-2">Confirm password</label>
                <input id="confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={8}
                  className="w-full rounded-xl bg-[var(--bg-raised)] border border-[var(--border-light)] px-4 py-3 text-sm text-white placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--accent-border)] focus:shadow-[0_0_0_3px_var(--accent-soft)] transition"
                  placeholder="Confirm password" />
              </div>
              {error && <p className="text-sm text-[var(--red)]">{error}</p>}
              <button type="submit" disabled={loading} className="w-full py-3 rounded-xl btn-primary text-sm cursor-pointer disabled:cursor-not-allowed">
                {loading ? "Updating..." : "Update password"}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return <Suspense fallback={<div className="min-h-screen" />}><ResetForm /></Suspense>;
}
