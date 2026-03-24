import * as cheerio from "cheerio";
import { scanStore, type ScanResult, type ScanCategory } from "./scanner";
import { validateAndNormalizeUrl } from "./validate-url";

export interface PageResult {
  url: string;
  type: "homepage" | "product" | "collection" | "other";
  result: ScanResult;
}

export interface DeepScanResult {
  rootUrl: string;
  platform: Platform;
  overallScore: number;
  grade: string;
  pages: PageResult[];
  aggregatedCategories: ScanCategory[];
  actionPlan: ActionItem[];
  scannedAt: string;
  scanDurationMs: number;
  totalPages: number;
}

export interface ActionItem {
  fix: string;
  category: string;
  impact: "high" | "medium" | "low";
  estimatedPoints: number;
  code?: string;
  platform?: string;
}

export type Platform =
  | "shopify"
  | "woocommerce"
  | "bigcommerce"
  | "magento"
  | "squarespace"
  | "wix"
  | "custom"
  | "unknown";

const MAX_PAGES = 12;
const CRAWL_TIMEOUT = 8000;

/* ── Platform Detection ── */
export function detectPlatform(html: string): Platform {
  const lower = html.toLowerCase();
  if (lower.includes("shopify") || lower.includes("cdn.shopify.com") || lower.includes("myshopify.com"))
    return "shopify";
  if (lower.includes("woocommerce") || lower.includes("wc-") || lower.includes("wp-content/plugins/woocommerce"))
    return "woocommerce";
  if (lower.includes("bigcommerce") || lower.includes("cdn11.bigcommerce.com"))
    return "bigcommerce";
  if (lower.includes("magento") || lower.includes("mage-") || lower.includes("/static/version"))
    return "magento";
  if (lower.includes("squarespace") || lower.includes("static1.squarespace.com"))
    return "squarespace";
  if (lower.includes("wix.com") || lower.includes("wixsite") || lower.includes("parastorage.com"))
    return "wix";
  if (lower.includes("<meta name=\"generator\""))
    return "custom";
  return "unknown";
}

/* ── Link Discovery ── */
function discoverLinks(html: string, baseUrl: string): { products: string[]; collections: string[]; other: string[] } {
  const $ = cheerio.load(html);
  const base = new URL(baseUrl);
  const products: Set<string> = new Set();
  const collections: Set<string> = new Set();
  const other: Set<string> = new Set();

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;

    try {
      const resolved = new URL(href, baseUrl);
      if (resolved.hostname !== base.hostname) return;

      const path = resolved.pathname.toLowerCase();
      const clean = resolved.origin + resolved.pathname;

      // Skip assets, anchors, query strings
      if (path.match(/\.(jpg|jpeg|png|gif|svg|css|js|ico|pdf|zip|webp)$/)) return;
      if (path === "/" || path === base.pathname) return;

      if (
        path.includes("/product") ||
        path.includes("/item") ||
        path.includes("/dp/") ||
        path.match(/\/p\/[^/]+$/)
      ) {
        products.add(clean);
      } else if (
        path.includes("/collection") ||
        path.includes("/category") ||
        path.includes("/shop") ||
        path.includes("/catalog")
      ) {
        collections.add(clean);
      } else {
        other.add(clean);
      }
    } catch {
      // invalid URL
    }
  });

  return {
    products: [...products],
    collections: [...collections],
    other: [...other],
  };
}

/* ── Page Type Detection ── */
function classifyUrl(url: string): "product" | "collection" | "other" {
  const path = new URL(url).pathname.toLowerCase();
  if (path.includes("/product") || path.includes("/item") || path.includes("/dp/") || path.match(/\/p\/[^/]+$/))
    return "product";
  if (path.includes("/collection") || path.includes("/category") || path.includes("/shop") || path.includes("/catalog"))
    return "collection";
  return "other";
}

