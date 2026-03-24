"use client";

import { useState, useEffect, useCallback } from "react";

interface Stats {
  totalUsers: number; activeSubscriptions: number; freeUsers: number; totalScans: number; totalLeads: number;
  totalProspects: number; totalStores: number; queuedEmails: number; sentEmails: number; apiKeyCount: number;
  webhookCount: number; avgScore: number; todayScans: number; todaySignups: number; weekSignups: number; verifiedUsers: number;
  revenueByPlan: { plan: string; count: number }[];
  recentSignups: { id: string; email: string; plan?: string; subscriptionStatus?: string; isAdmin: boolean; createdAt: string }[];
  scansByDay: { date: string; count: number }[];
  signupsByDay: { date: string; count: number }[];
  topStores: { url: string; count: number; avgScore: number }[];
  scoreDistribution: { grade: string; count: number }[];
  platformBreakdown: { platform: string; count: number }[];
  prospectsByStatus: { status: string; count: number }[];
}

interface UserRecord { id: string; email: string; plan?: string; subscriptionStatus?: string; stripeCustomerId?: string; isAdmin: boolean; createdAt: string; }
interface LeadRecord { email: string; scannedUrl: string; score: number; submittedAt: string; }
interface ScanRecord { userId: string; url: string; score: number; grade: string; scannedAt: string; }
interface ProspectRecord { id: number; url: string; email: string | null; storeName: string | null; platform: string | null; score: number | null; grade: string | null; status: string; source: string | null; notes: string | null; lastContactedAt: string | null; createdAt: string; }
interface EmailStats { queued: number; sent: number; opened: number; clicked: number; bounced: number; openRate: number; clickRate: number; }
interface QueueItem { id: number; recipient_email: string; subject: string; status: string; send_after: string; prospect_id: number | null; }
interface LogItem { id: number; recipient_email: string; subject: string; status: string; sent_at: string; }

const PLAN_PRICES: Record<string, number> = { growth: 49, business: 149, enterprise: 399, starter: 29, pro: 99, agency: 249 };
const STATUS_COLORS: Record<string, string> = { new: "var(--accent)", contacted: "var(--yellow)", replied: "var(--green)", converted: "#22d3ee", dead: "var(--text-dim)" };

function Stat({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="surface rounded-xl p-4">
      <p className="text-[9px] font-semibold text-[var(--text-dim)] uppercase tracking-widest mb-1">{label}</p>
      <p className="text-xl font-bold font-mono tabular-nums" style={{ color: color || "white" }}>{value}</p>
      {sub && <p className="text-[10px] text-[var(--text-dim)] mt-0.5">{sub}</p>}
    </div>
  );
}

