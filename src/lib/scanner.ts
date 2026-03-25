import * as cheerio from "cheerio";
import { validateAndNormalizeUrl } from "./validate-url";
import { checkUCPProtocol, checkOpenAIFeedReadiness, checkACPProtocol, checkAIDiscoverability, checkSecurityTrust, checkShippingReturns, checkIdentifiersTaxonomy } from "./checks";

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

export interface ScanResult {
  url: string;
  overallScore: number;
  grade: string;
  categories: ScanCategory[];
  scannedAt: string;
  scanDurationMs: number;
  topIssue: string | null;
  estimatedFixTime: string;
  responseTimeMs: number;
  isHttps: boolean;
  warnings: string[];
}

const MAX_RESPONSE_BYTES = 5 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 15_000;

function gradeFromScore(score: number): string {
  if (score >= 92) return "A+";
  if (score >= 82) return "A";
  if (score >= 72) return "B";
  if (score >= 58) return "C";
  if (score >= 40) return "D";
  return "F";
}

function categoryStatus(score: number, max: number): "pass" | "warn" | "fail" {
  const pct = max > 0 ? score / max : 0;
  if (pct >= 0.7) return "pass";
  if (pct >= 0.4) return "warn";
  return "fail";
}

/* ─── Fetch with bot detection ─── */
export async function safeFetch(
  url: string,
  signal: AbortSignal
): Promise<{ html: string; headers: Record<string, string>; responseTimeMs: number }> {
  const t0 = Date.now();
  const response = await fetch(url, {
    signal,
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; CartParseBot/1.0; +https://cartparse.com)",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
    },
    redirect: "follow",
  });

  const responseTimeMs = Date.now() - t0;

  if (!response.ok) {
    if (response.status === 403 || response.status === 503) {
      const cfRay = response.headers.get("cf-ray");
      const server = response.headers.get("server") || "";
      if (cfRay || server.toLowerCase().includes("cloudflare")) {
        throw new Error("CLOUDFLARE_BLOCK");
      }
      if (response.status === 503) throw new Error("BOT_BLOCKED");
    }
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html") && !contentType.includes("xhtml") && !contentType.includes("text/plain")) {
    throw new Error("URL does not return HTML content");
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error("Could not read response");

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > MAX_RESPONSE_BYTES) { reader.cancel(); throw new Error("Page is too large to scan (>5MB)"); }
    chunks.push(value);
  }

  const decoder = new TextDecoder("utf-8");
  const html = chunks.map((c) => decoder.decode(c, { stream: true })).join("") + decoder.decode();

  // Detect challenge pages
  if (html.includes("cf-browser-verification") || html.includes("challenge-platform") || html.includes("Just a moment...")) {
    throw new Error("CLOUDFLARE_BLOCK");
  }
  if (html.includes("captcha") && html.includes("blocked") || html.includes("Access Denied")) {
    throw new Error("BOT_BLOCKED");
  }

  // Detect JS-only sites (tiny HTML body, many scripts)
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const bodyText = bodyMatch ? bodyMatch[1].replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<[^>]+>/g, "").trim() : "";
  const scriptCount = (html.match(/<script/gi) || []).length;
  if (bodyText.length < 100 && scriptCount > 5) {
    throw new Error("JS_ONLY_SITE");
  }

  const headers: Record<string, string> = {};
  response.headers.forEach((value, key) => { headers[key.toLowerCase()] = value; });

  return { html, headers, responseTimeMs };
}

async function checkResourceExists(baseUrl: string, path: string, signal: AbortSignal): Promise<boolean> {
  try {
    const url = new URL(path, baseUrl).toString();
    const res = await fetch(url, { method: "HEAD", signal, headers: { "User-Agent": "Mozilla/5.0 (compatible; CartParseBot/1.0)" }, redirect: "follow" });
    return res.ok;
  } catch { return false; }
}

/* ─── Product Schema Validator ─── */
interface SchemaValidation {
  hasProduct: boolean;
  hasOrganization: boolean;
  hasBreadcrumb: boolean;
  hasProductGroup: boolean;
  hasFAQ: boolean;
  hasVideo: boolean;
  hasReview: boolean;
  hasLocalBusiness: boolean;
  hasWebPage: boolean;
  hasSearchAction: boolean;
  correctContext: boolean;
  productFields: {
    name: boolean; description: boolean; image: boolean;
    price: boolean; currency: boolean; availability: boolean;
    sku: boolean; brand: boolean; rating: boolean;
  };
  productFieldScore: number;
  totalTypes: number;
  issues: string[];
}

function validateStructuredData(jsonLdBlocks: string[]): SchemaValidation {
  const result: SchemaValidation = {
    hasProduct: false, hasOrganization: false, hasBreadcrumb: false,
    hasProductGroup: false, hasFAQ: false, hasVideo: false, hasReview: false,
    hasLocalBusiness: false, hasWebPage: false, hasSearchAction: false,
    correctContext: false, totalTypes: 0,
    productFields: { name: false, description: false, image: false, price: false, currency: false, availability: false, sku: false, brand: false, rating: false },
    productFieldScore: 0, issues: [],
  };

  for (const raw of jsonLdBlocks) {
    if (raw.length > 200_000) continue;
    try {
      const data = JSON.parse(raw);
      const items = Array.isArray(data) ? data : [data];

      function walk(obj: Record<string, unknown>) {
        if (!obj || typeof obj !== "object") return;
        const types: string[] = [];
        if (typeof obj["@type"] === "string") types.push(obj["@type"]);
        if (Array.isArray(obj["@type"])) types.push(...(obj["@type"] as string[]));

        for (const t of types) {
          if (t === "Product" || t === "ProductGroup") {
            result.hasProduct = true;
            if (obj.name && String(obj.name).length > 0) result.productFields.name = true;
            if (obj.description && String(obj.description).length > 0) result.productFields.description = true;
            if (obj.image) result.productFields.image = true;
            if (obj.sku || obj.gtin || obj.gtin13 || obj.gtin8 || obj.mpn) result.productFields.sku = true;
            if (obj.brand) result.productFields.brand = true;
            if (obj.aggregateRating) result.productFields.rating = true;

            // Check offers
            const offers = obj.offers as Record<string, unknown> | Record<string, unknown>[] | undefined;
            if (offers) {
              const offerList = Array.isArray(offers) ? offers : [offers];
              for (const offer of offerList) {
                if (offer && typeof offer === "object") {
                  if (offer.price || offer.lowPrice || offer.highPrice) result.productFields.price = true;
                  if (offer.priceCurrency) result.productFields.currency = true;
                  if (offer.availability) result.productFields.availability = true;
                }
              }
            }
          }
          if (t === "Organization" || t === "WebSite" || t === "Store") result.hasOrganization = true;
          if (t === "BreadcrumbList") result.hasBreadcrumb = true;
          if (t === "ProductGroup") result.hasProductGroup = true;
          if (t === "FAQPage") result.hasFAQ = true;
          if (t === "VideoObject") result.hasVideo = true;
          if (t === "Review") result.hasReview = true;
          if (t === "LocalBusiness") result.hasLocalBusiness = true;
          if (t === "WebPage" || t === "ItemPage" || t === "CollectionPage") result.hasWebPage = true;
          if (t === "SearchAction") result.hasSearchAction = true;
          result.totalTypes++;
        }

        if (Array.isArray(obj["@graph"])) {
          for (const item of obj["@graph"]) {
            if (item && typeof item === "object") walk(item as Record<string, unknown>);
          }
        }
      }

      for (const item of items) {
        if (item && typeof item === "object") {
          const ctx = (item as Record<string, unknown>)["@context"];
          if (ctx === "https://schema.org" || ctx === "https://schema.org/") result.correctContext = true;
          if (ctx === "http://schema.org" || ctx === "http://schema.org/") result.issues.push("JSON-LD uses http://schema.org instead of https://schema.org");
          walk(item as Record<string, unknown>);
        }
      }
    } catch {
      result.issues.push("Malformed JSON-LD block found");
    }
  }

  // Score product fields (0-10)
  if (result.hasProduct) {
    const f = result.productFields;
    let s = 0;
    if (f.name) s += 2;        else result.issues.push("Product schema is missing 'name'");
    if (f.price) s += 2;       else result.issues.push("Product schema is missing price data. AI agents need this to compare products.");
    if (f.image) s += 1.5;     else result.issues.push("Product schema is missing 'image'. Agents use images to verify products.");
    if (f.availability) s += 1.5; else result.issues.push("Product schema is missing 'availability'. Agents need to know if items are in stock.");
    if (f.currency) s += 1;    else result.issues.push("Product schema is missing 'priceCurrency'. Without it, agents can't compare prices across currencies.");
    if (f.description) s += 0.5;
    if (f.sku) s += 0.5;
    if (f.brand) s += 0.5;
    if (f.rating) s += 0.5;
    result.productFieldScore = Math.min(10, Math.round(s));
  }

  return result;
}