/* ── Aggregate Categories ── */
function aggregateCategories(pages: PageResult[]): ScanCategory[] {
  const catMap = new Map<string, { totalScore: number; totalMax: number; findings: string[]; recommendations: Set<string> }>();

  for (const page of pages) {
    for (const cat of page.result.categories) {
      const existing = catMap.get(cat.name);
      if (existing) {
        existing.totalScore += cat.score;
        existing.totalMax += cat.maxScore;
        for (const f of cat.findings) existing.findings.push(f);
        for (const r of cat.recommendations) existing.recommendations.add(r);
      } else {
        catMap.set(cat.name, {
          totalScore: cat.score,
          totalMax: cat.maxScore,
          findings: [...cat.findings],
          recommendations: new Set(cat.recommendations),
        });
      }
    }
  }

  const count = pages.length;
  return [...catMap.entries()].map(([name, data]) => {
    const avgScore = Math.round(data.totalScore / count);
    const avgMax = Math.round(data.totalMax / count);
    const pct = avgMax > 0 ? avgScore / avgMax : 0;
    return {
      name,
      score: avgScore,
      maxScore: avgMax,
      status: (pct >= 0.7 ? "pass" : pct >= 0.4 ? "warn" : "fail") as "pass" | "warn" | "fail",
      findings: [...new Set(data.findings)].slice(0, 15),
      recommendations: [...data.recommendations],
    };
  });
}

/* ── Impact Estimation ── */
const IMPACT_MAP: Record<string, { impact: "high" | "medium" | "low"; points: number }> = {
  "JSON-LD": { impact: "high", points: 15 },
  "Product structured data": { impact: "high", points: 12 },
  "og:price": { impact: "high", points: 8 },
  "sitemap": { impact: "high", points: 8 },
  "meta description": { impact: "medium", points: 5 },
  "alt text": { impact: "medium", points: 5 },
  "availability": { impact: "medium", points: 5 },
  "canonical": { impact: "medium", points: 4 },
  "robots": { impact: "low", points: 3 },
  "review": { impact: "medium", points: 5 },
  "Organization schema": { impact: "low", points: 3 },
  "BreadcrumbList": { impact: "low", points: 2 },
  "RSS": { impact: "low", points: 2 },
  "policy": { impact: "low", points: 3 },
  "semantic HTML": { impact: "low", points: 2 },
  "Open Graph": { impact: "medium", points: 4 },
  "lang": { impact: "low", points: 2 },
};

function estimateImpact(rec: string): { impact: "high" | "medium" | "low"; points: number } {
  for (const [keyword, info] of Object.entries(IMPACT_MAP)) {
    if (rec.toLowerCase().includes(keyword.toLowerCase())) return info;
  }
  return { impact: "medium", points: 3 };
}

