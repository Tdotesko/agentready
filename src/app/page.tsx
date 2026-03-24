"use client";

import { useState, useRef, useEffect } from "react";
import type { ScanCategory, ScanResult } from "@/lib/scanner";

/* ── Score Circle ── */
function ScoreCircle({ score, grade }: { score: number; grade: string }) {
  const [val, setVal] = useState(0);
  const r = 52;
  const circ = 2 * Math.PI * r;
  const offset = circ - (val / 100) * circ;
  const color = val >= 75 ? "#16a34a" : val >= 45 ? "#ca8a04" : "#dc2626";

  useEffect(() => {
    let frame: number;
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - t0) / 800, 1);
      setVal(Math.round((1 - Math.pow(1 - p, 3)) * score));
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [score]);

  return (
    <div className="relative w-32 h-32 shrink-0">
      <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
        <circle cx="60" cy="60" r={r} stroke="#e5e5e5" strokeWidth="7" fill="none" />
        <circle cx="60" cy="60" r={r} stroke={color} strokeWidth="7" fill="none"
          strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-75" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-mono font-bold tabular-nums" style={{ color }}>{val}</span>
        <span className="text-[10px] font-medium text-neutral-400 uppercase tracking-widest">{grade}</span>
      </div>
    </div>
  );
}