/* ─── Category: Structured Data (25pts) ─── */
function checkStructuredData(html: string, $: cheerio.CheerioAPI): ScanCategory {
  const findings: string[] = [];
  const recommendations: string[] = [];
  const checks: SubCheck[] = [];
  let score = 0;
  const maxScore = 25;

  // Extract JSON-LD blocks
  const jsonLdBlocks: string[] = [];
  $('script[type="application/ld+json"]').each((_, el) => { jsonLdBlocks.push($(el).text()); });

  const validation = validateStructuredData(jsonLdBlocks);

  // JSON-LD presence (4pts)
  if (jsonLdBlocks.length > 0) {
    score += 4;
    findings.push(`Found ${jsonLdBlocks.length} JSON-LD block(s)`);
    checks.push({ name: "JSON-LD present", passed: true, score: 4, maxScore: 4, detail: `${jsonLdBlocks.length} blocks found` });
  } else {
    checks.push({ name: "JSON-LD present", passed: false, score: 0, maxScore: 4, detail: "No JSON-LD structured data" });
    recommendations.push("Add JSON-LD structured data to your pages. This is the primary way AI shopping agents understand your products, prices, and availability.");
  }

  // Product schema + field validation (10pts)
  if (validation.hasProduct) {
    const fieldScore = validation.productFieldScore;
    score += fieldScore;
    findings.push("Product schema detected");
    const missing = validation.issues.filter(i => i.startsWith("Product schema is missing"));
    if (missing.length > 0) {
      findings.push(`Product schema has ${10 - fieldScore} missing or incomplete fields`);
      for (const m of missing) recommendations.push(m);
    } else {
      findings.push("Product schema has all key fields (name, price, image, availability)");
    }
    checks.push({ name: "Product schema quality", passed: fieldScore >= 7, score: fieldScore, maxScore: 10, detail: `${fieldScore}/10 fields present` });
  } else if (jsonLdBlocks.length > 0) {
    checks.push({ name: "Product schema quality", passed: false, score: 0, maxScore: 10, detail: "No Product type found" });
    recommendations.push("Add Product structured data (JSON-LD) with name, price, availability, and image. Without this, AI agents can't understand what you sell.");
  }

  // Organization/WebSite schema (3pts)
  if (validation.hasOrganization) {
    score += 3;
    findings.push("Organization/WebSite schema detected");
    checks.push({ name: "Organization schema", passed: true, score: 3, maxScore: 3, detail: "Present" });
  } else {
    checks.push({ name: "Organization schema", passed: false, score: 0, maxScore: 3, detail: "Missing" });
    recommendations.push("Add Organization schema with your store name, logo, and contact info. This helps agents identify your brand.");
  }

  // BreadcrumbList (2pts)
  if (validation.hasBreadcrumb) {
    score += 2;
    findings.push("Breadcrumb schema detected");
    checks.push({ name: "Breadcrumb schema", passed: true, score: 2, maxScore: 2, detail: "Present" });
  } else {
    checks.push({ name: "Breadcrumb schema", passed: false, score: 0, maxScore: 2, detail: "Missing" });
    recommendations.push("Add BreadcrumbList schema so agents understand your site hierarchy and navigation paths.");
  }

  // Microdata (2pts)
  const microdata = $("[itemtype]");
  if (microdata.length > 0) {
    score += 2;
    findings.push(`Found ${microdata.length} microdata element(s)`);
    checks.push({ name: "Microdata", passed: true, score: 2, maxScore: 2, detail: `${microdata.length} elements` });
  } else {
    checks.push({ name: "Microdata", passed: false, score: 0, maxScore: 2, detail: "None found" });
  }

  // Open Graph (4pts)
  const ogTags = $('meta[property^="og:"]');
  const ogTypes = new Set<string>();
  ogTags.each((_, el) => { const p = $(el).attr("property"); if (p) ogTypes.add(p); });
  const hasOgTitle = ogTypes.has("og:title");
  const hasOgDesc = ogTypes.has("og:description");
  const hasOgImage = ogTypes.has("og:image");
  const ogScore = (hasOgTitle ? 1 : 0) + (hasOgDesc ? 1 : 0) + (hasOgImage ? 2 : 0);
  score += ogScore;
  if (ogTags.length > 0) findings.push(`Found ${ogTags.length} Open Graph tags`);
  checks.push({ name: "Open Graph tags", passed: ogScore >= 3, score: ogScore, maxScore: 4, detail: `title:${hasOgTitle ? "yes" : "no"} desc:${hasOgDesc ? "yes" : "no"} image:${hasOgImage ? "yes" : "no"}` });
  if (!hasOgTitle || !hasOgDesc || !hasOgImage) {
    const missing = [!hasOgTitle && "og:title", !hasOgDesc && "og:description", !hasOgImage && "og:image"].filter(Boolean).join(", ");
    recommendations.push(`Add missing Open Graph tags (${missing}). These help AI agents preview and share your products.`);
  }

  // NEW: ProductGroup/variants (1pt)
  if (validation.hasProductGroup) { score += 1; findings.push("ProductGroup schema (variants)"); checks.push({ name: "ProductGroup variants", passed: true, score: 1, maxScore: 1, detail: "Present" }); }
  else { checks.push({ name: "ProductGroup variants", passed: false, score: 0, maxScore: 1, detail: "Missing" }); }

  // NEW: FAQPage schema (1pt)
  if (validation.hasFAQ) { score += 1; findings.push("FAQPage schema detected"); checks.push({ name: "FAQ schema", passed: true, score: 1, maxScore: 1, detail: "Present" }); }
  else { checks.push({ name: "FAQ schema", passed: false, score: 0, maxScore: 1, detail: "Not found" }); }

  // NEW: VideoObject (1pt)
  if (validation.hasVideo) { score += 1; findings.push("VideoObject schema detected"); checks.push({ name: "Video schema", passed: true, score: 1, maxScore: 1, detail: "Present" }); }
  else { checks.push({ name: "Video schema", passed: false, score: 0, maxScore: 1, detail: "Not found" }); }

  // NEW: Context validation (1pt)
  if (validation.correctContext) { score += 1; checks.push({ name: "Schema context", passed: true, score: 1, maxScore: 1, detail: "https://schema.org" }); }
  else if (jsonLdBlocks.length > 0) { checks.push({ name: "Schema context", passed: false, score: 0, maxScore: 1, detail: "Wrong or missing @context" }); recommendations.push("Use @context: 'https://schema.org' (HTTPS, not HTTP) in all JSON-LD blocks."); }
  else { checks.push({ name: "Schema context", passed: false, score: 0, maxScore: 1, detail: "No JSON-LD" }); }

  // NEW: WebPage/ItemPage (1pt)
  if (validation.hasWebPage) { score += 1; checks.push({ name: "WebPage schema", passed: true, score: 1, maxScore: 1, detail: "Present" }); }
  else { checks.push({ name: "WebPage schema", passed: false, score: 0, maxScore: 1, detail: "Not found" }); }

  // NEW: LocalBusiness (1pt)
  if (validation.hasLocalBusiness) { score += 1; checks.push({ name: "LocalBusiness schema", passed: true, score: 1, maxScore: 1, detail: "Present" }); }
  else { checks.push({ name: "LocalBusiness schema", passed: false, score: 0, maxScore: 1, detail: "Not found" }); }

  // NEW: Review schema separate from rating (1pt)
  if (validation.hasReview) { score += 1; checks.push({ name: "Review schema", passed: true, score: 1, maxScore: 1, detail: "Present" }); }
  else { checks.push({ name: "Review schema", passed: false, score: 0, maxScore: 1, detail: "Not found" }); }

  // NEW: Total schema type richness (1pt)
  if (validation.totalTypes >= 5) { score += 1; checks.push({ name: "Schema richness", passed: true, score: 1, maxScore: 1, detail: `${validation.totalTypes} types` }); }
  else { checks.push({ name: "Schema richness", passed: false, score: 0, maxScore: 1, detail: `${validation.totalTypes} types (aim for 5+)` }); }

  // NEW: Twitter Card meta tags (1pt)
  const twitterCard = $('meta[name="twitter:card"]').length > 0;
  if (twitterCard) { score += 1; checks.push({ name: "Twitter Card", passed: true, score: 1, maxScore: 1, detail: "Present" }); }
  else { checks.push({ name: "Twitter Card", passed: false, score: 0, maxScore: 1, detail: "Missing" }); }

  // NEW: og:type set correctly (1pt)
  const ogType = $('meta[property="og:type"]').attr("content");
  if (ogType) { score += 1; checks.push({ name: "og:type", passed: true, score: 1, maxScore: 1, detail: ogType }); }
  else { checks.push({ name: "og:type", passed: false, score: 0, maxScore: 1, detail: "Missing" }); }

  // NEW: og:site_name (1pt)
  const ogSiteName = $('meta[property="og:site_name"]').attr("content");
  if (ogSiteName) { score += 1; checks.push({ name: "og:site_name", passed: true, score: 1, maxScore: 1, detail: ogSiteName }); }
  else { checks.push({ name: "og:site_name", passed: false, score: 0, maxScore: 1, detail: "Missing" }); }

  // Malformed blocks
  for (const issue of validation.issues.filter(i => i.includes("Malformed"))) {
    findings.push(issue);
  }

  return { name: "Structured Data", score: Math.min(score, maxScore), maxScore, status: categoryStatus(score, maxScore), findings, recommendations, checks };
}

