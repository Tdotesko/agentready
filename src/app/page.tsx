"use client";

import { useState, useRef, useEffect } from "react";
import type { ScanCategory, ScanResult } from "@/lib/scanner";

/* ── Animated Hero Visual (fake scan demo) ── */
function HeroVisual() {
  const [score, setScore] = useState(0);
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 800),
      setTimeout(() => setPhase(2), 1800),
      setTimeout(() => { setPhase(3); let s = 0; const id = setInterval(() => { s += 2; if (s > 67) { clearInterval(id); setScore(67); } else setScore(s); }, 20); }, 2800),
      setTimeout(() => setPhase(4), 4500),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  const cats = [
    { name: "Structured Data", pct: 30, color: "var(--red)" },
    { name: "Product Signals", pct: 72, color: "var(--green)" },
    { name: "Machine Access", pct: 85, color: "var(--green)" },
    { name: "Commerce Ready", pct: 45, color: "var(--yellow)" },
    { name: "Performance", pct: 60, color: "var(--yellow)" },
  ];

  const r = 42, circ = 2 * Math.PI * r;
  const scoreColor = score >= 70 ? "var(--green)" : score >= 45 ? "var(--yellow)" : "var(--red)";

  return (
    <div className="relative w-full max-w-md mx-auto lg:mx-0">
      {/* Glow behind the card */}
      <div className="absolute -inset-8 bg-[var(--accent)] opacity-[0.04] blur-3xl rounded-full" />

      <div className="relative surface rounded-2xl p-6 overflow-hidden">
        {/* Scan line animation */}
        {phase < 3 && (
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--accent)] to-transparent opacity-60"
            style={{ animation: "scanDown 1.5s ease-in-out infinite", top: `${(phase / 3) * 100}%` }} />
        )}

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse" />
            <span className="text-[10px] font-mono text-[var(--text-dim)] uppercase tracking-wider">
              {phase < 1 ? "Connecting..." : phase < 2 ? "Scanning pages..." : phase < 3 ? "Analyzing..." : "Complete"}
            </span>
          </div>
          <span className="text-[10px] font-mono text-[var(--text-dim)]">demo-store.com</span>
        </div>

        {/* Score + Categories */}
        <div className="flex gap-6">
          {/* Score ring */}
          <div className="relative w-24 h-24 shrink-0">
            <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
              <circle cx="50" cy="50" r={r} stroke="rgba(255,255,255,0.04)" strokeWidth="5" fill="none" />
              <circle cx="50" cy="50" r={r} stroke={phase >= 3 ? scoreColor : "rgba(255,255,255,0.08)"} strokeWidth="5" fill="none"
                strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={circ - (score / 100) * circ}
                style={{ transition: "stroke-dashoffset 0.3s, stroke 0.3s", filter: phase >= 3 ? `drop-shadow(0 0 4px ${scoreColor})` : "none" }} />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xl font-mono font-bold tabular-nums" style={{ color: phase >= 3 ? scoreColor : "var(--text-dim)" }}>{score}</span>
            </div>
          </div>

          {/* Category bars */}
          <div className="flex-1 space-y-2.5 pt-1">
            {cats.map((cat, i) => (
              <div key={i} className={`transition-all duration-500 ${phase >= 4 ? "opacity-100" : "opacity-0"}`} style={{ transitionDelay: `${i * 100}ms` }}>
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-[10px] text-[var(--text-secondary)]">{cat.name}</span>
                  <span className="text-[10px] font-mono text-[var(--text-dim)]">{cat.pct}%</span>
                </div>
                <div className="h-1.5 bg-[rgba(255,255,255,0.04)] rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: phase >= 4 ? `${cat.pct}%` : "0%", background: cat.color, transitionDelay: `${i * 100}ms` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Fake action items preview */}
        {phase >= 4 && (
          <div className="mt-5 pt-4 border-t border-[var(--border)] space-y-2 fade-up">
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[var(--red-soft)] text-[var(--red)]">high</span>
              <span className="text-[11px] text-[var(--text-secondary)]">Add JSON-LD Product schema</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[var(--yellow-soft)] text-[var(--yellow)]">med</span>
              <span className="text-[11px] text-[var(--text-secondary)]">Add og:price meta tags</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Score Ring (for results) ── */
function ScoreRing({ score, grade }: { score: number; grade: string }) {
  const [val, setVal] = useState(0);
  const r = 54, circ = 2 * Math.PI * r;
  const offset = circ - (val / 100) * circ;
  const color = val >= 75 ? "var(--green)" : val >= 45 ? "var(--yellow)" : "var(--red)";

  useEffect(() => {
    let frame: number;
    const t0 = performance.now();
    const tick = (now: number) => { const p = Math.min((now - t0) / 900, 1); setVal(Math.round((1 - Math.pow(1 - p, 3)) * score)); if (p < 1) frame = requestAnimationFrame(tick); };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [score]);

  return (
    <div className="relative w-[140px] h-[140px] shrink-0">
      <svg viewBox="0 0 124 124" className="w-full h-full -rotate-90">
        <circle cx="62" cy="62" r={r} stroke="rgba(255,255,255,0.05)" strokeWidth="6" fill="none" />
        <circle cx="62" cy="62" r={r} stroke={color} strokeWidth="6" fill="none" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
          style={{ filter: `drop-shadow(0 0 6px ${color})` }} className="transition-[stroke-dashoffset] duration-75" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[28px] font-mono font-bold tabular-nums leading-none" style={{ color }}>{val}</span>
        <span className="text-[10px] font-medium text-[var(--text-dim)] uppercase tracking-[0.15em] mt-1">{grade}</span>
      </div>
    </div>
  );
}

/* ── Category Teaser ── */
function CategoryTeaser({ cat }: { cat: ScanCategory }) {
  const pct = Math.round((cat.score / cat.maxScore) * 100);
  const color = pct >= 70 ? "var(--green)" : pct >= 40 ? "var(--yellow)" : "var(--red)";
  const label = pct >= 70 ? "Good" : pct >= 40 ? "Needs work" : "Poor";
  return (
    <div className="flex items-center gap-4 py-3.5 border-b border-[var(--border)] last:border-0">
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color, boxShadow: `0 0 6px ${color}` }} />
      <span className="flex-1 text-[13px] text-[var(--text)]">{cat.name}</span>
      <span className="text-[11px] text-[var(--text-dim)] w-20 text-right">{label}</span>
      <div className="w-16 h-[3px] rounded-full bg-[rgba(255,255,255,0.05)] overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

/* ── Scan Progress ── */
function ScanProgress() {
  const [i, setI] = useState(0);
  const steps = ["Connecting to store", "Reading HTML and metadata", "Parsing structured data", "Checking product signals", "Scoring agent readiness"];
  useEffect(() => { const id = setInterval(() => setI(s => Math.min(s + 1, steps.length - 1)), 2200); return () => clearInterval(id); }, [steps.length]);
  return (
    <div className="py-20 flex flex-col items-center gap-5">
      <div className="w-5 h-5 border-2 border-[var(--accent)] border-t-transparent rounded-full loader" />
      <p className="text-sm text-[var(--text-secondary)]">{steps[i]}...</p>
      <div className="w-48 h-[2px] bg-[var(--border)] rounded-full overflow-hidden">
        <div className="h-full bg-[var(--accent)] rounded-full transition-all duration-500" style={{ width: `${((i + 1) / steps.length) * 100}%` }} />
      </div>
    </div>
  );
}

/* ── Pricing Tier ── */
function Tier({ name, price, desc, features, cta, pop, plan }: {
  name: string; price: string; desc: string; features: string[]; cta: string; pop?: boolean; plan: string;
}) {
  return (
    <div className={`rounded-2xl p-6 flex flex-col relative transition-all duration-200 ${pop ? "surface ring-1 ring-[var(--accent-border)] scale-[1.02]" : "surface hover:scale-[1.01]"}`}>
      {pop && <span className="absolute -top-3 left-5 text-[10px] font-semibold uppercase tracking-wider bg-[var(--accent)] text-black px-3 py-0.5 rounded-full shadow-lg shadow-[var(--accent-soft)]">Most popular</span>}
      <p className="text-sm font-semibold text-[var(--text)] mb-1">{name}</p>
      <p className="flex items-baseline gap-1 mb-1">
        <span className="text-3xl font-bold text-white">{price}</span>
        <span className="text-sm text-[var(--text-dim)]">/mo</span>
      </p>
      <p className="text-xs text-[var(--text-secondary)] mb-5">{desc}</p>
      <ul className="space-y-2.5 mb-6 flex-1">
        {features.map((f, i) => (
          <li key={i} className="text-[13px] text-[var(--text-secondary)] flex gap-2.5">
            <span className="text-[var(--accent)] shrink-0 text-xs mt-0.5">&#10003;</span>{f}
          </li>
        ))}
      </ul>
      <a href={`/signup?plan=${plan}`} className={`w-full py-2.5 rounded-xl text-sm font-medium text-center block ${pop ? "btn-primary" : "btn-secondary"}`}>{cta}</a>
    </div>
  );
}

/* ── Feature Card ── */
function FeatureCard({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div className="surface rounded-2xl p-5 hover:scale-[1.01] transition-transform duration-200">
      <div className="w-10 h-10 rounded-xl bg-[var(--accent-soft)] border border-[var(--accent-border)] flex items-center justify-center mb-4">
        <svg className="w-5 h-5 text-[var(--accent)]" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
        </svg>
      </div>
      <p className="text-sm font-semibold text-white mb-1">{title}</p>
      <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{desc}</p>
    </div>
  );
}

/* ═════════ PAGE ═════════ */
export default function Home() {
  const [url, setUrl] = useState("");
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [user, setUser] = useState<{ email: string; plan?: string } | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/auth/me").then(res => res.ok ? res.json() : null).then(data => {
      if (data?.email) {
        if (data.subscriptionStatus === "active" || data.subscriptionStatus === "trialing") { window.location.href = "/dashboard"; return; }
        setUser(data);
      }
    }).catch(() => {});
  }, []);

  async function handleScan(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim() || scanning) return;
    setScanning(true); setResult(null); setError("");
    try {
      const res = await fetch("/api/scan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: url.trim() }) });
      const data = await res.json();
      if (!res.ok) setError(data.error || "Scan failed.");
      else { setResult(data); setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 120); }
    } catch { setError("Connection failed. Double check the URL and try again."); }
    finally { setScanning(false); }
  }

  function share() {
    const text = `Just scored ${result?.overallScore}/100 on AI agent readiness for my store. See how yours does:`;
    if (navigator.share) navigator.share({ text, url: "https://cartparse.com" });
    else { navigator.clipboard.writeText(`${text} https://cartparse.com`); setCopied(true); setTimeout(() => setCopied(false), 2000); }
  }

  const issues = result ? result.categories.reduce((n, c) => n + c.recommendations.length, 0) : 0;

  return (
    <>
      {/* Nav */}
      <nav className="fixed top-0 inset-x-0 z-50 glass">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2.5">
            <img src="/logo-icon.png" alt="CartParse" className="w-7 h-7 rounded-md" />
            <span className="text-sm font-semibold tracking-tight text-white">CartParse</span>
          </a>
          <div className="flex items-center gap-6">
            <a href="#features" className="text-xs text-[var(--text-dim)] hover:text-[var(--text)] transition hidden sm:block">Features</a>
            <a href="#pricing" className="text-xs text-[var(--text-dim)] hover:text-[var(--text)] transition">Pricing</a>
            {user ? (
              <a href="/dashboard" className="text-xs px-3 py-1.5 rounded-lg bg-[var(--accent-soft)] border border-[var(--accent-border)] text-[var(--accent)] font-medium transition hover:bg-[var(--accent)] hover:text-black">Dashboard</a>
            ) : (
              <>
                <a href="/login" className="text-xs text-[var(--text-dim)] hover:text-[var(--text)] transition">Sign in</a>
                <a href="/signup?plan=free" className="text-xs px-3 py-1.5 rounded-lg btn-primary hidden sm:block">Sign up free</a>
              </>
            )}
            {result && (
              <button onClick={share} className="text-xs text-[var(--text-dim)] hover:text-[var(--text)] transition cursor-pointer">{copied ? "Copied!" : "Share"}</button>
            )}
          </div>
        </div>
      </nav>

      <main className="flex-1 pt-14">
        {/* ── Hero ── */}
        <section className="hero-ambient overflow-hidden">
          <div className="max-w-6xl mx-auto px-6 pt-20 sm:pt-28 pb-20">
            <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-16">
              {/* Left: Copy + Input */}
              <div className="flex-1 max-w-xl">
                <div className="inline-flex items-center gap-2 text-[11px] text-[var(--accent)] font-medium tracking-wider uppercase mb-6 bg-[var(--accent-soft)] border border-[var(--accent-border)] rounded-full px-3.5 py-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-pulse" />
                  Now scanning live stores
                </div>

                <h1 className="text-[2rem] sm:text-[2.75rem] lg:text-[3.25rem] font-bold leading-[1.08] tracking-tight text-white mb-5">
                  Can AI agents find<br />and buy your products?
                </h1>

                <p className="text-[var(--text-secondary)] text-base sm:text-lg leading-relaxed mb-8">
                  AI shopping agents from Google, OpenAI, and Visa are buying products on behalf of real customers.
                  Find out what they see when they visit your store.
                </p>

                <form onSubmit={handleScan}
                  className="flex items-center rounded-xl bg-[var(--bg-raised)] border border-[var(--border-light)] input-ring transition-all">
                  <label htmlFor="url" className="sr-only">Store URL</label>
                  <input id="url" type="text" value={url} onChange={(e) => setUrl(e.target.value)}
                    placeholder="yourstore.com" disabled={scanning} autoComplete="url" spellCheck={false}
                    className="flex-1 bg-transparent px-5 py-4 text-[15px] text-white placeholder:text-[var(--text-dim)] focus:outline-none" />
                  <button type="submit" disabled={scanning || !url.trim()}
                    className="m-1.5 px-6 py-2.5 rounded-lg btn-primary text-sm cursor-pointer disabled:cursor-not-allowed shrink-0">
                    {scanning ? "Scanning" : "Scan free"}
                  </button>
                </form>
                <p className="text-[11px] text-[var(--text-dim)] mt-3">Free instant scan. No signup needed.</p>

                {error && (
                  <div className="mt-4 text-sm text-[var(--red)] bg-[var(--red-soft)] border border-[rgba(248,113,113,0.15)] rounded-lg px-4 py-3" role="alert">{error}</div>
                )}

                {/* Trust bar */}
                <div className="flex items-center gap-6 mt-10 pt-8 border-t border-[var(--border)]">
                  {[
                    { num: "12", label: "pages per scan" },
                    { num: "6", label: "platforms detected" },
                    { num: "<3s", label: "scan time" },
                    { num: "100+", label: "checks run" },
                  ].map((s) => (
                    <div key={s.label} className="text-center">
                      <p className="text-lg font-bold font-mono text-white tabular-nums">{s.num}</p>
                      <p className="text-[10px] text-[var(--text-dim)]">{s.label}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right: Animated demo */}
              <div className="flex-1 max-w-md w-full hidden md:block">
                <HeroVisual />
              </div>
            </div>
          </div>
        </section>

        {scanning && <ScanProgress />}

        {/* ── Results ── */}
        {result && (
          <section ref={resultRef} className="max-w-3xl mx-auto px-6 pb-24 fade-up">
            <div className="surface rounded-2xl p-6 sm:p-8">
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 mb-8">
                <ScoreRing score={result.overallScore} grade={result.grade} />
                <div className="text-center sm:text-left">
                  <p className="text-xs text-[var(--text-dim)] uppercase tracking-wider font-medium mb-2">Agent Readiness Report</p>
                  <p className="text-sm font-mono text-[var(--text-secondary)] break-all mb-3">{result.url}</p>
                  {result.overallScore < 50 && <p className="text-sm text-[var(--red)]">AI agents can barely see your store. You&apos;re losing potential sales.</p>}
                  {result.overallScore >= 50 && result.overallScore < 75 && <p className="text-sm text-[var(--yellow)]">Agents see some of your data but miss important product details.</p>}
                  {result.overallScore >= 75 && <p className="text-sm text-[var(--green)]">Your store is well set up for AI-powered shopping.</p>}
                  <div className="flex flex-wrap items-center gap-3 mt-3 text-[11px] text-[var(--text-dim)]">
                    <span>{issues} issue{issues !== 1 && "s"}</span>
                    <span className="w-px h-3 bg-[var(--border)]" />
                    <span>{result.scanDurationMs}ms</span>
                  </div>
                </div>
              </div>
              <div className="mb-6">{result.categories.map((cat, i) => <CategoryTeaser key={i} cat={cat} />)}</div>

              {/* Blurred gate */}
              <div className="relative mb-2">
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[var(--bg-raised)]/60 to-[var(--bg-raised)] z-10 pointer-events-none rounded-lg" />
                <div className="blur-[3px] opacity-30 pointer-events-none select-none py-4 px-2">
                  <p className="text-xs text-[var(--text)] mb-2">&#10003; Found 3 JSON-LD blocks with Product schema</p>
                  <p className="text-xs text-[var(--text)] mb-2">&#8227; Add og:price:amount meta tags for machine-readable pricing</p>
                  <p className="text-xs text-[var(--text)] mb-2">&#10003; sitemap.xml is accessible and well-formed</p>
                  <p className="text-xs text-[var(--text)]">&#8227; Add structured review data for social proof signals</p>
                </div>
              </div>

              <div className="rounded-xl p-5 bg-[var(--bg-elevated)] border border-[var(--border-light)] text-center">
                <p className="text-sm font-semibold text-white mb-1">See what&apos;s broken and how to fix it</p>
                <p className="text-xs text-[var(--text-secondary)] mb-4">Get the full breakdown with fix code you can copy and paste.</p>
                <div className="flex flex-col sm:flex-row gap-2 justify-center">
                  <a href="/signup?plan=growth" className="px-5 py-2.5 rounded-lg btn-secondary text-sm inline-block text-center">Growth $49/mo</a>
                  <a href="/signup?plan=business" className="px-5 py-2.5 rounded-lg btn-primary text-sm inline-block text-center">Business $149/mo</a>
                  <a href="/signup?plan=enterprise" className="px-5 py-2.5 rounded-lg btn-secondary text-sm inline-block text-center">Enterprise $399/mo</a>
                </div>
                {user ? (
                  <p className="text-[10px] text-[var(--text-dim)] mt-3"><a href="/dashboard" className="text-[var(--accent)] hover:underline">Go to your dashboard</a> to run a full deep scan.</p>
                ) : (
                  <p className="text-[10px] text-[var(--text-dim)] mt-3">Already have an account? <a href="/login" className="text-[var(--accent)] hover:underline">Sign in</a></p>
                )}
              </div>
            </div>
            <div className="mt-8 text-center">
              <button onClick={() => { setResult(null); setUrl(""); setError(""); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                className="text-xs text-[var(--text-dim)] hover:text-[var(--text-secondary)] transition cursor-pointer">Scan another store &rarr;</button>
            </div>
          </section>
        )}

        {/* ── Below fold ── */}
        {!result && !scanning && (
          <>
            {/* Features */}
            <section id="features" className="max-w-6xl mx-auto px-6 py-24">
              <div className="text-center mb-14">
                <p className="text-[11px] font-semibold text-[var(--accent)] uppercase tracking-widest mb-3">How it works</p>
                <h2 className="text-2xl sm:text-3xl font-bold text-white">Everything you need to get agent-ready</h2>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <FeatureCard icon="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
                  title="Multi-page deep scan" desc="We crawl up to 12 pages on your store. Homepage, product pages, collections. Not just one URL." />
                <FeatureCard icon="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5"
                  title="Copy-paste fix code" desc="Every recommendation comes with the actual code. Tailored for Shopify, WooCommerce, or your platform." />
                <FeatureCard icon="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"
                  title="Priority action plan" desc="Every issue ranked by impact. Know exactly what to fix first for the biggest score improvement." />
                <FeatureCard icon="M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z"
                  title="Score tracking" desc="Watch your score improve over time. Visual charts show the impact of every fix you make." />
                <FeatureCard icon="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z"
                  title="Exportable reports" desc="Download professional HTML reports. Share with your dev team or clients." />
                <FeatureCard icon="M6 13.5V3.75m0 9.75a1.5 1.5 0 010 3m0-3a1.5 1.5 0 000 3m0 3.75V16.5m12-3V3.75m0 9.75a1.5 1.5 0 010 3m0-3a1.5 1.5 0 000 3m0 3.75V16.5m-6-9V3.75m0 3.75a1.5 1.5 0 010 3m0-3a1.5 1.5 0 000 3m0 9.75V10.5"
                  title="Competitor comparison" desc="Deep scan a competitor side by side. See exactly where they beat you and what to fix." />
              </div>
            </section>

            {/* Social proof */}
            <section className="border-y border-[var(--border)] bg-[var(--bg-raised)]">
              <div className="max-w-6xl mx-auto px-6 py-16">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 text-center">
                  {[
                    { num: "$1T+", label: "SaaS value shifted in the 2026 AI selloff" },
                    { num: "41.5%", label: "of YC W26 building agent infrastructure" },
                    { num: "Millions", label: "predicted to shop via AI agents by end of 2026" },
                    { num: "UCP", label: "launched by Google, Shopify, Etsy, Target, Walmart" },
                  ].map((s) => (
                    <div key={s.label}>
                      <p className="text-2xl sm:text-3xl font-bold font-mono text-white tabular-nums">{s.num}</p>
                      <p className="text-[11px] text-[var(--text-dim)] mt-2 leading-relaxed">{s.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* Why now */}
            <section className="max-w-6xl mx-auto px-6 py-24">
              <div className="max-w-2xl mx-auto text-center">
                <p className="text-[11px] font-semibold text-[var(--accent)] uppercase tracking-widest mb-3">Why now</p>
                <h2 className="text-2xl sm:text-3xl font-bold text-white mb-6">The shift is already happening</h2>
                <div className="space-y-4 text-[15px] text-[var(--text-secondary)] leading-relaxed text-left sm:text-center">
                  <p>Visa expects millions of people to use AI agents to buy things by the end of 2026. Google already launched the Universal Commerce Protocol with Shopify, Etsy, Target, and Walmart built in.</p>
                  <p>Stores that aren&apos;t set up for machine readability will get skipped. The ones that are will capture a wave of traffic that doesn&apos;t even open a browser.</p>
                </div>
              </div>
            </section>

            {/* Pricing */}
            <section id="pricing" className="max-w-6xl mx-auto px-6 pb-28">
              <div className="text-center mb-10">
                <p className="text-[11px] font-semibold text-[var(--accent)] uppercase tracking-widest mb-3">Pricing</p>
                <h2 className="text-2xl sm:text-3xl font-bold text-white">Pick the plan that fits your business</h2>
              </div>
              <div className="grid sm:grid-cols-3 gap-5 max-w-4xl mx-auto">
                <Tier name="Growth" price="$49" plan="growth" desc="For store owners optimizing for AI"
                  features={["Multi-page deep scan (12 pages)", "Up to 5 stores", "Platform-specific fix code", "Priority-ranked action plan", "Downloadable HTML reports", "Weekly rescans"]}
                  cta="Get started" />
                <Tier name="Business" price="$149" plan="business" desc="For serious sellers and teams" pop
                  features={["Everything in Growth", "Up to 25 stores", "Competitor comparison scans", "Score history tracking", "Daily automated monitoring", "Email alerts on score changes"]}
                  cta="Get started" />
                <Tier name="Enterprise" price="$399" plan="enterprise" desc="For agencies managing client stores"
                  features={["Everything in Business", "Unlimited stores", "White-label PDF reports", "Bulk scanning API", "Team seats and client dashboard", "Priority support"]}
                  cta="Get started" />
              </div>
            </section>
          </>
        )}
      </main>

      <footer className="border-t border-[var(--border)] px-6 py-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-[var(--text-dim)]">
          <span>CartParse</span>
          <div className="flex gap-6">
            <a href="#features" className="hover:text-[var(--text-secondary)] transition">Features</a>
            <a href="#pricing" className="hover:text-[var(--text-secondary)] transition">Pricing</a>
            <a href="/terms" className="hover:text-[var(--text-secondary)] transition">Terms</a>
            <a href="/privacy" className="hover:text-[var(--text-secondary)] transition">Privacy</a>
            <a href="/api/health" className="hover:text-[var(--text-secondary)] transition">Status</a>
          </div>
        </div>
      </footer>
    </>
  );
}
