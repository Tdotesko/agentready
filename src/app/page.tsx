"use client";

import { useState, useRef, useEffect } from "react";
import type { ScanCategory, ScanResult } from "@/lib/scanner";

/* ─────────── Score Ring ─────────── */
function ScoreRing({ score, grade }: { score: number; grade: string }) {
  const [val, setVal] = useState(0);
  const r = 54, circ = 2 * Math.PI * r;
  const offset = circ - (val / 100) * circ;
  const color = val >= 75 ? "var(--green)" : val >= 45 ? "var(--yellow)" : "var(--red)";

  useEffect(() => {
    let frame: number;
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - t0) / 900, 1);
      setVal(Math.round((1 - Math.pow(1 - p, 3)) * score));
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [score]);

  return (
    <div className="relative w-[140px] h-[140px] shrink-0">
      <svg viewBox="0 0 124 124" className="w-full h-full -rotate-90">
        <circle cx="62" cy="62" r={r} stroke="rgba(255,255,255,0.05)" strokeWidth="6" fill="none" />
        <circle cx="62" cy="62" r={r} stroke={color} strokeWidth="6" fill="none"
          strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
          style={{ filter: `drop-shadow(0 0 6px ${color})` }}
          className="transition-[stroke-dashoffset] duration-75" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[28px] font-mono font-bold tabular-nums leading-none" style={{ color }}>{val}</span>
        <span className="text-[10px] font-medium text-[var(--text-dim)] uppercase tracking-[0.15em] mt-1">{grade}</span>
      </div>
    </div>
  );
}

/* ─────────── Category Row (teaser) ─────────── */
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

/* ─────────── Scan Progress ─────────── */
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

/* ─────────── Pricing ─────────── */
function Tier({ name, price, desc, features, cta, pop, plan }: {
  name: string; price: string; desc: string; features: string[]; cta: string; pop?: boolean; plan: string;
}) {
  return (
    <div className={`rounded-xl p-6 flex flex-col relative ${
      pop
        ? "surface ring-1 ring-[var(--accent-border)]"
        : "surface"
    }`}>
      {pop && (
        <span className="absolute -top-3 left-5 text-[10px] font-semibold uppercase tracking-wider bg-[var(--accent)] text-black px-3 py-0.5 rounded-full">
          Most popular
        </span>
      )}
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
      <a href={`/signup?plan=${plan}`} className={`w-full py-2.5 rounded-lg text-sm font-medium transition text-center block ${
        pop
          ? "bg-[var(--accent)] text-black hover:brightness-110"
          : "bg-[var(--bg-elevated)] text-[var(--text)] border border-[var(--border-light)] hover:bg-[rgba(255,255,255,0.06)]"
      }`}>{cta}</a>
    </div>
  );
}

