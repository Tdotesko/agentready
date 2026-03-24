"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import type { DeepScanResult, ActionItem } from "@/lib/deep-scanner";

interface UserData { id: string; email: string; plan?: string; subscriptionStatus?: string; }
interface ScanRecord { url: string; score: number; grade: string; scannedAt: string; resultJson: string; }

const PLATFORM_LABELS: Record<string, string> = { shopify: "Shopify", woocommerce: "WooCommerce", bigcommerce: "BigCommerce", magento: "Magento", squarespace: "Squarespace", wix: "Wix", custom: "Custom", unknown: "Unknown" };

/* ── Score Chart (simple SVG) ── */
function ScoreChart({ scans }: { scans: ScanRecord[] }) {
  const recent = scans.slice(0, 20).reverse();
  if (recent.length < 2) return null;
  const max = 100, h = 120, w = 400;
  const step = w / (recent.length - 1);
  const points = recent.map((s, i) => `${i * step},${h - (s.score / max) * h}`).join(" ");

  return (
    <div className="surface rounded-xl p-5 mb-6">
      <p className="text-xs font-semibold text-[var(--text-dim)] uppercase tracking-wider mb-4">Score History</p>
      <svg viewBox={`-10 -10 ${w + 20} ${h + 30}`} className="w-full max-w-lg" preserveAspectRatio="none">
        <polyline points={points} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {recent.map((s, i) => (
          <g key={i}>
            <circle cx={i * step} cy={h - (s.score / max) * h} r="3" fill="var(--accent)" />
            <text x={i * step} y={h + 16} textAnchor="middle" fontSize="8" fill="var(--text-dim)">
              {new Date(s.scannedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

/* ── Action Item Row ── */
function ActionRow({ item, index }: { item: ActionItem; index: number }) {
  const [showCode, setShowCode] = useState(false);
  const [copied, setCopied] = useState(false);
  const impactColor = item.impact === "high" ? "text-[var(--red)]" : item.impact === "medium" ? "text-[var(--yellow)]" : "text-[var(--text-dim)]";
  const impactBg = item.impact === "high" ? "bg-[var(--red-soft)]" : item.impact === "medium" ? "bg-[var(--yellow-soft)]" : "bg-[rgba(255,255,255,0.03)]";

  function copyCode() {
    if (item.code) { navigator.clipboard.writeText(item.code); setCopied(true); setTimeout(() => setCopied(false), 1500); }
  }

  return (
    <div className="border-b border-[var(--border)] last:border-0 py-4 px-1">
      <div className="flex items-start gap-3">
        <span className="text-xs text-[var(--text-dim)] tabular-nums font-mono w-5 pt-0.5 shrink-0">{index + 1}</span>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${impactBg} ${impactColor}`}>
              {item.impact}
            </span>
            <span className="text-[10px] text-[var(--text-dim)]">~{item.estimatedPoints} pts</span>
            <span className="text-[10px] text-[var(--text-dim)]">{item.category}</span>
            {item.platform && <span className="text-[10px] text-[var(--accent)]">{PLATFORM_LABELS[item.platform] || item.platform}</span>}
          </div>
          <p className="text-[13px] text-[var(--text)]">{item.fix}</p>
          {item.code && (
            <button onClick={() => setShowCode(!showCode)}
              className="text-[11px] text-[var(--accent)] hover:underline mt-1.5 cursor-pointer">
              {showCode ? "Hide code" : "Show fix code"}
            </button>
          )}
          {showCode && item.code && (
            <div className="mt-2 relative">
              <pre className="text-[11px] leading-relaxed bg-[var(--bg)] border border-[var(--border)] rounded-lg p-4 overflow-x-auto text-[var(--text-secondary)]">
                {item.code}
              </pre>
              <button onClick={copyCode}
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

/* ── Page Breakdown ── */
function PageBreakdown({ result }: { result: DeepScanResult }) {
  return (
    <div className="surface rounded-xl overflow-hidden mb-6">
      <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between">
        <p className="text-sm font-semibold text-white">Pages scanned ({result.totalPages})</p>
        <p className="text-xs text-[var(--text-dim)]">Platform: <span className="text-[var(--accent)]">{PLATFORM_LABELS[result.platform]}</span></p>
      </div>
      {result.pages.map((page, i) => {
        const color = page.result.overallScore >= 75 ? "var(--green)" : page.result.overallScore >= 45 ? "var(--yellow)" : "var(--red)";
        return (
          <div key={i} className="px-5 py-3 flex items-center gap-4 border-b border-[var(--border)] last:border-0">
            <span className="text-lg font-mono font-bold tabular-nums w-10" style={{ color }}>{page.result.overallScore}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-[var(--text)] truncate">{page.url}</p>
              <p className="text-[11px] text-[var(--text-dim)]">{page.type}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Main Dashboard ── */
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

  // Competitor comparison
  const [compMyUrl, setCompMyUrl] = useState("");
  const [compTheirUrl, setCompTheirUrl] = useState("");
  const [comparing, setComparing] = useState(false);
  const [compResult, setCompResult] = useState<Record<string, unknown> | null>(null);
  const [compError, setCompError] = useState("");

  const isActive = user?.subscriptionStatus === "active" || user?.subscriptionStatus === "trialing";
  const canCompare = user?.plan === "pro" || user?.plan === "agency" || user?.plan === "business" || user?.plan === "enterprise";

  const loadData = useCallback(async () => {
    try {
      const meRes = await fetch("/api/auth/me");
      if (!meRes.ok) { window.location.href = "/login"; return; }
      const userData = await meRes.json();
      setUser(userData);

      // Only fetch scans if user has active sub
      if (userData.subscriptionStatus === "active" || userData.subscriptionStatus === "trialing") {
        try {
          const scansRes = await fetch("/api/dashboard/scans");
          if (scansRes.ok) setScans(await scansRes.json());
        } catch { /* scans fetch failed, not critical */ }
      }
    } catch { window.location.href = "/login"; }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Poll for subscription activation after Stripe redirect
  useEffect(() => {
    if (!justUpgraded || isActive) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/auth/me");
        if (res.ok) {
          const data = await res.json();
          if (data.subscriptionStatus === "active" || data.subscriptionStatus === "trialing") {
            setUser(data);
            clearInterval(interval);
            window.history.replaceState({}, "", "/dashboard");
            loadData();
          }
        }
      } catch { /* keep polling */ }
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
      setViewResult(data);
      setActiveTab("overview");
      setScanUrl("");
      loadData();
    } catch { setScanError("Scan failed."); }
    finally { setScanning(false); }
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
    const res = await fetch("/api/dashboard/export", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scanData: viewResult, whiteLabel: user?.plan === "agency" || user?.plan === "enterprise" }),
    });
    const html = await res.text();
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `agentready-report-${Date.now()}.html`; a.click();
    URL.revokeObjectURL(url);
  }

  async function openPortal() {
    setPortalLoading(true);
    try { const res = await fetch("/api/stripe/portal", { method: "POST" }); const data = await res.json(); if (data.url) window.location.href = data.url; }
    catch {} finally { setPortalLoading(false); }
  }

  async function logout() { await fetch("/api/auth/logout", { method: "POST" }); window.location.href = "/"; }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-sm text-[var(--text-dim)]">Loading...</div>;

  const planNames: Record<string, string> = { growth: "Growth", business: "Business", enterprise: "Enterprise", starter: "Starter", pro: "Pro", agency: "Agency" };
  const totalEstimatedGain = viewResult ? viewResult.actionPlan.reduce((s, a) => s + a.estimatedPoints, 0) : 0;

  return (
    <div className="min-h-screen">
      {/* Nav */}
      <nav className="border-b border-[var(--border)] px-6 py-3 sticky top-0 bg-[var(--bg)]/80 backdrop-blur-xl z-50">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <a href="/" className="flex items-center gap-2.5">
            <span className="w-7 h-7 rounded-md bg-[var(--accent)] flex items-center justify-center text-[11px] font-bold text-black">A</span>
            <span className="text-sm font-semibold text-white">AgentReady</span>
          </a>
          <div className="flex items-center gap-4">
            <span className="text-xs text-[var(--text-dim)] hidden sm:inline">{user?.email}</span>
            <button onClick={logout} className="text-xs text-[var(--text-dim)] hover:text-[var(--text-secondary)] transition cursor-pointer">Sign out</button>
          </div>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-xl font-bold text-white mb-1">Dashboard</h1>
            {isActive ? (
              <p className="text-sm text-[var(--text-secondary)]">
                {planNames[user?.plan || ""] || "Active"} plan &middot;
                <button onClick={openPortal} disabled={portalLoading} className="text-[var(--accent)] hover:underline ml-1 cursor-pointer">{portalLoading ? "Loading..." : "Manage billing"}</button>
              </p>
            ) : justUpgraded ? (
              <p className="text-sm text-[var(--accent)]">Processing your payment... This usually takes a few seconds.</p>
            ) : (
              <p className="text-sm text-[var(--red)]">No active subscription. <a href="/#pricing" className="text-[var(--accent)] hover:underline">Pick a plan</a></p>
            )}
          </div>
        </div>

        {/* Scanner */}
        {isActive && (
          <div className="surface rounded-xl p-5 mb-6">
            <p className="text-sm font-semibold text-white mb-1">Deep scan</p>
            <p className="text-xs text-[var(--text-secondary)] mb-3">We crawl your store, scan up to 12 pages, detect your platform, and generate fix code.</p>
            <form onSubmit={handleScan} className="flex gap-2">
              <input type="text" value={scanUrl} onChange={(e) => setScanUrl(e.target.value)} placeholder="yourstore.com" disabled={scanning}
                className="flex-1 rounded-lg bg-[var(--bg)] border border-[var(--border-light)] px-4 py-2.5 text-sm text-white placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--accent-border)]" />
              <button type="submit" disabled={scanning || !scanUrl.trim()}
                className="px-5 py-2.5 rounded-lg bg-[var(--accent)] text-black text-sm font-semibold hover:brightness-110 disabled:opacity-30 transition cursor-pointer disabled:cursor-not-allowed shrink-0">
                {scanning ? "Scanning..." : "Run deep scan"}
              </button>
            </form>
            {scanError && <p className="text-xs text-[var(--red)] mt-2">{scanError}</p>}
          </div>
        )}

        {/* Score History Chart */}
        {scans.length >= 2 && <ScoreChart scans={scans} />}

        {/* Scan Result */}
        {viewResult && (
          <div className="fade-up">
            {/* Result Header */}
            <div className="surface rounded-xl p-6 mb-6">
              <div className="flex flex-col sm:flex-row items-start gap-6">
                <div className="text-center">
                  <div className="text-4xl font-mono font-bold" style={{ color: viewResult.overallScore >= 75 ? "var(--green)" : viewResult.overallScore >= 45 ? "var(--yellow)" : "var(--red)" }}>
                    {viewResult.overallScore}
                  </div>
                  <div className="text-[10px] text-[var(--text-dim)] uppercase tracking-widest mt-1">{viewResult.grade}</div>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-mono text-[var(--text-secondary)] break-all mb-2">{viewResult.rootUrl}</p>
                  <div className="flex flex-wrap gap-3 text-[11px] text-[var(--text-dim)]">
                    <span>{viewResult.totalPages} pages scanned</span>
                    <span>{PLATFORM_LABELS[viewResult.platform]}</span>
                    <span>{viewResult.actionPlan.length} issues</span>
                    <span>~{totalEstimatedGain} points recoverable</span>
                    <span>{viewResult.scanDurationMs}ms</span>
                  </div>
                </div>
                <button onClick={handleExport}
                  className="px-4 py-2 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-light)] text-xs text-[var(--text)] hover:bg-[rgba(255,255,255,0.06)] transition cursor-pointer shrink-0">
                  Export report
                </button>
              </div>

              {/* Category bars */}
              <div className="mt-6 space-y-2">
                {viewResult.aggregatedCategories.map((cat, i) => {
                  const pct = cat.maxScore > 0 ? Math.round((cat.score / cat.maxScore) * 100) : 0;
                  const color = pct >= 70 ? "var(--green)" : pct >= 40 ? "var(--yellow)" : "var(--red)";
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color }} />
                      <span className="text-xs text-[var(--text)] w-40">{cat.name}</span>
                      <div className="flex-1 h-1.5 bg-[rgba(255,255,255,0.05)] rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
                      </div>
                      <span className="text-xs font-mono text-[var(--text-dim)] w-12 text-right">{cat.score}/{cat.maxScore}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 mb-4 bg-[var(--bg-raised)] rounded-lg p-1 w-fit">
              {(["overview", "actions", "pages", ...(canCompare ? ["compare"] : [])] as const).map((tab) => (
                <button key={tab} onClick={() => setActiveTab(tab as typeof activeTab)}
                  className={`px-4 py-1.5 rounded-md text-xs font-medium transition cursor-pointer ${activeTab === tab ? "bg-[var(--bg-elevated)] text-white" : "text-[var(--text-dim)] hover:text-[var(--text-secondary)]"}`}>
                  {tab === "overview" ? "Overview" : tab === "actions" ? `Action Plan (${viewResult.actionPlan.length})` : tab === "pages" ? "Pages" : "Compare"}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            {activeTab === "overview" && (
              <div className="surface rounded-xl p-5">
                <p className="text-sm font-semibold text-white mb-4">Quick wins</p>
                {viewResult.actionPlan.filter(a => a.impact === "high").slice(0, 5).map((a, i) => (
                  <ActionRow key={i} item={a} index={i} />
                ))}
                {viewResult.actionPlan.filter(a => a.impact === "high").length === 0 && (
                  <p className="text-sm text-[var(--text-dim)] py-4">No high-impact issues found. Check the full action plan for medium and low priority fixes.</p>
                )}
              </div>
            )}

            {activeTab === "actions" && (
              <div className="surface rounded-xl">
                <div className="px-5 pt-5 pb-3 flex items-center justify-between">
                  <p className="text-sm font-semibold text-white">All fixes, ranked by impact</p>
                  <p className="text-xs text-[var(--text-dim)]">~{totalEstimatedGain} total points recoverable</p>
                </div>
                <div className="px-4">
                  {viewResult.actionPlan.map((a, i) => <ActionRow key={i} item={a} index={i} />)}
                </div>
              </div>
            )}

            {activeTab === "pages" && <PageBreakdown result={viewResult} />}

            {activeTab === "compare" && canCompare && (
              <div className="surface rounded-xl p-5">
                <p className="text-sm font-semibold text-white mb-1">Competitor comparison</p>
                <p className="text-xs text-[var(--text-secondary)] mb-4">See how you stack up against a competitor. We deep scan both stores and show the gaps.</p>
                <form onSubmit={handleCompare} className="space-y-2 mb-6">
                  <input type="text" value={compMyUrl} onChange={(e) => setCompMyUrl(e.target.value)} placeholder="Your store URL"
                    className="w-full rounded-lg bg-[var(--bg)] border border-[var(--border-light)] px-4 py-2.5 text-sm text-white placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--accent-border)]" />
                  <input type="text" value={compTheirUrl} onChange={(e) => setCompTheirUrl(e.target.value)} placeholder="Competitor store URL"
                    className="w-full rounded-lg bg-[var(--bg)] border border-[var(--border-light)] px-4 py-2.5 text-sm text-white placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--accent-border)]" />
                  <button type="submit" disabled={comparing || !compMyUrl.trim() || !compTheirUrl.trim()}
                    className="px-5 py-2.5 rounded-lg bg-[var(--accent)] text-black text-sm font-semibold hover:brightness-110 disabled:opacity-30 transition cursor-pointer disabled:cursor-not-allowed">
                    {comparing ? "Comparing..." : "Run comparison"}
                  </button>
                </form>
                {compError && <p className="text-xs text-[var(--red)] mb-4">{compError}</p>}
                {compResult && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-[var(--bg)] rounded-lg p-4 text-center">
                        <p className="text-[10px] text-[var(--text-dim)] uppercase tracking-wider mb-1">You</p>
                        <p className="text-3xl font-mono font-bold" style={{ color: (compResult.you as { score: number }).score >= 75 ? "var(--green)" : "var(--red)" }}>
                          {(compResult.you as { score: number }).score}
                        </p>
                        <p className="text-xs text-[var(--text-dim)] mt-1 truncate">{(compResult.you as { url: string }).url}</p>
                      </div>
                      <div className="bg-[var(--bg)] rounded-lg p-4 text-center">
                        <p className="text-[10px] text-[var(--text-dim)] uppercase tracking-wider mb-1">Competitor</p>
                        <p className="text-3xl font-mono font-bold" style={{ color: (compResult.competitor as { score: number }).score >= 75 ? "var(--green)" : "var(--red)" }}>
                          {(compResult.competitor as { score: number }).score}
                        </p>
                        <p className="text-xs text-[var(--text-dim)] mt-1 truncate">{(compResult.competitor as { url: string }).url}</p>
                      </div>
                    </div>
                    <div className="text-center py-2">
                      {(compResult.scoreDiff as number) > 0 ? (
                        <p className="text-sm text-[var(--red)]">They&apos;re ahead by {compResult.scoreDiff as number} points</p>
                      ) : (compResult.scoreDiff as number) < 0 ? (
                        <p className="text-sm text-[var(--green)]">You&apos;re ahead by {Math.abs(compResult.scoreDiff as number)} points</p>
                      ) : (
                        <p className="text-sm text-[var(--text-secondary)]">You&apos;re tied</p>
                      )}
                    </div>
                    {(compResult.gaps as Array<{ category: string; you: number; competitor: number; gap: number }>)?.map((gap, i) => (
                      <div key={i} className="flex items-center gap-3 py-2 border-b border-[var(--border)] last:border-0">
                        <span className="text-xs text-[var(--text)] w-36">{gap.category}</span>
                        <div className="flex-1 flex items-center gap-2">
                          <span className="text-xs font-mono w-8 text-right" style={{ color: gap.you >= gap.competitor ? "var(--green)" : "var(--text-dim)" }}>{gap.you}%</span>
                          <div className="flex-1 h-1.5 bg-[rgba(255,255,255,0.05)] rounded-full relative overflow-hidden">
                            <div className="absolute left-0 h-full rounded-full bg-[var(--accent)]" style={{ width: `${gap.you}%` }} />
                          </div>
                          <span className="text-xs font-mono w-8" style={{ color: gap.competitor >= gap.you ? "var(--green)" : "var(--text-dim)" }}>{gap.competitor}%</span>
                        </div>
                        {gap.gap > 0 && <span className="text-[10px] text-[var(--red)]">-{gap.gap}</span>}
                        {gap.gap < 0 && <span className="text-[10px] text-[var(--green)]">+{Math.abs(gap.gap)}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Scan History */}
        {!viewResult && (
          <div className="surface rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[var(--border)]">
              <p className="text-sm font-semibold text-white">Scan history</p>
            </div>
            {scans.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <p className="text-sm text-[var(--text-dim)]">No scans yet. Run your first deep scan above.</p>
              </div>
            ) : (
              <div className="divide-y divide-[var(--border)]">
                {scans.map((scan, i) => (
                  <div key={i} className="px-5 py-3 flex items-center gap-4 hover:bg-[rgba(255,255,255,0.02)] transition">
                    <span className="text-lg font-mono font-bold tabular-nums w-10" style={{ color: scan.score >= 75 ? "var(--green)" : scan.score >= 45 ? "var(--yellow)" : "var(--red)" }}>{scan.score}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[var(--text)] truncate">{scan.url}</p>
                      <p className="text-[11px] text-[var(--text-dim)]">{new Date(scan.scannedAt).toLocaleString()}</p>
                    </div>
                    <button onClick={() => { try { setViewResult(JSON.parse(scan.resultJson)); setActiveTab("overview"); } catch {} }}
                      className="text-xs text-[var(--accent)] hover:underline cursor-pointer shrink-0">View report</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {viewResult && (
          <div className="mt-6 text-center">
            <button onClick={() => setViewResult(null)} className="text-xs text-[var(--text-dim)] hover:text-[var(--text-secondary)] cursor-pointer">Back to scan history</button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Dashboard() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-sm text-[var(--text-dim)]">Loading...</div>}>
      <DashboardInner />
    </Suspense>
  );
}
