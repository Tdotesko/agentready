"use client";

import { useState } from "react";

export default function AdminSettingsPage() {
  const [cronSecret, setCronSecret] = useState("");
  const [showSecret, setShowSecret] = useState(false);

  return (
    <>
      <h1 className="text-xl font-bold text-white mb-1">Settings</h1>
      <p className="text-sm text-[var(--text-secondary)] mb-6">Admin configuration and environment info.</p>

      <div className="max-w-2xl space-y-6">
        {/* Cron setup */}
        <div className="surface rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white mb-1">Cron Job Setup</h2>
          <p className="text-xs text-[var(--text-secondary)] mb-4">Set up a cron service (like cron-job.org) to call these URLs every 15 minutes:</p>
          <div className="space-y-2 text-xs font-mono bg-[var(--bg)] rounded-lg p-4 overflow-x-auto">
            <p className="text-[var(--text-secondary)]"># Process email queue (every 15 min)</p>
            <p className="text-[var(--accent)] break-all">POST /api/cron/process-emails?secret=YOUR_CRON_SECRET</p>
            <p className="text-[var(--text-secondary)] mt-3"># Nurture unconverted leads (every hour)</p>
            <p className="text-[var(--accent)] break-all">POST /api/cron/nurture-leads?secret=YOUR_CRON_SECRET</p>
            <p className="text-[var(--text-secondary)] mt-3"># Auto-rescan monitored stores (every hour)</p>
            <p className="text-[var(--accent)] break-all">POST /api/cron/rescan-stores?secret=YOUR_CRON_SECRET</p>
          </div>
        </div>

        {/* Stripe */}
        <div className="surface rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white mb-1">Stripe</h2>
          <p className="text-xs text-[var(--text-secondary)] mb-3">Payment processing is handled by Stripe in live mode.</p>
          <div className="flex items-center gap-3">
            <span className="w-2 h-2 rounded-full bg-[var(--green)]" />
            <span className="text-xs text-[var(--green)]">Live mode active</span>
          </div>
          <a href="https://dashboard.stripe.com" target="_blank" className="text-xs text-[var(--accent)] hover:underline mt-2 inline-block">Open Stripe Dashboard</a>
        </div>

        {/* Email */}
        <div className="surface rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white mb-1">Email (Resend)</h2>
          <p className="text-xs text-[var(--text-secondary)] mb-3">Transactional and marketing emails via Resend API.</p>
          <div className="flex items-center gap-3">
            <span className="w-2 h-2 rounded-full bg-[var(--green)]" />
            <span className="text-xs text-[var(--green)]">Connected</span>
          </div>
          <a href="https://resend.com" target="_blank" className="text-xs text-[var(--accent)] hover:underline mt-2 inline-block">Open Resend Dashboard</a>
        </div>

        {/* Danger zone */}
        <div className="surface rounded-xl p-5 ring-1 ring-[var(--red)]/20">
          <h2 className="text-sm font-semibold text-[var(--red)] mb-1">Danger Zone</h2>
          <p className="text-xs text-[var(--text-secondary)] mb-4">These actions are irreversible.</p>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-[var(--text)]">Process all queued emails now</p>
                <p className="text-[10px] text-[var(--text-dim)]">Immediately send all pending emails in the queue.</p>
              </div>
              <button onClick={async () => { await fetch("/api/cron/process-emails", { method: "POST" }); alert("Queue processed."); }}
                className="px-3 py-1.5 rounded-lg text-[10px] text-[var(--red)] border border-[var(--red)]/30 hover:bg-[var(--red-soft)] cursor-pointer">Run</button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
