import { type ScanCategory, type CheckContext, type SubCheck, categoryStatus, check } from "./types";

export function checkShippingReturns(ctx: CheckContext): ScanCategory {
  const findings: string[] = [];
  const recommendations: string[] = [];
  const checks: SubCheck[] = [];
  let score = 0;
  const maxScore = 15;

  // Parse all JSON-LD blocks to find MerchantReturnPolicy and OfferShippingDetails
  const jsonLdBlocks: Record<string, unknown>[] = [];
  ctx.$('script[type="application/ld+json"]').each((_, el) => {
    try {
      const data = JSON.parse(ctx.$(el).text());
      const items = Array.isArray(data) ? data : [data];
      for (const item of items) {
        if (item && typeof item === "object") {
          jsonLdBlocks.push(item as Record<string, unknown>);
          if (Array.isArray((item as Record<string, unknown>)["@graph"])) {
            for (const g of (item as Record<string, unknown>)["@graph"] as Record<string, unknown>[]) {
              if (g && typeof g === "object") jsonLdBlocks.push(g);
            }
          }
        }
      }
    } catch { /* skip */ }
  });

  // MerchantReturnPolicy
  const returnPolicy = jsonLdBlocks.find(b => (b["@type"] as string) === "MerchantReturnPolicy");
  if (returnPolicy) {
    score += 2;
    findings.push("MerchantReturnPolicy schema found");
    checks.push(check("Return policy schema", true, 2, 2, "Present"));

    if (returnPolicy.returnFees) { score += 1; checks.push(check("Return fees declared", true, 1, 1, String(returnPolicy.returnFees))); }
    else { checks.push(check("Return fees declared", false, 0, 1, "Missing")); recommendations.push("Add returnFees to your MerchantReturnPolicy schema (e.g. FreeReturn, ReturnFeesCustomerResponsibility)."); }

    if (returnPolicy.returnPolicyCategory) { score += 1; checks.push(check("Return category", true, 1, 1, String(returnPolicy.returnPolicyCategory))); }
    else { checks.push(check("Return category", false, 0, 1, "Missing")); }

    if (returnPolicy.merchantReturnDays) { score += 1; checks.push(check("Return window", true, 1, 1, `${returnPolicy.merchantReturnDays} days`)); findings.push(`Return window: ${returnPolicy.merchantReturnDays} days`); }
    else { checks.push(check("Return window", false, 0, 1, "Missing")); recommendations.push("Add merchantReturnDays to your return policy schema so agents know your return deadline."); }

    if (returnPolicy.returnMethod) { score += 1; checks.push(check("Return method", true, 1, 1, String(returnPolicy.returnMethod))); }
    else { checks.push(check("Return method", false, 0, 1, "Missing")); }
  } else {
    checks.push(check("Return policy schema", false, 0, 2, "Not found"));
    checks.push(check("Return fees declared", false, 0, 1, "N/A"));
    checks.push(check("Return category", false, 0, 1, "N/A"));
    checks.push(check("Return window", false, 0, 1, "N/A"));
    checks.push(check("Return method", false, 0, 1, "N/A"));
    recommendations.push("Add MerchantReturnPolicy schema to your product pages. Google and AI agents use this to show return information to shoppers. This directly impacts purchase decisions.");
  }

  // OfferShippingDetails
  const shippingDetails = jsonLdBlocks.find(b => (b["@type"] as string) === "OfferShippingDetails");
  const hasShippingInOffer = jsonLdBlocks.some(b => (b["@type"] as string) === "Offer" && (b as Record<string, unknown>).shippingDetails);

  if (shippingDetails || hasShippingInOffer) {
    score += 2;
    findings.push("OfferShippingDetails schema found");
    checks.push(check("Shipping schema", true, 2, 2, "Present"));

    const sd = shippingDetails || {};
    if (sd.shippingRate || hasShippingInOffer) { score += 1; checks.push(check("Shipping rate", true, 1, 1, "Declared")); }
    else { checks.push(check("Shipping rate", false, 0, 1, "Missing")); }

    if (sd.deliveryTime || hasShippingInOffer) { score += 1; checks.push(check("Delivery time", true, 1, 1, "Declared")); }
    else { checks.push(check("Delivery time", false, 0, 1, "Missing")); recommendations.push("Add deliveryTime to your shipping details so agents can tell customers when to expect delivery."); }

    if (sd.shippingDestination) { score += 1; checks.push(check("Shipping destination", true, 1, 1, "Declared")); }
    else { checks.push(check("Shipping destination", false, 0, 1, "Missing")); }
  } else {
    checks.push(check("Shipping schema", false, 0, 2, "Not found"));
    checks.push(check("Shipping rate", false, 0, 1, "N/A"));
    checks.push(check("Delivery time", false, 0, 1, "N/A"));
    checks.push(check("Shipping destination", false, 0, 1, "N/A"));
    recommendations.push("Add OfferShippingDetails schema to your product pages. AI agents need shipping costs and delivery times to recommend your products over competitors.");
  }

  // Shipping policy page linked
  const shippingLink = ctx.$('a[href*="shipping"], a[href*="delivery"]').length > 0;
  if (shippingLink) { score += 1; checks.push(check("Shipping page linked", true, 1, 1, "Found")); }
  else { checks.push(check("Shipping page linked", false, 0, 1, "Not linked")); }

  // Returns page linked
  const returnsLink = ctx.$('a[href*="return"], a[href*="refund"], a[href*="exchange"]').length > 0;
  if (returnsLink) { score += 1; checks.push(check("Returns page linked", true, 1, 1, "Found")); }
  else { checks.push(check("Returns page linked", false, 0, 1, "Not linked")); }

  // Estimated delivery text
  const hasDeliveryText = ctx.html.toLowerCase().includes("delivery") || ctx.html.toLowerCase().includes("shipping time") || ctx.html.toLowerCase().includes("arrives");
  if (hasDeliveryText) { checks.push(check("Delivery estimate text", true, 0, 0, "Mentioned")); }
  else { checks.push(check("Delivery estimate text", false, 0, 0, "Not found")); }

  // International shipping mentioned
  const hasIntl = ctx.html.toLowerCase().includes("international shipping") || ctx.html.toLowerCase().includes("worldwide") || ctx.html.toLowerCase().includes("ship worldwide");
  if (hasIntl) { checks.push(check("International shipping", true, 0, 0, "Mentioned")); findings.push("International shipping mentioned"); }
  else { checks.push(check("International shipping", false, 0, 0, "Not mentioned")); }

  // Satisfaction guarantee
  const hasGuarantee = ctx.html.toLowerCase().includes("satisfaction guarantee") || ctx.html.toLowerCase().includes("money back") || ctx.html.toLowerCase().includes("money-back");
  if (hasGuarantee) { checks.push(check("Satisfaction guarantee", true, 0, 0, "Mentioned")); findings.push("Satisfaction guarantee mentioned"); }
  else { checks.push(check("Satisfaction guarantee", false, 0, 0, "Not mentioned")); }

  // Free shipping indicator in HTML
  const freeShipping = ctx.$('[class*="free-shipping"]').length > 0 || ctx.html.toLowerCase().includes("free shipping");
  if (freeShipping) {
    score += 2;
    findings.push("Free shipping mentioned on page");
    checks.push(check("Free shipping signal", true, 2, 2, "Detected"));
  } else {
    checks.push(check("Free shipping signal", false, 0, 2, "Not detected"));
  }

  return { name: "Return & Shipping", score: Math.min(score, maxScore), maxScore, status: categoryStatus(score, maxScore), findings, recommendations, checks };
}
