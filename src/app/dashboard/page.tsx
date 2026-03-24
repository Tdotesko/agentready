"use client";

import { useState, useEffect, useCallback } from "react";
import type { ScanResult } from "@/lib/scanner";

interface UserData {
  id: string;
  email: string;
  plan?: string;
  subscriptionStatus?: string;
}

interface ScanRecord {
  url: string;
  score: number;
  grade: string;
  scannedAt: string;
  resultJson: string;
}

export default function Dashboard() {
  const [user, setUser] = useState<UserData | null>(null);
  const [scans, setScans] = useState<ScanRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanUrl, setScanUrl] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState("");
  const [viewingScan, setViewingScan] = useState<ScanResult | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);

  const isActive = user?.subscriptionStatus === "active" || user?.subscriptionStatus === "trialing";

  const loadData = useCallback(async () => {
    try {
      const [meRes, scansRes] = await Promise.all([
        fetch("/api/auth/me"),
        fetch("/api/dashboard/scans"),
      ]);
      if (!meRes.ok) { window.location.href = "/login"; return; }
      setUser(await meRes.json());
      if (scansRes.ok) setScans(await scansRes.json());
    } catch { window.location.href = "/login"; }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleScan(e: React.FormEvent) {
    e.preventDefault();
    if (!scanUrl.trim() || scanning) return;
    setScanning(true); setScanError("");
    try {
      const res = await fetch("/api/dashboard/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: scanUrl.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setScanError(data.error); return; }
      setViewingScan(data);
      setScanUrl("");
      loadData();
    } catch { setScanError("Scan failed."); }
    finally { setScanning(false); }
  }

  async function openPortal() {
    setPortalLoading(true);
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch { /* noop */ }
    finally { setPortalLoading(false); }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-sm text-[var(--text-dim)]">Loading...</div>;

  const planNames: Record<string, string> = { starter: "Starter", pro: "Pro", agency: "Agency" };

  return (
    <div className="min-h-screen">
      {/* Nav */}
      <nav className="border-b border-[var(--border)] px-6 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <a href="/" className="flex items-center gap-2.5">
            <span className="w-7 h-7 rounded-md bg-[var(--accent)] flex items-center justify-center text-[11px] font-bold text-black">A</span>
            <span className="text-sm font-semibold text-white">AgentReady</span>
          </a>
          <div className="flex items-center gap-4">
            <span className="text-xs text-[var(--text-dim)]">{user?.email}</span>
            <button onClick={logout} className="text-xs text-[var(--text-dim)] hover:text-[var(--text-secondary)] transition cursor-pointer">Sign out</button>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-10">
        {/* Subscription status */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-10">
          <div>
            <h1 className="text-xl font-bold text-white mb-1">Dashboard</h1>
            {isActive ? (
              <p className="text-sm text-[var(--text-secondary)]">
                {planNames[user?.plan || ""] || "Active"} plan &middot;
                <button onClick={openPortal} disabled={portalLoading}
                  className="text-[var(--accent)] hover:underline ml-1 cursor-pointer disabled:opacity-40">
                  {portalLoading ? "Loading..." : "Manage billing"}
                </button>
              </p>
            ) : (
              <p className="text-sm text-[var(--red)]">
                No active subscription.
                <a href="/#pricing" className="text-[var(--accent)] hover:underline ml-1">Pick a plan</a>
              </p>
            )}
          </div>
        </div>

        {/* Scanner */}
        {isActive && (
          <div className="surface rounded-xl p-6 mb-8">
            <p className="text-sm font-semibold text-white mb-3">Run a new scan</p>
            <form onSubmit={handleScan} className="flex gap-2">
              <input type="text" value={scanUrl} onChange={(e) => setScanUrl(e.target.value)}
                placeholder="yourstore.com" disabled={scanning}
                className="flex-1 rounded-lg bg-[var(--bg)] border border-[var(--border-light)] px-4 py-2.5 text-sm text-white placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--accent-border)]" />
              <button type="submit" disabled={scanning || !scanUrl.trim()}
                className="px-5 py-2.5 rounded-lg bg-[var(--accent)] text-black text-sm font-semibold hover:brightness-110 disabled:opacity-30 transition cursor-pointer disabled:cursor-not-allowed shrink-0">
                {scanning ? "Scanning..." : "Scan"}
              </button>
            </form>
            {scanError && <p className="text-xs text-[var(--red)] mt-2">{scanError}</p>}
          </div>
        )}

        {/* Viewing a scan result */}
        {viewingScan && isActive && (
          <div className="surface rounded-xl p-6 mb-8 fade-up">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm font-semibold text-white">Scan Result</p>
                <p className="text-xs font-mono text-[var(--text-dim)]">{viewingScan.url}</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-mono font-bold" style={{
                  color: viewingScan.overallScore >= 75 ? "var(--green)" : viewingScan.overallScore >= 45 ? "var(--yellow)" : "var(--red)"
                }}>{viewingScan.overallScore}</p>
                <p className="text-[10px] text-[var(--text-dim)] uppercase">{viewingScan.grade}</p>
              </div>
            </div>
            {viewingScan.categories.map((cat, i) => {
              const pct = Math.round((cat.score / cat.maxScore) * 100);
              const color = pct >= 70 ? "var(--green)" : pct >= 40 ? "var(--yellow)" : "var(--red)";
              return (
                <div key={i} className="border-t border-[var(--border)] py-3">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color }} />
                    <span className="flex-1 text-sm text-[var(--text)]">{cat.name}</span>
                    <span className="text-xs font-mono text-[var(--text-dim)]">{cat.score}/{cat.maxScore}</span>
                  </div>
                  {cat.findings.map((f, j) => (
                    <p key={`f${j}`} className="text-xs text-[var(--text-secondary)] ml-5 mb-1 flex gap-2">
                      <span className="text-[var(--green)]">&#10003;</span>{f}
                    </p>
                  ))}
                  {cat.recommendations.map((r, j) => (
                    <p key={`r${j}`} className="text-xs ml-5 mb-1 flex gap-2">
                      <span className="text-[var(--accent)]">&#8227;</span>
                      <span className="text-[var(--text)]">{r}</span>
                    </p>
                  ))}
                </div>
              );
            })}
            <button onClick={() => setViewingScan(null)}
              className="mt-4 text-xs text-[var(--text-dim)] hover:text-[var(--text-secondary)] cursor-pointer">Close</button>
          </div>
        )}

        {/* Scan history */}
        <div className="surface rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-[var(--border)]">
            <p className="text-sm font-semibold text-white">Scan history</p>
          </div>
          {scans.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="text-sm text-[var(--text-dim)]">No scans yet. Run your first scan above.</p>
            </div>
          ) : (
            <div className="divide-y divide-[var(--border)]">
              {scans.map((scan, i) => (
                <div key={i} className="px-6 py-3 flex items-center gap-4">
                  <span className="text-lg font-mono font-bold tabular-nums w-10" style={{
                    color: scan.score >= 75 ? "var(--green)" : scan.score >= 45 ? "var(--yellow)" : "var(--red)"
                  }}>{scan.score}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[var(--text)] truncate">{scan.url}</p>
                    <p className="text-[11px] text-[var(--text-dim)]">{new Date(scan.scannedAt).toLocaleString()}</p>
                  </div>
                  {isActive && (
                    <button onClick={() => setViewingScan(JSON.parse(scan.resultJson))}
                      className="text-xs text-[var(--accent)] hover:underline cursor-pointer shrink-0">View</button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
