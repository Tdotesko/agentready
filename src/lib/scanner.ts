import * as cheerio from "cheerio";
import { validateAndNormalizeUrl } from "./validate-url";

export interface ScanCategory {
  name: string;
  score: number;
  maxScore: number;
  status: "pass" | "warn" | "fail";
  findings: string[];
  recommendations: string[];
}

export interface ScanResult {
  url: string;
  overallScore: number;
  grade: string;
  categories: ScanCategory[];
  scannedAt: string;
  scanDurationMs: number;
}

const MAX_RESPONSE_BYTES = 5 * 1024 * 1024; // 5MB
const FETCH_TIMEOUT_MS = 15_000;

function gradeFromScore(score: number): string {
  if (score >= 90) return "A+";
  if (score >= 80) return "A";
  if (score >= 70) return "B";
  if (score >= 60) return "C";
  if (score >= 50) return "D";
  return "F";
}

function categoryStatus(score: number, max: number): "pass" | "warn" | "fail" {
  const pct = max > 0 ? score / max : 0;
  if (pct >= 0.7) return "pass";
  if (pct >= 0.4) return "warn";
  return "fail";
}

async function safeFetch(
  url: string,
  signal: AbortSignal
): Promise<{ html: string; headers: Record<string, string> }> {
  const response = await fetch(url, {
    signal,
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; AgentReadyBot/1.0; +https://agentready.dev)",
      Accept: "text/html,application/xhtml+xml",
    },
    redirect: "follow",
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html") && !contentType.includes("xhtml")) {
    throw new Error("URL does not return HTML content");
  }

  const contentLength = response.headers.get("content-length");
  if (contentLength && parseInt(contentLength) > MAX_RESPONSE_BYTES) {
    throw new Error("Page is too large to scan");
  }

  // Stream with size limit
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Could not read response");

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > MAX_RESPONSE_BYTES) {
      reader.cancel();
      throw new Error("Page is too large to scan (>5MB)");
    }
    chunks.push(value);
  }

  const decoder = new TextDecoder("utf-8");
  const html = chunks.map((c) => decoder.decode(c, { stream: true })).join("") +
    decoder.decode();

  const headers: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    headers[key.toLowerCase()] = value;
  });

  return { html, headers };
}

async function checkResourceExists(
  baseUrl: string,
  path: string,
  signal: AbortSignal
): Promise<boolean> {
  try {
    const url = new URL(path, baseUrl).toString();
    const res = await fetch(url, {
      method: "HEAD",
      signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; AgentReadyBot/1.0; +https://agentready.dev)",
      },
      redirect: "follow",
    });
    return res.ok;
  } catch {
    return false;
  }
}