/* ── Fix Code Generation ── */
function generateFixCode(rec: string, platform: Platform, url: string): string | undefined {
  const storeName = new URL(url).hostname.replace("www.", "").split(".")[0];
  const r = rec.toLowerCase();

  if (r.includes("json-ld") && r.includes("product")) {
    if (platform === "shopify") {
      return `{% comment %} Add to product.liquid or main-product.liquid {% endcomment %}
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "{{ product.title | escape }}",
  "description": "{{ product.description | strip_html | escape }}",
  "image": "{{ product.featured_image | image_url: width: 1200 }}",
  "sku": "{{ product.selected_or_first_available_variant.sku }}",
  "brand": { "@type": "Brand", "name": "{{ product.vendor | escape }}" },
  "offers": {
    "@type": "Offer",
    "url": "{{ shop.url }}{{ product.url }}",
    "priceCurrency": "{{ shop.currency }}",
    "price": "{{ product.selected_or_first_available_variant.price | money_without_currency }}",
    "availability": "{% if product.available %}https://schema.org/InStock{% else %}https://schema.org/OutOfStock{% endif %}",
    "seller": { "@type": "Organization", "name": "{{ shop.name | escape }}" }
  }
}
</script>`;
    }
    if (platform === "woocommerce") {
      return `<!-- Add to your theme's single-product.php or via functions.php -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "<?php echo esc_attr(get_the_title()); ?>",
  "description": "<?php echo esc_attr(wp_strip_all_tags(get_the_excerpt())); ?>",
  "image": "<?php echo esc_url(get_the_post_thumbnail_url(null, 'large')); ?>",
  "sku": "<?php echo esc_attr($product->get_sku()); ?>",
  "offers": {
    "@type": "Offer",
    "url": "<?php echo esc_url(get_permalink()); ?>",
    "priceCurrency": "<?php echo get_woocommerce_currency(); ?>",
    "price": "<?php echo $product->get_price(); ?>",
    "availability": "<?php echo $product->is_in_stock() ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock'; ?>"
  }
}
</script>`;
    }
    return `<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "Your Product Name",
  "description": "Product description here",
  "image": "https://${storeName}.com/images/product.jpg",
  "sku": "SKU-001",
  "brand": { "@type": "Brand", "name": "${storeName}" },
  "offers": {
    "@type": "Offer",
    "url": "${url}",
    "priceCurrency": "USD",
    "price": "29.99",
    "availability": "https://schema.org/InStock"
  }
}
</script>`;
  }

  if (r.includes("organization schema")) {
    return `<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "${storeName}",
  "url": "${new URL(url).origin}",
  "logo": "${new URL(url).origin}/logo.png",
  "contactPoint": {
    "@type": "ContactPoint",
    "contactType": "customer service",
    "email": "support@${new URL(url).hostname}"
  },
  "sameAs": []
}
</script>`;
  }

  if (r.includes("og:price") || r.includes("machine-readable pric")) {
    if (platform === "shopify") {
      return `{% comment %} Add to theme.liquid <head> or product template {% endcomment %}
<meta property="og:price:amount" content="{{ product.selected_or_first_available_variant.price | money_without_currency }}" />
<meta property="og:price:currency" content="{{ shop.currency }}" />
<meta property="product:availability" content="{% if product.available %}instock{% else %}oos{% endif %}" />`;
    }
    return `<meta property="og:price:amount" content="29.99" />
<meta property="og:price:currency" content="USD" />
<meta property="product:availability" content="instock" />`;
  }

  if (r.includes("meta description")) {
    if (platform === "shopify") {
      return `{% comment %} Add to theme.liquid <head> {% endcomment %}
{% if template contains 'product' %}
  <meta name="description" content="{{ product.description | strip_html | truncate: 155 }}" />
{% elsif template contains 'collection' %}
  <meta name="description" content="{{ collection.description | strip_html | truncate: 155 }}" />
{% endif %}`;
    }
    return `<meta name="description" content="Your page description here. Keep it between 120-160 characters for best results." />`;
  }

  if (r.includes("open graph")) {
    return `<meta property="og:type" content="product" />
<meta property="og:title" content="Product Name" />
<meta property="og:description" content="Product description" />
<meta property="og:image" content="https://${new URL(url).hostname}/images/product.jpg" />
<meta property="og:url" content="${url}" />
<meta property="og:site_name" content="${storeName}" />`;
  }

  if (r.includes("breadcrumblist")) {
    return `<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "Home", "item": "${new URL(url).origin}" },
    { "@type": "ListItem", "position": 2, "name": "Products", "item": "${new URL(url).origin}/products" },
    { "@type": "ListItem", "position": 3, "name": "Product Name" }
  ]
}
</script>`;
  }

  if (r.includes("review") || r.includes("rating")) {
    return `<!-- Add inside your Product JSON-LD block -->
"aggregateRating": {
  "@type": "AggregateRating",
  "ratingValue": "4.5",
  "reviewCount": "127"
},
"review": [{
  "@type": "Review",
  "reviewRating": { "@type": "Rating", "ratingValue": "5" },
  "author": { "@type": "Person", "name": "Customer Name" },
  "reviewBody": "Great product, exactly as described."
}]`;
  }

  return undefined;
}

