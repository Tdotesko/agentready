import * as cheerio from "cheerio";
import { scanStore, safeFetch, type ScanResult, type ScanCategory } from "./scanner";
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
  topIssue: string | null;
  estimatedFixTime: string;
}

export interface ActionItem {
  fix: string;
  category: string;
  impact: "high" | "medium" | "low";
  estimatedPoints: number;
  code?: string;
  platform?: string;
}

export type Platform = "shopify" | "woocommerce" | "bigcommerce" | "magento" | "squarespace" | "wix" | "custom" | "unknown";

const MAX_PAGES = 12;
const CRAWL_TIMEOUT = 10000;

/* ─── Platform Detection ─── */
export function detectPlatform(html: string): Platform {
  const l = html.toLowerCase();
  if (l.includes("shopify") || l.includes("cdn.shopify.com") || l.includes("myshopify.com")) return "shopify";
  if (l.includes("woocommerce") || l.includes("wc-") || l.includes("wp-content/plugins/woocommerce")) return "woocommerce";
  if (l.includes("bigcommerce") || l.includes("cdn11.bigcommerce.com") || l.includes("bigcommerce.com/s-")) return "bigcommerce";
  if (l.includes("magento") || l.includes("mage-") || l.includes("/static/version")) return "magento";
  if (l.includes("squarespace") || l.includes("static1.squarespace.com")) return "squarespace";
  if (l.includes("wix.com") || l.includes("wixsite") || l.includes("parastorage.com")) return "wix";
  return "unknown";
}

/* ─── Link Discovery ─── */
function discoverLinks(html: string, baseUrl: string): { products: string[]; collections: string[]; other: string[] } {
  const $ = cheerio.load(html);
  const base = new URL(baseUrl);
  const products = new Set<string>();
  const collections = new Set<string>();
  const other = new Set<string>();

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    try {
      const resolved = new URL(href, baseUrl);
      if (resolved.hostname !== base.hostname && resolved.hostname !== `www.${base.hostname}` && `www.${resolved.hostname}` !== base.hostname) return;
      const path = resolved.pathname.toLowerCase();
      const clean = resolved.origin + resolved.pathname;
      if (path.match(/\.(jpg|jpeg|png|gif|svg|css|js|ico|pdf|zip|webp|woff|woff2|ttf)$/)) return;
      if (path === "/" || path === base.pathname) return;

      if (path.match(/\/(products?|items?|goods|detail|buy|merchandise|dp)\//i) || path.match(/\/p\/[^/]+$/)) {
        products.add(clean);
      } else if (path.match(/\/(collections?|categor|shop|catalog|store|browse|department)/i)) {
        collections.add(clean);
      } else {
        other.add(clean);
      }
    } catch { /* invalid URL */ }
  });

  return { products: [...products], collections: [...collections], other: [...other] };
}

/* ─── Sitemap Parser (fallback for link discovery) ─── */
async function discoverFromSitemap(baseUrl: string): Promise<string[]> {
  const urls: string[] = [];
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CRAWL_TIMEOUT);

  try {
    const sitemapUrl = new URL("/sitemap.xml", baseUrl).toString();
    const res = await fetch(sitemapUrl, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; AgentReadyBot/1.0)" },
      redirect: "follow",
    });
    if (!res.ok) return [];

    const xml = await res.text();

    // Check for sitemap index
    const indexMatches = xml.match(/<sitemap>[\s\S]*?<loc>(.*?)<\/loc>/gi);
    if (indexMatches && indexMatches.length > 0) {
      // Parse first child sitemap (usually products)
      for (const match of indexMatches.slice(0, 3)) {
        const locMatch = match.match(/<loc>(.*?)<\/loc>/i);
        if (!locMatch) continue;
        const childUrl = locMatch[1].trim();
        // Prefer product sitemaps
        if (childUrl.toLowerCase().includes("product") || urls.length === 0) {
          try {
            const childRes = await fetch(childUrl, {
              signal: controller.signal,
              headers: { "User-Agent": "Mozilla/5.0 (compatible; AgentReadyBot/1.0)" },
              redirect: "follow",
            });
            if (childRes.ok) {
              const childXml = await childRes.text();
              const childUrls = childXml.match(/<url>[\s\S]*?<loc>(.*?)<\/loc>/gi) || [];
              for (const u of childUrls.slice(0, 50)) {
                const loc = u.match(/<loc>(.*?)<\/loc>/i);
                if (loc) urls.push(loc[1].trim());
              }
            }
          } catch { /* skip */ }
          if (urls.length >= 20) break;
        }
      }
    }

    // Also parse direct URL entries
    const directUrls = xml.match(/<url>[\s\S]*?<loc>(.*?)<\/loc>/gi) || [];
    for (const u of directUrls.slice(0, 50)) {
      const loc = u.match(/<loc>(.*?)<\/loc>/i);
      if (loc) urls.push(loc[1].trim());
    }
  } catch { /* sitemap fetch failed */ }
  finally { clearTimeout(timeout); }

  return urls;
}

