"use client";

import { useState, useRef, useEffect } from "react";
import type { ScanCategory, ScanResult } from "@/lib/scanner";

function ScoreRing({ score, grade }: { score: number; grade: string }) {
  const [animatedScore, setAnimatedScore] = useState(0);
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (animatedScore / 100) * circumference;
  const color =
    animatedScore >= 80
      ? "#22c55e"
      : animatedScore >= 60
        ? "#eab308"
        : animatedScore >= 40
          ? "#f97316"
          : "#ef4444";

  useEffect(() => {
    let frame: number;
    const start = performance.now();
    const duration = 1000;
    const animate = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setAnimatedScore(Math.round(eased * score));
      if (progress < 1) frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [score]);

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width="180" height="180" className="-rotate-90" role="img" aria-label={`Score: ${score} out of 100, grade ${grade}`}>
        <circle cx="90" cy="90" r={radius} stroke="#1f2937" strokeWidth="12" fill="none" />
        <circle
          cx="90" cy="90" r={radius} stroke={color} strokeWidth="12" fill="none"
          strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.1s linear" }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-4xl font-bold" style={{ color }}>{animatedScore}</span>
        <span className="text-lg text-gray-400">{grade}</span>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: "pass" | "warn" | "fail" }) {
  const styles = {
    pass: "bg-green-500/20 text-green-400 border-green-500/30",
    warn: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    fail: "bg-red-500/20 text-red-400 border-red-500/30",
  };
  const labels = { pass: "PASS", warn: "WARN", fail: "FAIL" };
  return (
    <span className={`px-2 py-0.5 text-xs font-bold rounded border ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

function CategoryCard({ category, defaultOpen }: { category: ScanCategory; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen || false);
  const pct = Math.round((category.score / category.maxScore) * 100);

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between cursor-pointer"
        aria-expanded={open}
      >
        <div className="flex items-center gap-3">
          <StatusBadge status={category.status} />
          <span className="font-semibold text-lg">{category.name}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-400 hidden sm:inline">
            {category.score}/{category.maxScore} pts
          </span>
          <div className="w-20 sm:w-24 h-2 bg-gray-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${
                pct >= 70 ? "bg-green-500" : pct >= 40 ? "bg-yellow-500" : "bg-red-500"
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <svg
            className={`w-5 h-5 text-gray-500 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {open && (
        <div className="mt-4 space-y-3 animate-[fadeIn_0.2s_ease-out]">
          {category.findings.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-400 mb-2">Findings</h4>
              <ul className="space-y-1.5">
                {category.findings.map((f, i) => (
                  <li key={i} className="text-sm text-gray-300 flex gap-2">
                    <span className="text-green-400 shrink-0">&#10003;</span>{f}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {category.recommendations.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-400 mb-2">Recommendations</h4>
              <ul className="space-y-1.5">
                {category.recommendations.map((r, i) => (
                  <li key={i} className="text-sm text-yellow-300 flex gap-2">
                    <span className="shrink-0">&#9888;</span>{r}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ScanningAnimation() {
  const [step, setStep] = useState(0);
  const steps = [
    "Fetching page content...",
    "Analyzing structured data...",
    "Checking product markup...",
    "Testing machine accessibility...",
    "Evaluating commerce readiness...",
    "Calculating score...",
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setStep((s) => (s < steps.length - 1 ? s + 1 : s));
    }, 2000);
    return () => clearInterval(interval);
  }, [steps.length]);

  return (
    <div className="flex flex-col items-center gap-6 py-16">
      <div className="relative w-20 h-20">
        <div className="absolute inset-0 rounded-full border-4 border-indigo-500/30" />
        <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-indigo-500 animate-spin" />
      </div>
      <div className="text-center">
        <p className="text-xl font-semibold text-indigo-400">Scanning your store...</p>
        <p className="text-sm text-gray-500 mt-2 h-5">{steps[step]}</p>
      </div>
    </div>
  );
}

export default function Home() {
  const [url, setUrl] = useState("");
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [emailState, setEmailState] = useState<"idle" | "submitting" | "done" | "error">("idle");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
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
      if (!res.ok) {
        setError(data.error || "Failed to scan store");
      } else {
        setResult(data);
        setTimeout(() => {
          resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 100);
      }
    } catch {
      setError("Network error. Please check the URL and try again.");
    } finally {
      setScanning(false);
    }
  }

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || emailState === "submitting") return;

    setEmailState("submitting");
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          scannedUrl: result?.url || "",
          score: result?.overallScore || 0,
        }),
      });
      if (res.ok) {
        setEmailState("done");
      } else {
        setEmailState("error");
      }
    } catch {
      setEmailState("error");
    }
  }

  function handleShare() {
    if (!result) return;
    const text = `My store scored ${result.overallScore}/100 (${result.grade}) on AI Agent Readiness! Check yours at agentready.dev`;
    if (navigator.share) {
      navigator.share({ title: "AgentReady Score", text, url: "https://agentready.dev" });
    } else {
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  const totalRecommendations = result
    ? result.categories.reduce((sum, c) => sum + c.recommendations.length, 0)
    : 0;

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-4 sticky top-0 bg-gray-950/90 backdrop-blur-sm z-50">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <a href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-sm">AR</div>
            <span className="text-xl font-bold">Agent<span className="text-indigo-400">Ready</span></span>
          </a>
          <nav className="hidden sm:flex items-center gap-6 text-sm text-gray-400">
            <a href="#how-it-works" className="hover:text-white transition">How it works</a>
            <a href="#why" className="hover:text-white transition">Why it matters</a>
          </nav>
          {/* Mobile menu */}
          <button
            className="sm:hidden p-2 text-gray-400 hover:text-white cursor-pointer"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {mobileMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
        {mobileMenuOpen && (
          <nav className="sm:hidden mt-4 pb-2 flex flex-col gap-3 text-sm text-gray-400">
            <a href="#how-it-works" className="hover:text-white transition" onClick={() => setMobileMenuOpen(false)}>How it works</a>
            <a href="#why" className="hover:text-white transition" onClick={() => setMobileMenuOpen(false)}>Why it matters</a>
          </nav>
        )}
      </header>

      {/* Hero */}
      <main className="flex-1">
        <section className="max-w-5xl mx-auto px-6 pt-16 sm:pt-20 pb-16 text-center">
          <div className="inline-block px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-sm font-medium mb-6">
            AI shopping agents are here. Is your store ready?
          </div>
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-tight mb-6">
            Find out if AI agents<br />
            <span className="text-indigo-400">can buy from your store</span>
          </h1>
          <p className="text-base sm:text-lg text-gray-400 max-w-2xl mx-auto mb-10">
            Google, Visa, and OpenAI are building AI shopping agents that buy products autonomously.
            Scan your store to see if agents can discover, understand, and purchase your products.
          </p>

          {/* Scanner Input */}
          <form onSubmit={handleScan} className="max-w-2xl mx-auto flex flex-col sm:flex-row gap-3">
            <label htmlFor="store-url" className="sr-only">Store URL</label>
            <input
              id="store-url"
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Enter your store URL (e.g., mystore.com)"
              className="flex-1 px-5 py-4 rounded-xl bg-gray-900 border border-gray-700 text-white placeholder:text-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-lg"
              disabled={scanning}
              autoComplete="url"
            />
            <button
              type="submit"
              disabled={scanning || !url.trim()}
              className="px-8 py-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:text-gray-500 font-semibold text-lg transition-colors cursor-pointer disabled:cursor-not-allowed"
            >
              {scanning ? "Scanning..." : "Scan Free"}
            </button>
          </form>
          <p className="text-xs text-gray-600 mt-3">Free scan. No signup required. 5 scans per minute.</p>

          {error && (
            <div className="mt-6 max-w-2xl mx-auto p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400" role="alert">
              {error}
            </div>
          )}
        </section>

        {/* Scanning Animation */}
        {scanning && (
          <section className="max-w-3xl mx-auto px-6">
            <ScanningAnimation />
          </section>
        )}

        {/* Results */}
        {result && (
          <section ref={resultRef} className="max-w-3xl mx-auto px-6 pb-20">
            <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6 sm:p-8">
              {/* Score Header */}
              <div className="flex flex-col sm:flex-row items-center gap-6 sm:gap-8 mb-8">
                <ScoreRing score={result.overallScore} grade={result.grade} />
                <div className="text-center sm:text-left flex-1">
                  <h2 className="text-2xl font-bold mb-1">Agent Readiness Score</h2>
                  <p className="text-gray-400 mb-1 break-all">{result.url}</p>
                  <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500">
                    <span>Scanned {new Date(result.scannedAt).toLocaleString()}</span>
                    <span>({result.scanDurationMs}ms)</span>
                  </div>
                  {result.overallScore < 50 && (
                    <p className="mt-3 text-red-400 text-sm font-medium">
                      Your store is largely invisible to AI shopping agents. Critical improvements needed.
                    </p>
                  )}
                  {result.overallScore >= 50 && result.overallScore < 75 && (
                    <p className="mt-3 text-yellow-400 text-sm font-medium">
                      AI agents can partially read your store but will miss key product details.
                    </p>
                  )}
                  {result.overallScore >= 75 && (
                    <p className="mt-3 text-green-400 text-sm font-medium">
                      Your store is well-positioned for AI shopping agents.
                    </p>
                  )}
                </div>
              </div>

              {/* Action Bar */}
              <div className="flex flex-wrap gap-3 mb-6">
                <button
                  onClick={handleShare}
                  className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm font-medium transition-colors cursor-pointer flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                  {copied ? "Copied!" : "Share Results"}
                </button>
                <div className="text-sm text-gray-500 flex items-center">
                  {totalRecommendations} recommendation{totalRecommendations !== 1 ? "s" : ""} found
                </div>
              </div>

              {/* Category Breakdown */}
              <div className="space-y-3">
                {result.categories.map((cat, i) => (
                  <CategoryCard key={i} category={cat} defaultOpen={cat.status === "fail"} />
                ))}
              </div>

              {/* Email Capture */}
              {emailState !== "done" ? (
                <div className="mt-8 p-6 rounded-xl bg-indigo-600/10 border border-indigo-500/20">
                  <h3 className="text-lg font-bold text-indigo-400 mb-2">
                    Get your full optimization report
                  </h3>
                  <p className="text-sm text-gray-400 mb-4">
                    Receive a detailed PDF with step-by-step fix instructions, code snippets,
                    and priority ranking — delivered to your inbox.
                  </p>
                  <form onSubmit={handleEmailSubmit} className="flex flex-col sm:flex-row gap-3">
                    <label htmlFor="email-capture" className="sr-only">Email address</label>
                    <input
                      id="email-capture"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="your@email.com"
                      className="flex-1 px-4 py-3 rounded-lg bg-gray-900 border border-gray-700 text-white placeholder:text-gray-500 focus:outline-none focus:border-indigo-500"
                      required
                      disabled={emailState === "submitting"}
                    />
                    <button
                      type="submit"
                      disabled={emailState === "submitting"}
                      className="px-6 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed"
                    >
                      {emailState === "submitting" ? "Sending..." : "Send Report"}
                    </button>
                  </form>
                  {emailState === "error" && (
                    <p className="text-red-400 text-sm mt-2">Failed to submit. Please try again.</p>
                  )}
                </div>
              ) : (
                <div className="mt-8 p-6 rounded-xl bg-green-600/10 border border-green-500/20 text-center">
                  <p className="text-green-400 font-semibold">Report requested! Check your inbox shortly.</p>
                </div>
              )}

              {/* Scan Again */}
              <div className="mt-6 text-center">
                <button
                  onClick={() => {
                    setResult(null);
                    setUrl("");
                    setError("");
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  className="text-indigo-400 hover:text-indigo-300 text-sm font-medium transition-colors cursor-pointer"
                >
                  Scan another store
                </button>
              </div>
            </div>
          </section>
        )}

        {/* How It Works */}
        {!result && !scanning && (
          <>
            <section id="how-it-works" className="max-w-5xl mx-auto px-6 py-20">
              <h2 className="text-3xl font-bold text-center mb-12">How it works</h2>
              <div className="grid sm:grid-cols-3 gap-8">
                {[
                  { step: "1", title: "Enter your store URL", desc: "Paste your Shopify, WooCommerce, or any e-commerce store URL." },
                  { step: "2", title: "We scan for agent readiness", desc: "Our scanner checks structured data, product markup, machine accessibility, and commerce signals." },
                  { step: "3", title: "Get your score & fixes", desc: "See exactly what AI agents can and can't read, with specific recommendations to improve." },
                ].map((item) => (
                  <div key={item.step} className="bg-gray-900 border border-gray-800 rounded-xl p-6 text-center">
                    <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center font-bold text-lg mx-auto mb-4">
                      {item.step}
                    </div>
                    <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
                    <p className="text-gray-400 text-sm">{item.desc}</p>
                  </div>
                ))}
              </div>
            </section>

            <section id="why" className="max-w-5xl mx-auto px-6 py-20">
              <h2 className="text-3xl font-bold text-center mb-4">Why this matters right now</h2>
              <p className="text-gray-400 text-center max-w-2xl mx-auto mb-12">
                The shift to AI-powered shopping is happening faster than anyone predicted.
              </p>
              <div className="grid sm:grid-cols-2 gap-6">
                {[
                  { stat: "$1T+", label: "SaaS market value shifted in the Feb 2026 SaaSpocalypse" },
                  { stat: "Millions", label: "of consumers predicted to use AI agents to shop by holiday 2026 (Visa)" },
                  { stat: "41.5%", label: "of YC Winter 2026 batch is building AI agent infrastructure" },
                  { stat: "UCP", label: "Universal Commerce Protocol launched by Google with Shopify, Etsy, Target, Walmart" },
                ].map((item) => (
                  <div key={item.label} className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                    <div className="text-3xl font-bold text-indigo-400 mb-2">{item.stat}</div>
                    <p className="text-gray-400 text-sm">{item.label}</p>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-800 px-6 py-8">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-500">
          <p>AgentReady &mdash; Prepare your store for the AI shopping era.</p>
          <div className="flex gap-6">
            <a href="/api/health" className="hover:text-gray-300 transition">Status</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