/* ── Build Action Plan ── */
function buildActionPlan(categories: ScanCategory[], platform: Platform, url: string): ActionItem[] {
  const items: ActionItem[] = [];

  for (const cat of categories) {
    for (const rec of cat.recommendations) {
      const { impact, points } = estimateImpact(rec);
      const code = generateFixCode(rec, platform, url);
      items.push({
        fix: rec,
        category: cat.name,
        impact,
        estimatedPoints: points,
        code,
        platform: platform !== "unknown" ? platform : undefined,
      });
    }
  }

  // Sort: high impact first, then by points desc
  const order = { high: 0, medium: 1, low: 2 };
  items.sort((a, b) => order[a.impact] - order[b.impact] || b.estimatedPoints - a.estimatedPoints);

  return items;
}

/* ── Fetch Homepage HTML for Platform Detection ── */
async function fetchHtml(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CRAWL_TIMEOUT);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; AgentReadyBot/1.0)", Accept: "text/html" },
      redirect: "follow",
    });
    if (!res.ok) return "";
    const text = await res.text();
    return text.slice(0, 500_000); // cap at 500KB for link discovery
  } catch {
    return "";
  } finally {
    clearTimeout(timeout);
  }
}

/* ── Deep Scan ── */
export async function deepScan(rawUrl: string): Promise<DeepScanResult> {
  const startTime = Date.now();
  const rootUrl = validateAndNormalizeUrl(rawUrl);

  // 1. Fetch homepage for link discovery and platform detection
  const homepageHtml = await fetchHtml(rootUrl);
  const platform = detectPlatform(homepageHtml);
  const links = discoverLinks(homepageHtml, rootUrl);

  // 2. Build scan list: homepage + product pages + collection pages (capped)
  const toScan: string[] = [rootUrl];
  const productPages = links.products.slice(0, 6);
  const collectionPages = links.collections.slice(0, 3);
  const otherPages = links.other.slice(0, 2);
  toScan.push(...productPages, ...collectionPages, ...otherPages);
  const uniqueUrls = [...new Set(toScan)].slice(0, MAX_PAGES);

  // 3. Scan all pages in parallel (batched)
  const pages: PageResult[] = [];
  const batchSize = 4;
  for (let i = 0; i < uniqueUrls.length; i += batchSize) {
    const batch = uniqueUrls.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      batch.map(async (pageUrl) => {
        const result = await scanStore(pageUrl);
        const type = pageUrl === rootUrl ? "homepage" as const : classifyUrl(pageUrl);
        return { url: pageUrl, type, result } as PageResult;
      })
    );
    for (const r of results) {
      if (r.status === "fulfilled") pages.push(r.value);
    }
  }

  if (pages.length === 0) {
    throw new Error("Could not scan any pages on this site.");
  }

  // 4. Aggregate
  const aggregatedCategories = aggregateCategories(pages);
  const totalScore = aggregatedCategories.reduce((s, c) => s + c.score, 0);
  const totalMax = aggregatedCategories.reduce((s, c) => s + c.maxScore, 0);
  const overallScore = totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : 0;

  // 5. Action plan with fix code
  const actionPlan = buildActionPlan(aggregatedCategories, platform, rootUrl);

  const gradeFromScore = (s: number) =>
    s >= 90 ? "A+" : s >= 80 ? "A" : s >= 70 ? "B" : s >= 60 ? "C" : s >= 50 ? "D" : "F";

  return {
    rootUrl,
    platform,
    overallScore,
    grade: gradeFromScore(overallScore),
    pages,
    aggregatedCategories,
    actionPlan,
    scannedAt: new Date().toISOString(),
    scanDurationMs: Date.now() - startTime,
    totalPages: pages.length,
  };
}
