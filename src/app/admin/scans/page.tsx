"use client";

import { useState, useEffect } from "react";

export default function AdminScansPage() {
  const [scans, setScans] = useState<{ userId: string; url: string; score: number; grade: string; scannedAt: string }[]>([]);
  useEffect(() => { fetch("/api/admin/scans").then(r => r.ok ? r.json() : []).then(setScans); }, []);

  return (
    <>
      <h1 className="text-xl font-bold text-white mb-1">All Scans</h1>
      <p className="text-sm text-[var(--text-secondary)] mb-6">{scans.length} total scans across all users.</p>
      <div className="surface rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead><tr className="border-b border-[var(--border)]">
              <th className="px-4 py-3 text-[10px] font-semibold text-[var(--text-dim)] uppercase">Score</th>
              <th className="px-4 py-3 text-[10px] font-semibold text-[var(--text-dim)] uppercase">URL</th>
              <th className="px-4 py-3 text-[10px] font-semibold text-[var(--text-dim)] uppercase">Grade</th>
              <th className="px-4 py-3 text-[10px] font-semibold text-[var(--text-dim)] uppercase">Date</th>
            </tr></thead>
            <tbody>
              {scans.map((s, i) => (
                <tr key={i} className="border-b border-[var(--border)]">
                  <td className="px-4 py-3"><span className="text-lg font-mono font-bold" style={{ color: s.score >= 75 ? "var(--green)" : s.score >= 45 ? "var(--yellow)" : "var(--red)" }}>{s.score}</span></td>
                  <td className="px-4 py-3 text-sm text-[var(--text)] truncate max-w-[300px]">{s.url}</td>
                  <td className="px-4 py-3 text-xs text-[var(--text-dim)]">{s.grade}</td>
                  <td className="px-4 py-3 text-xs text-[var(--text-dim)]">{new Date(s.scannedAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {scans.length === 0 && <p className="px-4 py-8 text-center text-sm text-[var(--text-dim)]">No scans recorded yet.</p>}
      </div>
    </>
  );
}