function checkStructuredData(
  html: string,
  $: cheerio.CheerioAPI
): ScanCategory {
  const findings: string[] = [];
  const recommendations: string[] = [];
  let score = 0;
  const maxScore = 30;

  const jsonLdScripts = $('script[type="application/ld+json"]');
  if (jsonLdScripts.length > 0) {
    score += 10;
    findings.push(`Found ${jsonLdScripts.length} JSON-LD block(s)`);

    let hasProduct = false;
    let hasOrganization = false;
    let hasBreadcrumb = false;

    jsonLdScripts.each((_, el) => {
      try {
        const raw = $(el).text();
        if (raw.length > 100_000) return; // skip absurdly large blocks
        const data = JSON.parse(raw);
        const items = Array.isArray(data) ? data : [data];

        function extractTypes(obj: Record<string, unknown>): string[] {
          const types: string[] = [];
          if (typeof obj["@type"] === "string") types.push(obj["@type"]);
          if (Array.isArray(obj["@type"])) types.push(...obj["@type"]);
          if (Array.isArray(obj["@graph"])) {
            for (const item of obj["@graph"]) {
              if (item && typeof item === "object") {
                types.push(...extractTypes(item as Record<string, unknown>));
              }
            }
          }
          return types;
        }

        for (const item of items) {
          if (!item || typeof item !== "object") continue;
          const types = extractTypes(item as Record<string, unknown>);
          if (types.some((t) => t === "Product")) hasProduct = true;
          if (types.some((t) => t === "Organization" || t === "WebSite"))
            hasOrganization = true;
          if (types.some((t) => t === "BreadcrumbList")) hasBreadcrumb = true;
        }
      } catch {
        findings.push("Found malformed JSON-LD block");
      }
    });

    if (hasProduct) {
      score += 8;
      findings.push("Product schema detected");
    } else {
      recommendations.push(
        "Add Product structured data (JSON-LD) with name, price, availability, description, images"
      );
    }

    if (hasOrganization) {
      score += 4;
      findings.push("Organization/WebSite schema detected");
    } else {
      recommendations.push(
        "Add Organization schema with name, logo, contact info"
      );
    }

    if (hasBreadcrumb) {
      score += 3;
      findings.push("Breadcrumb schema detected");
    } else {
      recommendations.push(
        "Add BreadcrumbList schema for better navigation context"
      );
    }
  } else {
    findings.push("No JSON-LD structured data found");
    recommendations.push(
      "Add JSON-LD structured data — this is the #1 way AI agents understand your products"
    );
  }

  const microdata = $("[itemtype]");
  if (microdata.length > 0) {
    score += 3;
    findings.push(`Found ${microdata.length} microdata element(s)`);
  }

  const ogTags = $('meta[property^="og:"]');
  if (ogTags.length >= 3) {
    score += 2;
    findings.push(`Found ${ogTags.length} Open Graph tags`);
  } else {
    recommendations.push(
      "Add Open Graph meta tags (og:title, og:description, og:image, og:price:amount)"
    );
  }

  return {
    name: "Structured Data",
    score: Math.min(score, maxScore),
    maxScore,
    status: categoryStatus(score, maxScore),
    findings,
    recommendations,
  };
}

function checkProductData($: cheerio.CheerioAPI): ScanCategory {
  const findings: string[] = [];
  const recommendations: string[] = [];
  let score = 0;
  const maxScore = 25;

  const metaDesc = $('meta[name="description"]').attr("content");
  if (metaDesc && metaDesc.length > 50) {
    score += 4;
    findings.push("Meta description present and descriptive");
  } else if (metaDesc) {
    score += 2;
    findings.push("Meta description present but short");
    recommendations.push(
      "Expand meta description to 120-160 chars with key product details"
    );
  } else {
    recommendations.push(
      "Add a meta description — AI agents use this to understand page content"
    );
  }

  const priceMetaOg = $(
    'meta[property="og:price:amount"], meta[property="product:price:amount"]'
  );
  const priceElements = $(
    '[class*="price"], [data-price], [itemprop="price"], .money, .product-price'
  );
  if (priceMetaOg.length > 0) {
    score += 6;
    findings.push("Machine-readable price meta tags found");
  } else if (priceElements.length > 0) {
    score += 3;
    findings.push("Price elements found in HTML but not in meta tags");
    recommendations.push(
      "Add og:price:amount and og:price:currency meta tags for machine-readable pricing"
    );
  } else {
    recommendations.push(
      "Ensure product prices are in structured data or meta tags, not just rendered via JavaScript"
    );
  }

  const images = $("img");
  const imagesWithAlt = $("img[alt]").filter(
    (_, el) => ($(el).attr("alt") || "").length > 5
  );
  if (images.length > 0) {
    score += 3;
    findings.push(`Found ${images.length} images`);
    if (imagesWithAlt.length >= images.length * 0.7) {
      score += 4;
      findings.push("Most images have descriptive alt text");
    } else {
      score += 1;
      recommendations.push(
        "Add descriptive alt text to all product images — agents use alt text to understand products"
      );
    }
  }

  const availabilityIndicators = $(
    '[itemprop="availability"], [class*="stock"], [class*="inventory"], [data-availability]'
  );
  if (availabilityIndicators.length > 0) {
    score += 4;
    findings.push("Product availability indicators found");
  } else {
    recommendations.push(
      "Add machine-readable availability status (in stock / out of stock) via structured data"
    );
  }

  const h1 = $("h1");
  if (h1.length === 1) {
    score += 4;
    findings.push("Single H1 tag found (good page structure)");
  } else if (h1.length > 1) {
    score += 2;
    findings.push(`Multiple H1 tags found (${h1.length})`);
    recommendations.push(
      "Use a single H1 per page for clear product identification"
    );
  }

  return {
    name: "Product Data Quality",
    score: Math.min(score, maxScore),
    maxScore,
    status: categoryStatus(score, maxScore),
    findings,
    recommendations,
  };
}

