"use client";

import { useState, useEffect } from "react";

interface UserRecord { id: string; email: string; plan?: string; subscriptionStatus?: string; stripeCustomerId?: string; isAdmin: boolean; createdAt: string; }

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [search, setSearch] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editPlan, setEditPlan] = useState("");
  const [editStatus, setEditStatus] = useState("");

  function load() { fetch("/api/admin/users").then(r => r.ok ? r.json() : []).then(setUsers); }
  useEffect(() => { load(); }, []);

  async function save(id: string) {
    await fetch("/api/admin/users", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: id, plan: editPlan || undefined, subscriptionStatus: editStatus || undefined }) });
    setEditId(null); load();
  }

  async function toggleAdmin(id: string, current: boolean) {
    await fetch("/api/admin/users", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: id, isAdmin: !current }) });
    load();
  }

  const filtered = search ? users.filter(u => u.email.toLowerCase().includes(search.toLowerCase())) : users;

  return (
    <>
      <h1 className="text-xl font-bold text-white mb-1">Users</h1>
      <p className="text-sm text-[var(--text-secondary)] mb-6">{users.length} total users. Manage plans, status, and admin access.</p>

      <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by email..."
        className="w-full sm:w-96 rounded-lg bg-[var(--bg-raised)] border border-[var(--border-light)] px-4 py-2.5 text-sm text-white placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--accent-border)] mb-4" />

      <div className="surface rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead><tr className="border-b border-[var(--border)]">
              <th className="px-4 py-3 text-[10px] font-semibold text-[var(--text-dim)] uppercase">Email</th>
              <th className="px-4 py-3 text-[10px] font-semibold text-[var(--text-dim)] uppercase">Plan</th>
              <th className="px-4 py-3 text-[10px] font-semibold text-[var(--text-dim)] uppercase">Status</th>
              <th className="px-4 py-3 text-[10px] font-semibold text-[var(--text-dim)] uppercase">Joined</th>
              <th className="px-4 py-3 text-[10px] font-semibold text-[var(--text-dim)] uppercase">Actions</th>
            </tr></thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id} className="border-b border-[var(--border)] hover:bg-[rgba(255,255,255,0.015)]">
                  <td className="px-4 py-3">
                    <span className="text-sm text-[var(--text)]">{u.email}</span>
                    {u.isAdmin && <span className="ml-2 text-[8px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 font-bold">ADMIN</span>}
                  </td>
                  <td className="px-4 py-3">
                    {editId === u.id ? (
                      <select value={editPlan} onChange={(e) => setEditPlan(e.target.value)} className="bg-[var(--bg)] border border-[var(--border-light)] rounded px-2 py-1 text-xs text-white">
                        <option value="">None</option><option value="growth">Growth</option><option value="business">Business</option><option value="enterprise">Enterprise</option>
                      </select>
                    ) : <span className="text-sm text-[var(--text-secondary)] capitalize">{u.plan || "free"}</span>}
                  </td>
                  <td className="px-4 py-3">
                    {editId === u.id ? (
                      <select value={editStatus} onChange={(e) => setEditStatus(e.target.value)} className="bg-[var(--bg)] border border-[var(--border-light)] rounded px-2 py-1 text-xs text-white">
                        <option value="">None</option><option value="active">Active</option><option value="canceled">Canceled</option><option value="trialing">Trialing</option>
                      </select>
                    ) : <span className={`text-[10px] px-2 py-0.5 rounded-full ${u.subscriptionStatus === "active" ? "bg-[var(--green-soft)] text-[var(--green)]" : u.subscriptionStatus === "canceled" ? "bg-[var(--red-soft)] text-[var(--red)]" : "bg-[rgba(255,255,255,0.04)] text-[var(--text-dim)]"}`}>{u.subscriptionStatus || "none"}</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--text-dim)]">{new Date(u.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {editId === u.id ? (
                        <><button onClick={() => save(u.id)} className="text-[10px] text-[var(--green)] cursor-pointer">Save</button><button onClick={() => setEditId(null)} className="text-[10px] text-[var(--text-dim)] cursor-pointer">Cancel</button></>
                      ) : (
                        <><button onClick={() => { setEditId(u.id); setEditPlan(u.plan || ""); setEditStatus(u.subscriptionStatus || ""); }} className="text-[10px] text-[var(--accent)] cursor-pointer">Edit</button>
                        <button onClick={() => toggleAdmin(u.id, u.isAdmin)} className={`text-[10px] cursor-pointer ${u.isAdmin ? "text-[var(--red)]" : "text-[var(--text-dim)]"}`}>{u.isAdmin ? "Remove admin" : "Make admin"}</button></>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
