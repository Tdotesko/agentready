"use client";

import { useState } from "react";
import type { DeepScanResult } from "@/lib/deep-scanner";

export default function AdminScanPage() {
  const [url, setUrl] = useState("");
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<DeepScanResult | null>(null);
  const [scanStep, setScanStep] = useState(0);

  async function handleScan(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim() || scanning) return;
    setScanning(true); setError(""); setResult(null); setScanStep(0);
    const stepInterval = setInterval(() => setScanStep(s => Math.min(s + 1, 5)), 2500);
    try {
      const res = await fetch("/api/dashboard/scan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: url.trim() }) });
      const data = await res.json();
      if (!res.ok) setError(data.error || "Scan failed.");
      else setResult(data);
    } catch { setError("Scan failed."); }
    finally { setScanning(false); clearInterval(stepInterval); }
  }

  const steps = ["Connecting to store", "Crawling pages", "Analyzing structured data", "Checking AI readiness", "Running 195 checks", "Generating report"];

  return (
    <>
      <h1 className="text-xl font-bold text-white mb-1">Run a Scan</h1>
      <p className="text-sm text-[var(--text-secondary)] mb-6">Deep scan any store. Crawls up to 50+ pages, runs 195 checks across 13 categories.</p>

      {/* Scan input */}
      <div className="surface rounded-2xl p-6 mb-6 max-w-2xl">
        <form onSubmit={handleScan} className="flex gap-3">
          <input type="text" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Enter any store URL (e.g. allbirds.com)"
            className="flex-1 rounded-xl bg-[var(--bg)] border border-[var(--border-light)] px-5 py-3.5 text-sm text-white placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--accent-border)] focus:shadow-[0_0_0_3px_var(--accent-soft)]" autoFocus />
          <button type="submit" disabled={scanning || !url.trim()} className="px-8 py-3.5 rounded-xl btn-primary text-sm cursor-pointer disabled:cursor-not-allowed shrink-0">
            {scanning ? "Scanning..." : "Scan"}
          </button>
        </form>
        {error && <p className="text-sm text-[var(--red)] mt-3 bg-[var(--red-soft)] rounded-lg px-4 py-2">{error}</p>}
      </div>

      {/* Scanning animation */}
      {scanning && (
        <div className="surface rounded-2xl p-8 max-w-2xl fade-up">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-8 h-8 border-3 border-[var(--accent)] border-t-transparent rounded-full animate-spin shrink-0" />
            <div>
              <p className="text-sm font-medium text-white">{steps[scanStep]}...</p>
              <p className="text-xs text-[var(--text-dim)]">This usually takes 10-30 seconds</p>
            </div>
          </div>
          <div className="h-1.5 bg-[rgba(255,255,255,0.05)] rounded-full overflow-hidden">
            <div className="h-full bg-[var(--accent)] rounded-full transition-all duration-500" style={{ width: `${((scanStep + 1) / steps.length) * 100}%` }} />
          </div>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="fade-up space-y-4 max-w-4xl">
          {/* Score header */}
          <div className="surface rounded-2xl p-6">
            <div className="flex flex-col sm:flex-row items-start gap-6">
              <div className="text-center shrink-0">
                <div className="w-24 h-24 rounded-2xl bg-[var(--bg)] flex flex-col items-center justify-center">
                  <p className="text-3xl font-mono font-bold" style={{ color: result.overallScore >= 72 ? "var(--green)" : result.overallScore >= 58 ? "var(--yellow)" : "var(--red)" }}>{result.overallScore}</p>
                  <p className="text-[10px] text-[var(--text-dim)] uppercase tracking-widest">{result.grade}</p>
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-lg font-semibold text-white mb-1">{result.rootUrl}</p>
                <div className="flex flex-wrap gap-2 text-[10px] mb-3">
                  <span className="px-2.5 py-1 rounded-lg bg-[var(--accent-soft)] border border-[var(--accent-border)] text-[var(--accent)] font-medium">{result.platform}</span>
                  <span className="px-2.5 py-1 rounded-lg bg-[rgba(255,255,255,0.04)] text-[var(--text-dim)]">{result.totalPages} pages scanned</span>
                  <span className="px-2.5 py-1 rounded-lg bg-[rgba(255,255,255,0.04)] text-[var(--text-dim)]">{result.actionPlan.length} things to fix</span>
                  <span className="px-2.5 py-1 rounded-lg bg-[rgba(255,255,255,0.04)] text-[var(--text-dim)]">{(result.scanDurationMs / 1000).toFixed(1)}s scan time</span>
                </div>
                {result.overallScore < 58 && <p className="text-sm text-[var(--red)]">This store has major gaps that AI shopping bots will notice. Fixing the top issues would make a big difference.</p>}
                {result.overallScore >= 58 && result.overallScore < 72 && <p className="text-sm text-[var(--yellow)]">This store is partially ready for AI shopping, but there are important things to improve.</p>}
                {result.overallScore >= 72 && <p className="text-sm text-[var(--green)]">This store is well set up for AI shopping bots.</p>}
              </div>
            </div>
          </div>

          {/* Categories */}
          <div className="surface rounded-2xl overflow-hidden">
            <div className="px-5 py-3 border-b border-[var(--border)]">
              <p className="text-xs font-semibold text-[var(--text-dim)] uppercase tracking-widest">13 categories, 195 checks</p>
            </div>
            {result.aggregatedCategories.map((cat, i) => {
              const pct = cat.maxScore > 0 ? Math.round((cat.score / cat.maxScore) * 100) : 0;
              const color = pct >= 70 ? "var(--green)" : pct >= 40 ? "var(--yellow)" : "var(--red)";
              return (
                <div key={i} className="px-5 py-3 flex items-center gap-4 border-b border-[var(--border)] last:border-0 hover:bg-[rgba(255,255,255,0.015)]">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
                  <span className="text-sm text-[var(--text)] flex-1">{cat.name}</span>
                  <div className="w-24 h-2 bg-[rgba(255,255,255,0.05)] rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
                  </div>
                  <span className="text-xs font-mono text-[var(--text-dim)] w-12 text-right">{pct}%</span>
                </div>
              );
            })}
          </div>

          {/* Top fixes */}
          <div className="surface rounded-2xl overflow-hidden">
            <div className="px-5 py-3 border-b border-[var(--border)]">
              <p className="text-xs font-semibold text-[var(--text-dim)] uppercase tracking-widest">What to fix (top {Math.min(10, result.actionPlan.length)} by impact)</p>
            </div>
            {result.actionPlan.slice(0, 10).map((a, i) => (
              <div key={i} className="px-5 py-3 flex items-start gap-3 border-b border-[var(--border)] last:border-0">
                <span className="text-xs font-mono text-[var(--text-dim)] w-5 pt-0.5 shrink-0">{i + 1}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${a.impact === "high" ? "bg-[var(--red-soft)] text-[var(--red)]" : a.impact === "medium" ? "bg-[var(--yellow-soft)] text-[var(--yellow)]" : "bg-[rgba(255,255,255,0.04)] text-[var(--text-dim)]"}`}>{a.impact}</span>
                    <span className="text-[10px] text-[var(--text-dim)]">{a.category}</span>
                  </div>
                  <p className="text-sm text-[var(--text)] leading-relaxed">{a.fix}</p>
                  {a.code && (
                    <details className="mt-2">
                      <summary className="text-[11px] text-[var(--accent)] cursor-pointer hover:underline">Show code to copy</summary>
                      <pre className="mt-2 text-[11px] bg-[var(--bg)] border border-[var(--border)] rounded-lg p-3 overflow-x-auto text-[var(--text-secondary)] leading-relaxed">{a.code}</pre>
                    </details>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Pages scanned */}
          <div className="surface rounded-2xl overflow-hidden">
            <div className="px-5 py-3 border-b border-[var(--border)]">
              <p className="text-xs font-semibold text-[var(--text-dim)] uppercase tracking-widest">Pages scanned ({result.pages.length})</p>
            </div>
            {result.pages.slice(0, 20).map((p, i) => (
              <div key={i} className="px-5 py-2 flex items-center gap-3 border-b border-[var(--border)] last:border-0">
                <span className="text-sm font-mono font-bold w-8" style={{ color: p.result.overallScore >= 72 ? "var(--green)" : p.result.overallScore >= 58 ? "var(--yellow)" : "var(--red)" }}>{p.result.overallScore}</span>
                <span className="text-xs text-[var(--text)] flex-1 truncate">{p.url}</span>
                <span className="text-[9px] px-2 py-0.5 rounded bg-[rgba(255,255,255,0.04)] text-[var(--text-dim)]">{p.type}</span>
              </div>
            ))}
            {result.pages.length > 20 && <p className="px-5 py-2 text-xs text-[var(--text-dim)]">...and {result.pages.length - 20} more pages</p>}
          </div>
        </div>
      )}
    </>
  );
}
