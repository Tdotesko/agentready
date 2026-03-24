"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

interface AdminUser { id: string; email: string; isAdmin: boolean; plan?: string; subscriptionStatus?: string; }

const NAV_ITEMS = [
  { label: "Dashboard", href: "/admin", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
  { label: "Prospects", href: "/admin/prospects", icon: "M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-2.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" },
  { label: "Email", href: "/admin/email", icon: "M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" },
  { label: "Users", href: "/admin/users", icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" },
  { label: "Scans", href: "/admin/scans", icon: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" },
  { label: "Leads", href: "/admin/leads", icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" },
  { label: "Run Scan", href: "/admin/scan", icon: "M13 10V3L4 14h7v7l9-11h-7z" },
  { label: "System", href: "/admin/system", icon: "M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" },
  { label: "Settings", href: "/admin/settings", icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/me")
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data || !data.isAdmin) { window.location.href = data ? "/dashboard" : "/login"; return; }
        setUser(data);
        setLoading(false);
      })
      .catch(() => { window.location.href = "/login"; });
  }, []);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
  }

  if (loading) return (
    <div className="min-h-screen flex">
      <aside className="w-60 bg-[var(--bg-raised)] border-r border-[var(--border)] hidden lg:flex flex-col">
        <div className="h-16 px-5 flex items-center border-b border-[var(--border)]"><div className="skeleton h-8 w-32" /></div>
        <div className="p-3 space-y-2">{Array.from({length: 8}).map((_, i) => <div key={i} className="skeleton h-10 w-full rounded-xl" />)}</div>
      </aside>
      <div className="flex-1 p-8"><div className="skeleton h-8 w-48 mb-6" /><div className="grid grid-cols-4 gap-4">{Array.from({length: 4}).map((_, i) => <div key={i} className="skeleton h-24 rounded-xl" />)}</div></div>
    </div>
  );

  return (
    <div className="min-h-screen flex">
      {/* Mobile overlay */}
      {mobileOpen && <div className="fixed inset-0 bg-black/60 z-40 lg:hidden" onClick={() => setMobileOpen(false)} />}

      {/* Mobile hamburger */}
      <div className="fixed top-0 left-0 right-0 h-14 bg-[var(--bg-raised)] border-b border-[var(--border)] flex items-center px-4 z-30 lg:hidden">
        <button onClick={() => setMobileOpen(true)} className="w-8 h-8 flex items-center justify-center text-[var(--text-dim)] hover:text-white cursor-pointer">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>
        <img src="/logo.png" alt="CartParse" className="ml-3 h-8 w-auto" />
        <span className="ml-2 text-[9px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 font-bold uppercase">Admin</span>
      </div>

      {/* Sidebar */}
      <aside className={`${collapsed ? "w-16" : "w-60"} bg-[var(--bg-raised)] border-r border-[var(--border)] flex-col transition-all duration-200 shrink-0 hidden lg:flex ${mobileOpen ? "!flex fixed inset-y-0 left-0 z-50 w-60" : ""}`}>
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-[var(--border)]">
          {(!collapsed || mobileOpen) && (
            <div className="flex items-center gap-2">
              <img src="/logo.png" alt="CartParse" className="h-9 w-auto" />
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 font-bold uppercase">Admin</span>
            </div>
          )}
          <button onClick={() => { if (mobileOpen) setMobileOpen(false); else setCollapsed(!collapsed); }}
            className="w-8 h-8 flex items-center justify-center text-[var(--text-dim)] hover:text-white rounded-lg hover:bg-[rgba(255,255,255,0.04)] transition cursor-pointer">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              {collapsed && !mobileOpen ? <path d="M9 18l6-6-6-6" /> : <path d="M15 18l-6-6 6-6" />}
            </svg>
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-2 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  active ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "text-[var(--text-secondary)] hover:text-white hover:bg-[rgba(255,255,255,0.03)]"
                }`}>
                <svg className={`w-5 h-5 shrink-0 ${active ? "text-[var(--accent)]" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d={item.icon} />
                </svg>
                {(!collapsed || mobileOpen) && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* User + Logout */}
        <div className="border-t border-[var(--border)]">
          {user && !collapsed && (
            <div className="px-4 py-3">
              <p className="text-xs font-medium text-white truncate">{user.email}</p>
              <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[9px] font-semibold text-red-400 bg-red-500/10">Admin</span>
            </div>
          )}
          <div className="p-2 space-y-0.5">
            <Link href="/dashboard"
              className="flex items-center gap-3 w-full px-3 py-2 rounded-xl text-xs text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--accent-soft)] transition">
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7" /></svg>
              {!collapsed && <span>User Dashboard</span>}
            </Link>
            <button onClick={handleLogout}
              className="flex items-center gap-3 w-full px-3 py-2 rounded-xl text-xs text-[var(--text-secondary)] hover:text-[var(--red)] hover:bg-[var(--red-soft)] transition cursor-pointer">
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" /></svg>
              {!collapsed && <span>Logout</span>}
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto pt-14 lg:pt-0">
        <div className="p-5 lg:p-8 max-w-7xl">
          {children}
        </div>
      </main>
    </div>
  );
}
