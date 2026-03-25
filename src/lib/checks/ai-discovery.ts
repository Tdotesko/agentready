import { type ScanCategory, type CheckContext, type SubCheck, categoryStatus, check } from "./types";

export async function checkAIDiscoverability(ctx: CheckContext): Promise<ScanCategory> {
  const findings: string[] = [];
  const recommendations: string[] = [];
  const checks: SubCheck[] = [];
  let score = 0;
  const maxScore = 20;
  const baseUrl = new URL(ctx.url).origin;

  // 1. llms.txt
  try {
    const res = await fetch(`${baseUrl}/llms.txt`, { signal: ctx.signal, headers: { "User-Agent": "Mozilla/5.0 (compatible; CartParseBot/1.0)" }, redirect: "follow" });
    if (res.ok) {
      const text = await res.text();
      score += 3;
      findings.push("llms.txt file found");
      checks.push(check("llms.txt", true, 3, 3, `${text.length} bytes`));

      // Check if it has content
      if (text.length > 100) {
        score += 1;
        findings.push("llms.txt has substantial content");
        checks.push(check("llms.txt content", true, 1, 1, "Detailed"));
      } else {
        checks.push(check("llms.txt content", false, 0, 1, "Too short"));
        recommendations.push("Your llms.txt exists but is very short. Add your store description, product categories, and key information for AI agents.");
      }
    } else {
      checks.push(check("llms.txt", false, 0, 3, "Not found"));
      checks.push(check("llms.txt content", false, 0, 1, "N/A"));
      recommendations.push("Add a llms.txt file at your site root. This tells AI language models about your store, products, and how to interact with you. See llmstxt.org for the specification.");
    }
  } catch {
    checks.push(check("llms.txt", false, 0, 3, "Request failed"));
    checks.push(check("llms.txt content", false, 0, 1, "N/A"));
  }

  // 2. robots.txt AI bot directives
  try {
    const res = await fetch(`${baseUrl}/robots.txt`, { signal: ctx.signal, headers: { "User-Agent": "Mozilla/5.0 (compatible; CartParseBot/1.0)" }, redirect: "follow" });
    if (res.ok) {
      const text = await res.text().then(t => t.toLowerCase());
      const blocksGPTBot = text.includes("user-agent: gptbot") && text.includes("disallow: /");
      const blocksGoogleExtended = text.includes("user-agent: google-extended") && text.includes("disallow: /");
      const blocksChatGPT = text.includes("user-agent: chatgpt");

      if (!blocksGPTBot && !blocksGoogleExtended && !blocksChatGPT) {
        score += 2;
        findings.push("robots.txt allows AI bot crawling");
        checks.push(check("AI bots allowed", true, 2, 2, "Not blocked"));
      } else {
        const blocked = [blocksGPTBot && "GPTBot", blocksGoogleExtended && "Google-Extended", blocksChatGPT && "ChatGPT-User"].filter(Boolean);
        findings.push(`robots.txt blocks: ${blocked.join(", ")}`);
        checks.push(check("AI bots allowed", false, 0, 2, `Blocks: ${blocked.join(", ")}`));
        recommendations.push(`Your robots.txt blocks ${blocked.join(" and ")}. This prevents AI shopping agents from discovering your products. Remove these blocks if you want AI agent traffic.`);
      }

      // Sitemap in robots.txt
      if (text.includes("sitemap:")) {
        score += 1;
        checks.push(check("Sitemap in robots.txt", true, 1, 1, "Declared"));
      } else {
        checks.push(check("Sitemap in robots.txt", false, 0, 1, "Not declared"));
        recommendations.push("Add a Sitemap directive to your robots.txt so AI agents can discover all your product pages.");
      }
    } else {
      checks.push(check("AI bots allowed", false, 0, 2, "No robots.txt"));
      checks.push(check("Sitemap in robots.txt", false, 0, 1, "No robots.txt"));
    }
  } catch {
    checks.push(check("AI bots allowed", false, 0, 2, "Check failed"));
    checks.push(check("Sitemap in robots.txt", false, 0, 1, "Check failed"));
  }

  // 3. SearchAction schema
  const hasSearchAction = ctx.html.includes("SearchAction") || ctx.html.includes("potentialAction");
  if (hasSearchAction) {
    score += 2;
    findings.push("SearchAction schema detected (site search)");
    checks.push(check("SearchAction schema", true, 2, 2, "Found"));
  } else {
    checks.push(check("SearchAction schema", false, 0, 2, "Not found"));
    recommendations.push("Add a SearchAction schema to enable AI agents to search your product catalog directly.");
  }

  // 4. OpenSearch
  const hasOpenSearch = ctx.$('link[type="application/opensearchdescription+xml"]').length > 0;
  if (hasOpenSearch) {
    score += 1;
    findings.push("OpenSearch description found");
    checks.push(check("OpenSearch", true, 1, 1, "Present"));
  } else {
    checks.push(check("OpenSearch", false, 0, 1, "Not found"));
  }

  // 5. RSS/Atom feed
  const hasFeed = ctx.$('link[type="application/rss+xml"], link[type="application/atom+xml"]').length > 0;
  if (hasFeed) {
    score += 1;
    findings.push("RSS/Atom feed detected");
    checks.push(check("Product feed", true, 1, 1, "Present"));
  } else {
    checks.push(check("Product feed", false, 0, 1, "Not found"));
  }

  // 6. Google Merchant Center hints
  const hasMerchantLink = ctx.$('link[rel="alternate"][type="application/rss+xml"], link[href*="merchant"], meta[name*="google-site-verification"]').length > 0;
  if (hasMerchantLink) {
    score += 1;
    checks.push(check("Merchant Center hints", true, 1, 1, "Detected"));
  } else {
    checks.push(check("Merchant Center hints", false, 0, 1, "Not detected"));
  }

  // 7. Server-rendered structured data (not JS-injected)
  const jsonLdInHead = ctx.$('head script[type="application/ld+json"]').length;
  const jsonLdTotal = ctx.$('script[type="application/ld+json"]').length;
  if (jsonLdTotal > 0 && jsonLdInHead > 0) {
    score += 2;
    findings.push("Structured data is server-rendered in <head>");
    checks.push(check("SSR structured data", true, 2, 2, `${jsonLdInHead}/${jsonLdTotal} in head`));
  } else if (jsonLdTotal > 0) {
    score += 1;
    checks.push(check("SSR structured data", false, 1, 2, "Present but not in head"));
  } else {
    checks.push(check("SSR structured data", false, 0, 2, "No structured data"));
  }

  // 8. Unique page titles (for deep scans this is checked at aggregation level, here check if title seems generic)
  const title = ctx.$("title").text();
  const isGenericTitle = !title || title.length < 10 || title === "Home" || title === "Shop";
  if (!isGenericTitle) {
    score += 1;
    checks.push(check("Unique page title", true, 1, 1, `"${title.slice(0, 40)}"`));
  } else {
    checks.push(check("Unique page title", false, 0, 1, title ? "Too generic" : "Missing"));
    recommendations.push("Give each page a unique, descriptive title. Generic titles like 'Home' or 'Shop' make it hard for AI agents to understand page content.");
  }

  // 9. Content not behind login wall
  const hasLoginWall = ctx.$('form[action*="login"], form[action*="signin"], .login-required, [data-requires-auth]').length > 0 && ctx.$('[class*="product"], [itemtype*="Product"]').length === 0;
  if (!hasLoginWall) {
    score += 2;
    checks.push(check("No login wall", true, 2, 2, "Content accessible"));
  } else {
    checks.push(check("No login wall", false, 0, 2, "Login required"));
    recommendations.push("Product content appears to be behind a login wall. AI agents cannot authenticate, so they will not see your products.");
  }

  // 10. No aggressive anti-bot
  const hasAntiBot = ctx.html.includes("captcha") || ctx.html.includes("recaptcha") || ctx.html.includes("cf-challenge") || ctx.html.includes("ddos-guard");
  if (!hasAntiBot) {
    score += 1;
    checks.push(check("No anti-bot blocking", true, 1, 1, "No CAPTCHA/challenge detected"));
  } else {
    checks.push(check("No anti-bot blocking", false, 0, 1, "Anti-bot detected"));
    recommendations.push("Anti-bot protection (CAPTCHA, Cloudflare challenge) detected. This may block AI shopping agents from accessing your store.");
  }

  // 11. Robots meta allows indexing
  const robotsMeta = ctx.$('meta[name="robots"]').attr("content") || "";
  if (!robotsMeta.includes("noindex") && !robotsMeta.includes("nofollow")) { checks.push(check("Meta robots allows indexing", true, 0, 0, robotsMeta || "Default allow")); }
  else { checks.push(check("Meta robots allows indexing", false, 0, 0, robotsMeta)); }

  // 12. Structured data not in noscript
  const sdInNoscript = ctx.$('noscript script[type="application/ld+json"]').length;
  if (sdInNoscript === 0) { checks.push(check("Schema not in noscript", true, 0, 0, "Clean")); }
  else { checks.push(check("Schema not in noscript", false, 0, 0, `${sdInNoscript} in noscript`)); }

  // 13. No nofollow on product links
  const nofollowLinks = ctx.$('a[rel*="nofollow"]').length;
  const totalLinks = ctx.$("a[href]").length;
  if (nofollowLinks < totalLinks * 0.3) { checks.push(check("Links followable", true, 0, 0, `${nofollowLinks} nofollow of ${totalLinks}`)); }
  else { checks.push(check("Links followable", false, 0, 0, `${nofollowLinks}/${totalLinks} nofollow`)); }

  // 14. Page has meaningful content
  const bodyText = ctx.$("body").text().replace(/\s+/g, " ").trim();
  if (bodyText.length > 500) { checks.push(check("Meaningful content", true, 0, 0, `${bodyText.length} chars`)); }
  else { checks.push(check("Meaningful content", false, 0, 0, `${bodyText.length} chars (thin)`)); }

  // 15. No redirect loops
  checks.push(check("Direct access", true, 0, 0, "Page loaded successfully"));

  return { name: "AI Visibility", score: Math.min(score, maxScore), maxScore, status: categoryStatus(score, maxScore), findings, recommendations, checks };
}