function classifyUrl(url: string): "product" | "collection" | "other" {
  const path = new URL(url).pathname.toLowerCase();
  if (path.match(/\/(products?|items?|goods|detail|buy|merchandise|dp)\//i) || path.match(/\/p\/[^/]+$/)) return "product";
  if (path.match(/\/(collections?|categor|shop|catalog|store|browse|department)/i)) return "collection";
  return "other";
}

/* ─── Aggregate Categories ─── */
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
        catMap.set(cat.name, { totalScore: cat.score, totalMax: cat.maxScore, findings: [...cat.findings], recommendations: new Set(cat.recommendations) });
      }
    }
  }

  const count = pages.length;
  return [...catMap.entries()].map(([name, data]) => {
    const avgScore = Math.round(data.totalScore / count);
    const avgMax = Math.round(data.totalMax / count);
    const pct = avgMax > 0 ? avgScore / avgMax : 0;
    return {
      name, score: avgScore, maxScore: avgMax,
      status: (pct >= 0.7 ? "pass" : pct >= 0.4 ? "warn" : "fail") as "pass" | "warn" | "fail",
      findings: [...new Set(data.findings)].slice(0, 20),
      recommendations: [...data.recommendations],
      checks: [],
    };
  });
}

/* ─── Impact Map ─── */
const IMPACT_MAP: Record<string, { impact: "high" | "medium" | "low"; points: number }> = {
  "json-ld": { impact: "high", points: 12 },
  "product schema": { impact: "high", points: 12 },
  "product structured data": { impact: "high", points: 12 },
  "price": { impact: "high", points: 8 },
  "sitemap": { impact: "high", points: 8 },
  "availability": { impact: "high", points: 6 },
  "server-side rendering": { impact: "high", points: 8 },
  "https": { impact: "high", points: 6 },
  "meta description": { impact: "medium", points: 5 },
  "alt text": { impact: "medium", points: 5 },
  "canonical": { impact: "medium", points: 4 },
  "review": { impact: "medium", points: 5 },
  "rating": { impact: "medium", points: 5 },
  "open graph": { impact: "medium", points: 4 },
  "viewport": { impact: "medium", points: 3 },
  "h1": { impact: "medium", points: 3 },
  "title": { impact: "medium", points: 3 },
  "organization schema": { impact: "low", points: 3 },
  "breadcrumb": { impact: "low", points: 2 },
  "policy": { impact: "low", points: 3 },
  "semantic html": { impact: "low", points: 2 },
  "lang": { impact: "low", points: 2 },
  "social": { impact: "low", points: 2 },
  "robots.txt": { impact: "low", points: 1 },
  "lazy loading": { impact: "low", points: 2 },
  "script": { impact: "medium", points: 4 },
  "page size": { impact: "medium", points: 4 },
};

function estimateImpact(rec: string): { impact: "high" | "medium" | "low"; points: number } {
  const r = rec.toLowerCase();
  for (const [keyword, info] of Object.entries(IMPACT_MAP)) {
    if (r.includes(keyword)) return info;
  }
  return { impact: "medium", points: 3 };
}