/* ─── Category: Product Data Quality (25pts) ─── */
function checkProductData($: cheerio.CheerioAPI, url: string): ScanCategory {
  const findings: string[] = [];
  const recommendations: string[] = [];
  const checks: SubCheck[] = [];
  let score = 0;
  const maxScore = 25;

  // Meta description (4pts)
  const metaDesc = $('meta[name="description"]').attr("content");
  if (metaDesc && metaDesc.length >= 80) {
    score += 4;
    findings.push(`Meta description present (${metaDesc.length} chars)`);
    checks.push({ name: "Meta description", passed: true, score: 4, maxScore: 4, detail: `${metaDesc.length} characters` });
  } else if (metaDesc && metaDesc.length >= 30) {
    score += 2;
    findings.push(`Meta description present but short (${metaDesc.length} chars)`);
    checks.push({ name: "Meta description", passed: false, score: 2, maxScore: 4, detail: `${metaDesc.length} chars (aim for 120-160)` });
    recommendations.push("Your meta description is too short. Expand it to 120-160 characters with product details that help agents understand the page.");
  } else {
    checks.push({ name: "Meta description", passed: false, score: 0, maxScore: 4, detail: "Missing" });
    recommendations.push("Add a meta description to this page. AI agents use it to understand what the page is about before processing the full HTML.");
  }

  // Price signals (5pts)
  const priceMetaOg = $('meta[property="og:price:amount"], meta[property="product:price:amount"]');
  const priceCurrency = $('meta[property="og:price:currency"], meta[property="product:price:currency"]');
  const priceElements = $('[class*="price"], [data-price], [itemprop="price"], .money, .product-price');
  if (priceMetaOg.length > 0) {
    score += priceCurrency.length > 0 ? 5 : 3;
    findings.push("Machine-readable price meta tags found");
    if (priceCurrency.length === 0) recommendations.push("Add og:price:currency meta tag alongside your price. Agents need the currency to compare prices accurately.");
    checks.push({ name: "Price meta tags", passed: true, score: priceCurrency.length > 0 ? 5 : 3, maxScore: 5, detail: `price:${priceMetaOg.length > 0 ? "yes" : "no"} currency:${priceCurrency.length > 0 ? "yes" : "no"}` });
  } else if (priceElements.length > 0) {
    score += 2;
    findings.push("Price elements found in HTML but not in meta tags");
    checks.push({ name: "Price meta tags", passed: false, score: 2, maxScore: 5, detail: "Prices in HTML only, not in meta tags" });
    recommendations.push("Add og:price:amount and og:price:currency meta tags. Your prices are visible in the HTML but not in a format AI agents can reliably read.");
  } else {
    checks.push({ name: "Price meta tags", passed: false, score: 0, maxScore: 5, detail: "No price signals found" });
    recommendations.push("No product prices were found in the HTML or meta tags. If this is a product page, prices may be loaded by JavaScript, which many AI agents can't execute.");
  }

  // Images + alt text (5pts)
  const images = $("img");
  const imagesWithAlt = $("img[alt]").filter((_, el) => ($(el).attr("alt") || "").length > 5);
  const imagesWithDimensions = $("img[width][height]");
  if (images.length > 0) {
    const altRatio = images.length > 0 ? imagesWithAlt.length / images.length : 0;
    let imgScore = 0;
    if (altRatio >= 0.8) { imgScore += 3; findings.push(`${imagesWithAlt.length}/${images.length} images have descriptive alt text`); }
    else if (altRatio >= 0.4) { imgScore += 1; findings.push(`Only ${imagesWithAlt.length}/${images.length} images have descriptive alt text`); recommendations.push(`${images.length - imagesWithAlt.length} images are missing descriptive alt text. AI agents use alt text to understand product images. Add specific descriptions like "Red running shoe, side view" instead of generic text.`); }
    else { recommendations.push(`Most of your ${images.length} images lack descriptive alt text. Add specific product descriptions to each image for AI agent visibility.`); }
    if (imagesWithDimensions.length >= images.length * 0.5) { imgScore += 2; findings.push("Images have explicit dimensions set"); }
    else { imgScore += 1; recommendations.push("Add width and height attributes to your images. This prevents layout shift and helps agents parse the page faster."); }
    score += imgScore;
    checks.push({ name: "Image quality", passed: imgScore >= 4, score: imgScore, maxScore: 5, detail: `alt: ${Math.round(altRatio * 100)}%, dimensions: ${imagesWithDimensions.length}/${images.length}` });
  } else {
    checks.push({ name: "Image quality", passed: false, score: 0, maxScore: 5, detail: "No images found" });
  }

  // Availability (4pts)
  const availabilityIndicators = $('[itemprop="availability"], [class*="stock"], [class*="inventory"], [data-availability]');
  if (availabilityIndicators.length > 0) {
    score += 4;
    findings.push("Product availability indicators found");
    checks.push({ name: "Availability signals", passed: true, score: 4, maxScore: 4, detail: "Present in HTML" });
  } else {
    checks.push({ name: "Availability signals", passed: false, score: 0, maxScore: 4, detail: "Not found" });
    recommendations.push("Add visible stock/availability status to your product pages. Include it in structured data with 'offers.availability' set to InStock or OutOfStock.");
  }

  // H1 structure (3pts)
  const h1 = $("h1");
  if (h1.length === 1) {
    score += 3;
    findings.push("Single H1 tag found (clean page structure)");
    checks.push({ name: "H1 structure", passed: true, score: 3, maxScore: 3, detail: "Single H1" });
  } else if (h1.length > 1) {
    score += 1;
    findings.push(`${h1.length} H1 tags found`);
    checks.push({ name: "H1 structure", passed: false, score: 1, maxScore: 3, detail: `${h1.length} H1 tags (should be 1)` });
    recommendations.push(`This page has ${h1.length} H1 tags. Use a single H1 for the product or page title so agents can clearly identify the primary content.`);
  } else {
    checks.push({ name: "H1 structure", passed: false, score: 0, maxScore: 3, detail: "No H1 tag" });
    recommendations.push("Add an H1 tag with the product or page title. This is the first thing agents look for to understand the page.");
  }

  // Favicon (1pt)
  const favicon = $('link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]');
  if (favicon.length > 0) {
    score += 1;
    checks.push({ name: "Favicon", passed: true, score: 1, maxScore: 1, detail: "Present" });
  } else {
    checks.push({ name: "Favicon", passed: false, score: 0, maxScore: 1, detail: "Missing" });
  }

  // Title tag (3pts)
  const title = $("title").text();
  if (title && title.length >= 20 && title.length <= 70) {
    score += 3;
    findings.push(`Title tag present (${title.length} chars)`);
    checks.push({ name: "Title tag", passed: true, score: 3, maxScore: 3, detail: `${title.length} characters` });
  } else if (title) {
    score += 1;
    checks.push({ name: "Title tag", passed: false, score: 1, maxScore: 3, detail: `${title.length} chars (aim for 30-60)` });
    if (title.length < 20) recommendations.push("Your page title is very short. Use 30-60 characters with the product name and key details.");
    if (title.length > 70) recommendations.push("Your page title is too long and may get truncated. Keep it under 60 characters.");
  } else {
    checks.push({ name: "Title tag", passed: false, score: 0, maxScore: 3, detail: "Missing" });
    recommendations.push("Add a title tag to this page. Every page needs a unique, descriptive title.");
  }

  // NEW: Multiple product images (1pt)
  const productImages = $('img[class*="product"], img[class*="gallery"], [class*="product-image"] img').length;
  if (productImages >= 3) { score += 1; checks.push({ name: "Multiple product images", passed: true, score: 1, maxScore: 1, detail: `${productImages} images` }); }
  else { checks.push({ name: "Multiple product images", passed: false, score: 0, maxScore: 1, detail: `${productImages} (aim for 3+)` }); }

  // NEW: Srcset responsive images (1pt)
  const srcsetImages = $("img[srcset], source[srcset]").length;
  if (srcsetImages > 0) { score += 1; checks.push({ name: "Responsive images", passed: true, score: 1, maxScore: 1, detail: `${srcsetImages} with srcset` }); }
  else { checks.push({ name: "Responsive images", passed: false, score: 0, maxScore: 1, detail: "No srcset" }); }

  // NEW: Price format validation (1pt)
  const priceInSchema = $('script[type="application/ld+json"]').text();
  const hasCurrencyInPrice = priceInSchema.includes('"price":"$') || priceInSchema.includes('"price": "$') || priceInSchema.includes('"price":"£');
  if (!hasCurrencyInPrice) { score += 1; checks.push({ name: "Price format clean", passed: true, score: 1, maxScore: 1, detail: "No currency symbols in price value" }); }
  else { checks.push({ name: "Price format clean", passed: false, score: 0, maxScore: 1, detail: "Currency symbol in price value" }); recommendations.push("Remove currency symbols from price values in schema. Use numeric values only (29.99, not $29.99)."); }

  // NEW: Product description length (1pt)
  const metaDescLen = ($('meta[name="description"]').attr("content") || "").length;
  const ogDescLen = ($('meta[property="og:description"]').attr("content") || "").length;
  const bestDescLen = Math.max(metaDescLen, ogDescLen);
  if (bestDescLen >= 100) { score += 1; checks.push({ name: "Description depth", passed: true, score: 1, maxScore: 1, detail: `${bestDescLen} chars` }); }
  else { checks.push({ name: "Description depth", passed: false, score: 0, maxScore: 1, detail: `${bestDescLen} chars (aim for 100+)` }); }

  // NEW: Structured data in head (1pt)
  const sdInHead = $('head script[type="application/ld+json"]').length;
  if (sdInHead > 0) { score += 1; checks.push({ name: "Schema in head", passed: true, score: 1, maxScore: 1, detail: `${sdInHead} blocks in head` }); }
  else { checks.push({ name: "Schema in head", passed: false, score: 0, maxScore: 1, detail: "Not in head" }); }

  // NEW: Unique title vs og:title (1pt)
  const pageTitle = $("title").text().trim();
  const ogTitle = $('meta[property="og:title"]').attr("content")?.trim() || "";
  if (pageTitle && ogTitle && pageTitle !== ogTitle) { score += 1; checks.push({ name: "Unique title/og:title", passed: true, score: 1, maxScore: 1, detail: "Different" }); }
  else { checks.push({ name: "Unique title/og:title", passed: false, score: 0, maxScore: 1, detail: pageTitle === ogTitle ? "Identical" : "Missing one" }); }

  // NEW: Canonical matches current URL (1pt)
  const canonical = $('link[rel="canonical"]').attr("href");
  if (canonical) { score += 1; checks.push({ name: "Canonical URL set", passed: true, score: 1, maxScore: 1, detail: canonical.slice(0, 50) }); }
  else { checks.push({ name: "Canonical URL set", passed: false, score: 0, maxScore: 1, detail: "Missing" }); }

  // NEW: JSON-LD count (1pt)
  const jsonLdCount = $('script[type="application/ld+json"]').length;
  if (jsonLdCount >= 2) { score += 1; checks.push({ name: "Rich JSON-LD", passed: true, score: 1, maxScore: 1, detail: `${jsonLdCount} blocks` }); }
  else { checks.push({ name: "Rich JSON-LD", passed: false, score: 0, maxScore: 1, detail: `${jsonLdCount} block(s)` }); }

  // NEW: No duplicate H1 content (1pt)
  const h1Texts = new Set<string>();
  $("h1").each((_, el) => { h1Texts.add($(el).text().trim()); });
  if (h1Texts.size === $("h1").length && h1Texts.size > 0) { score += 1; checks.push({ name: "Unique H1 content", passed: true, score: 1, maxScore: 1, detail: "All unique" }); }
  else { checks.push({ name: "Unique H1 content", passed: false, score: 0, maxScore: 1, detail: h1Texts.size === 0 ? "No H1" : "Duplicates" }); }

  return { name: "Product Data Quality", score: Math.min(score, maxScore), maxScore, status: categoryStatus(score, maxScore), findings, recommendations, checks };
}

