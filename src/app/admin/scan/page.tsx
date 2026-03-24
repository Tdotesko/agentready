"use client";

import { useState } from "react";
import type { DeepScanResult } from "@/lib/deep-scanner";

export default function AdminScanPage() {
  const [url, setUrl] = useState("");
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<DeepScanResult | null>(null);

  async function handleScan(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim() || scanning) return;
    setScanning(true); setError(""); setResult(null);
    try {
      const res = await fetch("/api/dashboard/scan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: url.trim() }) });
      const data = await res.json();
      if (!res.ok) setError(data.error || "Scan failed.");
      else setResult(data);
    } catch { setError("Scan failed."); }
    finally { setScanning(false); }
  }

  return (
    <>
      <h1 className="text-xl font-bold text-white mb-1">Run a Scan</h1>
      <p className="text-sm text-[var(--text-secondary)] mb-6">Run a deep scan as admin. Results are saved to your scan history.</p>

      <div className="surface rounded-xl p-5 mb-6 max-w-xl">
        <form onSubmit={handleScan} className="flex gap-2">
          <input type="text" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Enter store URL..."
            className="flex-1 rounded-lg bg-[var(--bg)] border border-[var(--border-light)] px-4 py-3 text-sm text-white placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--accent-border)]" autoFocus />
          <button type="submit" disabled={scanning || !url.trim()} className="px-6 py-3 rounded-lg btn-primary text-sm cursor-pointer disabled:cursor-not-allowed shrink-0">
            {scanning ? "Scanning..." : "Run deep scan"}
          </button>
        </form>
        {error && <p className="text-xs text-[var(--red)] mt-2">{error}</p>}
      </div>

      {result && (
        <div className="surface rounded-xl p-5 fade-up">
          <div className="flex items-start gap-6 mb-6">
            <div className="text-center">
              <p className="text-4xl font-mono font-bold" style={{ color: result.overallScore >= 75 ? "var(--green)" : result.overallScore >= 45 ? "var(--yellow)" : "var(--red)" }}>{result.overallScore}</p>
              <p className="text-[10px] text-[var(--text-dim)] uppercase tracking-widest">{result.grade}</p>
            </div>
            <div>
              <p className="text-sm font-mono text-[var(--text-secondary)] break-all mb-2">{result.rootUrl}</p>
              <div className="flex flex-wrap gap-2 text-[10px] text-[var(--text-dim)]">
                <span className="px-2 py-0.5 rounded bg-[rgba(255,255,255,0.04)]">{result.totalPages} pages</span>
                <span className="px-2 py-0.5 rounded bg-[var(--accent-soft)] text-[var(--accent)]">{result.platform}</span>
                <span className="px-2 py-0.5 rounded bg-[rgba(255,255,255,0.04)]">{result.actionPlan.length} issues</span>
                <span className="px-2 py-0.5 rounded bg-[rgba(255,255,255,0.04)]">{result.scanDurationMs}ms</span>
              </div>
            </div>
          </div>

          {/* Categories */}
          <div className="space-y-2 mb-6">
            {result.aggregatedCategories.map((cat, i) => {
              const pct = cat.maxScore > 0 ? Math.round((cat.score / cat.maxScore) * 100) : 0;
              const color = pct >= 70 ? "var(--green)" : pct >= 40 ? "var(--yellow)" : "var(--red)";
              return (
                <div key={i} className="flex items-center gap-3">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
                  <span className="text-xs text-[var(--text)] w-40">{cat.name}</span>
                  <div className="flex-1 h-1.5 bg-[rgba(255,255,255,0.05)] rounded-full overflow-hidden"><div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} /></div>
                  <span className="text-xs font-mono text-[var(--text-dim)] w-12 text-right">{cat.score}/{cat.maxScore}</span>
                </div>
              );
            })}
          </div>

          {/* Action plan */}
          <h3 className="text-sm font-semibold text-white mb-3">Action Plan ({result.actionPlan.length} fixes)</h3>
          <div className="space-y-2">
            {result.actionPlan.map((a, i) => (
              <div key={i} className="flex items-start gap-3 py-2 border-b border-[var(--border)] last:border-0">
                <span className="text-[10px] text-[var(--text-dim)] font-mono w-4 pt-0.5">{i + 1}</span>
                <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded shrink-0 ${a.impact === "high" ? "bg-[var(--red-soft)] text-[var(--red)]" : a.impact === "medium" ? "bg-[var(--yellow-soft)] text-[var(--yellow)]" : "bg-[rgba(255,255,255,0.04)] text-[var(--text-dim)]"}`}>{a.impact}</span>
                <p className="text-xs text-[var(--text)] flex-1">{a.fix}</p>
              </div>
            ))}
          </div>

          {/* Pages */}
          <h3 className="text-sm font-semibold text-white mt-6 mb-3">Pages Scanned ({result.pages.length})</h3>
          {result.pages.map((p, i) => (
            <div key={i} className="flex items-center gap-3 py-1.5 border-b border-[var(--border)] last:border-0">
              <span className="text-sm font-mono font-bold w-8" style={{ color: p.result.overallScore >= 75 ? "var(--green)" : p.result.overallScore >= 45 ? "var(--yellow)" : "var(--red)" }}>{p.result.overallScore}</span>
              <span className="text-xs text-[var(--text)] flex-1 truncate">{p.url}</span>
              <span className="text-[9px] text-[var(--text-dim)] px-1.5 py-0.5 rounded bg-[rgba(255,255,255,0.04)]">{p.type}</span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
