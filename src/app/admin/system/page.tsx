"use client";

import { useState, useEffect } from "react";

function Stat({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="surface rounded-xl p-4">
      <p className="text-[9px] font-semibold text-[var(--text-dim)] uppercase tracking-widest mb-1">{label}</p>
      <p className="text-xl font-bold font-mono tabular-nums" style={{ color: color || "white" }}>{value}</p>
    </div>
  );
}

export default function AdminSystemPage() {
  const [stats, setStats] = useState<Record<string, number | string> | null>(null);
  const [health, setHealth] = useState<Record<string, string> | null>(null);
  const [cronResults, setCronResults] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch("/api/admin/stats").then(r => r.ok ? r.json() : null).then(d => { if (d) setStats(d); });
    fetch("/api/health").then(r => r.ok ? r.json() : null).then(d => { if (d) setHealth(d); });
  }, []);

  async function runCron(endpoint: string) {
    setCronResults(prev => ({ ...prev, [endpoint]: "Running..." }));
    try {
      const res = await fetch(endpoint, { method: "POST" });
      const data = await res.json();
      setCronResults(prev => ({ ...prev, [endpoint]: JSON.stringify(data) }));
    } catch (err) {
      setCronResults(prev => ({ ...prev, [endpoint]: `Error: ${err}` }));
    }
  }

  if (!stats) return <div className="space-y-4">{Array.from({length: 4}).map((_, i) => <div key={i} className="skeleton h-24 rounded-xl" />)}</div>;

  return (
    <>
      <h1 className="text-xl font-bold text-white mb-1">System</h1>
      <p className="text-sm text-[var(--text-secondary)] mb-6">Infrastructure health, database stats, and cron management.</p>

      {/* Health */}
      <div className="surface rounded-xl p-4 mb-6">
        <p className="text-[9px] font-semibold text-[var(--text-dim)] uppercase tracking-widest mb-3">Service Health</p>
        <div className="flex items-center gap-3">
          <span className={`w-3 h-3 rounded-full ${health?.status === "ok" ? "bg-[var(--green)]" : "bg-[var(--red)]"}`} />
          <span className="text-sm text-[var(--text)]">{health?.status === "ok" ? "All systems operational" : "Service degraded"}</span>
          <span className="text-xs text-[var(--text-dim)] ml-auto">{health?.timestamp ? new Date(health.timestamp).toLocaleString() : ""}</span>
        </div>
      </div>

      {/* Database stats */}
      <h2 className="text-sm font-semibold text-white mb-3">Database</h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
        <Stat label="Users" value={stats.totalUsers as number} />
        <Stat label="Scans" value={stats.totalScans as number} />
        <Stat label="Leads" value={stats.totalLeads as number} />
        <Stat label="Prospects" value={stats.totalProspects as number} />
        <Stat label="Stores" value={stats.totalStores as number} />
        <Stat label="Avg Score" value={stats.avgScore as number} color={Number(stats.avgScore) >= 60 ? "var(--green)" : "var(--yellow)"} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Stat label="Email Queue" value={stats.queuedEmails as number} color={Number(stats.queuedEmails) > 10 ? "var(--yellow)" : "var(--green)"} />
        <Stat label="Emails Sent" value={stats.sentEmails as number} />
        <Stat label="Verified Users" value={stats.verifiedUsers as number} />
        <Stat label="Active Subs" value={stats.activeSubscriptions as number} color="var(--green)" />
      </div>

      {/* Cron */}
      <h2 className="text-sm font-semibold text-white mb-3">Cron Jobs</h2>
      <p className="text-xs text-[var(--text-secondary)] mb-4">Manually trigger cron endpoints. In production, these should be called automatically every 15 minutes.</p>
      <div className="space-y-3 mb-6">
        {[
          { label: "Process Email Queue", desc: "Send pending emails from the queue", endpoint: "/api/cron/process-emails" },
          { label: "Nurture Leads", desc: "Queue nurture emails for unconverted leads", endpoint: "/api/cron/nurture-leads" },
          { label: "Rescan Stores", desc: "Auto-rescan stores with monitoring enabled", endpoint: "/api/cron/rescan-stores" },
          { label: "Discover Leads", desc: "Auto-find and contact low-scoring stores", endpoint: "/api/cron/discover-leads" },
        ].map((cron) => (
          <div key={cron.endpoint} className="surface rounded-xl p-4 flex items-center gap-4">
            <div className="flex-1">
              <p className="text-sm text-white font-medium">{cron.label}</p>
              <p className="text-xs text-[var(--text-dim)]">{cron.desc}</p>
              {cronResults[cron.endpoint] && <p className="text-[10px] text-[var(--accent)] font-mono mt-1 break-all">{cronResults[cron.endpoint]}</p>}
            </div>
            <button onClick={() => runCron(cron.endpoint)} className="px-4 py-2 rounded-lg btn-secondary text-xs cursor-pointer shrink-0">Run now</button>
          </div>
        ))}
      </div>

      {/* Info */}
      <h2 className="text-sm font-semibold text-white mb-3">Platform Info</h2>
      <div className="surface rounded-xl p-4">
        <div className="grid sm:grid-cols-2 gap-2 text-xs">
          <div className="flex justify-between"><span className="text-[var(--text-dim)]">Database tables</span><span className="text-[var(--text)] font-mono">11</span></div>
          <div className="flex justify-between"><span className="text-[var(--text-dim)]">API routes</span><span className="text-[var(--text)] font-mono">37</span></div>
          <div className="flex justify-between"><span className="text-[var(--text-dim)]">Pages</span><span className="text-[var(--text)] font-mono">10+</span></div>
          <div className="flex justify-between"><span className="text-[var(--text-dim)]">Email provider</span><span className="text-[var(--text)] font-mono">Resend</span></div>
          <div className="flex justify-between"><span className="text-[var(--text-dim)]">Payment provider</span><span className="text-[var(--text)] font-mono">Stripe (Live)</span></div>
          <div className="flex justify-between"><span className="text-[var(--text-dim)]">Hosting</span><span className="text-[var(--text)] font-mono">Railway</span></div>
        </div>
      </div>
    </>
  );
}