function BarChart({ data, height = 60 }: { data: { label: string; value: number }[]; height?: number }) {
  if (data.length === 0) return <p className="text-xs text-[var(--text-dim)] py-4 text-center">No data yet</p>;
  const max = Math.max(...data.map(d => d.value), 1);
  const w = 100 / data.length;
  return (
    <svg viewBox={`0 0 100 ${height + 12}`} className="w-full" preserveAspectRatio="xMidYMid meet">
      {data.map((d, i) => (
        <g key={i}>
          <rect x={i * w + w * 0.15} y={height - (d.value / max) * height} width={w * 0.7} height={(d.value / max) * height} rx="1" fill="var(--accent)" opacity="0.8" />
          {data.length <= 15 && (
            <text x={i * w + w / 2} y={height + 9} textAnchor="middle" fontSize="3" fill="var(--text-dim)" fontFamily="var(--font-mono)">{d.label}</text>
          )}
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
      <svg viewBox="0 0 100 100" className="w-24 h-24 -rotate-90 shrink-0">
        <circle cx="50" cy="50" r={r} stroke="rgba(255,255,255,0.04)" strokeWidth="10" fill="none" />
        {data.map((d, i) => {
          const pct = d.value / total;
          const len = pct * circ;
          const seg = <circle key={i} cx="50" cy="50" r={r} stroke={d.color} strokeWidth="10" fill="none" strokeDasharray={`${len} ${circ - len}`} strokeDashoffset={-offset} />;
          offset += len;
          return seg;
        })}
      </svg>
      <div className="space-y-1">
        {data.map((d, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: d.color }} />
            <span className="text-[10px] text-[var(--text-secondary)]">{d.label}</span>
            <span className="text-[10px] font-mono text-[var(--text-dim)]">{d.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AdminPortal() {
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [leads, setLeads] = useState<LeadRecord[]>([]);
  const [scans, setScans] = useState<ScanRecord[]>([]);
  const [prospects, setProspects] = useState<ProspectRecord[]>([]);
  const [emailStats, setEmailStats] = useState<EmailStats | null>(null);
  const [emailQueue, setEmailQueue] = useState<QueueItem[]>([]);
  const [emailLog, setEmailLog] = useState<LogItem[]>([]);
  const [tab, setTab] = useState<"overview" | "users" | "scans" | "leads" | "prospects" | "email" | "system">("overview");
  const [search, setSearch] = useState("");
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [editPlan, setEditPlan] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [addProspectUrl, setAddProspectUrl] = useState("");
  const [addingProspect, setAddingProspect] = useState(false);
  const [importUrls, setImportUrls] = useState("");
  const [importing, setImporting] = useState(false);
  const [prospectFilter, setProspectFilter] = useState("");

  const loadData = useCallback(async () => {
    try {
      const meRes = await fetch("/api/auth/me");
      if (!meRes.ok) { window.location.href = "/login"; return; }
      const me = await meRes.json();
      if (!me.isAdmin) { window.location.href = "/dashboard"; return; }
      setAuthorized(true);
      const [statsRes, usersRes, leadsRes, scansRes, prospectsRes, emailRes] = await Promise.all([
        fetch("/api/admin/stats"), fetch("/api/admin/users"), fetch("/api/admin/leads"),
        fetch("/api/admin/scans"), fetch("/api/admin/prospects"), fetch("/api/admin/email/stats"),
      ]);
      if (statsRes.ok) setStats(await statsRes.json());
      if (usersRes.ok) setUsers(await usersRes.json());
      if (leadsRes.ok) setLeads(await leadsRes.json());
      if (scansRes.ok) setScans(await scansRes.json());
      if (prospectsRes.ok) { const d = await prospectsRes.json(); setProspects(d.prospects || []); }
      if (emailRes.ok) { const d = await emailRes.json(); setEmailStats(d.stats); setEmailQueue(d.queue || []); setEmailLog(d.log || []); }
    } catch { window.location.href = "/login"; }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleUpdateUser(userId: string) {
    await fetch("/api/admin/users", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId, plan: editPlan || undefined, subscriptionStatus: editStatus || undefined }) });
    setEditingUser(null); loadData();
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="w-6 h-6 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" /></div>;
  if (!authorized) return null;

  const mrr = stats?.revenueByPlan.reduce((sum, r) => sum + (PLAN_PRICES[r.plan] || 0) * r.count, 0) || 0;
  const filteredUsers = search ? users.filter(u => u.email.toLowerCase().includes(search.toLowerCase())) : users;
  const conversionRate = stats && stats.totalUsers > 0 ? Math.round((stats.activeSubscriptions / stats.totalUsers) * 100) : 0;

  return (
    <div className="min-h-screen">
      <nav className="border-b border-[var(--border)] px-6 py-3 sticky top-0 bg-[var(--bg)]/80 backdrop-blur-xl z-50">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a href="/dashboard" className="flex items-center gap-2">
              <img src="/logo.png" alt="CartParse" className="h-8 w-auto" />
            </a>
            <span className="text-[10px] px-2 py-0.5 rounded bg-red-500/20 text-red-400 font-semibold uppercase tracking-wider">Admin</span>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={loadData} className="text-xs text-[var(--text-dim)] hover:text-[var(--accent)] cursor-pointer">Refresh</button>
            <a href="/dashboard" className="text-xs text-[var(--text-dim)] hover:text-[var(--text)] transition">Dashboard</a>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-[var(--bg-raised)] rounded-lg p-1 w-fit overflow-x-auto">
          {(["overview", "prospects", "email", "users", "scans", "leads", "system"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-3 py-1.5 rounded-md text-[11px] font-medium transition cursor-pointer whitespace-nowrap ${tab === t ? "bg-[var(--bg-elevated)] text-white" : "text-[var(--text-dim)] hover:text-[var(--text-secondary)]"}`}>
              {t === "overview" ? "Overview" : t === "prospects" ? `Prospects (${prospects.length})` : t === "email" ? "Email" : t === "users" ? `Users (${users.length})` : t === "scans" ? `Scans (${scans.length})` : t === "leads" ? `Leads (${leads.length})` : "System"}
            </button>
          ))}
        </div>

        {/* ═══ OVERVIEW ═══ */}
        {tab === "overview" && stats && (
          <>
            {/* Row 1: Key metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
              <Stat label="MRR" value={`$${mrr.toLocaleString()}`} color="var(--accent)" />
              <Stat label="Active Subs" value={stats.activeSubscriptions} color="var(--green)" />
              <Stat label="Total Users" value={stats.totalUsers} sub={`${stats.freeUsers} free`} />
              <Stat label="Conversion" value={`${conversionRate}%`} color={conversionRate > 10 ? "var(--green)" : "var(--yellow)"} />
              <Stat label="Today" value={stats.todaySignups} sub={`signups / ${stats.todayScans} scans`} />
              <Stat label="This Week" value={stats.weekSignups} sub="signups" />
            </div>

            {/* Row 2: Charts */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              <div className="surface rounded-xl p-4">
                <p className="text-[9px] font-semibold text-[var(--text-dim)] uppercase tracking-widest mb-3">Scans (30 days)</p>
                <BarChart data={stats.scansByDay.map(d => ({ label: new Date(d.date).toLocaleDateString(undefined, { month: "short", day: "numeric" }), value: d.count }))} />
              </div>
              <div className="surface rounded-xl p-4">
                <p className="text-[9px] font-semibold text-[var(--text-dim)] uppercase tracking-widest mb-3">Signups (30 days)</p>
                <BarChart data={stats.signupsByDay.map(d => ({ label: new Date(d.date).toLocaleDateString(undefined, { month: "short", day: "numeric" }), value: d.count }))} />
              </div>
              <div className="surface rounded-xl p-4">
                <p className="text-[9px] font-semibold text-[var(--text-dim)] uppercase tracking-widest mb-3">Score Distribution</p>
                <PieChart data={stats.scoreDistribution.map(d => ({ label: d.grade, value: d.count, color: d.grade === "A" || d.grade === "B" ? "var(--green)" : d.grade === "C" ? "var(--yellow)" : "var(--red)" }))} />
              </div>
            </div>

            {/* Row 3: Revenue + Prospects + Activity */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              <div className="surface rounded-xl p-4">
                <p className="text-[9px] font-semibold text-[var(--text-dim)] uppercase tracking-widest mb-3">Revenue by plan</p>
                {stats.revenueByPlan.length === 0 ? (
                  <p className="text-xs text-[var(--text-dim)] py-4">No active subscriptions</p>
                ) : stats.revenueByPlan.map((r) => (
                  <div key={r.plan} className="flex items-center justify-between py-1.5">
                    <span className="text-xs text-[var(--text)] capitalize">{r.plan}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-[var(--text-dim)]">{r.count} sub{r.count !== 1 && "s"}</span>
                      <span className="text-xs font-mono text-[var(--accent)]">${(PLAN_PRICES[r.plan] || 0) * r.count}/mo</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="surface rounded-xl p-4">
                <p className="text-[9px] font-semibold text-[var(--text-dim)] uppercase tracking-widest mb-3">Prospect pipeline</p>
                <PieChart data={stats.prospectsByStatus.map(d => ({ label: d.status, value: d.count, color: STATUS_COLORS[d.status] || "var(--text-dim)" }))} />
              </div>
              <div className="surface rounded-xl p-4">
                <p className="text-[9px] font-semibold text-[var(--text-dim)] uppercase tracking-widest mb-3">Platform breakdown</p>
                {stats.platformBreakdown.map((p) => (
                  <div key={p.platform} className="flex items-center justify-between py-1">
                    <span className="text-xs text-[var(--text)] capitalize">{p.platform}</span>
                    <span className="text-xs font-mono text-[var(--text-dim)]">{p.count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Row 4: Top stores + recent signups */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="surface rounded-xl p-4">
                <p className="text-[9px] font-semibold text-[var(--text-dim)] uppercase tracking-widest mb-3">Most scanned stores</p>
                {stats.topStores.length === 0 ? <p className="text-xs text-[var(--text-dim)] py-4">No scans yet</p> : stats.topStores.map((s, i) => (
                  <div key={i} className="flex items-center gap-3 py-1.5 border-b border-[var(--border)] last:border-0">
                    <span className="text-xs font-mono text-[var(--text-dim)] w-4">{i + 1}</span>
                    <span className="text-xs text-[var(--text)] flex-1 truncate">{s.url}</span>
                    <span className="text-xs font-mono" style={{ color: s.avgScore >= 75 ? "var(--green)" : s.avgScore >= 45 ? "var(--yellow)" : "var(--red)" }}>{s.avgScore}</span>
                    <span className="text-[10px] text-[var(--text-dim)]">{s.count}x</span>
                  </div>
                ))}
              </div>
              <div className="surface rounded-xl p-4">
                <p className="text-[9px] font-semibold text-[var(--text-dim)] uppercase tracking-widest mb-3">Recent signups</p>
                {stats.recentSignups.map((u) => (
                  <div key={u.id} className="flex items-center justify-between py-1.5 border-b border-[var(--border)] last:border-0">
                    <div className="min-w-0">
                      <p className="text-xs text-[var(--text)] truncate">{u.email}</p>
                      <p className="text-[9px] text-[var(--text-dim)]">{new Date(u.createdAt).toLocaleDateString()}</p>
                    </div>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${u.subscriptionStatus === "active" ? "bg-[var(--green-soft)] text-[var(--green)]" : "bg-[rgba(255,255,255,0.04)] text-[var(--text-dim)]"}`}>
                      {u.plan || "free"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ═══ USERS ═══ */}
        {tab === "users" && (
          <>
            <div className="mb-4">
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by email..."
                className="w-full sm:w-80 rounded-lg bg-[var(--bg-raised)] border border-[var(--border-light)] px-4 py-2.5 text-sm text-white placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--accent-border)]" />
            </div>
            <div className="surface rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead><tr className="border-b border-[var(--border)]">
                    <th className="px-3 py-2 text-[9px] font-semibold text-[var(--text-dim)] uppercase">Email</th>
                    <th className="px-3 py-2 text-[9px] font-semibold text-[var(--text-dim)] uppercase">Plan</th>
                    <th className="px-3 py-2 text-[9px] font-semibold text-[var(--text-dim)] uppercase">Status</th>
                    <th className="px-3 py-2 text-[9px] font-semibold text-[var(--text-dim)] uppercase">Joined</th>
                    <th className="px-3 py-2 text-[9px] font-semibold text-[var(--text-dim)] uppercase">Actions</th>
                  </tr></thead>
                  <tbody>
                    {filteredUsers.map((u) => (
                      <tr key={u.id} className="border-b border-[var(--border)] hover:bg-[rgba(255,255,255,0.015)]">
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-[var(--text)]">{u.email}</span>
                            {u.isAdmin && <span className="text-[8px] px-1 py-0.5 rounded bg-red-500/20 text-red-400 font-bold">ADMIN</span>}
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          {editingUser === u.id ? (
                            <select value={editPlan} onChange={(e) => setEditPlan(e.target.value)} className="bg-[var(--bg)] border border-[var(--border-light)] rounded px-1 py-0.5 text-[10px] text-white">
                              <option value="">None</option><option value="growth">Growth</option><option value="business">Business</option><option value="enterprise">Enterprise</option>
                            </select>
                          ) : <span className="text-xs text-[var(--text-secondary)] capitalize">{u.plan || "free"}</span>}
                        </td>
                        <td className="px-3 py-2">
                          {editingUser === u.id ? (
                            <select value={editStatus} onChange={(e) => setEditStatus(e.target.value)} className="bg-[var(--bg)] border border-[var(--border-light)] rounded px-1 py-0.5 text-[10px] text-white">
                              <option value="">None</option><option value="active">Active</option><option value="canceled">Canceled</option><option value="trialing">Trialing</option>
                            </select>
                          ) : <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${u.subscriptionStatus === "active" ? "bg-[var(--green-soft)] text-[var(--green)]" : u.subscriptionStatus === "canceled" ? "bg-[var(--red-soft)] text-[var(--red)]" : "bg-[rgba(255,255,255,0.04)] text-[var(--text-dim)]"}`}>{u.subscriptionStatus || "none"}</span>}
                        </td>
                        <td className="px-3 py-2 text-[10px] text-[var(--text-dim)]">{new Date(u.createdAt).toLocaleDateString()}</td>
                        <td className="px-3 py-2">
                          {editingUser === u.id ? (
                            <div className="flex gap-1">
                              <button onClick={() => handleUpdateUser(u.id)} className="text-[9px] text-[var(--green)] cursor-pointer">Save</button>
                              <button onClick={() => setEditingUser(null)} className="text-[9px] text-[var(--text-dim)] cursor-pointer">Cancel</button>
                            </div>
                          ) : (
                            <button onClick={() => { setEditingUser(u.id); setEditPlan(u.plan || ""); setEditStatus(u.subscriptionStatus || ""); }}
                              className="text-[9px] text-[var(--accent)] cursor-pointer">Edit</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* ═══ SCANS ═══ */}
        {tab === "scans" && (
          <div className="surface rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead><tr className="border-b border-[var(--border)]">
                  <th className="px-3 py-2 text-[9px] font-semibold text-[var(--text-dim)] uppercase">Score</th>
                  <th className="px-3 py-2 text-[9px] font-semibold text-[var(--text-dim)] uppercase">URL</th>
                  <th className="px-3 py-2 text-[9px] font-semibold text-[var(--text-dim)] uppercase">Grade</th>
                  <th className="px-3 py-2 text-[9px] font-semibold text-[var(--text-dim)] uppercase">Date</th>
                </tr></thead>
                <tbody>
                  {scans.map((s, i) => (
                    <tr key={i} className="border-b border-[var(--border)]">
                      <td className="px-3 py-2"><span className="text-base font-mono font-bold" style={{ color: s.score >= 75 ? "var(--green)" : s.score >= 45 ? "var(--yellow)" : "var(--red)" }}>{s.score}</span></td>
                      <td className="px-3 py-2 text-xs text-[var(--text)] truncate max-w-[250px]">{s.url}</td>
                      <td className="px-3 py-2 text-xs text-[var(--text-dim)]">{s.grade}</td>
                      <td className="px-3 py-2 text-[10px] text-[var(--text-dim)]">{new Date(s.scannedAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ═══ LEADS ═══ */}
        {tab === "leads" && (
          <div className="surface rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead><tr className="border-b border-[var(--border)]">
                  <th className="px-3 py-2 text-[9px] font-semibold text-[var(--text-dim)] uppercase">Email</th>
                  <th className="px-3 py-2 text-[9px] font-semibold text-[var(--text-dim)] uppercase">Scanned URL</th>
                  <th className="px-3 py-2 text-[9px] font-semibold text-[var(--text-dim)] uppercase">Score</th>
                  <th className="px-3 py-2 text-[9px] font-semibold text-[var(--text-dim)] uppercase">Date</th>
                </tr></thead>
                <tbody>
                  {leads.map((l, i) => (
                    <tr key={i} className="border-b border-[var(--border)]">
                      <td className="px-3 py-2 text-xs text-[var(--text)]">{l.email}</td>
                      <td className="px-3 py-2 text-xs text-[var(--text-secondary)] truncate max-w-[200px]">{l.scannedUrl}</td>
                      <td className="px-3 py-2 text-xs font-mono text-[var(--text-dim)]">{l.score}</td>
                      <td className="px-3 py-2 text-[10px] text-[var(--text-dim)]">{new Date(l.submittedAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ═══ PROSPECTS ═══ */}
        {tab === "prospects" && (
          <>
            <div className="surface rounded-xl p-4 mb-4">
              <div className="flex gap-2 mb-3">
                <input type="text" value={addProspectUrl} onChange={(e) => setAddProspectUrl(e.target.value)} placeholder="Add store URL..."
                  className="flex-1 rounded-lg bg-[var(--bg)] border border-[var(--border-light)] px-3 py-2 text-sm text-white placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--accent-border)]" />
                <button onClick={async () => { if (!addProspectUrl.trim() || addingProspect) return; setAddingProspect(true); await fetch("/api/admin/prospects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: addProspectUrl }) }); setAddProspectUrl(""); setAddingProspect(false); loadData(); }}
                  disabled={addingProspect} className="px-4 py-2 rounded-lg btn-primary text-xs cursor-pointer shrink-0">{addingProspect ? "Scanning..." : "Add"}</button>
              </div>
              <details className="text-[10px] text-[var(--text-dim)]">
                <summary className="cursor-pointer hover:text-[var(--text-secondary)]">Bulk import</summary>
                <textarea value={importUrls} onChange={(e) => setImportUrls(e.target.value)} rows={3} placeholder="One URL per line..."
                  className="w-full mt-2 rounded-lg bg-[var(--bg)] border border-[var(--border-light)] px-3 py-2 text-xs text-white placeholder:text-[var(--text-dim)]" />
                <button onClick={async () => { if (!importUrls.trim() || importing) return; setImporting(true); await fetch("/api/admin/prospects/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ urls: importUrls.split("\n").filter(Boolean) }) }); setImportUrls(""); setImporting(false); loadData(); }}
                  className="mt-1 px-3 py-1.5 rounded btn-secondary text-[10px] cursor-pointer">{importing ? "Importing..." : "Import"}</button>
              </details>
            </div>

            <div className="flex gap-1.5 mb-4 flex-wrap">
              {["", "new", "contacted", "replied", "converted", "dead"].map((s) => (
                <button key={s} onClick={() => setProspectFilter(s)}
                  className={`px-2.5 py-1 rounded-md text-[10px] font-medium cursor-pointer ${prospectFilter === s ? "bg-[var(--accent)] text-black" : "bg-[var(--bg-raised)] text-[var(--text-dim)]"}`}>{s || "All"}</button>
              ))}
            </div>

            <div className="surface rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead><tr className="border-b border-[var(--border)]">
                    <th className="px-3 py-2 text-[9px] font-semibold text-[var(--text-dim)] uppercase">Score</th>
                    <th className="px-3 py-2 text-[9px] font-semibold text-[var(--text-dim)] uppercase">Store</th>
                    <th className="px-3 py-2 text-[9px] font-semibold text-[var(--text-dim)] uppercase">Email</th>
                    <th className="px-3 py-2 text-[9px] font-semibold text-[var(--text-dim)] uppercase">Platform</th>
                    <th className="px-3 py-2 text-[9px] font-semibold text-[var(--text-dim)] uppercase">Status</th>
                    <th className="px-3 py-2 text-[9px] font-semibold text-[var(--text-dim)] uppercase">Actions</th>
                  </tr></thead>
                  <tbody>
                    {(prospectFilter ? prospects.filter(p => p.status === prospectFilter) : prospects).map((p) => (
                      <tr key={p.id} className="border-b border-[var(--border)]">
                        <td className="px-3 py-2"><span className="text-base font-mono font-bold" style={{ color: (p.score || 0) >= 75 ? "var(--green)" : (p.score || 0) >= 45 ? "var(--yellow)" : "var(--red)" }}>{p.score ?? "-"}</span></td>
                        <td className="px-3 py-2"><p className="text-xs text-[var(--text)]">{p.storeName || p.url}</p><p className="text-[9px] text-[var(--text-dim)] truncate max-w-[150px]">{p.url}</p></td>
                        <td className="px-3 py-2 text-[10px] text-[var(--text-secondary)]">{p.email || "-"}</td>
                        <td className="px-3 py-2 text-[10px] text-[var(--accent)] capitalize">{p.platform || "-"}</td>
                        <td className="px-3 py-2">
                          <select value={p.status} onChange={async (e) => { await fetch("/api/admin/prospects", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: p.id, status: e.target.value }) }); loadData(); }}
                            className="bg-[var(--bg)] border border-[var(--border-light)] rounded px-1 py-0.5 text-[9px] text-white cursor-pointer">
                            {["new", "contacted", "replied", "converted", "dead"].map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex gap-2">
                            <button onClick={async () => { await fetch("/api/admin/prospects/scan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: p.id }) }); loadData(); }}
                              className="text-[9px] text-[var(--text-dim)] hover:text-[var(--accent)] cursor-pointer">Rescan</button>
                            {p.email && <button onClick={async () => { await fetch("/api/admin/email/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prospectId: p.id }) }); loadData(); }}
                              className="text-[9px] text-[var(--accent)] cursor-pointer">Outreach</button>}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* ═══ EMAIL ═══ */}
        {tab === "email" && (
          <>
            {emailStats && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                <Stat label="Queued" value={emailStats.queued} color="var(--accent)" />
                <Stat label="Sent" value={emailStats.sent} />
                <Stat label="Open Rate" value={`${emailStats.openRate}%`} color="var(--green)" sub={`${emailStats.opened} opened`} />
                <Stat label="Click Rate" value={`${emailStats.clickRate}%`} color="var(--accent)" sub={`${emailStats.clicked} clicked, ${emailStats.bounced} bounced`} />
              </div>
            )}
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="surface rounded-xl overflow-hidden">
                <div className="px-3 py-2 border-b border-[var(--border)]"><p className="text-[9px] font-semibold text-[var(--text-dim)] uppercase">Queue ({emailQueue.filter(q => q.status === "pending").length} pending)</p></div>
                {emailQueue.length === 0 ? <p className="px-3 py-6 text-center text-xs text-[var(--text-dim)]">Empty</p> : (
                  <div className="max-h-64 overflow-y-auto">
                    {emailQueue.slice(0, 30).map((q) => (
                      <div key={q.id} className="px-3 py-2 border-b border-[var(--border)] flex items-center gap-2">
                        <div className="flex-1 min-w-0"><p className="text-[10px] text-[var(--text)] truncate">{q.recipient_email}</p><p className="text-[9px] text-[var(--text-dim)] truncate">{q.subject}</p></div>
                        <span className={`text-[8px] px-1.5 py-0.5 rounded-full ${q.status === "pending" ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "bg-[rgba(255,255,255,0.04)] text-[var(--text-dim)]"}`}>{q.status}</span>
                        {q.status === "pending" && <button onClick={async () => { await fetch("/api/admin/email/cancel", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: q.id }) }); loadData(); }}
                          className="text-[8px] text-[var(--red)] cursor-pointer">X</button>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="surface rounded-xl overflow-hidden">
                <div className="px-3 py-2 border-b border-[var(--border)]"><p className="text-[9px] font-semibold text-[var(--text-dim)] uppercase">Sent log ({emailLog.length})</p></div>
                {emailLog.length === 0 ? <p className="px-3 py-6 text-center text-xs text-[var(--text-dim)]">No emails sent</p> : (
                  <div className="max-h-64 overflow-y-auto">
                    {emailLog.slice(0, 30).map((l) => (
                      <div key={l.id} className="px-3 py-2 border-b border-[var(--border)] flex items-center gap-2">
                        <div className="flex-1 min-w-0"><p className="text-[10px] text-[var(--text)] truncate">{l.recipient_email}</p><p className="text-[9px] text-[var(--text-dim)] truncate">{l.subject}</p></div>
                        <span className={`text-[8px] px-1.5 py-0.5 rounded-full ${l.status === "opened" ? "bg-[var(--green-soft)] text-[var(--green)]" : l.status === "clicked" ? "bg-[var(--accent-soft)] text-[var(--accent)]" : l.status === "bounced" ? "bg-[var(--red-soft)] text-[var(--red)]" : "bg-[rgba(255,255,255,0.04)] text-[var(--text-dim)]"}`}>{l.status}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* ═══ SYSTEM ═══ */}
        {tab === "system" && stats && (
          <>
            <h2 className="text-lg font-bold text-white mb-4">System Health</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
              <Stat label="Database Tables" value="11" />
              <Stat label="API Routes" value="37" />
              <Stat label="Email Queue" value={stats.queuedEmails} color={stats.queuedEmails > 10 ? "var(--yellow)" : "var(--green)"} />
              <Stat label="Avg Scan Score" value={stats.avgScore} color={stats.avgScore >= 60 ? "var(--green)" : "var(--yellow)"} />
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
              <Stat label="Total Scans" value={stats.totalScans} />
              <Stat label="Monitored Stores" value={stats.totalStores} />
              <Stat label="API Keys" value={stats.apiKeyCount} />
              <Stat label="Webhooks" value={stats.webhookCount} />
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <Stat label="Verified Emails" value={stats.verifiedUsers} sub={`of ${stats.totalUsers} users`} />
              <Stat label="Total Prospects" value={stats.totalProspects} />
              <Stat label="Emails Sent" value={stats.sentEmails} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
