"use client";

import { useState, useEffect } from "react";

interface Prospect { id: number; url: string; email: string | null; storeName: string | null; platform: string | null; score: number | null; grade: string | null; status: string; source: string | null; notes: string | null; lastContactedAt: string | null; createdAt: string; }

export default function AdminProspectsPage() {
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [url, setUrl] = useState("");
  const [adding, setAdding] = useState(false);
  const [importUrls, setImportUrls] = useState("");
  const [importing, setImporting] = useState(false);
  const [filter, setFilter] = useState("");

  function load() { fetch("/api/admin/prospects").then(r => r.ok ? r.json() : { prospects: [] }).then(d => setProspects(d.prospects || [])); }
  useEffect(() => { load(); }, []);

  async function addProspect() {
    if (!url.trim() || adding) return;
    setAdding(true);
    await fetch("/api/admin/prospects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url }) });
    setUrl(""); setAdding(false); load();
  }

  async function bulkImport() {
    if (!importUrls.trim() || importing) return;
    setImporting(true);
    await fetch("/api/admin/prospects/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ urls: importUrls.split("\n").filter(Boolean) }) });
    setImportUrls(""); setImporting(false); load();
  }

  const filtered = filter ? prospects.filter(p => p.status === filter) : prospects;

  return (
    <>
      <h1 className="text-xl font-bold text-white mb-1">Prospects</h1>
      <p className="text-sm text-[var(--text-secondary)] mb-6">{prospects.length} total prospects. Add stores, auto-scan, and send outreach.</p>

      {/* Add prospect */}
      <div className="surface rounded-xl p-5 mb-6">
        <p className="text-sm font-semibold text-white mb-3">Add a prospect</p>
        <div className="flex gap-2 mb-3">
          <input type="text" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Enter store URL..."
            className="flex-1 rounded-lg bg-[var(--bg)] border border-[var(--border-light)] px-4 py-2.5 text-sm text-white placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--accent-border)]"
            onKeyDown={(e) => e.key === "Enter" && addProspect()} />
          <button onClick={addProspect} disabled={adding || !url.trim()}
            className="px-5 py-2.5 rounded-lg btn-primary text-sm cursor-pointer disabled:cursor-not-allowed shrink-0">
            {adding ? "Scanning..." : "Add + Scan"}
          </button>
        </div>
        <details className="text-[10px] text-[var(--text-dim)]">
          <summary className="cursor-pointer hover:text-[var(--text-secondary)]">Bulk import URLs</summary>
          <textarea value={importUrls} onChange={(e) => setImportUrls(e.target.value)} rows={4} placeholder="One URL per line..."
            className="w-full mt-2 rounded-lg bg-[var(--bg)] border border-[var(--border-light)] px-3 py-2 text-xs text-white placeholder:text-[var(--text-dim)]" />
          <button onClick={bulkImport} disabled={importing} className="mt-1 px-3 py-1.5 rounded btn-secondary text-[10px] cursor-pointer">{importing ? "Importing..." : "Import all"}</button>
        </details>
      </div>

      {/* Status filter */}
      <div className="flex gap-1.5 mb-4 flex-wrap">
        {["", "new", "contacted", "replied", "converted", "dead"].map((s) => (
          <button key={s} onClick={() => setFilter(s)} className={`px-3 py-1.5 rounded-lg text-[10px] font-medium cursor-pointer transition ${filter === s ? "bg-[var(--accent)] text-black" : "bg-[var(--bg-raised)] text-[var(--text-dim)] hover:text-[var(--text)]"}`}>{s || "All"} {s && `(${prospects.filter(p => p.status === s).length})`}</button>
        ))}
      </div>

      {/* Table */}
      <div className="surface rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead><tr className="border-b border-[var(--border)]">
              <th className="px-4 py-3 text-[10px] font-semibold text-[var(--text-dim)] uppercase">Score</th>
              <th className="px-4 py-3 text-[10px] font-semibold text-[var(--text-dim)] uppercase">Store</th>
              <th className="px-4 py-3 text-[10px] font-semibold text-[var(--text-dim)] uppercase">Email</th>
              <th className="px-4 py-3 text-[10px] font-semibold text-[var(--text-dim)] uppercase">Platform</th>
              <th className="px-4 py-3 text-[10px] font-semibold text-[var(--text-dim)] uppercase">Status</th>
              <th className="px-4 py-3 text-[10px] font-semibold text-[var(--text-dim)] uppercase">Added</th>
              <th className="px-4 py-3 text-[10px] font-semibold text-[var(--text-dim)] uppercase">Actions</th>
            </tr></thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className="border-b border-[var(--border)] hover:bg-[rgba(255,255,255,0.015)]">
                  <td className="px-4 py-3"><span className="text-lg font-mono font-bold" style={{ color: (p.score || 0) >= 75 ? "var(--green)" : (p.score || 0) >= 45 ? "var(--yellow)" : "var(--red)" }}>{p.score ?? "-"}</span></td>
                  <td className="px-4 py-3"><p className="text-sm text-[var(--text)]">{p.storeName || p.url}</p><p className="text-[10px] text-[var(--text-dim)] truncate max-w-[200px]">{p.url}</p></td>
                  <td className="px-4 py-3 text-xs text-[var(--text-secondary)]">{p.email || <span className="text-[var(--text-dim)]">none</span>}</td>
                  <td className="px-4 py-3"><span className="text-xs text-[var(--accent)] capitalize">{p.platform || "-"}</span></td>
                  <td className="px-4 py-3">
                    <select value={p.status} onChange={async (e) => { await fetch("/api/admin/prospects", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: p.id, status: e.target.value }) }); load(); }}
                      className="bg-[var(--bg)] border border-[var(--border-light)] rounded px-2 py-1 text-[10px] text-white cursor-pointer">
                      {["new", "contacted", "replied", "converted", "dead"].map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-[10px] text-[var(--text-dim)]">{new Date(p.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button onClick={async () => { await fetch("/api/admin/prospects/scan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: p.id }) }); load(); }}
                        className="text-[10px] text-[var(--text-dim)] hover:text-[var(--accent)] cursor-pointer">Rescan</button>
                      {p.email && <button onClick={async () => { await fetch("/api/admin/email/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prospectId: p.id }) }); load(); }}
                        className="text-[10px] text-[var(--accent)] hover:underline cursor-pointer">Send outreach</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && <p className="px-4 py-8 text-center text-sm text-[var(--text-dim)]">No prospects {filter ? `with status "${filter}"` : "yet"}.</p>}
      </div>
    </>
  );
}
