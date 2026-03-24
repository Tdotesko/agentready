"use client";

import { useState, useEffect, useCallback } from "react";

interface Stats {
  totalUsers: number;
  activeSubscriptions: number;
  totalScans: number;
  totalLeads: number;
  revenueByPlan: { plan: string; count: number }[];
  recentSignups: { id: string; email: string; plan?: string; subscriptionStatus?: string; isAdmin: boolean; createdAt: string }[];
  scansByDay: { date: string; count: number }[];
}

interface UserRecord {
  id: string; email: string; plan?: string; subscriptionStatus?: string; stripeCustomerId?: string; isAdmin: boolean; createdAt: string;
}

interface LeadRecord { email: string; scannedUrl: string; score: number; submittedAt: string; }
interface ScanRecord { userId: string; url: string; score: number; grade: string; scannedAt: string; }
interface ProspectRecord { id: number; url: string; email: string | null; storeName: string | null; platform: string | null; score: number | null; grade: string | null; status: string; source: string | null; notes: string | null; lastContactedAt: string | null; createdAt: string; }
interface EmailStats { queued: number; sent: number; opened: number; clicked: number; bounced: number; openRate: number; clickRate: number; }
interface QueueItem { id: number; recipient_email: string; subject: string; status: string; send_after: string; prospect_id: number | null; }
interface LogItem { id: number; recipient_email: string; subject: string; status: string; sent_at: string; }

const PLAN_PRICES: Record<string, number> = { growth: 49, business: 149, enterprise: 399, starter: 29, pro: 99, agency: 249 };

/* ── Stat Card ── */
function Stat({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="surface rounded-xl p-5">
      <p className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-widest mb-2">{label}</p>
      <p className="text-2xl font-bold font-mono tabular-nums" style={{ color: color || "white" }}>{value}</p>
      {sub && <p className="text-[11px] text-[var(--text-dim)] mt-1">{sub}</p>}
    </div>
  );
}

