"use client";

import { useState, useEffect } from "react";

export default function AdminLeadsPage() {
  const [leads, setLeads] = useState<{ email: string; scannedUrl: string; score: number; submittedAt: string }[]>([]);
  useEffect(() => { fetch("/api/admin/leads").then(r => r.ok ? r.json() : []).then(setLeads); }, []);

  return (
    <>
      <h1 className="text-xl font-bold text-white mb-1">Leads</h1>
      <p className="text-sm text-[var(--text-secondary)] mb-6">{leads.length} email captures from free scans.</p>
      <div className="surface rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead><tr className="border-b border-[var(--border)]">
              <th className="px-4 py-3 text-[10px] font-semibold text-[var(--text-dim)] uppercase">Email</th>
              <th className="px-4 py-3 text-[10px] font-semibold text-[var(--text-dim)] uppercase">Scanned URL</th>
              <th className="px-4 py-3 text-[10px] font-semibold text-[var(--text-dim)] uppercase">Score</th>
              <th className="px-4 py-3 text-[10px] font-semibold text-[var(--text-dim)] uppercase">Date</th>
            </tr></thead>
            <tbody>
              {leads.map((l, i) => (
                <tr key={i} className="border-b border-[var(--border)]">
                  <td className="px-4 py-3 text-sm text-[var(--text)]">{l.email}</td>
                  <td className="px-4 py-3 text-sm text-[var(--text-secondary)] truncate max-w-[250px]">{l.scannedUrl}</td>
                  <td className="px-4 py-3 text-sm font-mono" style={{ color: l.score >= 60 ? "var(--green)" : l.score >= 40 ? "var(--yellow)" : "var(--red)" }}>{l.score}</td>
                  <td className="px-4 py-3 text-xs text-[var(--text-dim)]">{new Date(l.submittedAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {leads.length === 0 && <p className="px-4 py-8 text-center text-sm text-[var(--text-dim)]">No leads captured yet. Leads come from the free scan email gate.</p>}
      </div>
    </>
  );
}