/* ── Category (teaser vs full) ── */
function CategoryTeaser({ cat }: { cat: ScanCategory }) {
  const pct = Math.round((cat.score / cat.maxScore) * 100);
  const dot = pct >= 70 ? "bg-green-500" : pct >= 40 ? "bg-yellow-500" : "bg-red-500";
  const bar = pct >= 70 ? "bg-green-500" : pct >= 40 ? "bg-yellow-500" : "bg-red-500";
  const label = pct >= 70 ? "Good" : pct >= 40 ? "Needs work" : "Poor";

  return (
    <div className="flex items-center gap-4 py-3 border-b border-neutral-100 last:border-0">
      <span className={`w-1.5 h-1.5 rounded-full ${dot} shrink-0`} />
      <span className="flex-1 text-sm">{cat.name}</span>
      <span className="text-xs text-neutral-400 w-16 text-right">{label}</span>
      <div className="w-14 h-1 rounded-full bg-neutral-200 overflow-hidden">
        <div className={`h-full rounded-full ${bar}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function CategoryFull({ cat, defaultOpen }: { cat: ScanCategory; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  const pct = Math.round((cat.score / cat.maxScore) * 100);
  const dot = pct >= 70 ? "bg-green-500" : pct >= 40 ? "bg-yellow-500" : "bg-red-500";
  const bar = pct >= 70 ? "bg-green-500" : pct >= 40 ? "bg-yellow-500" : "bg-red-500";

  return (
    <div className="border-b border-neutral-100 last:border-0">
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-4 py-3 cursor-pointer group text-left">
        <span className={`w-1.5 h-1.5 rounded-full ${dot} shrink-0`} />
        <span className="flex-1 text-sm group-hover:text-black transition">{cat.name}</span>
        <span className="text-xs font-mono text-neutral-400 tabular-nums">{cat.score}/{cat.maxScore}</span>
        <div className="w-14 h-1 rounded-full bg-neutral-200 overflow-hidden">
          <div className={`h-full rounded-full ${bar}`} style={{ width: `${pct}%` }} />
        </div>
        <svg className={`w-3.5 h-3.5 text-neutral-400 transition-transform ${open ? "rotate-180" : ""}`}
          viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 6l4 4 4-4" /></svg>
      </button>
      {open && (
        <div className="pb-4 pl-6 space-y-2 fade-up">
          {cat.findings.map((f, i) => (
            <p key={`f${i}`} className="text-xs text-neutral-500 flex gap-2">
              <span className="text-green-600 shrink-0">&#10003;</span>{f}
            </p>
          ))}
          {cat.recommendations.map((r, i) => (
            <p key={`r${i}`} className="text-xs flex gap-2">
              <span className="text-yellow-600 shrink-0">&#8227;</span>
              <span className="text-neutral-700">{r}</span>
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Scanning ── */
function Scanning() {
  const [i, setI] = useState(0);
  const msgs = ["Fetching your store", "Reading structured data", "Checking product markup", "Testing agent access", "Calculating score"];
  useEffect(() => { const id = setInterval(() => setI(s => Math.min(s + 1, msgs.length - 1)), 2000); return () => clearInterval(id); }, [msgs.length]);

  return (
    <div className="py-20 text-center">
      <div className="inline-block w-5 h-5 border-2 border-neutral-300 border-t-neutral-800 rounded-full spin-slow mb-4" />
      <p className="text-sm text-neutral-500">{msgs[i]}...</p>
    </div>
  );
}

/* ── Pricing Card ── */
function PricingCard({ name, price, period, features, cta, highlighted }: {
  name: string; price: string; period: string; features: string[]; cta: string; highlighted?: boolean;
}) {
  return (
    <div className={`rounded-lg border p-6 flex flex-col ${highlighted ? "border-neutral-900 ring-1 ring-neutral-900" : "border-neutral-200"}`}>
      <p className="text-sm font-medium mb-1">{name}</p>
      <p className="text-2xl font-bold mb-0.5">{price}<span className="text-sm font-normal text-neutral-400">/{period}</span></p>
      <ul className="mt-4 mb-6 space-y-2 flex-1">
        {features.map((f, i) => (
          <li key={i} className="text-sm text-neutral-600 flex gap-2">
            <span className="text-neutral-400 shrink-0">+</span>{f}
          </li>
        ))}
      </ul>
      <button className={`w-full py-2.5 rounded-lg text-sm font-medium transition cursor-pointer ${
        highlighted ? "bg-neutral-900 text-white hover:bg-neutral-800" : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
      }`}>{cta}</button>
    </div>
  );
}

/* ── Page ── */
export default function Home() {
  const [url, setUrl] = useState("");
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [email, setEmail] = useState("");
  const [unlockState, setUnlockState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const resultRef = useRef<HTMLDivElement>(null);

  async function handleScan(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim() || scanning) return;
    setScanning(true); setResult(null); setError(""); setUnlocked(false); setUnlockState("idle");
    try {
      const res = await fetch("/api/scan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: url.trim() }) });
      const data = await res.json();
      if (!res.ok) setError(data.error || "Scan failed");
      else { setResult(data); setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100); }
    } catch { setError("Connection failed. Check the URL and try again."); }
    finally { setScanning(false); }
  }

  async function handleUnlock(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || unlockState === "sending") return;
    setUnlockState("sending");
    try {
      const res = await fetch("/api/leads", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), scannedUrl: result?.url, score: result?.overallScore }) });
      if (res.ok) { setUnlockState("done"); setUnlocked(true); }
      else setUnlockState("error");
    } catch { setUnlockState("error"); }
  }

  const issues = result ? result.categories.reduce((n, c) => n + c.recommendations.length, 0) : 0;

  return (
    <>
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-[#fafafa]/80 backdrop-blur-lg border-b border-neutral-200">
        <div className="max-w-2xl mx-auto px-6 h-12 flex items-center justify-between">
          <a href="/" className="text-sm font-semibold tracking-tight">AgentReady</a>
          <a href="#pricing" className="text-xs text-neutral-500 hover:text-neutral-900 transition">Pricing</a>
        </div>
      </nav>

      <main className="flex-1">
        {/* Hero */}
        <section className="max-w-2xl mx-auto px-6 pt-20 pb-16">
          <h1 className="text-2xl sm:text-4xl font-bold tracking-tight leading-snug mb-4">
            Can AI shopping agents<br />find and buy your products?
          </h1>
          <p className="text-neutral-500 text-base leading-relaxed max-w-lg mb-8">
            AI agents from Google, OpenAI, and Visa are starting to shop on behalf of real customers.
            We scan your store and tell you exactly what they see, what they miss, and how to fix it.
          </p>

          <form onSubmit={handleScan}
            className="flex items-center border border-neutral-300 rounded-lg bg-white focus-within:border-neutral-400 focus-within:shadow-sm transition-all">
            <label htmlFor="url" className="sr-only">Store URL</label>
            <input id="url" type="text" value={url} onChange={(e) => setUrl(e.target.value)}
              placeholder="yourstore.com" disabled={scanning} autoComplete="url" spellCheck={false}
              className="flex-1 bg-transparent px-4 py-3 text-sm placeholder:text-neutral-400 focus:outline-none" />
            <button type="submit" disabled={scanning || !url.trim()}
              className="m-1 px-4 py-2 rounded-md bg-neutral-900 text-white text-sm font-medium hover:bg-neutral-800 disabled:opacity-25 transition cursor-pointer disabled:cursor-not-allowed shrink-0">
              {scanning ? "Scanning" : "Scan"}
            </button>
          </form>
          <p className="text-[11px] text-neutral-400 mt-2">Free. No account needed for your first scan.</p>

          {error && (
            <p className="mt-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-4 py-3" role="alert">{error}</p>
          )}
        </section>

        {scanning && <Scanning />}

        {/* Results */}
        {result && (
          <section ref={resultRef} className="max-w-2xl mx-auto px-6 pb-20 fade-up">
            <div className="border border-neutral-200 rounded-lg bg-white p-6 sm:p-8 shadow-sm">
              {/* Header */}
              <div className="flex items-start gap-6 mb-6">
                <ScoreCircle score={result.overallScore} grade={result.grade} />
                <div className="pt-1 min-w-0">
                  <p className="text-xs text-neutral-400 uppercase tracking-wider font-medium mb-1">Readiness Score</p>
                  <p className="text-sm font-mono text-neutral-500 truncate mb-2">{result.url}</p>
                  {result.overallScore < 50 && <p className="text-sm text-red-600">AI agents can barely see your store. You need to fix this.</p>}
                  {result.overallScore >= 50 && result.overallScore < 75 && <p className="text-sm text-yellow-700">Agents see some of your data but miss important details.</p>}
                  {result.overallScore >= 75 && <p className="text-sm text-green-700">Your store is in good shape for AI-powered shopping.</p>}
                  <p className="text-xs text-neutral-400 mt-2">{issues} issue{issues !== 1 && "s"} found &middot; {result.scanDurationMs}ms</p>
                </div>
              </div>

              {/* Categories - teaser or full */}
              {!unlocked ? (
                <>
                  <div className="mb-6">
                    {result.categories.map((cat, i) => <CategoryTeaser key={i} cat={cat} />)}
                  </div>

                  {/* Gate */}
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/80 to-white z-10 pointer-events-none rounded-lg" />
                    <div className="blur-[3px] opacity-40 pointer-events-none select-none py-4">
                      <p className="text-xs text-neutral-600 mb-2">&#10003; Found 3 JSON-LD blocks with Product schema</p>
                      <p className="text-xs text-neutral-600 mb-2">&#8227; Add og:price:amount meta tags for machine-readable pricing</p>
                      <p className="text-xs text-neutral-600 mb-2">&#10003; sitemap.xml is accessible</p>
                      <p className="text-xs text-neutral-600">&#8227; Add structured review data for social proof signals</p>
                    </div>
                  </div>

                  <div className="border border-neutral-200 rounded-lg p-5 mt-2 bg-neutral-50">
                    <p className="text-sm font-medium mb-1">See what&apos;s actually broken</p>
                    <p className="text-xs text-neutral-500 mb-4">
                      Enter your email to unlock the full report with every finding and fix, prioritized by impact.
                      Your first report is free.
                    </p>
                    <form onSubmit={handleUnlock} className="flex gap-2">
                      <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                        placeholder="you@company.com" disabled={unlockState === "sending"}
                        className="flex-1 border border-neutral-300 rounded-md px-3 py-2 text-sm placeholder:text-neutral-400 focus:outline-none focus:border-neutral-400 bg-white" />
                      <button type="submit" disabled={unlockState === "sending"}
                        className="px-4 py-2 rounded-md bg-neutral-900 text-white text-sm font-medium hover:bg-neutral-800 disabled:opacity-40 transition cursor-pointer disabled:cursor-not-allowed shrink-0">
                        {unlockState === "sending" ? "..." : "Unlock report"}
                      </button>
                    </form>
                    {unlockState === "error" && <p className="text-xs text-red-600 mt-2">Something went wrong. Try again.</p>}
                  </div>
                </>
              ) : (
                <>
                  <div className="mb-4">
                    {result.categories.map((cat, i) => <CategoryFull key={i} cat={cat} defaultOpen={cat.status === "fail"} />)}
                  </div>
                  <p className="text-xs text-green-700 bg-green-50 border border-green-100 rounded-lg px-4 py-2.5">
                    Full report unlocked. Set up monitoring to get alerted when your score changes.
                  </p>
                </>
              )}
            </div>

            {/* Upsell after results */}
            {unlocked && (
              <div className="mt-8 border border-neutral-200 rounded-lg bg-white p-6 shadow-sm">
                <p className="text-sm font-medium mb-1">Want to stay ahead?</p>
                <p className="text-xs text-neutral-500 mb-4">
                  Your competitors are optimizing for AI agents right now.
                  Get weekly monitoring, automated alerts, and detailed fix guides.
                </p>
                <a href="#pricing"
                  className="inline-block px-4 py-2 rounded-md bg-neutral-900 text-white text-sm font-medium hover:bg-neutral-800 transition">
                  See plans
                </a>
              </div>
            )}

            <div className="mt-6 text-center">
              <button onClick={() => { setResult(null); setUrl(""); setError(""); setUnlocked(false); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                className="text-xs text-neutral-400 hover:text-neutral-600 transition cursor-pointer">
                Scan another store
              </button>
            </div>
          </section>
        )}

        {/* Below fold */}
        {!result && !scanning && (
          <>
            {/* What we scan */}
            <section className="max-w-2xl mx-auto px-6 pb-16">
              <p className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-4">What we check</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-8 gap-y-4">
                {[
                  "JSON-LD and Schema.org markup",
                  "Product prices in meta tags",
                  "Image alt text quality",
                  "Sitemap and robots.txt",
                  "Availability indicators",
                  "Shipping and return policies",
                  "Add-to-cart DOM signals",
                  "Review and rating data",
                  "Page weight and JS footprint",
                ].map((item) => (
                  <p key={item} className="text-sm text-neutral-600">{item}</p>
                ))}
              </div>
            </section>

            {/* Why now */}
            <section className="max-w-2xl mx-auto px-6 pb-16">
              <p className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-4">Why this matters now</p>
              <div className="space-y-4 text-sm text-neutral-600 leading-relaxed max-w-lg">
                <p>
                  Visa expects millions of people to use AI agents to buy things by the end of 2026.
                  Google already launched the Universal Commerce Protocol with Shopify, Etsy, Target, and Walmart built in.
                </p>
                <p>
                  Over 40% of the latest Y Combinator batch is building infrastructure for AI agents.
                  The stores that aren&apos;t set up for this will lose sales to the ones that are. It&apos;s that simple.
                </p>
              </div>
            </section>

            {/* Pricing */}
            <section id="pricing" className="max-w-2xl mx-auto px-6 pb-24">
              <p className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-6">Pricing</p>
              <div className="grid sm:grid-cols-3 gap-4">
                <PricingCard
                  name="Starter"
                  price="$29"
                  period="mo"
                  features={[
                    "Full scan reports",
                    "Up to 3 stores",
                    "Rescan anytime",
                    "Fix priority ranking",
                    "Code snippets for each fix",
                  ]}
                  cta="Get started"
                />
                <PricingCard
                  name="Pro"
                  price="$99"
                  period="mo"
                  highlighted
                  features={[
                    "Everything in Starter",
                    "Unlimited stores",
                    "Weekly automated scans",
                    "Email alerts on score changes",
                    "Competitor benchmarking",
                  ]}
                  cta="Start free trial"
                />
                <PricingCard
                  name="Agency"
                  price="$249"
                  period="mo"
                  features={[
                    "Everything in Pro",
                    "White-label PDF reports",
                    "Bulk scanning API",
                    "Client dashboard",
                    "Priority support",
                  ]}
                  cta="Contact us"
                />
              </div>
            </section>
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-neutral-200 px-6 py-5">
        <div className="max-w-2xl mx-auto flex items-center justify-between text-xs text-neutral-400">
          <span>AgentReady</span>
          <div className="flex gap-4">
            <a href="#pricing" className="hover:text-neutral-600 transition">Pricing</a>
            <a href="/api/health" className="hover:text-neutral-600 transition">Status</a>
          </div>
        </div>
      </footer>
    </>
  );
}
