"use client";

import { useState } from "react";

export default function UnsubscribePage() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // In production, this would call an API to update email preferences
    setDone(true);
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm text-center">
        <a href="/" className="flex items-center gap-2.5 justify-center mb-12">
          <img src="/logo.png" alt="CartParse" className="h-10 w-auto" />
        </a>

        {done ? (
          <div>
            <h1 className="text-xl font-bold text-white mb-2">You&apos;ve been unsubscribed</h1>
            <p className="text-sm text-[var(--text-secondary)] mb-6">You won&apos;t receive any more marketing emails from CartParse. Transactional emails (password resets, billing) will still be sent while your account is active.</p>
            <a href="/" className="text-sm text-[var(--accent)] hover:underline">Back to CartParse</a>
          </div>
        ) : (
          <div>
            <h1 className="text-xl font-bold text-white mb-2">Unsubscribe from emails</h1>
            <p className="text-sm text-[var(--text-secondary)] mb-6">Enter your email to unsubscribe from CartParse marketing emails.</p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@company.com"
                className="w-full rounded-xl bg-[var(--bg-raised)] border border-[var(--border-light)] px-4 py-3 text-sm text-white placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--accent-border)] transition text-center" />
              <button type="submit" className="w-full py-3 rounded-xl btn-secondary text-sm cursor-pointer">Unsubscribe</button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