/* ─── Fix Code Generation ─── */
function generateFixCode(rec: string, platform: Platform, url: string): string | undefined {
  const storeName = new URL(url).hostname.replace("www.", "").split(".")[0];
  const origin = new URL(url).origin;
  const r = rec.toLowerCase();

  // JSON-LD Product
  if ((r.includes("json-ld") || r.includes("product structured data") || r.includes("product schema")) && (r.includes("product") || r.includes("structured data"))) {
    if (platform === "shopify") {
      return `{# File: sections/main-product.liquid or snippets/product-schema.liquid #}
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "{{ product.title | escape }}",
  "description": "{{ product.description | strip_html | truncate: 500 | escape }}",
  "image": ["{{ product.featured_image | image_url: width: 1200 }}"],
  "sku": "{{ product.selected_or_first_available_variant.sku }}",
  "brand": { "@type": "Brand", "name": "{{ product.vendor | escape }}" },
  "offers": {
    "@type": "Offer",
    "url": "{{ shop.url }}{{ product.url }}",
    "priceCurrency": "{{ shop.currency }}",
    "price": "{{ product.selected_or_first_available_variant.price | money_without_currency | remove: ',' }}",
    "availability": "{% if product.available %}https://schema.org/InStock{% else %}https://schema.org/OutOfStock{% endif %}",
    "seller": { "@type": "Organization", "name": "{{ shop.name | escape }}" }
  }
}
</script>`;
    }
    if (platform === "woocommerce") {
      return `<?php // Add to functions.php or a custom plugin
add_action('wp_head', function() {
  if (!is_product()) return;
  global $product;
  $schema = [
    '@context' => 'https://schema.org',
    '@type' => 'Product',
    'name' => get_the_title(),
    'description' => wp_strip_all_tags(get_the_excerpt()),
    'image' => [get_the_post_thumbnail_url(null, 'large')],
    'sku' => $product->get_sku(),
    'offers' => [
      '@type' => 'Offer',
      'url' => get_permalink(),
      'priceCurrency' => get_woocommerce_currency(),
      'price' => $product->get_price(),
      'availability' => $product->is_in_stock()
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
    ],
  ];
  echo '<script type="application/ld+json">' . wp_json_encode($schema) . '</script>';
}); ?>`;
    }
    return `<!-- Add to your product page <head> or before </body> -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "Product Name",
  "description": "Your product description",
  "image": ["${origin}/images/product.jpg"],
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

  // Organization schema
  if (r.includes("organization schema") || r.includes("store name, logo")) {
    return `<!-- Add to your homepage <head> -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "${storeName}",
  "url": "${origin}",
  "logo": "${origin}/logo.png",
  "contactPoint": {
    "@type": "ContactPoint",
    "contactType": "customer service",
    "email": "support@${new URL(url).hostname}"
  },
  "sameAs": [
    "https://instagram.com/${storeName}",
    "https://facebook.com/${storeName}"
  ]
}
</script>`;
  }

  // Price meta tags
  if (r.includes("og:price") || r.includes("price:amount") || r.includes("price meta")) {
    if (platform === "shopify") {
      return `{# File: layout/theme.liquid inside <head> #}
{% if template contains 'product' %}
<meta property="og:price:amount" content="{{ product.selected_or_first_available_variant.price | money_without_currency | remove: ',' }}" />
<meta property="og:price:currency" content="{{ shop.currency }}" />
{% endif %}`;
    }
    return `<!-- Add inside <head> on product pages -->
<meta property="og:price:amount" content="29.99" />
<meta property="og:price:currency" content="USD" />`;
  }

  // Meta description
  if (r.includes("meta description")) {
    if (platform === "shopify") {
      return `{# File: layout/theme.liquid inside <head> #}
{% if page_description %}
  <meta name="description" content="{{ page_description | escape }}" />
{% endif %}`;
    }
    return `<!-- Add inside <head> -->
<meta name="description" content="Your page description here. Aim for 120-160 characters that describe what this page offers." />`;
  }

  // Open Graph
  if (r.includes("open graph") || r.includes("og:title") || r.includes("og:description") || r.includes("og:image")) {
    if (platform === "shopify") {
      return `{# File: layout/theme.liquid inside <head> #}
<meta property="og:title" content="{{ page_title | escape }}" />
<meta property="og:description" content="{{ page_description | escape }}" />
<meta property="og:image" content="{% if template contains 'product' %}{{ product.featured_image | image_url: width: 1200 }}{% endif %}" />
<meta property="og:url" content="{{ canonical_url }}" />
<meta property="og:type" content="{% if template contains 'product' %}product{% else %}website{% endif %}" />`;
    }
    return `<!-- Add inside <head> -->
<meta property="og:title" content="Page Title" />
<meta property="og:description" content="Page description" />
<meta property="og:image" content="${origin}/images/share.jpg" />
<meta property="og:url" content="${url}" />
<meta property="og:type" content="product" />`;
  }

  // Breadcrumb
  if (r.includes("breadcrumb")) {
    return `<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "Home", "item": "${origin}" },
    { "@type": "ListItem", "position": 2, "name": "Products", "item": "${origin}/products" },
    { "@type": "ListItem", "position": 3, "name": "Product Name" }
  ]
}
</script>`;
  }

  // Reviews/ratings
  if (r.includes("review") || r.includes("rating") || r.includes("social proof")) {
    return `<!-- Add inside your Product JSON-LD block -->
"aggregateRating": {
  "@type": "AggregateRating",
  "ratingValue": "4.5",
  "bestRating": "5",
  "reviewCount": "127"
}`;
  }

  // Availability
  if (r.includes("availability") || r.includes("stock")) {
    if (platform === "shopify") {
      return `{# Add inside your Product JSON-LD offers block #}
"availability": "{% if product.available %}https://schema.org/InStock{% else %}https://schema.org/OutOfStock{% endif %}"`;
    }
    return `<!-- Inside offers in your Product JSON-LD -->
"availability": "https://schema.org/InStock"
<!-- Use https://schema.org/OutOfStock when item is unavailable -->`;
  }

  // Viewport
  if (r.includes("viewport")) {
    return `<!-- Add inside <head> -->
<meta name="viewport" content="width=device-width, initial-scale=1" />`;
  }

  // Canonical
  if (r.includes("canonical")) {
    if (platform === "shopify") {
      return `{# File: layout/theme.liquid inside <head> #}
<link rel="canonical" href="{{ canonical_url }}" />`;
    }
    return `<!-- Add inside <head> -->
<link rel="canonical" href="${url}" />`;
  }

  // HTTPS
  if (r.includes("https") || r.includes("ssl") || r.includes("secure")) {
    return `# Most hosting providers offer free SSL. Steps:
# 1. Enable SSL/HTTPS in your hosting dashboard
# 2. Set up a redirect from HTTP to HTTPS
# 3. Update all internal links to use https://

# For Shopify: SSL is automatic and free
# For WooCommerce: Install the Really Simple SSL plugin
# For most hosts: Enable "Force HTTPS" in the control panel`;
  }

  // Alt text
  if (r.includes("alt text")) {
    return `<!-- Good alt text examples for product images -->
<img src="product.jpg" alt="Red canvas sneaker, side view" width="800" height="600" />
<img src="detail.jpg" alt="Close-up of rubber sole tread pattern" width="800" height="600" />

<!-- Bad alt text (too generic) -->
<img src="product.jpg" alt="Product image" />
<img src="product.jpg" alt="photo" />`;
  }

  // Image dimensions
  if (r.includes("width") && r.includes("height") && r.includes("image")) {
    return `<!-- Always include width and height on images -->
<img src="product.jpg" alt="Product name" width="800" height="600" loading="lazy" />

<!-- This prevents layout shift and helps agents parse faster -->`;
  }

  // Add-to-cart
  if (r.includes("add-to-cart") || r.includes("cart button") || r.includes("purchase")) {
    if (platform === "shopify") {
      return `{# Shopify product forms are usually already correct. Ensure you have: #}
<form method="post" action="/cart/add">
  <input type="hidden" name="id" value="{{ product.selected_or_first_available_variant.id }}" />
  <button type="submit" name="add">Add to cart</button>
</form>`;
    }
    return `<!-- Use a standard form or button for add-to-cart -->
<form action="/cart/add" method="POST">
  <input type="hidden" name="product_id" value="123" />
  <button type="submit">Add to cart</button>
</form>`;
  }

  // Sitemap
  if (r.includes("sitemap")) {
    if (platform === "shopify") return `# Shopify auto-generates your sitemap at /sitemap.xml
# Make sure it's not blocked in robots.txt
# Check: ${origin}/sitemap.xml`;
    if (platform === "woocommerce") return `# Install Yoast SEO or Rank Math to auto-generate sitemaps
# After installing, your sitemap will be at /sitemap_index.xml
# Add to robots.txt: Sitemap: ${origin}/sitemap_index.xml`;
    return `# Create a sitemap.xml file at your site root
# Include all product and collection pages
# Add to robots.txt: Sitemap: ${origin}/sitemap.xml
# Tools: xml-sitemaps.com or screaming frog can generate one`;
  }

  // Server-side rendering
  if (r.includes("javascript") && (r.includes("server") || r.includes("ssr") || r.includes("render"))) {
    return `# If using a JS framework (React, Vue, etc):
# 1. Use Next.js, Nuxt, or similar with SSR/SSG
# 2. Pre-render product pages at build time
# 3. Ensure critical content is in the initial HTML
#
# Test: curl your page URL and check if product info
# is visible in the HTML without JavaScript`;
  }

  return undefined;
}