/* ─────────── Page ─────────── */
export default function Home() {
  const [url, setUrl] = useState("");
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);

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
    if (navigator.share) navigator.share({ text, url: "https://agentready.dev" });
    else { navigator.clipboard.writeText(`${text} https://agentready.dev`); setCopied(true); setTimeout(() => setCopied(false), 2000); }
  }

  const issues = result ? result.categories.reduce((n, c) => n + c.recommendations.length, 0) : 0;

  return (
    <>
      {/* ── Nav ── */}
      <nav className="fixed top-0 inset-x-0 z-50 glass">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2.5">
            <span className="w-7 h-7 rounded-md bg-[var(--accent)] flex items-center justify-center text-[11px] font-bold text-black">A</span>
            <span className="text-sm font-semibold tracking-tight text-white">AgentReady</span>
          </a>
          <div className="flex items-center gap-5">
            <a href="#pricing" className="text-xs text-[var(--text-dim)] hover:text-[var(--text)] transition">Pricing</a>
            <a href="/login" className="text-xs text-[var(--text-dim)] hover:text-[var(--text)] transition">Sign in</a>
            {result && (
              <button onClick={share} className="text-xs text-[var(--text-dim)] hover:text-[var(--text)] transition cursor-pointer">
                {copied ? "Copied!" : "Share"}
              </button>
            )}
          </div>
        </div>
      </nav>

      <main className="flex-1 pt-14">
        {/* ── Hero ── */}
        <section className="hero-ambient">
          <div className="max-w-3xl mx-auto px-6 pt-24 sm:pt-32 pb-20">
            <div className="inline-flex items-center gap-2 text-[11px] text-[var(--accent)] font-medium tracking-wider uppercase mb-6 bg-[var(--accent-soft)] border border-[var(--accent-border)] rounded-full px-3.5 py-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />
              Now live
            </div>

            <h1 className="text-[2rem] sm:text-[2.75rem] lg:text-[3.25rem] font-bold leading-[1.1] tracking-tight text-white mb-5">
              Find out if AI agents<br />can buy from your store
            </h1>

            <p className="text-[var(--text-secondary)] text-base sm:text-lg leading-relaxed max-w-lg mb-10">
              Google, OpenAI, and Visa are rolling out AI shopping agents that browse and buy on behalf of customers.
              We&apos;ll tell you exactly what those agents see when they visit your store.
            </p>

            {/* Input */}
            <div className="max-w-lg">
              <form onSubmit={handleScan}
                className="flex items-center rounded-xl bg-[var(--bg-raised)] border border-[var(--border-light)] input-ring transition-all">
                <label htmlFor="url" className="sr-only">Store URL</label>
                <input id="url" type="text" value={url} onChange={(e) => setUrl(e.target.value)}
                  placeholder="yourstore.com" disabled={scanning} autoComplete="url" spellCheck={false}
                  className="flex-1 bg-transparent px-5 py-4 text-[15px] text-white placeholder:text-[var(--text-dim)] focus:outline-none" />
                <button type="submit" disabled={scanning || !url.trim()}
                  className="m-1.5 px-5 py-2.5 rounded-lg bg-[var(--accent)] text-black text-sm font-semibold hover:brightness-110 disabled:opacity-20 transition cursor-pointer disabled:cursor-not-allowed shrink-0">
                  {scanning ? "Scanning" : "Run scan"}
                </button>
              </form>
              <p className="text-[11px] text-[var(--text-dim)] mt-3">Free to try. No account needed for your first scan.</p>
            </div>

            {error && (
              <div className="mt-5 max-w-lg text-sm text-[var(--red)] bg-[var(--red-soft)] border border-[rgba(248,113,113,0.15)] rounded-lg px-4 py-3" role="alert">{error}</div>
            )}
          </div>
        </section>

        {/* ── Scanning ── */}
        {scanning && <ScanProgress />}

        {/* ── Results ── */}
        {result && (
          <section ref={resultRef} className="max-w-3xl mx-auto px-6 pb-24 fade-up">
            <div className="surface rounded-xl p-6 sm:p-8">
              {/* Score header */}
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
                    <span className="w-px h-3 bg-[var(--border)]" />
                    <span>{new Date(result.scannedAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>

              {/* Category teasers */}
              <div className="mb-6">
                {result.categories.map((cat, i) => <CategoryTeaser key={i} cat={cat} />)}
              </div>

              {/* Blurred details + signup gate */}
              <div className="relative mb-2">
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[var(--bg-raised)]/60 to-[var(--bg-raised)] z-10 pointer-events-none rounded-lg" />
                <div className="blur-[3px] opacity-30 pointer-events-none select-none py-4 px-2">
                  <p className="text-xs text-[var(--text)] mb-2">&#10003; Found 3 JSON-LD blocks with Product schema</p>
                  <p className="text-xs text-[var(--text)] mb-2">&#8227; Add og:price:amount meta tags for machine-readable pricing</p>
                  <p className="text-xs text-[var(--text)] mb-2">&#10003; sitemap.xml is accessible and well-formed</p>
                  <p className="text-xs text-[var(--text)]">&#8227; Add structured review data for social proof signals</p>
                </div>
              </div>

              {/* Signup CTA */}
              <div className="rounded-xl p-5 bg-[var(--bg-elevated)] border border-[var(--border-light)] text-center">
                <p className="text-sm font-semibold text-white mb-1">See what&apos;s broken and how to fix it</p>
                <p className="text-xs text-[var(--text-secondary)] mb-4">
                  Get the full breakdown with every finding, specific fixes, and code snippets you can copy and paste.
                </p>
                <div className="flex flex-col sm:flex-row gap-2 justify-center">
                  <a href="/signup?plan=starter"
                    className="px-5 py-2.5 rounded-lg bg-[var(--bg)] border border-[var(--border-light)] text-[var(--text)] text-sm font-medium hover:bg-[rgba(255,255,255,0.06)] transition inline-block">
                    Starter $29/mo
                  </a>
                  <a href="/signup?plan=pro"
                    className="px-5 py-2.5 rounded-lg bg-[var(--accent)] text-black text-sm font-semibold hover:brightness-110 transition inline-block">
                    Pro $99/mo
                  </a>
                  <a href="/signup?plan=agency"
                    className="px-5 py-2.5 rounded-lg bg-[var(--bg)] border border-[var(--border-light)] text-[var(--text)] text-sm font-medium hover:bg-[rgba(255,255,255,0.06)] transition inline-block">
                    Agency $249/mo
                  </a>
                </div>
                <p className="text-[10px] text-[var(--text-dim)] mt-3">Already have an account? <a href="/login" className="text-[var(--accent)] hover:underline">Sign in</a></p>
              </div>
            </div>

            <div className="mt-8 text-center">
              <button onClick={() => { setResult(null); setUrl(""); setError(""); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                className="text-xs text-[var(--text-dim)] hover:text-[var(--text-secondary)] transition cursor-pointer">
                Scan another store &rarr;
              </button>
            </div>
          </section>
        )}

        {/* ── Below fold ── */}
        {!result && !scanning && (
          <>
            {/* What we check */}
            <section className="max-w-3xl mx-auto px-6 pb-20">
              <p className="text-[11px] font-semibold text-[var(--text-dim)] uppercase tracking-widest mb-5">What we analyze</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-[var(--border)] rounded-xl overflow-hidden">
                {[
                  { title: "Structured Data", items: ["JSON-LD and Schema.org", "Open Graph meta tags", "Microdata markup"] },
                  { title: "Product Signals", items: ["Machine-readable prices", "Availability status", "Image alt text quality"] },
                  { title: "Store Infrastructure", items: ["Sitemap and robots.txt", "Semantic HTML structure", "Page weight and JS load"] },
                ].map((col) => (
                  <div key={col.title} className="bg-[var(--bg-raised)] p-5">
                    <p className="text-xs font-semibold text-[var(--accent)] mb-3">{col.title}</p>
                    <ul className="space-y-2">
                      {col.items.map((item) => (
                        <li key={item} className="text-[13px] text-[var(--text-secondary)]">{item}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>

            {/* Social proof numbers */}
            <section className="max-w-3xl mx-auto px-6 pb-20">
              <div className="flex flex-wrap gap-12 sm:gap-20">
                {[
                  { num: "$1T+", label: "SaaS value shifted in the Feb 2026 selloff" },
                  { num: "41.5%", label: "of YC W26 batch building agent infra" },
                  { num: "5 sec", label: "Average scan time" },
                ].map((s) => (
                  <div key={s.label}>
                    <p className="text-2xl font-bold text-white">{s.num}</p>
                    <p className="text-xs text-[var(--text-dim)] mt-1 max-w-[180px]">{s.label}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* Why now */}
            <section className="max-w-3xl mx-auto px-6 pb-20">
              <p className="text-[11px] font-semibold text-[var(--text-dim)] uppercase tracking-widest mb-5">The context</p>
              <div className="max-w-lg space-y-4 text-[15px] text-[var(--text-secondary)] leading-relaxed">
                <p>
                  Visa expects millions of people to use AI agents to buy things by the end of 2026.
                  Google already launched the Universal Commerce Protocol with Shopify, Etsy, Target, and Walmart built in.
                </p>
                <p>
                  Stores that aren&apos;t set up for machine readability will get skipped.
                  The ones that are will capture a wave of traffic that doesn&apos;t even open a browser.
                </p>
              </div>
            </section>

            {/* Pricing */}
            <section id="pricing" className="max-w-3xl mx-auto px-6 pb-28">
              <p className="text-[11px] font-semibold text-[var(--text-dim)] uppercase tracking-widest mb-6">Pricing</p>
              <div className="grid sm:grid-cols-3 gap-4">
                <Tier name="Starter" price="$29" plan="starter" desc="For store owners getting started"
                  features={["Full scan reports", "Up to 3 stores", "Rescan anytime", "Fix priority ranking", "Code snippets for each fix"]}
                  cta="Get started" />
                <Tier name="Pro" price="$99" plan="pro" desc="For serious sellers and teams" pop
                  features={["Everything in Starter", "Unlimited stores", "Weekly automated scans", "Score change alerts", "Competitor benchmarking"]}
                  cta="Start free trial" />
                <Tier name="Agency" price="$249" plan="agency" desc="For agencies managing clients"
                  features={["Everything in Pro", "White-label PDF reports", "Bulk scanning API", "Client dashboard", "Priority support"]}
                  cta="Get started" />
              </div>
            </section>
          </>
        )}
      </main>

      <footer className="border-t border-[var(--border)] px-6 py-5">
        <div className="max-w-3xl mx-auto flex items-center justify-between text-[11px] text-[var(--text-dim)]">
          <span>AgentReady</span>
          <div className="flex gap-5">
            <a href="#pricing" className="hover:text-[var(--text-secondary)] transition">Pricing</a>
            <a href="/api/health" className="hover:text-[var(--text-secondary)] transition">Status</a>
          </div>
        </div>
      </footer>
    </>
  );
}