/* ─── Category: Machine Accessibility (20pts) ─── */
function checkMachineAccessibility($: cheerio.CheerioAPI, headers: Record<string, string>, hasSitemap: boolean, hasRobotsTxt: boolean, url: string): ScanCategory {
  const findings: string[] = [];
  const recommendations: string[] = [];
  const checks: SubCheck[] = [];
  let score = 0;
  const maxScore = 20;

  // HTTPS (3pts)
  const isHttps = url.startsWith("https://");
  if (isHttps) {
    score += 3;
    findings.push("HTTPS enabled");
    checks.push({ name: "HTTPS", passed: true, score: 3, maxScore: 3, detail: "Secure connection" });
  } else {
    checks.push({ name: "HTTPS", passed: false, score: 0, maxScore: 3, detail: "Not using HTTPS" });
    recommendations.push("Switch to HTTPS. AI agents and browsers flag insecure sites, and some agents refuse to interact with HTTP-only stores.");
  }

  // Canonical URL (3pts)
  const canonical = $('link[rel="canonical"]');
  if (canonical.length > 0) {
    score += 3;
    findings.push("Canonical URL set");
    checks.push({ name: "Canonical URL", passed: true, score: 3, maxScore: 3, detail: canonical.attr("href") || "Set" });
  } else {
    checks.push({ name: "Canonical URL", passed: false, score: 0, maxScore: 3, detail: "Missing" });
    recommendations.push("Add a canonical URL tag to prevent duplicate content issues. Without it, agents may index the wrong version of your pages.");
  }

  // Robots meta (2pts)
  const robotsMeta = $('meta[name="robots"]');
  const robotsContent = robotsMeta.attr("content") || "";
  if (robotsContent.includes("noindex")) {
    checks.push({ name: "Robots meta", passed: false, score: 0, maxScore: 2, detail: "noindex set" });
    findings.push("Page is set to noindex");
    recommendations.push("This page has a 'noindex' directive. AI shopping agents will not be able to discover or recommend products from this page.");
  } else {
    score += 2;
    findings.push("Page is indexable");
    checks.push({ name: "Robots meta", passed: true, score: 2, maxScore: 2, detail: "Indexable" });
  }

  // Language (2pts)
  const langAttr = $("html").attr("lang");
  if (langAttr) {
    score += 2;
    findings.push(`Language: ${langAttr}`);
    checks.push({ name: "Language attribute", passed: true, score: 2, maxScore: 2, detail: langAttr });
  } else {
    checks.push({ name: "Language attribute", passed: false, score: 0, maxScore: 2, detail: "Missing" });
    recommendations.push("Add a lang attribute to your HTML tag (e.g. lang=\"en\"). Agents use this to determine language and regional targeting.");
  }

  // Sitemap (3pts)
  if (hasSitemap) {
    score += 3;
    findings.push("sitemap.xml is accessible");
    checks.push({ name: "Sitemap", passed: true, score: 3, maxScore: 3, detail: "Accessible" });
  } else {
    checks.push({ name: "Sitemap", passed: false, score: 0, maxScore: 3, detail: "Not found" });
    recommendations.push("Your sitemap.xml is missing or not accessible. AI agents use sitemaps to discover all your product pages. This is one of the most impactful fixes you can make.");
  }

  // robots.txt (1pt)
  if (hasRobotsTxt) {
    score += 1;
    findings.push("robots.txt is accessible");
    checks.push({ name: "robots.txt", passed: true, score: 1, maxScore: 1, detail: "Accessible" });
  } else {
    checks.push({ name: "robots.txt", passed: false, score: 0, maxScore: 1, detail: "Not found" });
    recommendations.push("Add a robots.txt file to guide how AI agents crawl your site.");
  }

  // Mobile viewport (2pts)
  const viewport = $('meta[name="viewport"]');
  const viewportContent = viewport.attr("content") || "";
  if (viewport.length > 0 && viewportContent.includes("width=device-width")) {
    score += 2;
    findings.push("Mobile viewport configured");
    checks.push({ name: "Mobile viewport", passed: true, score: 2, maxScore: 2, detail: "Responsive" });
  } else {
    checks.push({ name: "Mobile viewport", passed: false, score: 0, maxScore: 2, detail: "Missing or misconfigured" });
    recommendations.push("Add a mobile viewport meta tag. Some AI agents browse as mobile devices, and non-responsive pages may render incorrectly.");
  }

  // Semantic HTML (2pts)
  const semanticCount = ($("nav").length > 0 ? 1 : 0) + ($("main").length > 0 ? 1 : 0) + ($("footer").length > 0 ? 1 : 0) + ($("header").length > 0 ? 1 : 0) + ($("article").length > 0 ? 1 : 0);
  if (semanticCount >= 3) {
    score += 2;
    findings.push("Strong semantic HTML structure");
    checks.push({ name: "Semantic HTML", passed: true, score: 2, maxScore: 2, detail: `${semanticCount} semantic elements` });
  } else if (semanticCount >= 1) {
    score += 1;
    checks.push({ name: "Semantic HTML", passed: false, score: 1, maxScore: 2, detail: `${semanticCount} semantic elements (aim for 3+)` });
  } else {
    checks.push({ name: "Semantic HTML", passed: false, score: 0, maxScore: 2, detail: "No semantic elements" });
    recommendations.push("Use semantic HTML elements (header, nav, main, article, footer). They help agents understand your page layout and find content faster.");
  }

  // NEW: Compression (1pt)
  const encoding = headers["content-encoding"] || "";
  if (encoding.includes("gzip") || encoding.includes("br") || encoding.includes("deflate")) { score += 1; checks.push({ name: "Compression", passed: true, score: 1, maxScore: 1, detail: encoding }); findings.push(`Compression: ${encoding}`); }
  else { checks.push({ name: "Compression", passed: false, score: 0, maxScore: 1, detail: "Not compressed" }); }

  // NEW: Cache-Control (1pt)
  if (headers["cache-control"]) { score += 1; checks.push({ name: "Cache-Control", passed: true, score: 1, maxScore: 1, detail: headers["cache-control"].slice(0, 40) }); }
  else { checks.push({ name: "Cache-Control", passed: false, score: 0, maxScore: 1, detail: "Not set" }); }

  // NEW: ETag (1pt)
  if (headers["etag"]) { score += 1; checks.push({ name: "ETag caching", passed: true, score: 1, maxScore: 1, detail: "Present" }); }
  else { checks.push({ name: "ETag caching", passed: false, score: 0, maxScore: 1, detail: "Not set" }); }

  // NEW: X-Robots-Tag header (1pt)
  const xRobots = headers["x-robots-tag"] || "";
  if (!xRobots.includes("noindex")) { score += 1; checks.push({ name: "X-Robots-Tag", passed: true, score: 1, maxScore: 1, detail: xRobots || "Not set (good)" }); }
  else { checks.push({ name: "X-Robots-Tag", passed: false, score: 0, maxScore: 1, detail: "noindex set" }); }

  // NEW: Clean URL structure (1pt)
  const hasCleanUrl = !url.includes("?sid=") && !url.includes("&session") && !url.includes("jsessionid");
  if (hasCleanUrl) { score += 1; checks.push({ name: "Clean URLs", passed: true, score: 1, maxScore: 1, detail: "No session IDs" }); }
  else { checks.push({ name: "Clean URLs", passed: false, score: 0, maxScore: 1, detail: "Session IDs in URL" }); }

  // NEW: hreflang tags (1pt)
  const hreflang = $('link[hreflang]').length;
  if (hreflang > 0) { score += 1; findings.push(`${hreflang} hreflang tags`); checks.push({ name: "hreflang", passed: true, score: 1, maxScore: 1, detail: `${hreflang} languages` }); }
  else { checks.push({ name: "hreflang", passed: false, score: 0, maxScore: 1, detail: "Not set" }); }

  // NEW: Content-Type (1pt)
  const ct = headers["content-type"] || "";
  if (ct.includes("text/html") && ct.includes("utf-8")) { score += 1; checks.push({ name: "Content-Type", passed: true, score: 1, maxScore: 1, detail: "text/html; charset=utf-8" }); }
  else { checks.push({ name: "Content-Type", passed: false, score: 0, maxScore: 1, detail: ct.slice(0, 40) || "Missing" }); }

  // NEW: Meta charset (1pt)
  const charset = $('meta[charset]').length > 0 || $('meta[http-equiv="content-type"]').length > 0;
  if (charset) { score += 1; checks.push({ name: "Charset declaration", passed: true, score: 1, maxScore: 1, detail: "Present" }); }
  else { checks.push({ name: "Charset declaration", passed: false, score: 0, maxScore: 1, detail: "Missing" }); }

  // NEW: Preconnect hints (1pt)
  const preconnect = $('link[rel="preconnect"], link[rel="dns-prefetch"]').length;
  if (preconnect > 0) { score += 1; checks.push({ name: "Preconnect hints", passed: true, score: 1, maxScore: 1, detail: `${preconnect} hints` }); }
  else { checks.push({ name: "Preconnect hints", passed: false, score: 0, maxScore: 1, detail: "None" }); }

  return { name: "Machine Accessibility", score: Math.min(score, maxScore), maxScore, status: categoryStatus(score, maxScore), findings, recommendations, checks };
}