/* ── Activity Chart ── */
function ActivityChart({ data }: { data: { date: string; count: number }[] }) {
  if (data.length < 2) return null;
  const h = 80, w = 500, pad = 10;
  const maxCount = Math.max(...data.map(d => d.count), 1);
  const barW = (w - pad * 2) / data.length - 2;

  return (
    <svg viewBox={`0 0 ${w} ${h + 20}`} className="w-full" preserveAspectRatio="xMidYMid meet">
      {data.map((d, i) => {
        const barH = (d.count / maxCount) * h;
        const x = pad + i * ((w - pad * 2) / data.length);
        return (
          <g key={i}>
            <rect x={x} y={h - barH} width={barW} height={barH} rx="2" fill="var(--accent)" opacity="0.7" />
            {i % Math.ceil(data.length / 7) === 0 && (
              <text x={x + barW / 2} y={h + 14} textAnchor="middle" fontSize="7" fill="var(--text-dim)" fontFamily="var(--font-mono)">
                {new Date(d.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/* ── Main Admin Page ── */
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
  const [tab, setTab] = useState<"overview" | "users" | "scans" | "leads" | "prospects" | "email">("overview");
  const [addProspectUrl, setAddProspectUrl] = useState("");
  const [addingProspect, setAddingProspect] = useState(false);
  const [importUrls, setImportUrls] = useState("");
  const [importing, setImporting] = useState(false);
  const [prospectFilter, setProspectFilter] = useState("");
  const [search, setSearch] = useState("");
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [editPlan, setEditPlan] = useState("");
  const [editStatus, setEditStatus] = useState("");

  const loadData = useCallback(async () => {
    try {
      const meRes = await fetch("/api/auth/me");
      if (!meRes.ok) { window.location.href = "/login"; return; }
      const me = await meRes.json();
      if (!me.isAdmin) { window.location.href = "/dashboard"; return; }
      setAuthorized(true);

      const [statsRes, usersRes, leadsRes, scansRes, prospectsRes, emailRes] = await Promise.all([
        fetch("/api/admin/stats"),
        fetch("/api/admin/users"),
        fetch("/api/admin/leads"),
        fetch("/api/admin/scans"),
        fetch("/api/admin/prospects"),
        fetch("/api/admin/email/stats"),
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
    await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, plan: editPlan || undefined, subscriptionStatus: editStatus || undefined }),
    });
    setEditingUser(null);
    loadData();
  }

  async function toggleAdmin(userId: string, current: boolean) {
    await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, isAdmin: !current }),
    });
    loadData();
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="w-6 h-6 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" /></div>;
  if (!authorized) return null;

  const mrr = stats?.revenueByPlan.reduce((sum, r) => sum + (PLAN_PRICES[r.plan] || 0) * r.count, 0) || 0;
  const filteredUsers = search ? users.filter(u => u.email.toLowerCase().includes(search.toLowerCase())) : users;

  return (
    <div className="min-h-screen">
      {/* Nav */}
      <nav className="border-b border-[var(--border)] px-6 py-3 sticky top-0 bg-[var(--bg)]/80 backdrop-blur-xl z-50">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a href="/dashboard" className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-md bg-[var(--accent)] flex items-center justify-center text-[11px] font-bold text-black">C</span>
              <span className="text-sm font-semibold text-white">CartParse</span>
            </a>
            <span className="text-[10px] px-2 py-0.5 rounded bg-red-500/20 text-red-400 font-semibold uppercase tracking-wider">Admin</span>
          </div>
          <a href="/dashboard" className="text-xs text-[var(--text-dim)] hover:text-[var(--text)] transition">Back to dashboard</a>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Tabs */}
        <div className="flex gap-1 mb-8 bg-[var(--bg-raised)] rounded-lg p-1 w-fit">
          {(["overview", "prospects", "email", "users", "scans", "leads"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-md text-xs font-medium transition cursor-pointer ${tab === t ? "bg-[var(--bg-elevated)] text-white" : "text-[var(--text-dim)] hover:text-[var(--text-secondary)]"}`}>
              {t === "overview" ? "Overview" : t === "prospects" ? `Prospects (${prospects.length})` : t === "email" ? "Email" : t === "users" ? `Users (${users.length})` : t === "scans" ? `Scans (${scans.length})` : `Leads (${leads.length})`}
            </button>
          ))}
        </div>

        {/* ═══ OVERVIEW ═══ */}
        {tab === "overview" && stats && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
              <Stat label="Total Users" value={stats.totalUsers} />
              <Stat label="Active Subs" value={stats.activeSubscriptions} color="var(--green)" />
              <Stat label="MRR" value={`$${mrr.toLocaleString()}`} color="var(--accent)" sub="Monthly recurring revenue" />
              <Stat label="Total Scans" value={stats.totalScans} />
            </div>

            <div className="grid sm:grid-cols-2 gap-4 mb-8">
              <div className="surface rounded-xl p-5">
                <p className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-widest mb-3">Scans (last 30 days)</p>
                <ActivityChart data={stats.scansByDay} />
              </div>
              <div className="surface rounded-xl p-5">
                <p className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-widest mb-3">Revenue breakdown</p>
                {stats.revenueByPlan.length === 0 ? (
                  <p className="text-sm text-[var(--text-dim)] py-4">No active subscriptions yet.</p>
                ) : (
                  <div className="space-y-3">
                    {stats.revenueByPlan.map((r) => (
                      <div key={r.plan} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-white font-medium capitalize">{r.plan}</span>
                          <span className="text-xs text-[var(--text-dim)]">{r.count} sub{r.count !== 1 && "s"}</span>
                        </div>
                        <span className="text-sm font-mono text-[var(--accent)]">${(PLAN_PRICES[r.plan] || 0) * r.count}/mo</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="surface rounded-xl p-5">
                <p className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-widest mb-3">Recent signups</p>
                {stats.recentSignups.map((u) => (
                  <div key={u.id} className="flex items-center justify-between py-2 border-b border-[var(--border)] last:border-0">
                    <div>
                      <p className="text-sm text-[var(--text)]">{u.email}</p>
                      <p className="text-[10px] text-[var(--text-dim)]">{new Date(u.createdAt).toLocaleDateString()}</p>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${u.subscriptionStatus === "active" ? "bg-[var(--green-soft)] text-[var(--green)]" : "bg-[rgba(255,255,255,0.04)] text-[var(--text-dim)]"}`}>
                      {u.plan || "free"}
                    </span>
                  </div>
                ))}
              </div>
              <div className="surface rounded-xl p-5">
                <p className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-widest mb-3">Quick stats</p>
                <div className="space-y-3">
                  <div className="flex justify-between"><span className="text-sm text-[var(--text-secondary)]">Total leads captured</span><span className="text-sm font-mono text-white">{stats.totalLeads}</span></div>
                  <div className="flex justify-between"><span className="text-sm text-[var(--text-secondary)]">Conversion rate</span><span className="text-sm font-mono text-white">{stats.totalUsers > 0 ? Math.round((stats.activeSubscriptions / stats.totalUsers) * 100) : 0}%</span></div>
                  <div className="flex justify-between"><span className="text-sm text-[var(--text-secondary)]">Avg scans per user</span><span className="text-sm font-mono text-white">{stats.totalUsers > 0 ? (stats.totalScans / stats.totalUsers).toFixed(1) : 0}</span></div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ═══ USERS ═══ */}
        {tab === "users" && (
          <>
            <div className="mb-4">
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search users by email..."
                className="w-full sm:w-80 rounded-lg bg-[var(--bg-raised)] border border-[var(--border-light)] px-4 py-2.5 text-sm text-white placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--accent-border)]" />
            </div>
            <div className="surface rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-[var(--border)]">
                      <th className="px-4 py-3 text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">Email</th>
                      <th className="px-4 py-3 text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">Plan</th>
                      <th className="px-4 py-3 text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">Status</th>
                      <th className="px-4 py-3 text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">Joined</th>
                      <th className="px-4 py-3 text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((u) => (
                      <tr key={u.id} className="border-b border-[var(--border)] hover:bg-[rgba(255,255,255,0.015)] transition">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-[var(--text)]">{u.email}</span>
                            {u.isAdmin && <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 font-semibold uppercase">Admin</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {editingUser === u.id ? (
                            <select value={editPlan} onChange={(e) => setEditPlan(e.target.value)}
                              className="bg-[var(--bg)] border border-[var(--border-light)] rounded px-2 py-1 text-xs text-white">
                              <option value="">None</option>
                              <option value="growth">Growth</option>
                              <option value="business">Business</option>
                              <option value="enterprise">Enterprise</option>
                            </select>
                          ) : (
                            <span className="text-sm text-[var(--text-secondary)] capitalize">{u.plan || "free"}</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {editingUser === u.id ? (
                            <select value={editStatus} onChange={(e) => setEditStatus(e.target.value)}
                              className="bg-[var(--bg)] border border-[var(--border-light)] rounded px-2 py-1 text-xs text-white">
                              <option value="">None</option>
                              <option value="active">Active</option>
                              <option value="canceled">Canceled</option>
                              <option value="trialing">Trialing</option>
                            </select>
                          ) : (
                            <span className={`text-[10px] px-2 py-0.5 rounded-full ${u.subscriptionStatus === "active" ? "bg-[var(--green-soft)] text-[var(--green)]" : u.subscriptionStatus === "canceled" ? "bg-[var(--red-soft)] text-[var(--red)]" : "bg-[rgba(255,255,255,0.04)] text-[var(--text-dim)]"}`}>
                              {u.subscriptionStatus || "none"}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-[var(--text-dim)]">{new Date(u.createdAt).toLocaleDateString()}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {editingUser === u.id ? (
                              <>
                                <button onClick={() => handleUpdateUser(u.id)} className="text-[10px] text-[var(--green)] hover:underline cursor-pointer">Save</button>
                                <button onClick={() => setEditingUser(null)} className="text-[10px] text-[var(--text-dim)] hover:underline cursor-pointer">Cancel</button>
                              </>
                            ) : (
                              <>
                                <button onClick={() => { setEditingUser(u.id); setEditPlan(u.plan || ""); setEditStatus(u.subscriptionStatus || ""); }}
                                  className="text-[10px] text-[var(--accent)] hover:underline cursor-pointer">Edit</button>
                                <button onClick={() => toggleAdmin(u.id, u.isAdmin)}
                                  className={`text-[10px] hover:underline cursor-pointer ${u.isAdmin ? "text-[var(--red)]" : "text-[var(--text-dim)]"}`}>
                                  {u.isAdmin ? "Remove admin" : "Make admin"}
                                </button>
                              </>
                            )}
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

        {/* ═══ SCANS ═══ */}
        {tab === "scans" && (
          <div className="surface rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-[var(--border)]">
                    <th className="px-4 py-3 text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">Score</th>
                    <th className="px-4 py-3 text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">URL</th>
                    <th className="px-4 py-3 text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">Grade</th>
                    <th className="px-4 py-3 text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {scans.map((s, i) => (
                    <tr key={i} className="border-b border-[var(--border)]">
                      <td className="px-4 py-3">
                        <span className="text-lg font-mono font-bold tabular-nums" style={{ color: s.score >= 75 ? "var(--green)" : s.score >= 45 ? "var(--yellow)" : "var(--red)" }}>{s.score}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-[var(--text)] truncate max-w-[300px]">{s.url}</td>
                      <td className="px-4 py-3 text-xs text-[var(--text-dim)]">{s.grade}</td>
                      <td className="px-4 py-3 text-xs text-[var(--text-dim)]">{new Date(s.scannedAt).toLocaleString()}</td>
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
                <thead>
                  <tr className="border-b border-[var(--border)]">
                    <th className="px-4 py-3 text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">Email</th>
                    <th className="px-4 py-3 text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">Scanned URL</th>
                    <th className="px-4 py-3 text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">Score</th>
                    <th className="px-4 py-3 text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((l, i) => (
                    <tr key={i} className="border-b border-[var(--border)]">
                      <td className="px-4 py-3 text-sm text-[var(--text)]">{l.email}</td>
                      <td className="px-4 py-3 text-sm text-[var(--text-secondary)] truncate max-w-[250px]">{l.scannedUrl}</td>
                      <td className="px-4 py-3 text-sm font-mono text-[var(--text-dim)]">{l.score}</td>
                      <td className="px-4 py-3 text-xs text-[var(--text-dim)]">{new Date(l.submittedAt).toLocaleString()}</td>
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
            {/* Add prospect */}
            <div className="surface rounded-xl p-5 mb-6">
              <div className="flex flex-col sm:flex-row gap-3 mb-4">
                <div className="flex-1 flex gap-2">
                  <input type="text" value={addProspectUrl} onChange={(e) => setAddProspectUrl(e.target.value)} placeholder="Add a store URL..."
                    className="flex-1 rounded-lg bg-[var(--bg)] border border-[var(--border-light)] px-4 py-2.5 text-sm text-white placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--accent-border)]" />
                  <button onClick={async () => {
                    if (!addProspectUrl.trim() || addingProspect) return;
                    setAddingProspect(true);
                    await fetch("/api/admin/prospects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: addProspectUrl }) });
                    setAddProspectUrl("");
                    setAddingProspect(false);
                    loadData();
                  }} disabled={addingProspect || !addProspectUrl.trim()}
                    className="px-4 py-2.5 rounded-lg btn-primary text-xs cursor-pointer disabled:cursor-not-allowed shrink-0">
                    {addingProspect ? "Scanning..." : "Add + Scan"}
                  </button>
                </div>
              </div>
              {/* Bulk import */}
              <details className="text-xs">
                <summary className="text-[var(--text-dim)] cursor-pointer hover:text-[var(--text-secondary)]">Bulk import URLs</summary>
                <div className="mt-3">
                  <textarea value={importUrls} onChange={(e) => setImportUrls(e.target.value)} rows={4} placeholder="Paste URLs, one per line..."
                    className="w-full rounded-lg bg-[var(--bg)] border border-[var(--border-light)] px-4 py-2.5 text-sm text-white placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--accent-border)]" />
                  <button onClick={async () => {
                    if (!importUrls.trim() || importing) return;
                    setImporting(true);
                    const urls = importUrls.split("\n").map(u => u.trim()).filter(Boolean);
                    await fetch("/api/admin/prospects/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ urls }) });
                    setImportUrls("");
                    setImporting(false);
                    loadData();
                  }} disabled={importing}
                    className="mt-2 px-4 py-2 rounded-lg btn-secondary text-xs cursor-pointer">{importing ? "Importing..." : "Import all"}</button>
                </div>
              </details>
            </div>

            {/* Status filter */}
            <div className="flex gap-2 mb-4">
              {["", "new", "contacted", "replied", "converted", "dead"].map((s) => (
                <button key={s} onClick={() => setProspectFilter(s)}
                  className={`px-3 py-1.5 rounded-md text-[10px] font-medium cursor-pointer transition ${prospectFilter === s ? "bg-[var(--accent)] text-black" : "bg-[var(--bg-raised)] text-[var(--text-dim)] hover:text-[var(--text)]"}`}>
                  {s || "All"}
                </button>
              ))}
            </div>

            {/* Prospects table */}
            <div className="surface rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead><tr className="border-b border-[var(--border)]">
                    <th className="px-4 py-3 text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">Score</th>
                    <th className="px-4 py-3 text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">Store</th>
                    <th className="px-4 py-3 text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">Email</th>
                    <th className="px-4 py-3 text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">Platform</th>
                    <th className="px-4 py-3 text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-wider">Actions</th>
                  </tr></thead>
                  <tbody>
                    {(prospectFilter ? prospects.filter(p => p.status === prospectFilter) : prospects).map((p) => (
                      <tr key={p.id} className="border-b border-[var(--border)]">
                        <td className="px-4 py-3">
                          <span className="text-lg font-mono font-bold" style={{ color: (p.score || 0) >= 75 ? "var(--green)" : (p.score || 0) >= 45 ? "var(--yellow)" : "var(--red)" }}>{p.score ?? "-"}</span>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm text-[var(--text)]">{p.storeName || p.url}</p>
                          <p className="text-[10px] text-[var(--text-dim)] truncate max-w-[200px]">{p.url}</p>
                        </td>
                        <td className="px-4 py-3 text-xs text-[var(--text-secondary)]">{p.email || <span className="text-[var(--text-dim)]">none</span>}</td>
                        <td className="px-4 py-3 text-xs text-[var(--accent)] capitalize">{p.platform || "-"}</td>
                        <td className="px-4 py-3">
                          <select value={p.status} onChange={async (e) => {
                            await fetch("/api/admin/prospects", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: p.id, status: e.target.value }) });
                            loadData();
                          }} className="bg-[var(--bg)] border border-[var(--border-light)] rounded px-2 py-1 text-[10px] text-white cursor-pointer">
                            {["new", "contacted", "replied", "converted", "dead"].map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <button onClick={async () => { await fetch("/api/admin/prospects/scan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: p.id }) }); loadData(); }}
                              className="text-[10px] text-[var(--text-dim)] hover:text-[var(--accent)] cursor-pointer">Rescan</button>
                            {p.email && (
                              <button onClick={async () => { await fetch("/api/admin/email/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prospectId: p.id }) }); loadData(); }}
                                className="text-[10px] text-[var(--accent)] hover:underline cursor-pointer">Send outreach</button>
                            )}
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
            {/* Email stats */}
            {emailStats && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                <Stat label="Queued" value={emailStats.queued} color="var(--accent)" />
                <Stat label="Sent" value={emailStats.sent} />
                <Stat label="Open Rate" value={`${emailStats.openRate}%`} color="var(--green)" sub={`${emailStats.opened} opened`} />
                <Stat label="Click Rate" value={`${emailStats.clickRate}%`} color="var(--accent)" sub={`${emailStats.clicked} clicked`} />
              </div>
            )}

            {/* Queue */}
            <div className="surface rounded-xl overflow-hidden mb-6">
              <div className="px-4 py-3 border-b border-[var(--border)]">
                <p className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-widest">Email Queue ({emailQueue.filter(q => q.status === "pending").length} pending)</p>
              </div>
              {emailQueue.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-[var(--text-dim)]">No emails in queue.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead><tr className="border-b border-[var(--border)]">
                      <th className="px-4 py-2 text-[10px] font-semibold text-[var(--text-dim)] uppercase">To</th>
                      <th className="px-4 py-2 text-[10px] font-semibold text-[var(--text-dim)] uppercase">Subject</th>
                      <th className="px-4 py-2 text-[10px] font-semibold text-[var(--text-dim)] uppercase">Status</th>
                      <th className="px-4 py-2 text-[10px] font-semibold text-[var(--text-dim)] uppercase">Send at</th>
                      <th className="px-4 py-2 text-[10px] font-semibold text-[var(--text-dim)] uppercase">Action</th>
                    </tr></thead>
                    <tbody>
                      {emailQueue.slice(0, 50).map((q) => (
                        <tr key={q.id} className="border-b border-[var(--border)]">
                          <td className="px-4 py-2 text-xs text-[var(--text)]">{q.recipient_email}</td>
                          <td className="px-4 py-2 text-xs text-[var(--text-secondary)] truncate max-w-[200px]">{q.subject}</td>
                          <td className="px-4 py-2">
                            <span className={`text-[10px] px-2 py-0.5 rounded-full ${q.status === "pending" ? "bg-[var(--accent-soft)] text-[var(--accent)]" : q.status === "sent" ? "bg-[var(--green-soft)] text-[var(--green)]" : "bg-[rgba(255,255,255,0.04)] text-[var(--text-dim)]"}`}>{q.status}</span>
                          </td>
                          <td className="px-4 py-2 text-[10px] text-[var(--text-dim)]">{new Date(q.send_after).toLocaleString()}</td>
                          <td className="px-4 py-2">
                            {q.status === "pending" && (
                              <button onClick={async () => { await fetch("/api/admin/email/cancel", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: q.id }) }); loadData(); }}
                                className="text-[10px] text-[var(--red)] hover:underline cursor-pointer">Cancel</button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Sent log */}
            <div className="surface rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-[var(--border)]">
                <p className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-widest">Sent Email Log ({emailLog.length})</p>
              </div>
              {emailLog.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-[var(--text-dim)]">No emails sent yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead><tr className="border-b border-[var(--border)]">
                      <th className="px-4 py-2 text-[10px] font-semibold text-[var(--text-dim)] uppercase">To</th>
                      <th className="px-4 py-2 text-[10px] font-semibold text-[var(--text-dim)] uppercase">Subject</th>
                      <th className="px-4 py-2 text-[10px] font-semibold text-[var(--text-dim)] uppercase">Status</th>
                      <th className="px-4 py-2 text-[10px] font-semibold text-[var(--text-dim)] uppercase">Sent at</th>
                    </tr></thead>
                    <tbody>
                      {emailLog.slice(0, 50).map((l) => (
                        <tr key={l.id} className="border-b border-[var(--border)]">
                          <td className="px-4 py-2 text-xs text-[var(--text)]">{l.recipient_email}</td>
                          <td className="px-4 py-2 text-xs text-[var(--text-secondary)] truncate max-w-[200px]">{l.subject}</td>
                          <td className="px-4 py-2">
                            <span className={`text-[10px] px-2 py-0.5 rounded-full ${l.status === "opened" ? "bg-[var(--green-soft)] text-[var(--green)]" : l.status === "clicked" ? "bg-[var(--accent-soft)] text-[var(--accent)]" : l.status === "bounced" ? "bg-[var(--red-soft)] text-[var(--red)]" : "bg-[rgba(255,255,255,0.04)] text-[var(--text-dim)]"}`}>{l.status}</span>
                          </td>
                          <td className="px-4 py-2 text-[10px] text-[var(--text-dim)]">{new Date(l.sent_at).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