function checkMachineAccessibility(
  $: cheerio.CheerioAPI,
  headers: Record<string, string>,
  hasSitemap: boolean,
  hasRobotsTxt: boolean
): ScanCategory {
  const findings: string[] = [];
  const recommendations: string[] = [];
  let score = 0;
  const maxScore = 20;

  const canonical = $('link[rel="canonical"]');
  if (canonical.length > 0) {
    score += 3;
    findings.push("Canonical URL set");
  } else {
    recommendations.push(
      "Add a canonical URL tag to prevent duplicate content issues for agents"
    );
  }

  const robotsMeta = $('meta[name="robots"]');
  const robotsContent = robotsMeta.attr("content") || "";
  if (robotsMeta.length > 0 && !robotsContent.includes("noindex")) {
    score += 2;
    findings.push("Page is indexable by agents");
  } else if (robotsContent.includes("noindex")) {
    findings.push("Page is set to noindex — AI agents may not discover this");
    recommendations.push(
      "Remove noindex if you want AI shopping agents to find your products"
    );
  } else {
    score += 2;
    findings.push("No robots meta tag (defaults to indexable)");
  }

  const langAttr = $("html").attr("lang");
  if (langAttr) {
    score += 2;
    findings.push(`Language declared: ${langAttr}`);
  } else {
    recommendations.push(
      "Add lang attribute to <html> tag for language identification"
    );
  }

  if (hasSitemap) {
    score += 4;
    findings.push("sitemap.xml is accessible");
  } else {
    recommendations.push(
      "Add a sitemap.xml — this is critical for AI agents to discover all your products"
    );
  }

  if (hasRobotsTxt) {
    score += 2;
    findings.push("robots.txt is accessible");
  } else {
    recommendations.push(
      "Add a robots.txt file to guide AI agent crawlers"
    );
  }

  const feedLink = $(
    'link[type="application/rss+xml"], link[type="application/atom+xml"]'
  );
  if (feedLink.length > 0) {
    score += 2;
    findings.push("RSS/Atom feed detected — agents can track product updates");
  } else {
    recommendations.push(
      "Add an RSS/Atom feed for new products so agents can track inventory changes"
    );
  }

  const contentType = headers["content-type"] || "";
  if (contentType.includes("utf-8")) {
    score += 1;
    findings.push("UTF-8 encoding confirmed");
  }

  const nav = $("nav");
  const main = $("main");
  const footer = $("footer");
  const semanticCount =
    (nav.length > 0 ? 1 : 0) +
    (main.length > 0 ? 1 : 0) +
    (footer.length > 0 ? 1 : 0);
  if (semanticCount >= 2) {
    score += 2;
    findings.push("Good semantic HTML structure");
  } else {
    recommendations.push(
      "Use semantic HTML elements (nav, main, footer) for better agent parsing"
    );
  }

  return {
    name: "Machine Accessibility",
    score: Math.min(score, maxScore),
    maxScore,
    status: categoryStatus(score, maxScore),
    findings,
    recommendations,
  };
}

