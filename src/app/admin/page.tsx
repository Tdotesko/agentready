"use client";

import { useState, useEffect } from "react";

const PLAN_PRICES: Record<string, number> = { growth: 49, business: 149, enterprise: 399, starter: 29, pro: 99, agency: 249 };

function Stat({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="surface rounded-xl p-4">
      <p className="text-[9px] font-semibold text-[var(--text-dim)] uppercase tracking-widest mb-1">{label}</p>
      <p className="text-xl font-bold font-mono tabular-nums" style={{ color: color || "white" }}>{value}</p>
      {sub && <p className="text-[10px] text-[var(--text-dim)] mt-0.5">{sub}</p>}
    </div>
  );
}

function BarChart({ data }: { data: { label: string; value: number }[] }) {
  if (data.length === 0) return <p className="text-xs text-[var(--text-dim)] py-4 text-center">No data yet</p>;
  const max = Math.max(...data.map(d => d.value), 1);
  const w = 100 / data.length;
  return (
    <svg viewBox="0 0 100 72" className="w-full" preserveAspectRatio="xMidYMid meet">
      {data.map((d, i) => (
        <g key={i}>
          <rect x={i * w + w * 0.15} y={60 - (d.value / max) * 60} width={w * 0.7} height={(d.value / max) * 60} rx="1" fill="var(--accent)" opacity="0.8" />
          {data.length <= 15 && <text x={i * w + w / 2} y={69} textAnchor="middle" fontSize="3" fill="var(--text-dim)" fontFamily="var(--font-mono)">{d.label}</text>}
        </g>
      ))}
    </svg>
  );
}

function PieChart({ data }: { data: { label: string; value: number; color: string }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return <p className="text-xs text-[var(--text-dim)] py-4 text-center">No data</p>;
  let offset = 0;
  const r = 40, circ = 2 * Math.PI * r;
  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 100 100" className="w-20 h-20 -rotate-90 shrink-0">
        <circle cx="50" cy="50" r={r} stroke="rgba(255,255,255,0.04)" strokeWidth="10" fill="none" />
        {data.map((d, i) => { const pct = d.value / total; const len = pct * circ; const seg = <circle key={i} cx="50" cy="50" r={r} stroke={d.color} strokeWidth="10" fill="none" strokeDasharray={`${len} ${circ - len}`} strokeDashoffset={-offset} />; offset += len; return seg; })}
      </svg>
      <div className="space-y-1">{data.map((d, i) => <div key={i} className="flex items-center gap-2"><span className="w-2 h-2 rounded-full shrink-0" style={{ background: d.color }} /><span className="text-[10px] text-[var(--text-secondary)]">{d.label} ({d.value})</span></div>)}</div>
    </div>
  );
}

interface Stats {
  totalUsers: number; activeSubscriptions: number; freeUsers: number; totalScans: number; totalLeads: number;
  totalProspects: number; totalStores: number; queuedEmails: number; sentEmails: number; avgScore: number;
  todayScans: number; todaySignups: number; weekSignups: number; verifiedUsers: number;
  revenueByPlan: { plan: string; count: number }[];
  recentSignups: { id: string; email: string; plan?: string; subscriptionStatus?: string; createdAt: string }[];
  scansByDay: { date: string; count: number }[];
  signupsByDay: { date: string; count: number }[];
  topStores: { url: string; count: number; avgScore: number }[];
  scoreDistribution: { grade: string; count: number }[];
  platformBreakdown: { platform: string; count: number }[];
  prospectsByStatus: { status: string; count: number }[];
}

