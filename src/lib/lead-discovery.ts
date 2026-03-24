import { query, queryOne } from "./db";
import { addProspect } from "./prospects";
import { queueColdOutreach, scoreColor } from "./email-sequences";

/* ── Discover stores from various sources ── */

// Source 1: Scan a list of known Shopify store URLs from a seed list
const SEED_KEYWORDS = [
  "clothing store", "shoe store", "jewelry store", "pet supplies",
  "home decor", "fitness equipment", "skincare", "supplements",
  "outdoor gear", "electronics accessories", "coffee", "candles",
  "baby products", "art supplies", "kitchen gadgets", "phone cases",
];

// Generate store discovery URLs from common patterns
function generateDiscoveryUrls(count: number = 20): string[] {
  const urls: string[] = [];
  const tlds = [".com", ".co", ".store", ".shop"];

  // Common patterns for e-commerce stores
  const patterns = [
    // Shopify stores often have predictable patterns
    "get", "shop", "buy", "the", "my", "our",
  ];

  // Use seed keywords to create plausible store URLs
  for (const keyword of SEED_KEYWORDS) {
    const slug = keyword.replace(/\s+/g, "");
    for (const prefix of patterns) {
      for (const tld of tlds) {
        urls.push(`${prefix}${slug}${tld}`);
        if (urls.length >= count * 3) break;
      }
      if (urls.length >= count * 3) break;
    }
    if (urls.length >= count * 3) break;
  }

  // Shuffle and return subset
  return urls.sort(() => Math.random() - 0.5).slice(0, count);
}

/* ── Discover from a provided URL list (sitemap, directory page, etc) ── */
export async function discoverFromUrlList(urls: string[], source: string): Promise<{ discovered: number; scanned: number; contacted: number }> {
  let discovered = 0, scanned = 0, contacted = 0;

  for (const url of urls.slice(0, 50)) {
    try {
      // Check if already a prospect
      const normalized = url.startsWith("http") ? new URL(url).origin : `https://${url}`;
      const exists = await queryOne<{ id: number }>("SELECT id FROM prospects WHERE url = $1", [normalized]);
      if (exists) continue;

      // Add as prospect (auto-scans)
      const prospect = await addProspect(url, source);
      discovered++;

      if (prospect.score !== null) scanned++;

      // Auto-contact if score is low and we have an email
      if (prospect.score !== null && prospect.score < 60 && prospect.email) {
        const storeName = prospect.storeName || new URL(prospect.url).hostname;
        await queueColdOutreach(prospect.id, prospect.email, {
          store_name: storeName,
          store_url: prospect.url,
          score: String(prospect.score),
          score_color: scoreColor(prospect.score),
          grade: prospect.grade || "?",
          platform: prospect.platform || "your",
          findings_list: "<li>Your store needs improvements for AI agent readiness</li>",
          unsubscribe_url: "https://cartparse.com/unsubscribe",
        });
        contacted++;

        // Update prospect status
        await query("UPDATE prospects SET status = 'contacted' WHERE id = $1", [prospect.id]);
      }
    } catch { /* skip failed URLs */ }
  }

  return { discovered, scanned, contacted };
}

/* ── Auto-discover stores (called by cron) ── */
export async function autoDiscover(): Promise<{ discovered: number; scanned: number; contacted: number }> {
  // Get total prospects to avoid re-scanning known stores
  const [count] = await query<{ count: string }>("SELECT COUNT(*) as count FROM prospects");
  const totalProspects = parseInt(count.count);

  // Generate some URLs to try
  const urls = generateDiscoveryUrls(10);

  return discoverFromUrlList(urls, "auto-discovery");
}

/* ── Discover from a website that lists stores (e.g. a directory page) ── */
export async function discoverFromDirectory(directoryUrl: string): Promise<{ discovered: number; scanned: number; contacted: number }> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const res = await fetch(directoryUrl, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; CartParseBot/1.0)", Accept: "text/html" },
      redirect: "follow",
    });

    clearTimeout(timeout);
    if (!res.ok) return { discovered: 0, scanned: 0, contacted: 0 };

    const html = await res.text();

    // Extract external links that look like store URLs
    const linkRegex = /href="(https?:\/\/[^"]+)"/gi;
    const urls: string[] = [];
    let match;
    while ((match = linkRegex.exec(html)) !== null) {
      const url = match[1];
      // Filter for likely e-commerce stores
      if (
        url.includes(".myshopify.com") ||
        url.includes(".shop") ||
        url.includes(".store") ||
        url.includes("shopify") ||
        url.match(/\.(com|co|io)\/?$/)
      ) {
        try {
          const origin = new URL(url).origin;
          if (!urls.includes(origin)) urls.push(origin);
        } catch { /* invalid URL */ }
      }
    }

    return discoverFromUrlList(urls, `directory:${directoryUrl}`);
  } catch {
    return { discovered: 0, scanned: 0, contacted: 0 };
  }
}

/* ── Re-contact unconverted prospects with low scores ── */
export async function recontactLowScoreProspects(): Promise<{ contacted: number }> {
  // Find prospects that were scanned but not yet contacted, with low scores
  const prospects = await query<{
    id: number; url: string; email: string; store_name: string; platform: string; score: number; grade: string;
  }>(
    `SELECT id, url, email, store_name, platform, score, grade FROM prospects
     WHERE status = 'new' AND score IS NOT NULL AND score < 60 AND email IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM email_queue WHERE prospect_id = prospects.id)
     LIMIT 20`
  );

  let contacted = 0;
  for (const p of prospects) {
    try {
      const platformNames: Record<string, string> = { shopify: "Shopify", woocommerce: "WooCommerce", bigcommerce: "BigCommerce", magento: "Magento", squarespace: "Squarespace", wix: "Wix" };

      await queueColdOutreach(p.id, p.email, {
        store_name: p.store_name || new URL(p.url).hostname,
        store_url: p.url,
        score: String(p.score),
        score_color: scoreColor(p.score),
        grade: p.grade || "?",
        platform: platformNames[p.platform] || "your",
        findings_list: "<li>AI agents struggle to read your store data</li>",
        unsubscribe_url: "https://cartparse.com/unsubscribe",
      });

      await query("UPDATE prospects SET status = 'contacted', last_contacted_at = NOW() WHERE id = $1", [p.id]);
      contacted++;
    } catch { /* skip */ }
  }

  return { contacted };
}
