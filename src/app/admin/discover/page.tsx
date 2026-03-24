"use client";

import { useState } from "react";

export default function AdminDiscoverPage() {
  const [directoryUrl, setDirectoryUrl] = useState("");
  const [manualUrls, setManualUrls] = useState("");
  const [running, setRunning] = useState("");
  const [results, setResults] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState("");

  async function runAction(action: string, body: Record<string, unknown>) {
    setRunning(action); setError(""); setResults(null);
    try {
      const res = await fetch("/api/admin/discover", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...body }) });
      const data = await res.json();
      if (!res.ok) setError(data.error || "Failed");
      else setResults(data);
    } catch { setError("Request failed"); }
    finally { setRunning(""); }
  }

  return (
    <>
      <h1 className="text-xl font-bold text-white mb-1">Lead Discovery</h1>
      <p className="text-sm text-[var(--text-secondary)] mb-6">Automatically find e-commerce stores, scan them, and contact the ones with low AI readiness scores.</p>

      {/* Results */}
      {results && (
        <div className="surface rounded-xl p-4 mb-6 fade-up">
          <p className="text-[9px] font-semibold text-[var(--text-dim)] uppercase tracking-widest mb-2">Results</p>
          <div className="flex gap-6 text-sm">
            {Object.entries(results).map(([key, val]) => (
              <div key={key}>
                {typeof val === "object" && val !== null ? (
                  Object.entries(val as Record<string, number>).map(([k, v]) => (
                    <div key={k} className="flex items-center gap-2">
                      <span className="text-[var(--text-dim)]">{k}:</span>
                      <span className="font-mono text-[var(--accent)]">{v}</span>
                    </div>
                  ))
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-[var(--text-dim)]">{key}:</span>
                    <span className="font-mono text-[var(--accent)]">{String(val)}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      {error && <div className="surface rounded-xl p-4 mb-6 text-sm text-[var(--red)]">{error}</div>}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Discover from directory */}
        <div className="surface rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white mb-1">Scan a store directory</h2>
          <p className="text-xs text-[var(--text-secondary)] mb-4">Enter a URL of a page that lists e-commerce stores (like a directory, marketplace, or list article). We will extract store URLs, scan each one, and auto-contact low scorers.</p>
          <input type="url" value={directoryUrl} onChange={(e) => setDirectoryUrl(e.target.value)} placeholder="https://example.com/top-shopify-stores"
            className="w-full rounded-lg bg-[var(--bg)] border border-[var(--border-light)] px-4 py-2.5 text-sm text-white placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--accent-border)] mb-3" />
          <button onClick={() => runAction("directory", { directoryUrl })} disabled={running === "directory" || !directoryUrl.trim()}
            className="px-5 py-2.5 rounded-lg btn-primary text-sm cursor-pointer disabled:cursor-not-allowed">
            {running === "directory" ? "Discovering..." : "Scan directory"}
          </button>
        </div>

        {/* Manual URL list */}
        <div className="surface rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white mb-1">Import store URLs</h2>
          <p className="text-xs text-[var(--text-secondary)] mb-4">Paste a list of store URLs (one per line). Each will be scanned and added as a prospect. Low scorers with contact info get auto-outreach.</p>
          <textarea value={manualUrls} onChange={(e) => setManualUrls(e.target.value)} rows={5} placeholder="store1.com&#10;store2.shop&#10;store3.com"
            className="w-full rounded-lg bg-[var(--bg)] border border-[var(--border-light)] px-4 py-2.5 text-sm text-white placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--accent-border)] mb-3" />
          <button onClick={() => runAction("urls", { urls: manualUrls.split("\n").map(u => u.trim()).filter(Boolean) })} disabled={running === "urls" || !manualUrls.trim()}
            className="px-5 py-2.5 rounded-lg btn-primary text-sm cursor-pointer disabled:cursor-not-allowed">
            {running === "urls" ? "Processing..." : "Import and scan"}
          </button>
        </div>
      </div>

      {/* Re-contact */}
      <div className="surface rounded-xl p-5 mt-6">
        <h2 className="text-sm font-semibold text-white mb-1">Auto-contact low scorers</h2>
        <p className="text-xs text-[var(--text-secondary)] mb-4">Find all prospects with scores under 60 that have a contact email but haven&apos;t been contacted yet. Automatically queue a 3-email cold outreach sequence for each.</p>
        <button onClick={() => runAction("recontact", {})} disabled={running === "recontact"}
          className="px-5 py-2.5 rounded-lg btn-primary text-sm cursor-pointer disabled:cursor-not-allowed">
          {running === "recontact" ? "Contacting..." : "Auto-contact low scorers"}
        </button>
      </div>

      {/* How it works */}
      <div className="mt-8 space-y-3 text-xs text-[var(--text-secondary)]">
        <p className="text-[9px] font-semibold text-[var(--text-dim)] uppercase tracking-widest">How auto-discovery works</p>
        <ol className="list-decimal pl-4 space-y-1.5">
          <li>You provide a directory URL or list of store URLs</li>
          <li>CartParse scans each store, detects the platform, extracts contact email, and scores their AI readiness</li>
          <li>Stores scoring below 60 with a discoverable email get a 3-email cold outreach sequence automatically queued</li>
          <li>The sequence sends: score reveal (immediately), specific findings (48h later), competitor urgency (5 days later)</li>
          <li>Track results in the Prospects and Email tabs</li>
        </ol>
        <p>For fully automated discovery, set up a cron job to call <code className="text-[var(--accent)] bg-[var(--bg-elevated)] px-1 rounded">POST /api/cron/discover-leads</code> periodically.</p>
      </div>
    </>
  );
}