/* ─── Build Action Plan ─── */
function buildActionPlan(categories: ScanCategory[], platform: Platform, url: string): ActionItem[] {
  const items: ActionItem[] = [];
  for (const cat of categories) {
    for (const rec of cat.recommendations) {
      const { impact, points } = estimateImpact(rec);
      const code = generateFixCode(rec, platform, url);
      items.push({ fix: rec, category: cat.name, impact, estimatedPoints: points, code, platform: platform !== "unknown" ? platform : undefined });
    }
  }
  const order = { high: 0, medium: 1, low: 2 };
  items.sort((a, b) => order[a.impact] - order[b.impact] || b.estimatedPoints - a.estimatedPoints);
  return items;
}

/* ─── Fetch HTML (for link discovery) ─── */
async function fetchHtml(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CRAWL_TIMEOUT);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { "User-Agent": "Mozilla/5.0 (compatible; AgentReadyBot/1.0)", Accept: "text/html" }, redirect: "follow" });
    if (!res.ok) return "";
    const text = await res.text();
    return text.slice(0, 500_000);
  } catch { return ""; }
  finally { clearTimeout(timeout); }
}

/* ─── Estimate fix time ─── */
function estimateFixTime(actionPlan: ActionItem[]): string {
  if (actionPlan.length === 0) return "No fixes needed";
  const high = actionPlan.filter(a => a.impact === "high").length;
  const med = actionPlan.filter(a => a.impact === "medium").length;
  const total = high * 30 + med * 15 + (actionPlan.length - high - med) * 5;
  if (total <= 30) return "About 30 minutes";
  if (total <= 120) return "About 1-2 hours";
  if (total <= 240) return "About 2-4 hours";
  return "About 4-8 hours";
}