/* ─── Category: Agent Commerce Readiness (15pts) ─── */
function checkAgentCommerce($: cheerio.CheerioAPI): ScanCategory {
  const findings: string[] = [];
  const recommendations: string[] = [];
  const checks: SubCheck[] = [];
  let score = 0;
  const maxScore = 15;

  // Cart/purchase actions (4pts)
  const cartButtons = $('[class*="add-to-cart"], [id*="add-to-cart"], [data-action="add-to-cart"], form[action*="cart"], button[name="add"], input[name="add"], [class*="buy-now"], [data-action="buy"]');
  if (cartButtons.length > 0) {
    score += 4;
    findings.push("Add-to-cart functionality detected");
    checks.push({ name: "Purchase actions", passed: true, score: 4, maxScore: 4, detail: `${cartButtons.length} cart elements found` });
  } else {
    checks.push({ name: "Purchase actions", passed: false, score: 0, maxScore: 4, detail: "Not found in HTML" });
    recommendations.push("Your add-to-cart button is not detectable in the HTML. If it's rendered by JavaScript, AI agents may not be able to complete purchases. Use a standard <form> or <button> element.");
  }

  // Shipping/returns policies (3pts)
  const policyLinks = $('a[href*="policy"], a[href*="shipping"], a[href*="returns"], a[href*="refund"], a[href*="delivery"], a[href*="guarantee"]');
  if (policyLinks.length >= 2) {
    score += 3;
    findings.push("Shipping and returns policies linked");
    checks.push({ name: "Policy links", passed: true, score: 3, maxScore: 3, detail: `${policyLinks.length} policy links found` });
  } else if (policyLinks.length === 1) {
    score += 1;
    checks.push({ name: "Policy links", passed: false, score: 1, maxScore: 3, detail: "Only 1 policy link" });
    recommendations.push("Link to both your shipping and returns policies from product pages. AI agents check these before recommending a store to customers.");
  } else {
    checks.push({ name: "Policy links", passed: false, score: 0, maxScore: 3, detail: "No policy links found" });
    recommendations.push("Add links to your shipping and returns policies on product pages. AI agents check these before recommending purchases to customers.");
  }

  // Reviews/ratings (3pts)
  const reviews = $('[itemprop="aggregateRating"], [itemprop="review"], [itemprop="ratingValue"], [class*="review"], [class*="rating"], [data-reviews]');
  if (reviews.length > 0) {
    score += 3;
    findings.push("Reviews/ratings section detected");
    checks.push({ name: "Reviews and ratings", passed: true, score: 3, maxScore: 3, detail: "Present" });
  } else {
    checks.push({ name: "Reviews and ratings", passed: false, score: 0, maxScore: 3, detail: "Not found" });
    recommendations.push("Add customer reviews and ratings to your product pages, ideally with structured data (aggregateRating). AI agents heavily favor products with social proof.");
  }

  // Social/contact signals (3pts)
  const socialLinks = $('a[href*="instagram.com"], a[href*="facebook.com"], a[href*="twitter.com"], a[href*="x.com"], a[href*="tiktok.com"], a[href*="youtube.com"], a[href*="linkedin.com"], a[href*="pinterest.com"]');
  const contactLinks = $('a[href*="contact"], a[href*="support"], a[href*="help"], a[href*="mailto:"], a[href^="tel:"]');
  let socialScore = 0;
  if (socialLinks.length >= 2) { socialScore += 2; findings.push(`${socialLinks.length} social media links found`); }
  else if (socialLinks.length === 1) { socialScore += 1; }
  if (contactLinks.length > 0) { socialScore += 1; findings.push("Contact/support link found"); }
  score += socialScore;
  checks.push({ name: "Social and contact", passed: socialScore >= 2, score: socialScore, maxScore: 3, detail: `social: ${socialLinks.length}, contact: ${contactLinks.length}` });
  if (socialLinks.length < 2) recommendations.push("Add links to your social media profiles. AI agents use social presence as a trust signal when recommending stores.");

  // Trust signals (2pts)
  const trustSignals = $('[class*="trust"], [class*="secure"], [class*="guarantee"], [class*="badge"], [alt*="secure"], [alt*="trust"], [alt*="verified"]');
  if (trustSignals.length > 0) {
    score += 2;
    findings.push("Trust/security badges detected");
    checks.push({ name: "Trust signals", passed: true, score: 2, maxScore: 2, detail: `${trustSignals.length} trust elements` });
  } else {
    checks.push({ name: "Trust signals", passed: false, score: 0, maxScore: 2, detail: "None found" });
  }

  // NEW: Variant selector (1pt)
  const hasVariants = $('select[name*="variant"], select[name*="option"], [class*="variant"], [class*="swatch"], [data-option]').length > 0;
  if (hasVariants) { score += 1; findings.push("Product variant selector found"); checks.push({ name: "Variant selector", passed: true, score: 1, maxScore: 1, detail: "Present" }); }
  else { checks.push({ name: "Variant selector", passed: false, score: 0, maxScore: 1, detail: "Not found" }); }

  // NEW: Quantity input (1pt)
  const hasQuantity = $('input[name*="quantity"], input[name*="qty"], [class*="quantity"]').length > 0;
  if (hasQuantity) { score += 1; checks.push({ name: "Quantity input", passed: true, score: 1, maxScore: 1, detail: "Present" }); }
  else { checks.push({ name: "Quantity input", passed: false, score: 0, maxScore: 1, detail: "Not found" }); }

  // NEW: Search functionality (1pt)
  const hasSearch = $('form[action*="search"], input[name*="search"], input[name="q"], [class*="search-form"], [role="search"]').length > 0;
  if (hasSearch) { score += 1; findings.push("Site search available"); checks.push({ name: "Search functionality", passed: true, score: 1, maxScore: 1, detail: "Present" }); }
  else { checks.push({ name: "Search functionality", passed: false, score: 0, maxScore: 1, detail: "Not found" }); }

  // NEW: Payment icons visible (1pt)
  const hasPaymentIcons = $('[class*="payment"], [alt*="visa"], [alt*="mastercard"], [alt*="paypal"], [alt*="apple-pay"], img[src*="payment"]').length > 0;
  if (hasPaymentIcons) { score += 1; checks.push({ name: "Payment icons", passed: true, score: 1, maxScore: 1, detail: "Visible" }); }
  else { checks.push({ name: "Payment icons", passed: false, score: 0, maxScore: 1, detail: "Not visible" }); }

  // NEW: Live chat/support widget (1pt)
  const hasChat = $('[class*="chat"], [id*="chat"], [class*="intercom"], [class*="zendesk"], [class*="tawk"], [class*="crisp"], [class*="drift"]').length > 0;
  if (hasChat) { score += 1; findings.push("Live chat widget detected"); checks.push({ name: "Live chat", passed: true, score: 1, maxScore: 1, detail: "Present" }); }
  else { checks.push({ name: "Live chat", passed: false, score: 0, maxScore: 1, detail: "Not found" }); }

  // NEW: Cross-sell/related products (1pt)
  const hasCrossSell = $('[class*="related"], [class*="recommended"], [class*="also-like"], [class*="cross-sell"], [class*="upsell"]').length > 0;
  if (hasCrossSell) { score += 1; checks.push({ name: "Related products", passed: true, score: 1, maxScore: 1, detail: "Section found" }); }
  else { checks.push({ name: "Related products", passed: false, score: 0, maxScore: 1, detail: "Not found" }); }

  // NEW: Share buttons (1pt)
  const hasShare = $('[class*="share"], [data-share], a[href*="facebook.com/sharer"], a[href*="twitter.com/intent"], a[href*="pinterest.com/pin"]').length > 0;
  if (hasShare) { score += 1; checks.push({ name: "Share buttons", passed: true, score: 1, maxScore: 1, detail: "Present" }); }
  else { checks.push({ name: "Share buttons", passed: false, score: 0, maxScore: 1, detail: "Not found" }); }

  // NEW: Wishlist/save (1pt)
  const hasWishlist = $('[class*="wishlist"], [class*="save-for-later"], [class*="favorite"], [data-wishlist]').length > 0;
  if (hasWishlist) { score += 1; checks.push({ name: "Wishlist/save", passed: true, score: 1, maxScore: 1, detail: "Present" }); }
  else { checks.push({ name: "Wishlist/save", passed: false, score: 0, maxScore: 1, detail: "Not found" }); }

  // NEW: Email signup/newsletter (1pt)
  const hasNewsletter = $('[class*="newsletter"], [class*="subscribe"], input[name*="email"][type="email"]').length > 0;
  if (hasNewsletter) { score += 1; checks.push({ name: "Newsletter signup", passed: true, score: 1, maxScore: 1, detail: "Present" }); }
  else { checks.push({ name: "Newsletter signup", passed: false, score: 0, maxScore: 1, detail: "Not found" }); }

  // NEW: Product specs/details section (1pt)
  const hasSpecs = $('[class*="specification"], [class*="details"], [class*="features"], [class*="description"], [class*="product-info"]').length > 0;
  if (hasSpecs) { score += 1; checks.push({ name: "Product details", passed: true, score: 1, maxScore: 1, detail: "Section found" }); }
  else { checks.push({ name: "Product details", passed: false, score: 0, maxScore: 1, detail: "Not found" }); }

  return { name: "Agent Commerce Readiness", score: Math.min(score, maxScore), maxScore, status: categoryStatus(score, maxScore), findings, recommendations, checks };
}

