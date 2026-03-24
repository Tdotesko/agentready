"use client";

import { useState, useEffect } from "react";

function Stat({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="surface rounded-xl p-4">
      <p className="text-[9px] font-semibold text-[var(--text-dim)] uppercase tracking-widest mb-1">{label}</p>
      <p className="text-xl font-bold font-mono tabular-nums" style={{ color: color || "white" }}>{value}</p>
      {sub && <p className="text-[10px] text-[var(--text-dim)] mt-0.5">{sub}</p>}
    </div>
  );
}

interface EmailStats { queued: number; sent: number; sentToday: number; dailyLimit: number; dailyRemaining: number; opened: number; clicked: number; bounced: number; openRate: number; clickRate: number; }
interface QueueItem { id: number; recipient_email: string; subject: string; status: string; send_after: string; }
interface LogItem { id: number; recipient_email: string; subject: string; status: string; sent_at: string; }

export default function AdminEmailPage() {
  const [stats, setStats] = useState<EmailStats | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [log, setLog] = useState<LogItem[]>([]);

  function load() {
    fetch("/api/admin/email/stats").then(r => r.ok ? r.json() : null).then((d: { stats?: EmailStats; queue?: QueueItem[]; log?: LogItem[] } | null) => { if (d) { setStats(d.stats || null); setQueue(d.queue || []); setLog(d.log || []); } });
  }
  useEffect(() => { load(); }, []);

  return (
    <>
      <h1 className="text-xl font-bold text-white mb-1">Email</h1>
      <p className="text-sm text-[var(--text-secondary)] mb-6">Email automation, queue management, and delivery tracking.</p>

      {stats && (
        <>
          {/* Daily limit bar */}
          <div className="surface rounded-xl p-4 mb-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[9px] font-semibold text-[var(--text-dim)] uppercase tracking-widest">Daily email usage</p>
              <p className="text-xs font-mono text-[var(--text-secondary)]">{stats.sentToday} / {stats.dailyLimit}</p>
            </div>
            <div className="h-2 bg-[rgba(255,255,255,0.05)] rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{
                width: `${Math.min(100, (stats.sentToday / stats.dailyLimit) * 100)}%`,
                background: stats.sentToday >= stats.dailyLimit * 0.9 ? "var(--red)" : stats.sentToday >= stats.dailyLimit * 0.7 ? "var(--yellow)" : "var(--green)"
              }} />
            </div>
            <p className="text-[10px] text-[var(--text-dim)] mt-1">{stats.dailyRemaining} emails remaining today. Resets every 24 hours.</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <Stat label="Queued" value={stats.queued} color="var(--accent)" />
            <Stat label="Total Sent" value={stats.sent} />
            <Stat label="Open Rate" value={`${stats.openRate}%`} color="var(--green)" sub={`${stats.opened} opened`} />
            <Stat label="Click Rate" value={`${stats.clickRate}%`} color="var(--accent)" sub={`${stats.clicked} clicked, ${stats.bounced} bounced`} />
          </div>
        </>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Queue */}
        <div>
          <h2 className="text-sm font-semibold text-white mb-3">Email Queue ({queue.filter(q => q.status === "pending").length} pending)</h2>
          <div className="surface rounded-xl overflow-hidden">
            {queue.length === 0 ? <p className="px-4 py-8 text-center text-xs text-[var(--text-dim)]">Queue is empty.</p> : (
              <div className="max-h-[500px] overflow-y-auto divide-y divide-[var(--border)]">
                {queue.map((q) => (
                  <div key={q.id} className="px-4 py-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-[var(--text)] truncate">{q.recipient_email}</p>
                      <p className="text-[10px] text-[var(--text-dim)] truncate">{q.subject}</p>
                      <p className="text-[9px] text-[var(--text-dim)]">Scheduled: {new Date(q.send_after).toLocaleString()}</p>
                    </div>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full shrink-0 ${q.status === "pending" ? "bg-[var(--accent-soft)] text-[var(--accent)]" : q.status === "sent" ? "bg-[var(--green-soft)] text-[var(--green)]" : "bg-[rgba(255,255,255,0.04)] text-[var(--text-dim)]"}`}>{q.status}</span>
                    {q.status === "pending" && (
                      <button onClick={async () => { await fetch("/api/admin/email/cancel", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: q.id }) }); load(); }}
                        className="text-[9px] text-[var(--red)] hover:underline cursor-pointer shrink-0">Cancel</button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Log */}
        <div>
          <h2 className="text-sm font-semibold text-white mb-3">Sent Emails ({log.length})</h2>
          <div className="surface rounded-xl overflow-hidden">
            {log.length === 0 ? <p className="px-4 py-8 text-center text-xs text-[var(--text-dim)]">No emails sent yet.</p> : (
              <div className="max-h-[500px] overflow-y-auto divide-y divide-[var(--border)]">
                {log.map((l) => (
                  <div key={l.id} className="px-4 py-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-[var(--text)] truncate">{l.recipient_email}</p>
                      <p className="text-[10px] text-[var(--text-dim)] truncate">{l.subject}</p>
                    </div>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full shrink-0 ${l.status === "opened" ? "bg-[var(--green-soft)] text-[var(--green)]" : l.status === "clicked" ? "bg-[var(--accent-soft)] text-[var(--accent)]" : l.status === "bounced" ? "bg-[var(--red-soft)] text-[var(--red)]" : "bg-[rgba(255,255,255,0.04)] text-[var(--text-dim)]"}`}>{l.status}</span>
                    <span className="text-[9px] text-[var(--text-dim)] shrink-0">{new Date(l.sent_at).toLocaleDateString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