/* ═══ Deep Scan ═══ */
export async function deepScan(rawUrl: string): Promise<DeepScanResult> {
  const startTime = Date.now();
  const rootUrl = validateAndNormalizeUrl(rawUrl);

  // 1. Fetch homepage
  const homepageHtml = await fetchHtml(rootUrl);
  const platform = detectPlatform(homepageHtml);
  const links = discoverLinks(homepageHtml, rootUrl);

  // 2. If few product pages found, try sitemap as fallback
  let productPages = links.products.slice(0, 8);
  if (productPages.length < 3) {
    const sitemapUrls = await discoverFromSitemap(rootUrl);
    const sitemapProducts = sitemapUrls.filter(u => classifyUrl(u) === "product");
    const sitemapCollections = sitemapUrls.filter(u => classifyUrl(u) === "collection");
    // Merge sitemap results with link discovery
    for (const u of sitemapProducts) { if (!productPages.includes(u)) productPages.push(u); }
    for (const u of sitemapCollections) { if (!links.collections.includes(u)) links.collections.push(u); }
    productPages = productPages.slice(0, 8);
  }

  // 3. Build scan list
  const toScan: string[] = [rootUrl];
  toScan.push(...productPages.slice(0, 6));
  toScan.push(...links.collections.slice(0, 3));
  toScan.push(...links.other.slice(0, 2));
  const uniqueUrls = [...new Set(toScan)].slice(0, MAX_PAGES);

  // 4. Scan all pages (batched, resilient)
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
      // Failed pages are silently skipped instead of crashing the whole scan
    }
  }

  if (pages.length === 0) throw new Error("Could not scan any pages on this site.");

  // 5. Aggregate
  const aggregatedCategories = aggregateCategories(pages);
  const totalScore = aggregatedCategories.reduce((s, c) => s + c.score, 0);
  const totalMax = aggregatedCategories.reduce((s, c) => s + c.maxScore, 0);
  const overallScore = totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : 0;

  const gradeFromScore = (s: number) => s >= 85 ? "A+" : s >= 75 ? "A" : s >= 60 ? "B" : s >= 45 ? "C" : s >= 30 ? "D" : "F";

  // 6. Action plan
  const actionPlan = buildActionPlan(aggregatedCategories, platform, rootUrl);

  return {
    rootUrl, platform, overallScore, grade: gradeFromScore(overallScore),
    pages, aggregatedCategories, actionPlan,
    scannedAt: new Date().toISOString(),
    scanDurationMs: Date.now() - startTime,
    totalPages: pages.length,
    topIssue: actionPlan.length > 0 ? actionPlan[0].fix : null,
    estimatedFixTime: estimateFixTime(actionPlan),
  };
}