/* ─── Category: Performance & Parsability (15pts) ─── */
function checkPerformance(html: string, $: cheerio.CheerioAPI, responseTimeMs: number): ScanCategory {
  const findings: string[] = [];
  const recommendations: string[] = [];
  const checks: SubCheck[] = [];
  let score = 0;
  const maxScore = 15;

  // Response time (3pts)
  if (responseTimeMs < 1000) {
    score += 3;
    findings.push(`Response time: ${responseTimeMs}ms (fast)`);
    checks.push({ name: "Response time", passed: true, score: 3, maxScore: 3, detail: `${responseTimeMs}ms` });
  } else if (responseTimeMs < 3000) {
    score += 2;
    findings.push(`Response time: ${responseTimeMs}ms (moderate)`);
    checks.push({ name: "Response time", passed: false, score: 2, maxScore: 3, detail: `${responseTimeMs}ms (aim for <1s)` });
  } else {
    score += 1;
    findings.push(`Response time: ${responseTimeMs}ms (slow)`);
    checks.push({ name: "Response time", passed: false, score: 1, maxScore: 3, detail: `${responseTimeMs}ms (slow)` });
    recommendations.push(`Your page took ${(responseTimeMs / 1000).toFixed(1)}s to load. AI agents have timeouts and may skip slow pages. Aim for under 1 second.`);
  }

  // Page size (3pts)
  const sizeKB = new TextEncoder().encode(html).byteLength / 1024;
  if (sizeKB < 300) {
    score += 3;
    findings.push(`Page size: ${Math.round(sizeKB)}KB`);
    checks.push({ name: "Page size", passed: true, score: 3, maxScore: 3, detail: `${Math.round(sizeKB)}KB` });
  } else if (sizeKB < 700) {
    score += 2;
    findings.push(`Page size: ${Math.round(sizeKB)}KB (moderate)`);
    checks.push({ name: "Page size", passed: false, score: 2, maxScore: 3, detail: `${Math.round(sizeKB)}KB (aim for <300KB)` });
  } else {
    findings.push(`Page size: ${Math.round(sizeKB)}KB (heavy)`);
    checks.push({ name: "Page size", passed: false, score: 0, maxScore: 3, detail: `${Math.round(sizeKB)}KB (too large)` });
    recommendations.push(`Your page is ${Math.round(sizeKB)}KB. Large pages are slower for AI agents to parse. Consider reducing inline styles, removing unused HTML, and lazy-loading non-critical content.`);
  }

  // External scripts (3pts)
  const scripts = $("script[src]");
  if (scripts.length < 10) {
    score += 3;
    findings.push(`${scripts.length} external scripts`);
    checks.push({ name: "External scripts", passed: true, score: 3, maxScore: 3, detail: `${scripts.length} scripts` });
  } else if (scripts.length < 20) {
    score += 2;
    findings.push(`${scripts.length} external scripts (moderate)`);
    checks.push({ name: "External scripts", passed: false, score: 2, maxScore: 3, detail: `${scripts.length} scripts (aim for <10)` });
  } else {
    findings.push(`${scripts.length} external scripts (heavy)`);
    checks.push({ name: "External scripts", passed: false, score: 0, maxScore: 3, detail: `${scripts.length} scripts (excessive)` });
    recommendations.push(`Your page loads ${scripts.length} external scripts. This slows down page parsing and may cause issues with AI agents that have limited JavaScript support. Defer non-essential scripts.`);
  }

  // Lazy loading (2pts)
  const lazyImages = $('img[loading="lazy"]');
  if (lazyImages.length > 0) {
    score += 2;
    findings.push("Lazy loading implemented");
    checks.push({ name: "Lazy loading", passed: true, score: 2, maxScore: 2, detail: `${lazyImages.length} lazy images` });
  } else {
    checks.push({ name: "Lazy loading", passed: false, score: 0, maxScore: 2, detail: "Not implemented" });
  }

  // Server-rendered content (4pts)
  const textContent = $("body").text().replace(/\s+/g, " ").trim();
  const inlineScripts = $("script:not([src])");
  const totalJSBlocks = scripts.length + inlineScripts.length;
  if (textContent.length > 500 && totalJSBlocks < 20) {
    score += 4;
    findings.push("Good server-rendered content");
    checks.push({ name: "Server-rendered content", passed: true, score: 4, maxScore: 4, detail: `${textContent.length} chars of text content` });
  } else if (textContent.length > 200) {
    score += 2;
    checks.push({ name: "Server-rendered content", passed: false, score: 2, maxScore: 4, detail: "Moderate content, heavy JS" });
  } else {
    checks.push({ name: "Server-rendered content", passed: false, score: 0, maxScore: 4, detail: "Very little server-rendered content" });
    recommendations.push("Most of your page content appears to be loaded by JavaScript. AI agents that don't execute JavaScript will see a nearly empty page. Implement server-side rendering (SSR) for product content.");
  }

  // NEW: CSS file count (1pt)
  const cssFiles = $('link[rel="stylesheet"]').length;
  if (cssFiles < 5) { score += 1; checks.push({ name: "CSS files", passed: true, score: 1, maxScore: 1, detail: `${cssFiles} files` }); }
  else { checks.push({ name: "CSS files", passed: false, score: 0, maxScore: 1, detail: `${cssFiles} files (aim for <5)` }); }

  // NEW: Font files (1pt)
  const fontFiles = $('link[href*=".woff"], link[href*="fonts.googleapis"], link[href*="fonts.gstatic"]').length;
  if (fontFiles <= 3) { score += 1; checks.push({ name: "Font files", passed: true, score: 1, maxScore: 1, detail: `${fontFiles} fonts` }); }
  else { checks.push({ name: "Font files", passed: false, score: 0, maxScore: 1, detail: `${fontFiles} fonts (aim for <=3)` }); }

  // NEW: Third-party script domains (1pt)
  const scriptDomains = new Set<string>();
  $("script[src]").each((_, el) => { const src = $(el).attr("src") || ""; if (src.startsWith("http")) { try { scriptDomains.add(new URL(src).hostname); } catch {} } });
  if (scriptDomains.size < 8) { score += 1; checks.push({ name: "Third-party domains", passed: true, score: 1, maxScore: 1, detail: `${scriptDomains.size} domains` }); }
  else { checks.push({ name: "Third-party domains", passed: false, score: 0, maxScore: 1, detail: `${scriptDomains.size} domains (too many)` }); }

  // NEW: Inline style count (1pt)
  const inlineStyles = $("[style]").length;
  if (inlineStyles < 20) { score += 1; checks.push({ name: "Inline styles", passed: true, score: 1, maxScore: 1, detail: `${inlineStyles} elements` }); }
  else { checks.push({ name: "Inline styles", passed: false, score: 0, maxScore: 1, detail: `${inlineStyles} elements (excessive)` }); }

  // NEW: DOM element count (1pt)
  const domElements = $("*").length;
  if (domElements < 2000) { score += 1; findings.push(`DOM: ${domElements} elements`); checks.push({ name: "DOM size", passed: true, score: 1, maxScore: 1, detail: `${domElements} elements` }); }
  else { checks.push({ name: "DOM size", passed: false, score: 0, maxScore: 1, detail: `${domElements} elements (heavy)` }); }

  // NEW: Image optimization (1pt)
  const webpImages = $('img[src*=".webp"], source[srcset*=".webp"]').length;
  if (webpImages > 0) { score += 1; checks.push({ name: "WebP images", passed: true, score: 1, maxScore: 1, detail: `${webpImages} WebP` }); }
  else { checks.push({ name: "WebP images", passed: false, score: 0, maxScore: 1, detail: "No WebP" }); }

  // NEW: Defer/async scripts (1pt)
  const deferAsync = $("script[defer], script[async]").length;
  const totalScriptsAll = $("script[src]").length;
  if (totalScriptsAll === 0 || deferAsync >= totalScriptsAll * 0.5) { score += 1; checks.push({ name: "Deferred scripts", passed: true, score: 1, maxScore: 1, detail: `${deferAsync}/${totalScriptsAll} deferred` }); }
  else { checks.push({ name: "Deferred scripts", passed: false, score: 0, maxScore: 1, detail: `${deferAsync}/${totalScriptsAll} deferred` }); }

  // NEW: Preload critical resources (1pt)
  const preloads = $('link[rel="preload"]').length;
  if (preloads > 0) { score += 1; checks.push({ name: "Preload hints", passed: true, score: 1, maxScore: 1, detail: `${preloads} preloaded` }); }
  else { checks.push({ name: "Preload hints", passed: false, score: 0, maxScore: 1, detail: "None" }); }

  // NEW: No document.write (1pt)
  const hasDocWrite = html.includes("document.write");
  if (!hasDocWrite) { score += 1; checks.push({ name: "No document.write", passed: true, score: 1, maxScore: 1, detail: "Clean" }); }
  else { checks.push({ name: "No document.write", passed: false, score: 0, maxScore: 1, detail: "Found (blocks rendering)" }); }

  return { name: "Performance & Parsability", score: Math.min(score, maxScore), maxScore, status: categoryStatus(score, maxScore), findings, recommendations, checks };
}

