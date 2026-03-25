import type * as cheerio from "cheerio";

export interface SubCheck {
  name: string;
  passed: boolean;
  score: number;
  maxScore: number;
  detail: string;
}

export interface ScanCategory {
  name: string;
  score: number;
  maxScore: number;
  status: "pass" | "warn" | "fail";
  findings: string[];
  recommendations: string[];
  checks: SubCheck[];
}

export interface CheckContext {
  html: string;
  $: cheerio.CheerioAPI;
  url: string;
  headers: Record<string, string>;
  responseTimeMs: number;
  signal: AbortSignal;
}

export function categoryStatus(score: number, max: number): "pass" | "warn" | "fail" {
  const pct = max > 0 ? score / max : 0;
  if (pct >= 0.7) return "pass";
  if (pct >= 0.4) return "warn";
  return "fail";
}

export function check(name: string, passed: boolean, score: number, maxScore: number, detail: string): SubCheck {
  return { name, passed, score: passed ? score : 0, maxScore, detail };
}

export function partialCheck(name: string, score: number, maxScore: number, detail: string): SubCheck {
  return { name, passed: score >= maxScore * 0.7, score, maxScore, detail };
}