function checkAgentCommerce($: cheerio.CheerioAPI): ScanCategory {
  const findings: string[] = [];
  const recommendations: string[] = [];
  let score = 0;
  const maxScore = 15;

  const cartButtons = $(
    '[class*="add-to-cart"], [id*="add-to-cart"], [data-action="add-to-cart"], form[action*="cart"], button[name="add"], input[name="add"]'
  );
  if (cartButtons.length > 0) {
    score += 4;
    findings.push("Add-to-cart functionality detected");
  } else {
    recommendations.push(
      "Ensure add-to-cart actions are identifiable in the DOM (not purely JS-rendered)"
    );
  }

  const apiLinks = $('link[rel="api"], meta[name="api-url"]');
  if (apiLinks.length > 0) {
    score += 5;
    findings.push("API endpoint references found");
  } else {
    recommendations.push(
      "Consider exposing a product API or catalog feed for direct agent access"
    );
  }

  const policyLinks = $(
    'a[href*="policy"], a[href*="shipping"], a[href*="returns"], a[href*="refund"]'
  );
  if (policyLinks.length >= 2) {
    score += 3;
    findings.push("Policy pages (shipping/returns) are linked");
  } else {
    recommendations.push(
      "Link to shipping and returns policies from product pages — agents check these before recommending purchases"
    );
  }

  const reviews = $(
    '[itemprop="aggregateRating"], [itemprop="review"], [class*="review"], [class*="rating"]'
  );
  if (reviews.length > 0) {
    score += 3;
    findings.push("Reviews/ratings section detected");
  } else {
    recommendations.push(
      "Add structured review/rating data — agents prioritize products with social proof"
    );
  }

  return {
    name: "Agent Commerce Readiness",
    score: Math.min(score, maxScore),
    maxScore,
    status: categoryStatus(score, maxScore),
    findings,
    recommendations,
  };
}

function checkPerformance(
  html: string,
  $: cheerio.CheerioAPI
): ScanCategory {
  const findings: string[] = [];
  const recommendations: string[] = [];
  let score = 0;
  const maxScore = 10;

  const sizeKB = new TextEncoder().encode(html).byteLength / 1024;
  if (sizeKB < 200) {
    score += 3;
    findings.push(`Page size: ${Math.round(sizeKB)}KB (lean)`);
  } else if (sizeKB < 500) {
    score += 2;
    findings.push(`Page size: ${Math.round(sizeKB)}KB (moderate)`);
  } else {
    findings.push(`Page size: ${Math.round(sizeKB)}KB (heavy)`);
    recommendations.push(
      "Reduce page size — heavy pages are slower for agents to parse"
    );
  }

  const scripts = $("script[src]");
  if (scripts.length < 10) {
    score += 2;
    findings.push(`${scripts.length} external scripts (good)`);
  } else if (scripts.length < 20) {
    score += 1;
    findings.push(`${scripts.length} external scripts (moderate)`);
  } else {
    findings.push(`${scripts.length} external scripts (excessive)`);
    recommendations.push(
      "Reduce external scripts — they can block agent parsing and slow page loads"
    );
  }

  const lazyImages = $('img[loading="lazy"]');
  if (lazyImages.length > 0) {
    score += 2;
    findings.push("Lazy loading implemented for images");
  }

  const inlineScripts = $("script:not([src])");
  const totalJSBlocks = scripts.length + inlineScripts.length;
  if (totalJSBlocks < 15) {
    score += 3;
    findings.push("Reasonable JavaScript footprint");
  } else {
    recommendations.push(
      "Heavy JavaScript dependency may mean content isn't available without JS execution — agents prefer server-rendered content"
    );
  }

  return {
    name: "Performance & Parsability",
    score: Math.min(score, maxScore),
    maxScore,
    status: categoryStatus(score, maxScore),
    findings,
    recommendations,
  };
}

export async function scanStore(rawUrl: string): Promise<ScanResult> {
  const startTime = Date.now();
  const normalizedUrl = validateAndNormalizeUrl(rawUrl);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const [{ html, headers }, hasSitemap, hasRobotsTxt] = await Promise.all([
      safeFetch(normalizedUrl, controller.signal),
      checkResourceExists(normalizedUrl, "/sitemap.xml", controller.signal),
      checkResourceExists(normalizedUrl, "/robots.txt", controller.signal),
    ]);

    const $ = cheerio.load(html);

    const categories = [
      checkStructuredData(html, $),
      checkProductData($),
      checkMachineAccessibility($, headers, hasSitemap, hasRobotsTxt),
      checkAgentCommerce($),
      checkPerformance(html, $),
    ];

    const totalScore = categories.reduce((sum, c) => sum + c.score, 0);
    const totalMax = categories.reduce((sum, c) => sum + c.maxScore, 0);
    const overallScore = Math.round((totalScore / totalMax) * 100);

    return {
      url: normalizedUrl,
      overallScore,
      grade: gradeFromScore(overallScore),
      categories,
      scannedAt: new Date().toISOString(),
      scanDurationMs: Date.now() - startTime,
    };
  } finally {
    clearTimeout(timeout);
  }
}