/* ─── Estimate fix time ─── */
function estimateFixTime(categories: ScanCategory[]): string {
  const totalRecs = categories.reduce((s, c) => s + c.recommendations.length, 0);
  if (totalRecs === 0) return "No fixes needed";
  if (totalRecs <= 3) return "About 30 minutes";
  if (totalRecs <= 7) return "About 1-2 hours";
  if (totalRecs <= 12) return "About 2-4 hours";
  return "About 4-8 hours";
}

/* ─── Main Scanner ─── */
export async function scanStore(rawUrl: string): Promise<ScanResult> {
  const startTime = Date.now();
  const normalizedUrl = validateAndNormalizeUrl(rawUrl);
  const warnings: string[] = [];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const [{ html, headers, responseTimeMs }, hasSitemap, hasRobotsTxt] = await Promise.all([
      safeFetch(normalizedUrl, controller.signal),
      checkResourceExists(normalizedUrl, "/sitemap.xml", controller.signal),
      checkResourceExists(normalizedUrl, "/robots.txt", controller.signal),
    ]);

    const $ = cheerio.load(html);

    const ctx = { html, $, url: normalizedUrl, headers, responseTimeMs, signal: controller.signal };

    // Run all 12 categories (existing 5 + 7 new modules)
    const [ucpResult, aiDiscoveryResult] = await Promise.all([
      checkUCPProtocol(ctx).catch(() => ({ name: "UCP Protocol", score: 0, maxScore: 25, status: "fail" as const, findings: [], recommendations: ["UCP check failed"], checks: [] })),
      checkAIDiscoverability(ctx).catch(() => ({ name: "AI Discoverability", score: 0, maxScore: 20, status: "fail" as const, findings: [], recommendations: ["AI discovery check failed"], checks: [] })),
    ]);

    const categories = [
      checkStructuredData(html, $),
      checkProductData($, normalizedUrl),
      checkMachineAccessibility($, headers, hasSitemap, hasRobotsTxt, normalizedUrl),
      checkAgentCommerce($),
      checkPerformance(html, $, responseTimeMs),
      ucpResult,
      checkOpenAIFeedReadiness(ctx),
      checkACPProtocol(ctx),
      aiDiscoveryResult,
      checkSecurityTrust(ctx),
      checkShippingReturns(ctx),
      checkIdentifiersTaxonomy(ctx),
    ];

    const totalScore = categories.reduce((sum, c) => sum + c.score, 0);
    const totalMax = categories.reduce((sum, c) => sum + c.maxScore, 0);
    const overallScore = Math.round((totalScore / totalMax) * 100);

    // Find top issue
    let topIssue: string | null = null;
    let maxImpact = 0;
    for (const cat of categories) {
      for (const check of cat.checks) {
        const gap = check.maxScore - check.score;
        if (gap > maxImpact) { maxImpact = gap; topIssue = cat.recommendations[0] || null; }
      }
    }

    return {
      url: normalizedUrl,
      overallScore,
      grade: gradeFromScore(overallScore),
      categories,
      scannedAt: new Date().toISOString(),
      scanDurationMs: Date.now() - startTime,
      topIssue,
      estimatedFixTime: estimateFixTime(categories),
      responseTimeMs,
      isHttps: normalizedUrl.startsWith("https://"),
      warnings,
    };
  } finally {
    clearTimeout(timeout);
  }
}