const STATUS_COLORS: Record<string, string> = { new: "#e8a443", contacted: "#fbbf24", replied: "#34d399", converted: "#22d3ee", dead: "#555" };

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  useEffect(() => { fetch("/api/admin/stats").then(r => r.ok ? r.json() : null).then(d => { if (d) setStats(d); }); }, []);

  if (!stats) return <div className="space-y-4">{Array.from({length: 6}).map((_, i) => <div key={i} className="skeleton h-24 rounded-xl" />)}</div>;

  const mrr = stats.revenueByPlan.reduce((sum, r) => sum + (PLAN_PRICES[r.plan] || 0) * r.count, 0);
  const conv = stats.totalUsers > 0 ? Math.round((stats.activeSubscriptions / stats.totalUsers) * 100) : 0;

  return (
    <>
      <h1 className="text-xl font-bold text-white mb-1">Dashboard</h1>
      <p className="text-sm text-[var(--text-secondary)] mb-6">CartParse metrics and activity overview.</p>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <Stat label="MRR" value={`$${mrr.toLocaleString()}`} color="var(--accent)" />
        <Stat label="Active Subs" value={stats.activeSubscriptions} color="var(--green)" />
        <Stat label="Total Users" value={stats.totalUsers} sub={`${stats.freeUsers} free`} />
        <Stat label="Conversion" value={`${conv}%`} color={conv > 10 ? "var(--green)" : "var(--yellow)"} />
        <Stat label="Today" value={stats.todaySignups} sub={`signups / ${stats.todayScans} scans`} />
        <Stat label="This Week" value={stats.weekSignups} sub="signups" />
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <div className="surface rounded-xl p-4"><p className="text-[9px] font-semibold text-[var(--text-dim)] uppercase tracking-widest mb-3">Scans (30 days)</p><BarChart data={stats.scansByDay.map(d => ({ label: new Date(d.date).toLocaleDateString(undefined, { month: "short", day: "numeric" }), value: d.count }))} /></div>
        <div className="surface rounded-xl p-4"><p className="text-[9px] font-semibold text-[var(--text-dim)] uppercase tracking-widest mb-3">Signups (30 days)</p><BarChart data={stats.signupsByDay.map(d => ({ label: new Date(d.date).toLocaleDateString(undefined, { month: "short", day: "numeric" }), value: d.count }))} /></div>
        <div className="surface rounded-xl p-4"><p className="text-[9px] font-semibold text-[var(--text-dim)] uppercase tracking-widest mb-3">Score Distribution</p><PieChart data={stats.scoreDistribution.map(d => ({ label: d.grade, value: d.count, color: d.grade === "A" || d.grade === "B" ? "var(--green)" : d.grade === "C" ? "var(--yellow)" : "var(--red)" }))} /></div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <div className="surface rounded-xl p-4"><p className="text-[9px] font-semibold text-[var(--text-dim)] uppercase tracking-widest mb-3">Revenue by plan</p>{stats.revenueByPlan.length === 0 ? <p className="text-xs text-[var(--text-dim)]">No subs yet</p> : stats.revenueByPlan.map(r => <div key={r.plan} className="flex justify-between py-1"><span className="text-xs text-[var(--text)] capitalize">{r.plan}</span><span className="text-xs font-mono text-[var(--accent)]">{r.count} x ${PLAN_PRICES[r.plan] || 0}</span></div>)}</div>
        <div className="surface rounded-xl p-4"><p className="text-[9px] font-semibold text-[var(--text-dim)] uppercase tracking-widest mb-3">Prospect pipeline</p><PieChart data={stats.prospectsByStatus.map(d => ({ label: d.status, value: d.count, color: STATUS_COLORS[d.status] || "#555" }))} /></div>
        <div className="surface rounded-xl p-4"><p className="text-[9px] font-semibold text-[var(--text-dim)] uppercase tracking-widest mb-3">Platforms</p>{stats.platformBreakdown.map(p => <div key={p.platform} className="flex justify-between py-1"><span className="text-xs text-[var(--text)] capitalize">{p.platform}</span><span className="text-xs font-mono text-[var(--text-dim)]">{p.count}</span></div>)}</div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="surface rounded-xl p-4"><p className="text-[9px] font-semibold text-[var(--text-dim)] uppercase tracking-widest mb-3">Most scanned</p>{stats.topStores.length === 0 ? <p className="text-xs text-[var(--text-dim)]">None yet</p> : stats.topStores.map((s, i) => <div key={i} className="flex items-center gap-2 py-1 border-b border-[var(--border)] last:border-0"><span className="text-[10px] text-[var(--text-dim)] w-3">{i+1}</span><span className="text-xs text-[var(--text)] flex-1 truncate">{s.url}</span><span className="text-xs font-mono" style={{ color: s.avgScore >= 60 ? "var(--green)" : "var(--yellow)" }}>{s.avgScore}</span></div>)}</div>
        <div className="surface rounded-xl p-4"><p className="text-[9px] font-semibold text-[var(--text-dim)] uppercase tracking-widest mb-3">Recent signups</p>{stats.recentSignups.slice(0, 8).map(u => <div key={u.id} className="flex justify-between py-1 border-b border-[var(--border)] last:border-0"><div className="min-w-0"><p className="text-xs text-[var(--text)] truncate">{u.email}</p></div><span className={`text-[9px] px-1.5 py-0.5 rounded-full ${u.subscriptionStatus === "active" ? "bg-[var(--green-soft)] text-[var(--green)]" : "bg-[rgba(255,255,255,0.04)] text-[var(--text-dim)]"}`}>{u.plan || "free"}</span></div>)}</div>
      </div>
    </>
  );
}
