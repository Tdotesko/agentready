"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import type { DeepScanResult, ActionItem } from "@/lib/deep-scanner";

interface UserData { id: string; email: string; plan?: string; subscriptionStatus?: string; isAdmin?: boolean; }
interface ScanRecord { url: string; score: number; grade: string; scannedAt: string; resultJson: string; }

const PLATFORM_LABELS: Record<string, string> = { shopify: "Shopify", woocommerce: "WooCommerce", bigcommerce: "BigCommerce", magento: "Magento", squarespace: "Squarespace", wix: "Wix", custom: "Custom", unknown: "Unknown" };
const PLAN_NAMES: Record<string, string> = { growth: "Growth", business: "Business", enterprise: "Enterprise", starter: "Starter", pro: "Pro", agency: "Agency" };

/* ─────── Stat Card ─────── */
function StatCard({ label, value, sub, color, tip }: { label: string; value: string; sub?: string; color?: string; tip?: string }) {
  return (
    <div className="surface rounded-xl p-5 tooltip-container">
      {tip && <span className="tooltip-text">{tip}</span>}
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
  const [navSection, setNavSection] = useState<"scan" | "history" | "compare" | "stores" | "apikeys" | "webhooks">("scan");

  const [freeScanUrl, setFreeScanUrl] = useState("");
  const [freeScanning, setFreeScanning] = useState(false);
  const [freeScanResult, setFreeScanResult] = useState<{ overallScore: number; grade: string; categories: Array<{ name: string; score: number; maxScore: number; status: string }> } | null>(null);
  const [freeScanError, setFreeScanError] = useState("");

  const [compMyUrl, setCompMyUrl] = useState("");
  const [compTheirUrl, setCompTheirUrl] = useState("");
  const [comparing, setComparing] = useState(false);
  const [compResult, setCompResult] = useState<Record<string, unknown> | null>(null);
  const [compError, setCompError] = useState("");
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [actionsVisible, setActionsVisible] = useState(10);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");

  // Stores, API keys, webhooks
  const [stores, setStores] = useState<Array<{ id: number; url: string; name: string; autoRescan: boolean; rescanInterval: string; lastScore: number | null }>>([]);
  const [apiKeys, setApiKeys] = useState<Array<{ id: number; keyPrefix: string; name: string; lastUsedAt: string | null; createdAt: string }>>([]);
  const [webhooks, setWebhooks] = useState<Array<{ id: number; url: string; events: string[]; isActive: boolean }>>([]);
  const [newStoreUrl, setNewStoreUrl] = useState("");
  const [newKeyName, setNewKeyName] = useState("");
  const [newWebhookUrl, setNewWebhookUrl] = useState("");
  const [newApiKey, setNewApiKey] = useState("");

  const isActive = user?.subscriptionStatus === "active" || user?.subscriptionStatus === "trialing" || user?.isAdmin === true;
  const canCompare = isActive && (user?.isAdmin || ["pro", "agency", "business", "enterprise"].includes(user?.plan || ""));
  const isEnterprise = user?.isAdmin || ["enterprise", "agency"].includes(user?.plan || "");
  const canWebhook = user?.isAdmin || ["business", "enterprise", "pro", "agency"].includes(user?.plan || "");
  const isFree = !isActive && !justUpgraded;

  const loadData = useCallback(async () => {
    try {
      const meRes = await fetch("/api/auth/me");
      if (!meRes.ok) { window.location.href = "/login"; return; }
      const userData = await meRes.json();
      setUser(userData);
      const isActiveUser = userData.subscriptionStatus === "active" || userData.subscriptionStatus === "trialing" || userData.isAdmin;
      if (isActiveUser) {
        try { const r = await fetch("/api/dashboard/scans"); if (r.ok) setScans(await r.json()); } catch {}
        try { const r = await fetch("/api/dashboard/stores"); if (r.ok) setStores(await r.json()); } catch {}
        try { const r = await fetch("/api/v1/keys"); if (r.ok) setApiKeys(await r.json()); } catch {}
        try { const r = await fetch("/api/dashboard/webhooks"); if (r.ok) setWebhooks(await r.json()); } catch {}
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
      setViewResult(data); setActiveTab("overview"); setScanUrl(""); setActionsVisible(10); loadData();
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

  async function handleUpgrade(plan: string) {
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch {}
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
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `cartparse-report-${Date.now()}.html`; a.click();
  }

  async function openPortal() {
    setPortalLoading(true);
    try { const r = await fetch("/api/stripe/portal", { method: "POST" }); const d = await r.json(); if (d.url) window.location.href = d.url; } catch {} finally { setPortalLoading(false); }
  }

  async function logout() { await fetch("/api/auth/logout", { method: "POST" }); window.location.href = "/"; }

  if (loading) return (
    <div className="min-h-screen flex">
      <aside className="w-56 shrink-0 border-r border-[var(--border)] bg-[var(--bg-raised)] hidden lg:flex flex-col">
        <div className="p-5 border-b border-[var(--border)]"><div className="skeleton h-7 w-32" /></div>
        <div className="p-3 space-y-2">{[1,2,3].map(i => <div key={i} className="skeleton h-8 w-full" />)}</div>
      </aside>
      <div className="flex-1 p-8">
        <div className="skeleton h-8 w-48 mb-6" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">{[1,2,3,4].map(i => <div key={i} className="skeleton h-24 rounded-xl" />)}</div>
        <div className="skeleton h-48 rounded-xl mb-6" />
        <div className="grid sm:grid-cols-2 gap-4">{[1,2].map(i => <div key={i} className="skeleton h-40 rounded-xl" />)}</div>
      </div>
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
            <img src="/logo.png" alt="CartParse" className="h-8 w-auto" />
          </a>
        </div>
        <nav className="flex-1 p-3 space-y-0.5">
          {[
            { id: "scan" as const, label: isFree ? "Overview" : "New Scan", icon: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" },
            ...(isActive ? [{ id: "history" as const, label: "Scan History", icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" }] : []),
            ...(isActive ? [{ id: "stores" as const, label: "My Stores", icon: "M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.016a3.001 3.001 0 003.75.614m-16.5 0a3.004 3.004 0 01-.621-4.72L4.318 3.44A1.5 1.5 0 015.378 3h13.243a1.5 1.5 0 011.06.44l1.19 1.189a3 3 0 01-.621 4.72m-13.5 8.65h3.75a.75.75 0 00.75-.75V13.5a.75.75 0 00-.75-.75H6.75a.75.75 0 00-.75.75v3.15c0 .415.336.75.75.75z" }] : []),
            ...(canCompare ? [{ id: "compare" as const, label: "Compare", icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" }] : []),
            ...(isEnterprise ? [{ id: "apikeys" as const, label: "API Keys", icon: "M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" }] : []),
            ...(canWebhook ? [{ id: "webhooks" as const, label: "Webhooks", icon: "M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" }] : []),
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
            <button onClick={() => setShowUpgradeModal(true)}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-[var(--accent)] hover:bg-[var(--accent-soft)] transition cursor-pointer">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" /></svg>
              Upgrade
            </button>
          )}
          {user?.isAdmin && (
            <a href="/admin"
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-red-400 hover:bg-red-500/10 transition">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              Admin panel
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
          <div className="flex items-center justify-between">
            <p className={`text-[10px] ${isActive ? "text-[var(--accent)]" : "text-[var(--text-dim)]"}`}>{isActive ? PLAN_NAMES[user?.plan || ""] || "Active" : "Free account"}</p>
            <button onClick={() => setShowDeleteModal(true)} className="text-[9px] text-[var(--text-dim)] hover:text-[var(--red)] cursor-pointer">Delete account</button>
          </div>
        </div>
      </aside>

      {/* ─── Main Content ─── */}
      <div className="flex-1 min-w-0">
        {/* Mobile header */}
        <header className="lg:hidden border-b border-[var(--border)] px-5 py-3 flex items-center justify-between bg-[var(--bg-raised)]">
          <a href="/dashboard" className="flex items-center gap-2">
            <img src="/logo.png" alt="CartParse" className="h-7 w-auto" />
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
            ...(isActive ? [{ id: "stores" as const, label: "Stores" }] : []),
            ...(canCompare ? [{ id: "compare" as const, label: "Compare" }] : []),
            ...(isEnterprise ? [{ id: "apikeys" as const, label: "API" }] : []),
            ...(canWebhook ? [{ id: "webhooks" as const, label: "Hooks" }] : []),
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

          {/* ═══ ONBOARDING (new paid user, 0 scans) ═══ */}
          {navSection === "scan" && !viewResult && isActive && scans.length === 0 && !scanning && (
            <div className="max-w-lg mx-auto py-8 fade-up">
              <div className="text-center mb-8">
                <div className="w-16 h-16 rounded-2xl bg-[var(--accent-soft)] border border-[var(--accent-border)] flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-[var(--accent)]" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>
                </div>
                <h1 className="text-xl font-bold text-white mb-2">Let&apos;s scan your store</h1>
                <p className="text-sm text-[var(--text-secondary)]">Enter your store URL below and we&apos;ll run a deep scan across up to 50+ pages, detect your platform, and generate fix code.</p>
              </div>

              <form onSubmit={handleScan} className="surface rounded-xl p-6">
                <label className="text-xs font-medium text-[var(--text-secondary)] block mb-2">Your store URL</label>
                <div className="flex gap-2">
                  <input type="text" value={scanUrl} onChange={(e) => setScanUrl(e.target.value)} placeholder="yourstore.com"
                    className="flex-1 rounded-lg bg-[var(--bg)] border border-[var(--border-light)] px-4 py-3 text-sm text-white placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--accent-border)]" autoFocus />
                  <button type="submit" disabled={!scanUrl.trim()}
                    className="px-6 py-3 rounded-lg btn-primary text-sm cursor-pointer disabled:cursor-not-allowed shrink-0">Scan</button>
                </div>
                {scanError && <p className="text-xs text-[var(--red)] mt-2">{scanError}</p>}
                <div className="mt-4 flex items-center gap-4 text-[10px] text-[var(--text-dim)]">
                  <span>50+ pages scanned</span>
                  <span>Platform detection</span>
                  <span>Fix code included</span>
                </div>
              </form>
            </div>
          )}

          {/* ═══ SCAN SECTION (has existing scans) ═══ */}
          {navSection === "scan" && !viewResult && isActive && (scans.length > 0 || scanning) && (
            <>
              {/* Scanner input - ALWAYS AT TOP */}
              <div className="surface rounded-2xl p-6 mb-6">
                <p className="text-base font-semibold text-white mb-1">Scan a store</p>
                <p className="text-xs text-[var(--text-secondary)] mb-4">Enter any store URL. We&apos;ll crawl up to 50+ pages, run 195 checks, detect the platform, and tell you exactly what to fix.</p>
                <form onSubmit={handleScan} className="flex gap-3">
                  <input type="text" value={scanUrl} onChange={(e) => setScanUrl(e.target.value)} placeholder="Enter store URL (e.g. mystore.com)" disabled={scanning}
                    className="flex-1 rounded-xl bg-[var(--bg)] border border-[var(--border-light)] px-5 py-3.5 text-sm text-white placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--accent-border)] focus:shadow-[0_0_0_3px_var(--accent-soft)]" />
                  <button type="submit" disabled={scanning || !scanUrl.trim()}
                    className="px-8 py-3.5 rounded-xl btn-primary text-sm disabled:opacity-30 transition cursor-pointer disabled:cursor-not-allowed shrink-0">
                    {scanning ? "Scanning..." : "Scan"}
                  </button>
                </form>
                {scanError && <p className="text-sm text-[var(--red)] mt-3 bg-[var(--red-soft)] rounded-lg px-4 py-2">{scanError}</p>}
              </div>

              {/* Stats below scanner */}
              {scans.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                  <StatCard label="Latest Score" value={String(latestScan?.score || 0)}
                    color={latestScan?.score >= 75 ? "var(--green)" : latestScan?.score >= 45 ? "var(--yellow)" : "var(--red)"}
                    sub={latestScan?.grade} tip="Your most recent scan score out of 100" />
                  <StatCard label="Average" value={String(avgScore)} sub={`across ${scans.length} scans`} tip="Average score across all your scans" />
                  <StatCard label="Best Score" value={String(bestScore)} color="var(--green)" tip="Your highest score achieved" />
                  <StatCard label="Stores" value={String(uniqueStores)} sub="unique domains" tip="Number of different stores you've scanned" />
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

              {/* Scanner moved to top of section */}
            </>
          )}

          {/* Free user upgrade experience */}
          {navSection === "scan" && isFree && (
            <div>
              <div className="mb-6">
                <h1 className="text-lg font-bold text-white mb-1">Welcome to CartParse</h1>
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
                    <button onClick={() => setShowUpgradeModal(true)} className="px-5 py-2.5 rounded-lg btn-primary text-sm transition cursor-pointer">Unlock full report</button>
                  </div>
                </div>
              )}

              {/* Demo dashboard preview */}
              <div className="relative mb-6">
                <div className="absolute -inset-1 bg-gradient-to-b from-transparent via-transparent to-[var(--bg)] z-20 pointer-events-none" />
                <div className="surface rounded-2xl p-5 overflow-hidden">
                  <p className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-widest mb-4">Dashboard preview</p>

                  {/* Demo stat cards */}
                  <div className="grid grid-cols-4 gap-3 mb-5">
                    {[
                      { label: "Score", value: "67", color: "var(--yellow)" },
                      { label: "Pages", value: "10", color: "white" },
                      { label: "Issues", value: "17", color: "var(--red)" },
                      { label: "Fixes", value: "12", color: "var(--green)" },
                    ].map((s, i) => (
                      <div key={i} className="bg-[var(--bg)] rounded-xl p-3 text-center">
                        <p className="text-lg font-mono font-bold tabular-nums" style={{ color: s.color }}>{s.value}</p>
                        <p className="text-[9px] text-[var(--text-dim)] uppercase tracking-wider mt-0.5">{s.label}</p>
                      </div>
                    ))}
                  </div>

                  {/* Demo chart */}
                  <div className="bg-[var(--bg)] rounded-xl p-4 mb-5">
                    <p className="text-[10px] text-[var(--text-dim)] uppercase tracking-wider mb-3">Score trend</p>
                    <svg viewBox="0 0 400 80" className="w-full" preserveAspectRatio="xMidYMid meet">
                      <defs>
                        <linearGradient id="demoGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.2" />
                          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      {[0.25, 0.5, 0.75].map((p, i) => (
                        <line key={i} x1="0" y1={p * 80} x2="400" y2={p * 80} stroke="rgba(255,255,255,0.03)" strokeWidth="0.5" />
                      ))}
                      <polygon points="0,80 0,65 50,58 100,52 150,48 200,40 250,35 300,28 350,22 400,18 400,80" fill="url(#demoGrad)" />
                      <polyline points="0,65 50,58 100,52 150,48 200,40 250,35 300,28 350,22 400,18" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      {[[0,65],[100,52],[200,40],[300,28],[400,18]].map(([x,y], i) => (
                        <circle key={i} cx={x} cy={y} r="3" fill="var(--bg)" stroke="var(--accent)" strokeWidth="1.5" />
                      ))}
                    </svg>
                  </div>

                  {/* Demo category bars */}
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="bg-[var(--bg)] rounded-xl p-4">
                      <p className="text-[10px] text-[var(--text-dim)] uppercase tracking-wider mb-3">Categories</p>
                      {[
                        { name: "Structured Data", pct: 30, color: "var(--red)" },
                        { name: "Product Signals", pct: 68, color: "var(--yellow)" },
                        { name: "Machine Access", pct: 85, color: "var(--green)" },
                        { name: "Commerce Ready", pct: 20, color: "var(--red)" },
                        { name: "Performance", pct: 60, color: "var(--yellow)" },
                      ].map((cat, i) => (
                        <div key={i} className="mb-2 last:mb-0">
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-[10px] text-[var(--text-secondary)]">{cat.name}</span>
                            <span className="text-[10px] font-mono text-[var(--text-dim)]">{cat.pct}%</span>
                          </div>
                          <div className="h-1.5 bg-[rgba(255,255,255,0.04)] rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${cat.pct}%`, background: cat.color }} />
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="bg-[var(--bg)] rounded-xl p-4">
                      <p className="text-[10px] text-[var(--text-dim)] uppercase tracking-wider mb-3">Top fixes</p>
                      {[
                        { impact: "high", fix: "Add JSON-LD Product schema", pts: 15 },
                        { impact: "high", fix: "Add price meta tags", pts: 8 },
                        { impact: "medium", fix: "Improve image alt text", pts: 5 },
                        { impact: "medium", fix: "Add review markup", pts: 5 },
                      ].map((a, i) => (
                        <div key={i} className="flex items-center gap-2 mb-2 last:mb-0">
                          <span className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded ${a.impact === "high" ? "bg-[var(--red-soft)] text-[var(--red)]" : "bg-[var(--yellow-soft)] text-[var(--yellow)]"}`}>{a.impact}</span>
                          <span className="text-[10px] text-[var(--text-secondary)] flex-1 truncate">{a.fix}</span>
                          <span className="text-[10px] font-mono text-[var(--text-dim)]">+{a.pts}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Lock overlay */}
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-[var(--bg)]/40 backdrop-blur-[2px] rounded-2xl">
                  <div className="text-center">
                    <div className="w-12 h-12 rounded-2xl bg-[var(--accent-soft)] border border-[var(--accent-border)] flex items-center justify-center mx-auto mb-3">
                      <svg className="w-6 h-6 text-[var(--accent)]" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                      </svg>
                    </div>
                    <p className="text-sm font-semibold text-white mb-1">Unlock your full dashboard</p>
                    <p className="text-xs text-[var(--text-secondary)] mb-4 max-w-xs">Charts, action plans, fix code, competitor comparison, and more.</p>
                    <button onClick={() => setShowUpgradeModal(true)} className="px-6 py-2.5 rounded-xl btn-primary text-sm cursor-pointer">Choose a plan</button>
                  </div>
                </div>
              </div>

              {/* What you get */}
              <div className="surface rounded-xl p-6 mb-6">
                <p className="text-xs font-semibold text-[var(--text-dim)] uppercase tracking-widest mb-5">What you get with a paid plan</p>
                <div className="grid sm:grid-cols-2 gap-4">
                  {[
                    { title: "Multi-page deep scan", desc: "We crawl up to 50+ pages on your store, not just the homepage.", locked: false },
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
                    <button onClick={() => handleUpgrade(tier.plan)}
                      className={`w-full py-2.5 rounded-lg text-sm font-medium text-center block transition cursor-pointer ${
                        tier.pop ? "bg-[var(--accent)] text-black hover:brightness-110" : "btn-secondary"
                      }`}>Get started</button>
                  </div>
                ))}
              </div>

              <p className="text-[11px] text-[var(--text-dim)] text-center">Cancel anytime from your dashboard.</p>
            </div>
          )}

          {/* ═══ SCAN RESULT VIEW ═══ */}
          {viewResult && (
            <div className="fade-up space-y-4">
              <button onClick={() => setViewResult(null)} className="text-xs text-[var(--text-dim)] hover:text-[var(--text-secondary)] cursor-pointer">&larr; Back to dashboard</button>

              {/* Score header */}
              <div className="surface rounded-2xl p-6">
                <div className="flex flex-col sm:flex-row items-start gap-6">
                  <div className="text-center shrink-0">
                    <div className="w-24 h-24 rounded-2xl bg-[var(--bg)] flex flex-col items-center justify-center">
                      <p className="text-3xl font-mono font-bold" style={{ color: viewResult.overallScore >= 72 ? "var(--green)" : viewResult.overallScore >= 58 ? "var(--yellow)" : "var(--red)" }}>{viewResult.overallScore}</p>
                      <p className="text-[10px] text-[var(--text-dim)] uppercase tracking-widest">{viewResult.grade}</p>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-lg font-semibold text-white mb-1">{viewResult.rootUrl}</p>
                    <div className="flex flex-wrap gap-2 text-[10px] mb-3">
                      <span className="px-2.5 py-1 rounded-lg bg-[var(--accent-soft)] border border-[var(--accent-border)] text-[var(--accent)] font-medium">{PLATFORM_LABELS[viewResult.platform]}</span>
                      <span className="px-2.5 py-1 rounded-lg bg-[rgba(255,255,255,0.04)] text-[var(--text-dim)]">{viewResult.totalPages} pages scanned</span>
                      <span className="px-2.5 py-1 rounded-lg bg-[rgba(255,255,255,0.04)] text-[var(--text-dim)]">{viewResult.actionPlan.length} things to fix</span>
                    </div>
                    {viewResult.overallScore < 58 && <p className="text-sm text-[var(--red)]">Your store has major gaps that AI shopping bots will notice. Fix the top issues below to see the biggest improvement.</p>}
                    {viewResult.overallScore >= 58 && viewResult.overallScore < 72 && <p className="text-sm text-[var(--yellow)]">Your store is partially ready for AI shopping. There are important things to improve below.</p>}
                    {viewResult.overallScore >= 72 && <p className="text-sm text-[var(--green)]">Your store is well set up for AI shopping bots. Keep improving the areas below.</p>}
                  </div>
                  <button onClick={handleExport} className="px-4 py-2.5 rounded-xl btn-secondary text-xs cursor-pointer shrink-0">Download report</button>
                </div>
              </div>

              {/* Categories overview */}
              <div className="surface rounded-2xl overflow-hidden">
                <div className="px-5 py-3 border-b border-[var(--border)]">
                  <p className="text-xs font-semibold text-[var(--text-dim)] uppercase tracking-widest">How your store scores in each area</p>
                </div>
                {viewResult.aggregatedCategories.map((cat, i) => {
                  const pct = cat.maxScore > 0 ? Math.round((cat.score / cat.maxScore) * 100) : 0;
                  const color = pct >= 70 ? "var(--green)" : pct >= 40 ? "var(--yellow)" : "var(--red)";
                  return (
                    <div key={i} className="px-5 py-3 flex items-center gap-4 border-b border-[var(--border)] last:border-0">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
                      <span className="text-sm text-[var(--text)] flex-1">{cat.name}</span>
                      <div className="w-24 h-2 bg-[rgba(255,255,255,0.05)] rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
                      </div>
                      <span className="text-xs font-mono text-[var(--text-dim)] w-10 text-right">{pct}%</span>
                    </div>
                  );
                })}
              </div>

              {/* Tabs */}
              <div className="flex gap-1 bg-[var(--bg-raised)] rounded-xl p-1 w-fit">
                {(["overview", "actions", "pages"] as const).map((tab) => (
                  <button key={tab} onClick={() => setActiveTab(tab)}
                    className={`px-4 py-2 rounded-lg text-xs font-medium transition cursor-pointer ${activeTab === tab ? "bg-[var(--bg-elevated)] text-white" : "text-[var(--text-dim)] hover:text-[var(--text-secondary)]"}`}>
                    {tab === "overview" ? "Top Priorities" : tab === "actions" ? `All Fixes (${viewResult.actionPlan.length})` : `Pages (${viewResult.pages.length})`}
                  </button>
                ))}
              </div>

              {activeTab === "overview" && (
                <div className="surface rounded-2xl overflow-hidden">
                  <div className="px-5 py-3 border-b border-[var(--border)]">
                    <p className="text-xs font-semibold text-[var(--text-dim)] uppercase tracking-widest">Fix these first for the biggest improvement</p>
                  </div>
                  {viewResult.actionPlan.filter(a => a.impact === "high").length === 0 ? (
                    <div className="px-5 py-8 text-center">
                      <p className="text-sm text-[var(--green)] font-medium mb-1">No critical issues found</p>
                      <p className="text-xs text-[var(--text-dim)]">Check the &quot;All Fixes&quot; tab for smaller improvements you can still make.</p>
                    </div>
                  ) : (
                    viewResult.actionPlan.filter(a => a.impact === "high").slice(0, 5).map((a, i) => <ActionRow key={i} item={a} index={i} />)
                  )}
                </div>
              )}
              {activeTab === "actions" && (
                <div className="surface rounded-2xl overflow-hidden">
                  <div className="px-5 py-3 border-b border-[var(--border)] flex items-center justify-between">
                    <p className="text-xs font-semibold text-[var(--text-dim)] uppercase tracking-widest">Everything to fix, sorted by importance</p>
                    <p className="text-xs text-[var(--text-dim)]">Showing {Math.min(actionsVisible, viewResult.actionPlan.length)} of {viewResult.actionPlan.length}</p>
                  </div>
                  <div className="px-4">
                    {viewResult.actionPlan.slice(0, actionsVisible).map((a, i) => <ActionRow key={i} item={a} index={i} />)}
                  </div>
                  {actionsVisible < viewResult.actionPlan.length && (
                    <div className="px-5 py-3 border-t border-[var(--border)] text-center">
                      <button onClick={() => setActionsVisible(v => v + 15)} className="text-xs text-[var(--accent)] hover:underline cursor-pointer">
                        Show {Math.min(15, viewResult.actionPlan.length - actionsVisible)} more fixes
                      </button>
                    </div>
                  )}
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
                    <div className="w-12 h-12 rounded-2xl bg-[rgba(255,255,255,0.04)] flex items-center justify-center mx-auto mb-4">
                      <svg className="w-6 h-6 text-[var(--text-dim)]" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>
                    <p className="text-sm text-[var(--text)] font-medium mb-1">No scan history yet</p>
                    <p className="text-xs text-[var(--text-dim)] mb-4">Your scan results will appear here after you run your first scan.</p>
                    <button onClick={() => setNavSection("scan")} className="text-xs text-[var(--accent)] hover:underline cursor-pointer">Run a scan now</button>
                  </div>
                ) : (
                  <div className="divide-y divide-[var(--border)]">
                    {scans.map((scan, i) => (
                      <button key={i} onClick={() => { try { setViewResult(JSON.parse(scan.resultJson)); setActiveTab("overview"); setActionsVisible(10); } catch {} }}
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
                    className="px-5 py-2.5 rounded-lg btn-primary text-sm disabled:opacity-30 transition cursor-pointer disabled:cursor-not-allowed">
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
                      <span className="text-[10px] text-[var(--accent)]">{String(PLATFORM_LABELS[String((compResult.you as Record<string, unknown>).platform)] ?? "")}</span>
                    </div>
                    <div className="surface rounded-xl p-6 text-center">
                      <p className="text-[10px] text-[var(--text-dim)] uppercase tracking-wider mb-2">Competitor</p>
                      <p className="text-4xl font-mono font-bold" style={{ color: (compResult.competitor as { score: number }).score >= 75 ? "var(--green)" : "var(--yellow)" }}>
                        {(compResult.competitor as { score: number }).score}
                      </p>
                      <p className="text-xs text-[var(--text-dim)] mt-2 truncate">{(compResult.competitor as { url: string }).url}</p>
                      <span className="text-[10px] text-[var(--accent)]">{String(PLATFORM_LABELS[String((compResult.competitor as Record<string, unknown>).platform)] ?? "")}</span>
                    </div>
                  </div>

                  <div className="text-center">
                    {Number(compResult.scoreDiff) > 0 ? (
                      <span className="text-sm px-3 py-1 rounded-full bg-[var(--red-soft)] text-[var(--red)]">They lead by {Number(compResult.scoreDiff)} points</span>
                    ) : Number(compResult.scoreDiff) < 0 ? (
                      <span className="text-sm px-3 py-1 rounded-full bg-[var(--green-soft)] text-[var(--green)]">You lead by {Math.abs(Number(compResult.scoreDiff))} points</span>
                    ) : (
                      <span className="text-sm px-3 py-1 rounded-full bg-[rgba(255,255,255,0.05)] text-[var(--text-secondary)]">Tied</span>
                    )}
                  </div>

                  {/* Plain English summary */}
                  {typeof compResult.summary === "string" && (
                    <div className="surface rounded-xl p-4 text-sm text-[var(--text)] leading-relaxed">
                      {String(compResult.summary)}
                    </div>
                  )}

                  {/* Category gaps */}
                  <div className="surface rounded-xl overflow-hidden">
                    <div className="px-5 py-3 border-b border-[var(--border)]">
                      <p className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-widest">Category by category</p>
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

                  {/* How to beat them - action plan */}
                  {(compResult.beatThemPlan as Array<{ priority: number; action: string; category: string; impact: string; difficulty: string }>)?.length > 0 && (
                    <div className="surface rounded-xl overflow-hidden">
                      <div className="px-5 py-3 border-b border-[var(--border)]">
                        <p className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-widest">
                          {(compResult.scoreDiff as number) > 0 ? "How to beat them" : "How to stay ahead"}
                        </p>
                      </div>
                      <div className="divide-y divide-[var(--border)]">
                        {(compResult.beatThemPlan as Array<{ priority: number; action: string; category: string; impact: string; difficulty: string }>).map((item, i) => (
                          <div key={i} className="px-5 py-3 flex items-start gap-3">
                            <span className="text-xs font-mono text-[var(--text-dim)] w-5 pt-0.5 shrink-0">{item.priority}</span>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className={`text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded-full ${item.impact === "high" ? "bg-[var(--red-soft)] text-[var(--red)]" : item.impact === "medium" ? "bg-[var(--yellow-soft)] text-[var(--yellow)]" : "bg-[rgba(255,255,255,0.04)] text-[var(--text-dim)]"}`}>{item.impact}</span>
                                <span className="text-[9px] text-[var(--text-dim)]">{item.category}</span>
                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-[rgba(255,255,255,0.04)] text-[var(--text-dim)]">{item.difficulty}</span>
                              </div>
                              <p className="text-xs text-[var(--text)] leading-relaxed">{item.action}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* ═══ STORES SECTION ═══ */}
          {navSection === "stores" && isActive && (
            <>
              <h2 className="text-lg font-bold text-white mb-1">My Stores</h2>
              <p className="text-sm text-[var(--text-secondary)] mb-6">Add stores to monitor. Enable auto-rescan to track your score over time.</p>

              <div className="surface rounded-xl p-5 mb-6">
                <form onSubmit={async (e) => { e.preventDefault(); if (!newStoreUrl.trim()) return;
                  await fetch("/api/dashboard/stores", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: newStoreUrl, autoRescan: true }) });
                  setNewStoreUrl(""); loadData(); }} className="flex gap-2">
                  <input type="text" value={newStoreUrl} onChange={(e) => setNewStoreUrl(e.target.value)} placeholder="yourstore.com"
                    className="flex-1 rounded-lg bg-[var(--bg)] border border-[var(--border-light)] px-4 py-2.5 text-sm text-white placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--accent-border)]" />
                  <button type="submit" className="px-5 py-2.5 rounded-lg btn-primary text-sm cursor-pointer shrink-0">Add store</button>
                </form>
              </div>

              <div className="surface rounded-xl overflow-hidden">
                {stores.length === 0 ? (
                  <div className="px-6 py-12 text-center">
                    <p className="text-sm text-[var(--text-dim)]">No stores added yet. Add your first store above.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-[var(--border)]">
                    {stores.map((s) => (
                      <div key={s.id} className="px-5 py-3 flex items-center gap-4">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-[var(--text)] truncate">{s.name || s.url}</p>
                          <p className="text-[10px] text-[var(--text-dim)]">{s.url}</p>
                        </div>
                        {s.lastScore !== null && (
                          <span className="text-lg font-mono font-bold" style={{ color: s.lastScore >= 75 ? "var(--green)" : s.lastScore >= 45 ? "var(--yellow)" : "var(--red)" }}>{s.lastScore}</span>
                        )}
                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${s.autoRescan ? "bg-[var(--green-soft)] text-[var(--green)]" : "bg-[rgba(255,255,255,0.04)] text-[var(--text-dim)]"}`}>
                          {s.autoRescan ? `Auto: ${s.rescanInterval}` : "Manual"}
                        </span>
                        <button onClick={async () => { await fetch("/api/dashboard/stores", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: s.id }) }); loadData(); }}
                          className="text-[10px] text-[var(--red)] hover:underline cursor-pointer">Remove</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* ═══ API KEYS SECTION ═══ */}
          {navSection === "apikeys" && isEnterprise && (
            <>
              <h2 className="text-lg font-bold text-white mb-1">API Keys</h2>
              <p className="text-sm text-[var(--text-secondary)] mb-6">Use the REST API to scan stores programmatically. Send requests to <code className="text-xs bg-[var(--bg-elevated)] px-1.5 py-0.5 rounded">POST /api/v1/scan</code> with your API key.</p>

              <div className="surface rounded-xl p-5 mb-6">
                <form onSubmit={async (e) => { e.preventDefault();
                  const res = await fetch("/api/v1/keys", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newKeyName || "Default" }) });
                  const data = await res.json();
                  if (data.key) { setNewApiKey(data.key); setNewKeyName(""); loadData(); }
                }} className="flex gap-2">
                  <input type="text" value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)} placeholder="Key name (optional)"
                    className="flex-1 rounded-lg bg-[var(--bg)] border border-[var(--border-light)] px-4 py-2.5 text-sm text-white placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--accent-border)]" />
                  <button type="submit" className="px-5 py-2.5 rounded-lg btn-primary text-sm cursor-pointer shrink-0">Generate key</button>
                </form>
                {newApiKey && (
                  <div className="mt-3 p-3 rounded-lg bg-[var(--accent-soft)] border border-[var(--accent-border)]">
                    <p className="text-[10px] text-[var(--accent)] mb-1">Copy this key now. You won&apos;t see it again.</p>
                    <code className="text-xs text-white break-all select-all">{newApiKey}</code>
                  </div>
                )}
              </div>

              <div className="surface rounded-xl p-5 mb-6">
                <p className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-widest mb-3">Usage example</p>
                <pre className="text-[11px] text-[var(--text-secondary)] bg-[var(--bg)] rounded-lg p-4 overflow-x-auto">
{`curl -X POST https://cartparse.com/api/v1/scan \\
  -H "Authorization: Bearer cp_your_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{"url": "yourstore.com"}'`}
                </pre>
              </div>

              <div className="surface rounded-xl overflow-hidden">
                <div className="px-5 py-3 border-b border-[var(--border)]">
                  <p className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-widest">Your keys</p>
                </div>
                {apiKeys.length === 0 ? (
                  <p className="px-5 py-8 text-center text-sm text-[var(--text-dim)]">No API keys yet.</p>
                ) : (
                  <div className="divide-y divide-[var(--border)]">
                    {apiKeys.map((k) => (
                      <div key={k.id} className="px-5 py-3 flex items-center gap-4">
                        <div className="flex-1">
                          <p className="text-sm text-[var(--text)]">{k.name}</p>
                          <p className="text-[10px] text-[var(--text-dim)] font-mono">{k.keyPrefix}...</p>
                        </div>
                        <span className="text-[10px] text-[var(--text-dim)]">{k.lastUsedAt ? `Used ${new Date(k.lastUsedAt).toLocaleDateString()}` : "Never used"}</span>
                        <button onClick={async () => { await fetch("/api/v1/keys", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: k.id }) }); loadData(); }}
                          className="text-[10px] text-[var(--red)] hover:underline cursor-pointer">Revoke</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* ═══ WEBHOOKS SECTION ═══ */}
          {navSection === "webhooks" && canWebhook && (
            <>
              <h2 className="text-lg font-bold text-white mb-1">Webhooks</h2>
              <p className="text-sm text-[var(--text-secondary)] mb-6">Get notified when scans complete. We&apos;ll POST the scan result to your URL.</p>

              <div className="surface rounded-xl p-5 mb-6">
                <form onSubmit={async (e) => { e.preventDefault(); if (!newWebhookUrl.trim()) return;
                  await fetch("/api/dashboard/webhooks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: newWebhookUrl }) });
                  setNewWebhookUrl(""); loadData(); }} className="flex gap-2">
                  <input type="url" value={newWebhookUrl} onChange={(e) => setNewWebhookUrl(e.target.value)} placeholder="https://your-server.com/webhook"
                    className="flex-1 rounded-lg bg-[var(--bg)] border border-[var(--border-light)] px-4 py-2.5 text-sm text-white placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--accent-border)]" />
                  <button type="submit" className="px-5 py-2.5 rounded-lg btn-primary text-sm cursor-pointer shrink-0">Add webhook</button>
                </form>
              </div>

              <div className="surface rounded-xl overflow-hidden">
                {webhooks.length === 0 ? (
                  <p className="px-5 py-8 text-center text-sm text-[var(--text-dim)]">No webhooks configured.</p>
                ) : (
                  <div className="divide-y divide-[var(--border)]">
                    {webhooks.map((w) => (
                      <div key={w.id} className="px-5 py-3 flex items-center gap-4">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-[var(--text)] font-mono truncate">{w.url}</p>
                          <p className="text-[10px] text-[var(--text-dim)]">Events: {w.events.join(", ")}</p>
                        </div>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${w.isActive ? "bg-[var(--green-soft)] text-[var(--green)]" : "bg-[rgba(255,255,255,0.04)] text-[var(--text-dim)]"}`}>
                          {w.isActive ? "Active" : "Inactive"}
                        </span>
                        <button onClick={async () => { await fetch("/api/dashboard/webhooks", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: w.id }) }); loadData(); }}
                          className="text-[10px] text-[var(--red)] hover:underline cursor-pointer">Delete</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ─── Upgrade Modal ─── */}
      {showUpgradeModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowUpgradeModal(false)} />
          <div className="relative bg-[var(--bg-raised)] border border-[var(--border)] rounded-2xl p-6 sm:p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl fade-up">
            <button onClick={() => setShowUpgradeModal(false)}
              className="absolute top-4 right-4 text-[var(--text-dim)] hover:text-[var(--text)] cursor-pointer">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>

            <h2 className="text-lg font-bold text-white mb-1">Pick your plan</h2>
            <p className="text-sm text-[var(--text-secondary)] mb-6">All plans include full scan reports, fix code, and exportable reports.</p>

            <div className="grid sm:grid-cols-3 gap-4">
              {[
                { name: "Growth", price: "$49", plan: "growth", desc: "For store owners getting started", features: ["5 stores", "Multi-page deep scan", "Platform-specific fix code", "Priority action plan", "Downloadable reports", "Weekly rescans"] },
                { name: "Business", price: "$149", plan: "business", pop: true, desc: "For serious sellers and teams", features: ["25 stores", "Everything in Growth", "Competitor comparison", "Score history tracking", "Daily monitoring", "Email alerts"] },
                { name: "Enterprise", price: "$399", plan: "enterprise", desc: "For agencies managing clients", features: ["Unlimited stores", "Everything in Business", "White-label reports", "Bulk scanning API", "Team seats", "Priority support"] },
              ].map((tier) => (
                <div key={tier.plan} className={`rounded-xl p-5 flex flex-col relative ${tier.pop ? "bg-[var(--bg-elevated)] ring-1 ring-[var(--accent-border)]" : "bg-[var(--bg-elevated)] border border-[var(--border)]"}`}>
                  {tier.pop && <span className="absolute -top-2.5 left-4 text-[9px] font-semibold uppercase tracking-wider bg-[var(--accent)] text-black px-2.5 py-0.5 rounded-full">Popular</span>}
                  <p className="text-sm font-semibold text-white">{tier.name}</p>
                  <p className="text-2xl font-bold text-white mt-1">{tier.price}<span className="text-xs text-[var(--text-dim)] font-normal">/mo</span></p>
                  <p className="text-[11px] text-[var(--text-dim)] mt-1 mb-3">{tier.desc}</p>
                  <ul className="space-y-1.5 mb-5 flex-1">
                    {tier.features.map((f, i) => (
                      <li key={i} className="text-xs text-[var(--text-secondary)] flex gap-2">
                        <span className="text-[var(--accent)] shrink-0">&#10003;</span>{f}
                      </li>
                    ))}
                  </ul>
                  <button onClick={() => { setShowUpgradeModal(false); handleUpgrade(tier.plan); }}
                    className={`w-full py-2.5 rounded-lg text-sm font-medium transition cursor-pointer ${
                      tier.pop ? "bg-[var(--accent)] text-black hover:brightness-110" : "bg-[rgba(255,255,255,0.06)] text-[var(--text)] border border-[var(--border-light)] hover:bg-[rgba(255,255,255,0.1)]"
                    }`}>Choose {tier.name}</button>
                </div>
              ))}
            </div>

            <p className="text-[11px] text-[var(--text-dim)] text-center mt-5">Cancel anytime. You&apos;ll be taken to a secure Stripe checkout.</p>
          </div>
        </div>
      )}

      {/* ─── Delete Account Modal ─── */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { setShowDeleteModal(false); setDeleteConfirm(""); }} />
          <div className="relative bg-[var(--bg-raised)] border border-[var(--border)] rounded-2xl p-6 max-w-sm w-full shadow-2xl fade-up">
            <h2 className="text-lg font-bold text-white mb-2">Delete your account</h2>
            <p className="text-sm text-[var(--text-secondary)] mb-4">This will permanently delete your account, all scan data, stores, and API keys. This cannot be undone.</p>
            <p className="text-xs text-[var(--text-dim)] mb-3">Type <strong className="text-white">DELETE</strong> to confirm.</p>
            <input type="text" value={deleteConfirm} onChange={(e) => setDeleteConfirm(e.target.value)} placeholder="Type DELETE"
              className="w-full rounded-lg bg-[var(--bg)] border border-[var(--border-light)] px-4 py-2.5 text-sm text-white placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--red)] mb-4" />
            <div className="flex gap-2">
              <button onClick={() => { setShowDeleteModal(false); setDeleteConfirm(""); }}
                className="flex-1 py-2.5 rounded-lg btn-secondary text-sm cursor-pointer">Cancel</button>
              <button onClick={async () => {
                if (deleteConfirm !== "DELETE") return;
                await fetch("/api/auth/delete-account", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirm: "DELETE" }) });
                window.location.href = "/";
              }} disabled={deleteConfirm !== "DELETE"}
                className="flex-1 py-2.5 rounded-lg bg-[var(--red)] text-white text-sm font-medium disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed">Delete forever</button>
            </div>
          </div>
        </div>
      )}
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
