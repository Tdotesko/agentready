"use client";

import { useState, useRef, useEffect } from "react";
import type { ScanCategory, ScanResult } from "@/lib/scanner";

/* ─── Score Ring ─── */
function ScoreRing({ score, grade }: { score: number; grade: string }) {
  const [val, setVal] = useState(0);
  const r = 58;
  const circ = 2 * Math.PI * r;
  const offset = circ - (val / 100) * circ;
  const color = val >= 75 ? "var(--color-green)" : val >= 45 ? "var(--color-yellow)" : "var(--color-red)";

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
    <div className="relative w-36 h-36 shrink-0">
      <svg viewBox="0 0 140 140" className="w-full h-full -rotate-90">
        <circle cx="70" cy="70" r={r} stroke="var(--color-border)" strokeWidth="8" fill="none" />
        <circle cx="70" cy="70" r={r} stroke={color} strokeWidth="8" fill="none"
          strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-100 ease-linear" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-mono font-bold tabular-nums" style={{ color }}>{val}</span>
        <span className="text-xs font-medium text-[var(--color-text-tertiary)] tracking-wider uppercase">{grade}</span>
      </div>
    </div>
  );
}

/* ─── Category Row ─── */
function CategoryRow({ cat, defaultOpen }: { cat: ScanCategory; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  const pct = Math.round((cat.score / cat.maxScore) * 100);
  const barColor = pct >= 70 ? "bg-[var(--color-green)]" : pct >= 40 ? "bg-[var(--color-yellow)]" : "bg-[var(--color-red)]";
  const dotColor = pct >= 70 ? "bg-[var(--color-green)]" : pct >= 40 ? "bg-[var(--color-yellow)]" : "bg-[var(--color-red)]";

  return (
    <div className="border-b border-[var(--color-border)] last:border-0">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-4 py-4 px-1 cursor-pointer group text-left">
        <span className={`w-2 h-2 rounded-full shrink-0 ${dotColor}`} />
        <span className="flex-1 text-sm font-medium text-[var(--color-text-primary)] group-hover:text-white transition">{cat.name}</span>
        <span className="text-xs font-mono text-[var(--color-text-tertiary)] tabular-nums w-12 text-right">{cat.score}/{cat.maxScore}</span>
        <div className="w-16 h-1 rounded-full bg-[var(--color-border)] overflow-hidden">
          <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
        </div>
        <svg className={`w-4 h-4 text-[var(--color-text-tertiary)] transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M4 6l4 4 4-4" />
        </svg>
      </button>
      {open && (
        <div className="pb-4 pl-7 pr-1 space-y-3 animate-fade-in">
          {cat.findings.length > 0 && (
            <ul className="space-y-1">
              {cat.findings.map((f, i) => (
                <li key={i} className="text-xs text-[var(--color-text-secondary)] flex gap-2 leading-relaxed">
                  <span className="text-[var(--color-green)] shrink-0 mt-0.5">&#10003;</span>{f}
                </li>
              ))}
            </ul>
          )}
          {cat.recommendations.length > 0 && (
            <ul className="space-y-1.5">
              {cat.recommendations.map((r, i) => (
                <li key={i} className="text-xs flex gap-2 leading-relaxed">
                  <span className="text-[var(--color-yellow)] shrink-0 mt-0.5">&#9656;</span>
                  <span className="text-[var(--color-text-primary)]">{r}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Scanner Progress ─── */
function ScanProgress() {
  const [step, setStep] = useState(0);
  const steps = ["Connecting", "Fetching HTML", "Parsing structured data", "Checking product markup", "Testing accessibility", "Scoring"];

  useEffect(() => {
    const id = setInterval(() => setStep((s) => Math.min(s + 1, steps.length - 1)), 1800);
    return () => clearInterval(id);
  }, [steps.length]);

  return (
    <div className="max-w-md mx-auto py-20 space-y-6">
      <div className="flex items-center justify-center gap-3">
        <div className="w-5 h-5 rounded-full border-2 border-[var(--color-brand)] border-t-transparent animate-spin" />
        <span className="text-sm font-medium text-[var(--color-text-secondary)]">{steps[step]}...</span>
      </div>
      <div className="h-0.5 bg-[var(--color-border)] rounded-full overflow-hidden">
        <div className="h-full bg-[var(--color-brand)] rounded-full transition-all duration-500 ease-out"
          style={{ width: `${((step + 1) / steps.length) * 100}%` }} />
      </div>
    </div>
  );
}

/* ─── Main ─── */
export default function Home() {
  const [url, setUrl] = useState("");
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [emailState, setEmailState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [copied, setCopied] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);

  async function handleScan(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim() || scanning) return;
    setScanning(true);
    setResult(null);
    setError("");
    setEmailState("idle");
    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error || "Scan failed");
      else {
        setResult(data);
        setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
      }
    } catch { setError("Network error — check the URL and try again."); }
    finally { setScanning(false); }
  }

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || emailState === "sending") return;
    setEmailState("sending");
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), scannedUrl: result?.url, score: result?.overallScore }),
      });
      setEmailState(res.ok ? "done" : "error");
    } catch { setEmailState("error"); }
  }

  function share() {
    const text = `My store scored ${result?.overallScore}/100 on AI Agent Readiness. Check yours:`;
    if (navigator.share) navigator.share({ text, url: "https://agentready.dev" });
    else { navigator.clipboard.writeText(`${text} https://agentready.dev`); setCopied(true); setTimeout(() => setCopied(false), 2000); }
  }

  const issues = result ? result.categories.reduce((n, c) => n + c.recommendations.length, 0) : 0;

  return (
    <>
      {/* ── Nav ── */}
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-[var(--color-border)] bg-[var(--color-surface)]/80 backdrop-blur-xl">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2 text-sm font-semibold tracking-tight">
            <span className="w-6 h-6 rounded bg-[var(--color-brand)] flex items-center justify-center text-[10px] font-bold text-white">A</span>
            AgentReady
          </a>
          {result && (
            <button onClick={share} className="text-xs text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition cursor-pointer">
              {copied ? "Copied" : "Share"}
            </button>
          )}
        </div>
      </nav>

      <main className="flex-1 pt-14">
        {/* ── Hero ── */}
        <section className="hero-glow">
          <div className="max-w-3xl mx-auto px-6 pt-24 pb-20">
            <p className="text-xs font-medium tracking-widest uppercase text-[var(--color-brand-light)] mb-4">AI Commerce Readiness Scanner</p>
            <h1 className="text-3xl sm:text-[2.75rem] font-bold leading-[1.15] tracking-tight mb-5">
              Can AI agents<br />
              <span className="gradient-text">buy from your store?</span>
            </h1>
            <p className="text-[var(--color-text-secondary)] text-base sm:text-lg leading-relaxed max-w-xl mb-10">
              AI shopping agents from Google, OpenAI, and others are starting to make purchases autonomously.
              We scan your store and show you exactly what they can and can&apos;t see.
            </p>

            {/* ── Input ── */}
            <form onSubmit={handleScan} className="input-glow rounded-xl bg-[var(--color-surface-raised)] border border-[var(--color-border)] flex items-center transition-all duration-200">
              <label htmlFor="url" className="sr-only">Store URL</label>
              <input
                id="url" type="text" value={url} onChange={(e) => setUrl(e.target.value)}
                placeholder="yourstore.com"
                className="flex-1 bg-transparent px-5 py-4 text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none text-base"
                disabled={scanning} autoComplete="url" spellCheck={false}
              />
              <button type="submit" disabled={scanning || !url.trim()}
                className="m-1.5 px-5 py-2.5 rounded-lg bg-[var(--color-brand)] hover:bg-[var(--color-brand-light)] disabled:opacity-30 text-white text-sm font-medium transition-all cursor-pointer disabled:cursor-not-allowed shrink-0">
                {scanning ? "Scanning" : "Scan"}
              </button>
            </form>
            <p className="text-[10px] text-[var(--color-text-tertiary)] mt-3 tracking-wide">Free &middot; No signup &middot; Takes ~10 seconds</p>

            {error && (
              <div className="mt-5 text-sm text-[var(--color-red)] bg-[var(--color-red)]/8 border border-[var(--color-red)]/20 rounded-lg px-4 py-3" role="alert">{error}</div>
            )}
          </div>
        </section>

        {/* ── Scanning ── */}
        {scanning && <ScanProgress />}

        {/* ── Results ── */}
        {result && (
          <section ref={resultRef} className="max-w-3xl mx-auto px-6 pb-24 animate-fade-in">
            {/* Score */}
            <div className="flex items-start gap-8 mb-10">
              <ScoreRing score={result.overallScore} grade={result.grade} />
              <div className="pt-2">
                <h2 className="text-lg font-semibold mb-1">Agent Readiness Report</h2>
                <p className="text-sm text-[var(--color-text-tertiary)] font-mono mb-3 break-all">{result.url}</p>
                {result.overallScore < 50 && <p className="text-sm text-[var(--color-red)]">Critical — your store is mostly invisible to AI agents.</p>}
                {result.overallScore >= 50 && result.overallScore < 75 && <p className="text-sm text-[var(--color-yellow)]">Partial — agents can read some data but miss key details.</p>}
                {result.overallScore >= 75 && <p className="text-sm text-[var(--color-green)]">Strong — your store is well-prepared for AI commerce.</p>}
                <div className="flex items-center gap-4 mt-3 text-xs text-[var(--color-text-tertiary)]">
                  <span>{issues} issue{issues !== 1 && "s"}</span>
                  <span>{result.scanDurationMs}ms</span>
                  <span>{new Date(result.scannedAt).toLocaleDateString()}</span>
                </div>
              </div>
            </div>

            {/* Category breakdown */}
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-raised)] divide-y divide-[var(--color-border)] px-5">
              {result.categories.map((cat, i) => (
                <CategoryRow key={i} cat={cat} defaultOpen={cat.status === "fail"} />
              ))}
            </div>

            {/* Email capture */}
            <div className="mt-10 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-raised)] p-6">
              {emailState !== "done" ? (
                <>
                  <h3 className="text-sm font-semibold mb-1">Get the full report</h3>
                  <p className="text-xs text-[var(--color-text-secondary)] mb-4">Step-by-step fixes with code snippets, prioritized by impact.</p>
                  <form onSubmit={handleEmail} className="flex gap-2">
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                      placeholder="you@company.com" disabled={emailState === "sending"}
                      className="flex-1 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-4 py-2.5 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:border-[var(--color-brand)]" />
                    <button type="submit" disabled={emailState === "sending"}
                      className="px-5 py-2.5 rounded-lg bg-[var(--color-brand)] hover:bg-[var(--color-brand-light)] disabled:opacity-40 text-white text-sm font-medium transition cursor-pointer disabled:cursor-not-allowed shrink-0">
                      {emailState === "sending" ? "..." : "Send"}
                    </button>
                  </form>
                  {emailState === "error" && <p className="text-xs text-[var(--color-red)] mt-2">Something went wrong — try again.</p>}
                </>
              ) : (
                <p className="text-sm text-[var(--color-green)] font-medium">Sent — check your inbox.</p>
              )}
            </div>

            {/* Scan again */}
            <div className="mt-8 text-center">
              <button onClick={() => { setResult(null); setUrl(""); setError(""); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                className="text-xs text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] transition cursor-pointer">
                Scan another store &rarr;
              </button>
            </div>
          </section>
        )}

        {/* ── Below fold (only when no results) ── */}
        {!result && !scanning && (
          <section className="max-w-3xl mx-auto px-6 pb-24">
            {/* What we check */}
            <div className="grid sm:grid-cols-5 gap-px bg-[var(--color-border)] rounded-xl overflow-hidden mb-20">
              {[
                { label: "Structured Data", detail: "JSON-LD, Schema.org, Open Graph" },
                { label: "Product Data", detail: "Prices, images, availability, descriptions" },
                { label: "Accessibility", detail: "Sitemap, robots.txt, semantic HTML" },
                { label: "Commerce Signals", detail: "Cart actions, policies, reviews" },
                { label: "Performance", detail: "Page weight, JS footprint, SSR" },
              ].map((item) => (
                <div key={item.label} className="bg-[var(--color-surface-raised)] p-5">
                  <p className="text-xs font-semibold text-[var(--color-text-primary)] mb-1">{item.label}</p>
                  <p className="text-[11px] text-[var(--color-text-tertiary)] leading-relaxed">{item.detail}</p>
                </div>
              ))}
            </div>

            {/* Context */}
            <div className="max-w-lg">
              <p className="text-xs font-medium tracking-widest uppercase text-[var(--color-text-tertiary)] mb-4">Why now</p>
              <div className="space-y-6 text-sm text-[var(--color-text-secondary)] leading-relaxed">
                <p>
                  In February 2026, <span className="text-[var(--color-text-primary)]">$1 trillion</span> in SaaS market cap evaporated
                  in a single week as markets priced in AI agents replacing traditional software workflows.
                </p>
                <p>
                  Visa predicts <span className="text-[var(--color-text-primary)]">millions of consumers</span> will use AI agents
                  to shop by holiday 2026. Google launched the Universal Commerce Protocol with Shopify, Etsy, Target, and Walmart.
                </p>
                <p>
                  <span className="text-[var(--color-text-primary)]">41.5% of Y Combinator&apos;s Winter 2026 batch</span> is building
                  agent infrastructure. The shift is happening now — stores that aren&apos;t machine-readable will be invisible to the next generation of shoppers.
                </p>
              </div>
            </div>
          </section>
        )}
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-[var(--color-border)] px-6 py-6">
        <div className="max-w-3xl mx-auto flex items-center justify-between text-[11px] text-[var(--color-text-tertiary)]">
          <span>AgentReady</span>
          <a href="/api/health" className="hover:text-[var(--color-text-secondary)] transition">Status</a>
        </div>
      </footer>
    </>
  );
}
