"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import type { DeepScanResult, ActionItem } from "@/lib/deep-scanner";

interface UserData { id: string; email: string; plan?: string; subscriptionStatus?: string; }
interface ScanRecord { url: string; score: number; grade: string; scannedAt: string; resultJson: string; }

const PLATFORM_LABELS: Record<string, string> = { shopify: "Shopify", woocommerce: "WooCommerce", bigcommerce: "BigCommerce", magento: "Magento", squarespace: "Squarespace", wix: "Wix", custom: "Custom", unknown: "Unknown" };
const PLAN_NAMES: Record<string, string> = { growth: "Growth", business: "Business", enterprise: "Enterprise", starter: "Starter", pro: "Pro", agency: "Agency" };

/* ─────── Stat Card ─────── */
function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="surface rounded-xl p-5">
      <p className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-widest mb-2">{label}</p>
      <p className="text-2xl font-bold font-mono tabular-nums" style={{ color: color || "white" }}>{value}</p>
      {sub && <p className="text-[11px] text-[var(--text-dim)] mt-1">{sub}</p>}
    </div>
  );
}

/* ─────── Donut Chart ─────── */
function DonutChart({ categories }: { categories: DeepScanResult["aggregatedCategories"] }) {
  const total = categories.reduce((s, c) => s + c.maxScore, 0);
  let offset = 0;
  const r = 60, circ = 2 * Math.PI * r;

  return (
    <div className="relative w-40 h-40 mx-auto">
      <svg viewBox="0 0 140 140" className="w-full h-full -rotate-90">
        <circle cx="70" cy="70" r={r} stroke="rgba(255,255,255,0.04)" strokeWidth="14" fill="none" />
        {categories.map((cat, i) => {
          const pct = total > 0 ? cat.score / total : 0;
          const len = pct * circ;
          const color = (cat.score / cat.maxScore) >= 0.7 ? "var(--green)" : (cat.score / cat.maxScore) >= 0.4 ? "var(--yellow)" : "var(--red)";
          const seg = (
            <circle key={i} cx="70" cy="70" r={r} stroke={color} strokeWidth="14" fill="none"
              strokeDasharray={`${len} ${circ - len}`} strokeDashoffset={-offset}
              style={{ opacity: 0.85 }} />
          );
          offset += len;
          return seg;
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <p className="text-[10px] text-[var(--text-dim)] uppercase tracking-wider">Score</p>
      </div>
    </div>
  );
}

/* ─────── Area Chart ─────── */
function AreaChart({ scans }: { scans: ScanRecord[] }) {
  const recent = scans.slice(0, 30).reverse();
  if (recent.length < 2) return null;

  const h = 100, w = 500, pad = 20;
  const innerW = w - pad * 2;
  const step = innerW / (recent.length - 1);
  const minScore = Math.max(0, Math.min(...recent.map(s => s.score)) - 10);
  const maxScore = Math.min(100, Math.max(...recent.map(s => s.score)) + 10);
  const range = maxScore - minScore || 1;

  const pts = recent.map((s, i) => ({
    x: pad + i * step,
    y: pad + (1 - (s.score - minScore) / range) * (h - pad * 2),
    score: s.score,
    date: new Date(s.scannedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
  }));

  const line = pts.map(p => `${p.x},${p.y}`).join(" ");
  const area = `${pts[0].x},${h - pad} ${line} ${pts[pts.length - 1].x},${h - pad}`;

  return (
    <div className="surface rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-widest">Score Trend</p>
        <div className="flex items-center gap-3 text-[10px] text-[var(--text-dim)]">
          <span>Low: {Math.min(...recent.map(s => s.score))}</span>
          <span>High: {Math.max(...recent.map(s => s.score))}</span>
        </div>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" preserveAspectRatio="xMidYMid meet">
        {/* Grid lines */}
        {[0.25, 0.5, 0.75].map((p, i) => (
          <line key={i} x1={pad} y1={pad + p * (h - pad * 2)} x2={w - pad} y2={pad + p * (h - pad * 2)}
            stroke="rgba(255,255,255,0.04)" strokeWidth="0.5" />
        ))}
        {/* Area fill */}
        <polygon points={area} fill="url(#areaGrad)" />
        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.2" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* Line */}
        <polyline points={line} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {/* Points */}
        {pts.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="3" fill="var(--bg)" stroke="var(--accent)" strokeWidth="1.5" />
            {(i === 0 || i === pts.length - 1 || i % Math.ceil(pts.length / 5) === 0) && (
              <text x={p.x} y={h - 4} textAnchor="middle" fontSize="7" fill="var(--text-dim)" fontFamily="var(--font-mono)">{p.date}</text>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}

/* ─────── Category Bar (horizontal) ─────── */
function CategoryBars({ categories }: { categories: DeepScanResult["aggregatedCategories"] }) {
  return (
    <div className="space-y-3">
      {categories.map((cat, i) => {
        const pct = cat.maxScore > 0 ? Math.round((cat.score / cat.maxScore) * 100) : 0;
        const color = pct >= 70 ? "var(--green)" : pct >= 40 ? "var(--yellow)" : "var(--red)";
        return (
          <div key={i}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-[var(--text)]">{cat.name}</span>
              <span className="text-xs font-mono text-[var(--text-dim)] tabular-nums">{pct}%</span>
            </div>
            <div className="h-2 bg-[rgba(255,255,255,0.04)] rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─────── Action Row ─────── */
function ActionRow({ item, index }: { item: ActionItem; index: number }) {
  const [showCode, setShowCode] = useState(false);
  const [copied, setCopied] = useState(false);
  const impactColor = item.impact === "high" ? "text-[var(--red)]" : item.impact === "medium" ? "text-[var(--yellow)]" : "text-[var(--text-dim)]";
  const impactBg = item.impact === "high" ? "bg-[var(--red-soft)]" : item.impact === "medium" ? "bg-[var(--yellow-soft)]" : "bg-[rgba(255,255,255,0.03)]";

  return (
    <div className="border-b border-[var(--border)] last:border-0 py-4 px-1">
      <div className="flex items-start gap-3">
        <span className="text-xs text-[var(--text-dim)] tabular-nums font-mono w-5 pt-0.5 shrink-0">{index + 1}</span>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${impactBg} ${impactColor}`}>{item.impact}</span>
            <span className="text-[10px] text-[var(--text-dim)]">~{item.estimatedPoints} pts</span>
            <span className="text-[10px] text-[var(--text-dim)]">{item.category}</span>
            {item.platform && <span className="text-[10px] text-[var(--accent)]">{PLATFORM_LABELS[item.platform] || item.platform}</span>}
          </div>
          <p className="text-[13px] text-[var(--text)]">{item.fix}</p>
          {item.code && (
            <button onClick={() => setShowCode(!showCode)} className="text-[11px] text-[var(--accent)] hover:underline mt-1.5 cursor-pointer">
              {showCode ? "Hide code" : "Show fix code"}
            </button>
          )}
          {showCode && item.code && (
            <div className="mt-2 relative">
              <pre className="text-[11px] leading-relaxed bg-[var(--bg)] border border-[var(--border)] rounded-lg p-4 overflow-x-auto text-[var(--text-secondary)]">{item.code}</pre>
              <button onClick={() => { navigator.clipboard.writeText(item.code!); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
                className="absolute top-2 right-2 text-[10px] text-[var(--text-dim)] hover:text-[var(--accent)] bg-[var(--bg-elevated)] px-2 py-1 rounded border border-[var(--border)] cursor-pointer">
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─────── Page Breakdown ─────── */
function PageBreakdown({ result }: { result: DeepScanResult }) {
  return (
    <div className="surface rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between">
        <p className="text-xs font-semibold text-[var(--text-dim)] uppercase tracking-widest">Pages ({result.totalPages})</p>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--accent-soft)] border border-[var(--accent-border)] text-[var(--accent)]">{PLATFORM_LABELS[result.platform]}</span>
      </div>
      {result.pages.map((page, i) => {
        const color = page.result.overallScore >= 75 ? "var(--green)" : page.result.overallScore >= 45 ? "var(--yellow)" : "var(--red)";
        return (
          <div key={i} className="px-5 py-3 flex items-center gap-4 border-b border-[var(--border)] last:border-0 hover:bg-[rgba(255,255,255,0.015)] transition">
            <span className="text-lg font-mono font-bold tabular-nums w-10" style={{ color }}>{page.result.overallScore}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-[var(--text)] truncate">{page.url}</p>
            </div>
            <span className="text-[10px] text-[var(--text-dim)] px-2 py-0.5 rounded bg-[rgba(255,255,255,0.04)]">{page.type}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ═══════ Main Dashboard ═══════ */
function DashboardInner() {
  const searchParams = useSearchParams();
  const justUpgraded = searchParams.get("upgraded") === "true";
  const [user, setUser] = useState<UserData | null>(null);
  const [scans, setScans] = useState<ScanRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanUrl, setScanUrl] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState("");
  const [viewResult, setViewResult] = useState<DeepScanResult | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "actions" | "pages" | "compare">("overview");
  const [portalLoading, setPortalLoading] = useState(false);
  const [navSection, setNavSection] = useState<"scan" | "history" | "compare">("scan");

  const [freeScanUrl, setFreeScanUrl] = useState("");
  const [freeScanning, setFreeScanning] = useState(false);
  const [freeScanResult, setFreeScanResult] = useState<{ overallScore: number; grade: string; categories: Array<{ name: string; score: number; maxScore: number; status: string }> } | null>(null);
  const [freeScanError, setFreeScanError] = useState("");

  const [compMyUrl, setCompMyUrl] = useState("");
  const [compTheirUrl, setCompTheirUrl] = useState("");
  const [comparing, setComparing] = useState(false);
  const [compResult, setCompResult] = useState<Record<string, unknown> | null>(null);
  const [compError, setCompError] = useState("");

  const isActive = user?.subscriptionStatus === "active" || user?.subscriptionStatus === "trialing";
  const canCompare = isActive && ["pro", "agency", "business", "enterprise"].includes(user?.plan || "");
  const isFree = !isActive && !justUpgraded;

  const loadData = useCallback(async () => {
    try {
      const meRes = await fetch("/api/auth/me");
      if (!meRes.ok) { window.location.href = "/login"; return; }
      const userData = await meRes.json();
      setUser(userData);
      if (userData.subscriptionStatus === "active" || userData.subscriptionStatus === "trialing") {
        try { const r = await fetch("/api/dashboard/scans"); if (r.ok) setScans(await r.json()); } catch {}
      }
    } catch { window.location.href = "/login"; }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (!justUpgraded || isActive) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/auth/me");
        if (res.ok) {
          const data = await res.json();
          if (data.subscriptionStatus === "active" || data.subscriptionStatus === "trialing") {
            setUser(data); clearInterval(interval); window.history.replaceState({}, "", "/dashboard"); loadData();
          }
        }
      } catch {}
    }, 3000);
    return () => clearInterval(interval);
  }, [justUpgraded, isActive, loadData]);

  async function handleScan(e: React.FormEvent) {
    e.preventDefault();
    if (!scanUrl.trim() || scanning) return;
    setScanning(true); setScanError(""); setViewResult(null);
    try {
      const res = await fetch("/api/dashboard/scan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: scanUrl.trim() }) });
      const data = await res.json();
      if (!res.ok) { setScanError(data.error); return; }
      setViewResult(data); setActiveTab("overview"); setScanUrl(""); loadData();
    } catch { setScanError("Scan failed."); }
    finally { setScanning(false); }
  }

  async function handleFreeScan(e: React.FormEvent) {
    e.preventDefault();
    if (!freeScanUrl.trim() || freeScanning) return;
    setFreeScanning(true); setFreeScanError(""); setFreeScanResult(null);
    try {
      const res = await fetch("/api/scan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: freeScanUrl.trim() }) });
      const data = await res.json();
      if (!res.ok) { setFreeScanError(data.error); return; }
      setFreeScanResult(data);
    } catch { setFreeScanError("Scan failed. Check the URL and try again."); }
    finally { setFreeScanning(false); }
  }

  async function handleCompare(e: React.FormEvent) {
    e.preventDefault();
    if (!compMyUrl.trim() || !compTheirUrl.trim() || comparing) return;
    setComparing(true); setCompError(""); setCompResult(null);
    try {
      const res = await fetch("/api/dashboard/compare", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ myUrl: compMyUrl.trim(), competitorUrl: compTheirUrl.trim() }) });
      const data = await res.json();
      if (!res.ok) { setCompError(data.error); return; }
      setCompResult(data);
    } catch { setCompError("Comparison failed."); }
    finally { setComparing(false); }
  }

  async function handleExport() {
    if (!viewResult) return;
    const res = await fetch("/api/dashboard/export", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scanData: viewResult, whiteLabel: user?.plan === "agency" || user?.plan === "enterprise" }) });
    const html = await res.text();
    const blob = new Blob([html], { type: "text/html" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `agentready-report-${Date.now()}.html`; a.click();
  }

  async function openPortal() {
    setPortalLoading(true);
    try { const r = await fetch("/api/stripe/portal", { method: "POST" }); const d = await r.json(); if (d.url) window.location.href = d.url; } catch {} finally { setPortalLoading(false); }
  }

  async function logout() { await fetch("/api/auth/logout", { method: "POST" }); window.location.href = "/"; }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const latestScan = scans[0];
  const latestResult: DeepScanResult | null = latestScan ? (() => { try { return JSON.parse(latestScan.resultJson); } catch { return null; } })() : null;
  const totalEstimatedGain = viewResult ? viewResult.actionPlan.reduce((s, a) => s + a.estimatedPoints, 0) : 0;
  const avgScore = scans.length > 0 ? Math.round(scans.reduce((s, sc) => s + sc.score, 0) / scans.length) : 0;
  const bestScore = scans.length > 0 ? Math.max(...scans.map(s => s.score)) : 0;
  const uniqueStores = new Set(scans.map(s => new URL(s.url).hostname)).size;

  return (
    <div className="min-h-screen flex">
      {/* ─── Sidebar ─── */}
      <aside className="w-56 shrink-0 border-r border-[var(--border)] bg-[var(--bg-raised)] hidden lg:flex flex-col">
        <div className="p-5 border-b border-[var(--border)]">
          <a href="/dashboard" className="flex items-center gap-2.5">
            <span className="w-7 h-7 rounded-md bg-[var(--accent)] flex items-center justify-center text-[11px] font-bold text-black">A</span>
            <span className="text-sm font-semibold text-white">AgentReady</span>
          </a>
        </div>
        <nav className="flex-1 p-3 space-y-0.5">
          {[
            { id: "scan" as const, label: isFree ? "Overview" : "New Scan", icon: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" },
            ...(isActive ? [{ id: "history" as const, label: "Scan History", icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" }] : []),
            ...(canCompare ? [{ id: "compare" as const, label: "Compare", icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" }] : []),
          ].map((item) => (
            <button key={item.id} onClick={() => { setNavSection(item.id); setViewResult(null); }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition cursor-pointer ${
                navSection === item.id ? "bg-[var(--bg-elevated)] text-white" : "text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-[rgba(255,255,255,0.03)]"
              }`}>
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d={item.icon} /></svg>
              {item.label}
            </button>
          ))}
        </nav>
        <div className="p-3 border-t border-[var(--border)] space-y-1">
          {isActive ? (
            <button onClick={openPortal} disabled={portalLoading}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-[rgba(255,255,255,0.03)] transition cursor-pointer">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" /></svg>
              {portalLoading ? "Loading..." : "Billing"}
            </button>
          ) : (
            <a href="/#pricing"
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-[var(--accent)] hover:bg-[var(--accent-soft)] transition">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" /></svg>
              Upgrade
            </a>
          )}
          <button onClick={logout}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-[rgba(255,255,255,0.03)] transition cursor-pointer">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" /></svg>
            Sign out
          </button>
        </div>
        <div className="px-5 py-3 border-t border-[var(--border)]">
          <p className="text-[10px] text-[var(--text-dim)] truncate">{user?.email}</p>
          <p className={`text-[10px] ${isActive ? "text-[var(--accent)]" : "text-[var(--text-dim)]"}`}>{isActive ? PLAN_NAMES[user?.plan || ""] || "Active" : "Free account"}</p>
        </div>
      </aside>

      {/* ─── Main Content ─── */}
      <div className="flex-1 min-w-0">
        {/* Mobile header */}
        <header className="lg:hidden border-b border-[var(--border)] px-5 py-3 flex items-center justify-between bg-[var(--bg-raised)]">
          <a href="/dashboard" className="flex items-center gap-2">
            <span className="w-6 h-6 rounded bg-[var(--accent)] flex items-center justify-center text-[10px] font-bold text-black">A</span>
            <span className="text-sm font-semibold text-white">AgentReady</span>
          </a>
          <div className="flex items-center gap-3">
            <button onClick={openPortal} className="text-[11px] text-[var(--text-dim)] cursor-pointer">Billing</button>
            <button onClick={logout} className="text-[11px] text-[var(--text-dim)] cursor-pointer">Sign out</button>
          </div>
        </header>

        {/* Mobile nav tabs */}
        <div className="lg:hidden flex border-b border-[var(--border)] bg-[var(--bg-raised)] px-4 overflow-x-auto">
          {[
            { id: "scan" as const, label: isFree ? "Overview" : "Scan" },
            ...(isActive ? [{ id: "history" as const, label: "History" }] : []),
            ...(canCompare ? [{ id: "compare" as const, label: "Compare" }] : []),
          ].map((t) => (
            <button key={t.id} onClick={() => { setNavSection(t.id); setViewResult(null); }}
              className={`px-4 py-2.5 text-xs font-medium border-b-2 transition cursor-pointer shrink-0 ${
                navSection === t.id ? "border-[var(--accent)] text-[var(--accent)]" : "border-transparent text-[var(--text-dim)]"
              }`}>{t.label}</button>
          ))}
        </div>

        <div className="p-5 sm:p-8 max-w-5xl">
          {/* Payment processing banner */}
          {justUpgraded && !isActive && (
            <div className="mb-6 flex items-center gap-3 px-4 py-3 rounded-xl bg-[var(--accent-soft)] border border-[var(--accent-border)]">
              <div className="w-4 h-4 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin shrink-0" />
              <p className="text-sm text-[var(--accent)]">Activating your subscription... this takes a few seconds.</p>
            </div>
          )}

          {/* ═══ SCAN SECTION ═══ */}
          {navSection === "scan" && !viewResult && isActive && (
            <>
              {/* Welcome + Stats */}
              <div className="mb-8">
                <h1 className="text-lg font-bold text-white mb-1">Welcome back</h1>
                <p className="text-sm text-[var(--text-secondary)]">Run a deep scan to check your store&apos;s AI agent readiness.</p>
              </div>

              {/* Stat cards */}
              {scans.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                  <StatCard label="Latest Score" value={String(latestScan?.score || 0)}
                    color={latestScan?.score >= 75 ? "var(--green)" : latestScan?.score >= 45 ? "var(--yellow)" : "var(--red)"}
                    sub={latestScan?.grade} />
                  <StatCard label="Average" value={String(avgScore)} sub={`across ${scans.length} scans`} />
                  <StatCard label="Best Score" value={String(bestScore)} color="var(--green)" />
                  <StatCard label="Stores" value={String(uniqueStores)} sub="unique domains" />
                </div>
              )}

              {/* Chart */}
              {scans.length >= 2 && <div className="mb-6"><AreaChart scans={scans} /></div>}

              {/* Category breakdown from latest scan */}
              {latestResult && (
                <div className="grid sm:grid-cols-2 gap-4 mb-6">
                  <div className="surface rounded-xl p-5">
                    <p className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-widest mb-4">Category Breakdown</p>
                    <CategoryBars categories={latestResult.aggregatedCategories} />
                  </div>
                  <div className="surface rounded-xl p-5 flex flex-col items-center justify-center">
                    <DonutChart categories={latestResult.aggregatedCategories} />
                    <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1">
                      {latestResult.aggregatedCategories.map((cat, i) => {
                        const pct = cat.maxScore > 0 ? Math.round((cat.score / cat.maxScore) * 100) : 0;
                        const color = pct >= 70 ? "var(--green)" : pct >= 40 ? "var(--yellow)" : "var(--red)";
                        return (
                          <div key={i} className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
                            <span className="text-[10px] text-[var(--text-dim)]">{cat.name}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Scanner input */}
              <div className="surface rounded-xl p-5">
                <p className="text-sm font-semibold text-white mb-1">Run a deep scan</p>
                <p className="text-xs text-[var(--text-secondary)] mb-3">Crawls up to 12 pages, detects your platform, and generates copy-paste fix code.</p>
                <form onSubmit={handleScan} className="flex gap-2">
                  <input type="text" value={scanUrl} onChange={(e) => setScanUrl(e.target.value)} placeholder="yourstore.com" disabled={scanning}
                    className="flex-1 rounded-lg bg-[var(--bg)] border border-[var(--border-light)] px-4 py-2.5 text-sm text-white placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--accent-border)]" />
                  <button type="submit" disabled={scanning || !scanUrl.trim()}
                    className="px-5 py-2.5 rounded-lg bg-[var(--accent)] text-black text-sm font-semibold hover:brightness-110 disabled:opacity-30 transition cursor-pointer disabled:cursor-not-allowed shrink-0">
                    {scanning ? "Scanning..." : "Scan"}
                  </button>
                </form>
                {scanError && <p className="text-xs text-[var(--red)] mt-2">{scanError}</p>}
              </div>
            </>
          )}

          {/* Free user upgrade experience */}
          {navSection === "scan" && isFree && (
            <div>
              <div className="mb-6">
                <h1 className="text-lg font-bold text-white mb-1">Welcome to AgentReady</h1>
                <p className="text-sm text-[var(--text-secondary)]">Try a free preview scan, then upgrade to unlock full reports and fix code.</p>
              </div>

              {/* Free scanner */}
              <div className="surface rounded-xl p-5 mb-6">
                <p className="text-sm font-semibold text-white mb-1">Quick scan preview</p>
                <p className="text-xs text-[var(--text-secondary)] mb-3">See your score and category grades. Upgrade for the full breakdown with fixes.</p>
                <form onSubmit={handleFreeScan} className="flex gap-2">
                  <input type="text" value={freeScanUrl} onChange={(e) => setFreeScanUrl(e.target.value)} placeholder="yourstore.com" disabled={freeScanning}
                    className="flex-1 rounded-lg bg-[var(--bg)] border border-[var(--border-light)] px-4 py-2.5 text-sm text-white placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--accent-border)]" />
                  <button type="submit" disabled={freeScanning || !freeScanUrl.trim()}
                    className="px-5 py-2.5 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-light)] text-[var(--text)] text-sm font-medium hover:bg-[rgba(255,255,255,0.06)] disabled:opacity-30 transition cursor-pointer disabled:cursor-not-allowed shrink-0">
                    {freeScanning ? "Scanning..." : "Preview"}
                  </button>
                </form>
                {freeScanError && <p className="text-xs text-[var(--red)] mt-2">{freeScanError}</p>}
              </div>

              {/* Free scan teaser results */}
              {freeScanResult && (
                <div className="surface rounded-xl p-5 mb-6 fade-up">
                  <div className="flex items-start gap-5 mb-5">
                    <div className="text-center shrink-0">
                      <div className="text-3xl font-mono font-bold" style={{ color: freeScanResult.overallScore >= 75 ? "var(--green)" : freeScanResult.overallScore >= 45 ? "var(--yellow)" : "var(--red)" }}>
                        {freeScanResult.overallScore}
                      </div>
                      <div className="text-[10px] text-[var(--text-dim)] uppercase tracking-widest mt-1">{freeScanResult.grade}</div>
                    </div>
                    <div>
                      <p className="text-sm text-white font-medium mb-2">Your store scored {freeScanResult.overallScore}/100</p>
                      <p className="text-xs text-[var(--text-secondary)]">
                        {freeScanResult.overallScore < 50 ? "AI agents can barely see your store. There are critical issues to fix." :
                         freeScanResult.overallScore < 75 ? "Agents see some of your data but miss important product details." :
                         "Your store is in decent shape, but there is room to improve."}
                      </p>
                    </div>
                  </div>

                  {/* Category grades only */}
                  <div className="space-y-2 mb-5">
                    {freeScanResult.categories.map((cat, i) => {
                      const pct = cat.maxScore > 0 ? Math.round((cat.score / cat.maxScore) * 100) : 0;
                      const color = pct >= 70 ? "var(--green)" : pct >= 40 ? "var(--yellow)" : "var(--red)";
                      const label = pct >= 70 ? "Good" : pct >= 40 ? "Needs work" : "Poor";
                      return (
                        <div key={i} className="flex items-center gap-3">
                          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color }} />
                          <span className="text-xs text-[var(--text)] flex-1">{cat.name}</span>
                          <span className="text-[11px] text-[var(--text-dim)]">{label}</span>
                          <div className="w-16 h-1.5 bg-[rgba(255,255,255,0.04)] rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Blurred details + upgrade CTA */}
                  <div className="relative mb-4">
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[var(--bg-raised)] z-10 pointer-events-none rounded-lg" />
                    <div className="blur-[3px] opacity-25 pointer-events-none select-none py-3 px-2">
                      <p className="text-xs text-[var(--text)] mb-1.5">&#10003; Found 3 JSON-LD blocks with Product schema</p>
                      <p className="text-xs text-[var(--text)] mb-1.5">&#8227; Add og:price:amount meta tags for pricing</p>
                      <p className="text-xs text-[var(--text)] mb-1.5">&#10003; sitemap.xml is accessible</p>
                      <p className="text-xs text-[var(--text)]">&#8227; Add structured review data for social proof</p>
                    </div>
                  </div>

                  <div className="text-center">
                    <p className="text-xs text-[var(--text-secondary)] mb-3">Upgrade to see every finding, get fix code, and track your score over time.</p>
                    <a href="/signup?plan=growth" className="inline-block px-5 py-2.5 rounded-lg bg-[var(--accent)] text-black text-sm font-semibold hover:brightness-110 transition">Unlock full report</a>
                  </div>
                </div>
              )}

              {/* What you get */}
              <div className="surface rounded-xl p-6 mb-6">
                <p className="text-xs font-semibold text-[var(--text-dim)] uppercase tracking-widest mb-5">What you get with a paid plan</p>
                <div className="grid sm:grid-cols-2 gap-4">
                  {[
                    { title: "Multi-page deep scan", desc: "We crawl up to 12 pages on your store, not just the homepage.", locked: false },
                    { title: "Platform-specific fix code", desc: "Copy-paste code for Shopify, WooCommerce, and more.", locked: false },
                    { title: "Priority action plan", desc: "Every issue ranked by impact with estimated point gains.", locked: false },
                    { title: "Exportable reports", desc: "Download HTML reports to share with your dev team.", locked: false },
                    { title: "Score history and trends", desc: "Track your progress over time with visual charts.", locked: true },
                    { title: "Competitor comparison", desc: "Deep scan a competitor and see exactly where you fall behind.", locked: true },
                  ].map((f, i) => (
                    <div key={i} className="flex gap-3">
                      <div className="w-5 h-5 rounded-full bg-[var(--accent-soft)] border border-[var(--accent-border)] flex items-center justify-center shrink-0 mt-0.5">
                        <span className="text-[10px] text-[var(--accent)]">&#10003;</span>
                      </div>
                      <div>
                        <p className="text-sm text-white font-medium">{f.title} {f.locked && <span className="text-[10px] text-[var(--text-dim)] ml-1">Business+</span>}</p>
                        <p className="text-xs text-[var(--text-secondary)] mt-0.5">{f.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Pricing cards inline */}
              <div className="grid sm:grid-cols-3 gap-4 mb-6">
                {[
                  { name: "Growth", price: "$49", plan: "growth", features: ["5 stores", "Weekly rescans", "Fix code + reports"] },
                  { name: "Business", price: "$149", plan: "business", pop: true, features: ["25 stores", "Competitor comparison", "Daily monitoring"] },
                  { name: "Enterprise", price: "$399", plan: "enterprise", features: ["Unlimited stores", "White-label reports", "Priority support"] },
                ].map((tier) => (
                  <div key={tier.plan} className={`surface rounded-xl p-5 flex flex-col relative ${tier.pop ? "ring-1 ring-[var(--accent-border)]" : ""}`}>
                    {tier.pop && <span className="absolute -top-2.5 left-4 text-[9px] font-semibold uppercase tracking-wider bg-[var(--accent)] text-black px-2.5 py-0.5 rounded-full">Popular</span>}
                    <p className="text-sm font-semibold text-white">{tier.name}</p>
                    <p className="text-2xl font-bold text-white mt-1">{tier.price}<span className="text-xs text-[var(--text-dim)] font-normal">/mo</span></p>
                    <ul className="mt-3 mb-4 space-y-1.5 flex-1">
                      {tier.features.map((f, i) => (
                        <li key={i} className="text-xs text-[var(--text-secondary)] flex gap-2">
                          <span className="text-[var(--accent)] shrink-0">&#10003;</span>{f}
                        </li>
                      ))}
                    </ul>
                    <a href={`/signup?plan=${tier.plan}`}
                      className={`w-full py-2.5 rounded-lg text-sm font-medium text-center block transition ${
                        tier.pop ? "bg-[var(--accent)] text-black hover:brightness-110" : "bg-[var(--bg-elevated)] text-[var(--text)] border border-[var(--border-light)] hover:bg-[rgba(255,255,255,0.06)]"
                      }`}>Get started</a>
                  </div>
                ))}
              </div>

              <p className="text-[11px] text-[var(--text-dim)] text-center">All plans include a 7-day money-back guarantee. Cancel anytime.</p>
            </div>
          )}

          {/* ═══ SCAN RESULT VIEW ═══ */}
          {viewResult && (
            <div className="fade-up">
              <button onClick={() => setViewResult(null)} className="text-xs text-[var(--text-dim)] hover:text-[var(--text-secondary)] cursor-pointer mb-4">&larr; Back</button>

              {/* Score header */}
              <div className="surface rounded-xl p-6 mb-4">
                <div className="flex flex-col sm:flex-row items-start gap-6">
                  <div className="text-center shrink-0">
                    <div className="text-4xl font-mono font-bold" style={{ color: viewResult.overallScore >= 75 ? "var(--green)" : viewResult.overallScore >= 45 ? "var(--yellow)" : "var(--red)" }}>{viewResult.overallScore}</div>
                    <div className="text-[10px] text-[var(--text-dim)] uppercase tracking-widest mt-1">{viewResult.grade}</div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-mono text-[var(--text-secondary)] break-all mb-2">{viewResult.rootUrl}</p>
                    <div className="flex flex-wrap gap-3 text-[11px] text-[var(--text-dim)]">
                      <span className="px-2 py-0.5 rounded bg-[rgba(255,255,255,0.04)]">{viewResult.totalPages} pages</span>
                      <span className="px-2 py-0.5 rounded bg-[var(--accent-soft)] text-[var(--accent)]">{PLATFORM_LABELS[viewResult.platform]}</span>
                      <span className="px-2 py-0.5 rounded bg-[rgba(255,255,255,0.04)]">{viewResult.actionPlan.length} issues</span>
                      <span className="px-2 py-0.5 rounded bg-[rgba(255,255,255,0.04)]">~{totalEstimatedGain} pts recoverable</span>
                    </div>
                  </div>
                  <button onClick={handleExport} className="px-4 py-2 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-light)] text-xs text-[var(--text)] hover:bg-[rgba(255,255,255,0.06)] transition cursor-pointer shrink-0">Export</button>
                </div>
                <div className="mt-5"><CategoryBars categories={viewResult.aggregatedCategories} /></div>
              </div>

              {/* Tabs */}
              <div className="flex gap-1 mb-4 bg-[var(--bg-raised)] rounded-lg p-1 w-fit">
                {(["overview", "actions", "pages"] as const).map((tab) => (
                  <button key={tab} onClick={() => setActiveTab(tab)}
                    className={`px-4 py-1.5 rounded-md text-xs font-medium transition cursor-pointer ${activeTab === tab ? "bg-[var(--bg-elevated)] text-white" : "text-[var(--text-dim)] hover:text-[var(--text-secondary)]"}`}>
                    {tab === "overview" ? "Quick Wins" : tab === "actions" ? `All Fixes (${viewResult.actionPlan.length})` : "Pages"}
                  </button>
                ))}
              </div>

              {activeTab === "overview" && (
                <div className="surface rounded-xl p-5">
                  {viewResult.actionPlan.filter(a => a.impact === "high").slice(0, 5).map((a, i) => <ActionRow key={i} item={a} index={i} />)}
                  {viewResult.actionPlan.filter(a => a.impact === "high").length === 0 && (
                    <p className="text-sm text-[var(--text-dim)] py-6 text-center">No high-impact issues. Check the full list for smaller improvements.</p>
                  )}
                </div>
              )}
              {activeTab === "actions" && (
                <div className="surface rounded-xl px-4">
                  {viewResult.actionPlan.map((a, i) => <ActionRow key={i} item={a} index={i} />)}
                </div>
              )}
              {activeTab === "pages" && <PageBreakdown result={viewResult} />}
            </div>
          )}

          {/* ═══ HISTORY SECTION ═══ */}
          {navSection === "history" && !viewResult && (
            <>
              <h2 className="text-lg font-bold text-white mb-4">Scan History</h2>
              {scans.length >= 2 && <div className="mb-6"><AreaChart scans={scans} /></div>}
              <div className="surface rounded-xl overflow-hidden">
                {scans.length === 0 ? (
                  <div className="px-6 py-16 text-center">
                    <p className="text-sm text-[var(--text-dim)]">No scans yet. Run your first scan to see results here.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-[var(--border)]">
                    {scans.map((scan, i) => (
                      <button key={i} onClick={() => { try { setViewResult(JSON.parse(scan.resultJson)); setActiveTab("overview"); } catch {} }}
                        className="w-full px-5 py-3.5 flex items-center gap-4 hover:bg-[rgba(255,255,255,0.02)] transition cursor-pointer text-left">
                        <span className="text-xl font-mono font-bold tabular-nums w-12" style={{ color: scan.score >= 75 ? "var(--green)" : scan.score >= 45 ? "var(--yellow)" : "var(--red)" }}>{scan.score}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-[var(--text)] truncate">{scan.url}</p>
                          <p className="text-[11px] text-[var(--text-dim)]">{new Date(scan.scannedAt).toLocaleString()}</p>
                        </div>
                        <span className="text-xs text-[var(--text-dim)]">{scan.grade}</span>
                        <svg className="w-4 h-4 text-[var(--text-dim)]" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* ═══ COMPARE SECTION ═══ */}
          {navSection === "compare" && canCompare && (
            <>
              <h2 className="text-lg font-bold text-white mb-1">Competitor Comparison</h2>
              <p className="text-sm text-[var(--text-secondary)] mb-6">Deep scan two stores side by side and see exactly where you fall behind.</p>

              <div className="surface rounded-xl p-5 mb-6">
                <form onSubmit={handleCompare} className="space-y-3">
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] text-[var(--text-dim)] uppercase tracking-wider block mb-1.5">Your store</label>
                      <input type="text" value={compMyUrl} onChange={(e) => setCompMyUrl(e.target.value)} placeholder="yourstore.com"
                        className="w-full rounded-lg bg-[var(--bg)] border border-[var(--border-light)] px-4 py-2.5 text-sm text-white placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--accent-border)]" />
                    </div>
                    <div>
                      <label className="text-[10px] text-[var(--text-dim)] uppercase tracking-wider block mb-1.5">Competitor</label>
                      <input type="text" value={compTheirUrl} onChange={(e) => setCompTheirUrl(e.target.value)} placeholder="competitor.com"
                        className="w-full rounded-lg bg-[var(--bg)] border border-[var(--border-light)] px-4 py-2.5 text-sm text-white placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--accent-border)]" />
                    </div>
                  </div>
                  <button type="submit" disabled={comparing || !compMyUrl.trim() || !compTheirUrl.trim()}
                    className="px-5 py-2.5 rounded-lg bg-[var(--accent)] text-black text-sm font-semibold hover:brightness-110 disabled:opacity-30 transition cursor-pointer disabled:cursor-not-allowed">
                    {comparing ? "Scanning both stores..." : "Run comparison"}
                  </button>
                </form>
                {compError && <p className="text-xs text-[var(--red)] mt-2">{compError}</p>}
              </div>

              {compResult && (
                <div className="fade-up space-y-4">
                  {/* Score cards */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="surface rounded-xl p-6 text-center">
                      <p className="text-[10px] text-[var(--text-dim)] uppercase tracking-wider mb-2">Your store</p>
                      <p className="text-4xl font-mono font-bold" style={{ color: (compResult.you as { score: number }).score >= 75 ? "var(--green)" : "var(--yellow)" }}>
                        {(compResult.you as { score: number }).score}
                      </p>
                      <p className="text-xs text-[var(--text-dim)] mt-2 truncate">{(compResult.you as { url: string }).url}</p>
                      <span className="text-[10px] text-[var(--accent)]">{PLATFORM_LABELS[(compResult.you as { platform: string }).platform]}</span>
                    </div>
                    <div className="surface rounded-xl p-6 text-center">
                      <p className="text-[10px] text-[var(--text-dim)] uppercase tracking-wider mb-2">Competitor</p>
                      <p className="text-4xl font-mono font-bold" style={{ color: (compResult.competitor as { score: number }).score >= 75 ? "var(--green)" : "var(--yellow)" }}>
                        {(compResult.competitor as { score: number }).score}
                      </p>
                      <p className="text-xs text-[var(--text-dim)] mt-2 truncate">{(compResult.competitor as { url: string }).url}</p>
                      <span className="text-[10px] text-[var(--accent)]">{PLATFORM_LABELS[(compResult.competitor as { platform: string }).platform]}</span>
                    </div>
                  </div>

                  {/* Diff badge */}
                  <div className="text-center">
                    {(compResult.scoreDiff as number) > 0 ? (
                      <span className="text-sm px-3 py-1 rounded-full bg-[var(--red-soft)] text-[var(--red)]">They lead by {compResult.scoreDiff as number} points</span>
                    ) : (compResult.scoreDiff as number) < 0 ? (
                      <span className="text-sm px-3 py-1 rounded-full bg-[var(--green-soft)] text-[var(--green)]">You lead by {Math.abs(compResult.scoreDiff as number)} points</span>
                    ) : (
                      <span className="text-sm px-3 py-1 rounded-full bg-[rgba(255,255,255,0.05)] text-[var(--text-secondary)]">Tied</span>
                    )}
                  </div>

                  {/* Category gaps */}
                  <div className="surface rounded-xl overflow-hidden">
                    <div className="px-5 py-3 border-b border-[var(--border)]">
                      <p className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-widest">Category Comparison</p>
                    </div>
                    {(compResult.gaps as Array<{ category: string; you: number; competitor: number; gap: number }>)?.map((gap, i) => (
                      <div key={i} className="px-5 py-3 flex items-center gap-4 border-b border-[var(--border)] last:border-0">
                        <span className="text-xs text-[var(--text)] w-32 shrink-0">{gap.category}</span>
                        <div className="flex-1 flex items-center gap-2">
                          <span className="text-xs font-mono w-10 text-right tabular-nums" style={{ color: gap.you >= gap.competitor ? "var(--green)" : "var(--text-dim)" }}>{gap.you}%</span>
                          <div className="flex-1 h-2 bg-[rgba(255,255,255,0.04)] rounded-full relative overflow-hidden">
                            <div className="absolute left-0 h-full rounded-full bg-[var(--accent)] transition-all" style={{ width: `${gap.you}%` }} />
                          </div>
                          <div className="flex-1 h-2 bg-[rgba(255,255,255,0.04)] rounded-full relative overflow-hidden">
                            <div className="absolute left-0 h-full rounded-full bg-[var(--text-secondary)] transition-all" style={{ width: `${gap.competitor}%` }} />
                          </div>
                          <span className="text-xs font-mono w-10 tabular-nums" style={{ color: gap.competitor >= gap.you ? "var(--green)" : "var(--text-dim)" }}>{gap.competitor}%</span>
                        </div>
                        <span className={`text-[10px] font-mono w-8 text-right ${gap.gap > 0 ? "text-[var(--red)]" : gap.gap < 0 ? "text-[var(--green)]" : "text-[var(--text-dim)]"}`}>
                          {gap.gap > 0 ? `-${gap.gap}` : gap.gap < 0 ? `+${Math.abs(gap.gap)}` : "0"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="w-6 h-6 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" /></div>}>
      <DashboardInner />
    </Suspense>
  );
}
