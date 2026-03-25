import { type ScanCategory, type CheckContext, type SubCheck, categoryStatus, check } from "./types";

export function checkOpenAIFeedReadiness(ctx: CheckContext): ScanCategory {
  const findings: string[] = [];
  const recommendations: string[] = [];
  const checks: SubCheck[] = [];
  let score = 0;
  const maxScore = 20;

  // Parse JSON-LD to check product data against OpenAI feed spec requirements
  const products: Record<string, unknown>[] = [];
  ctx.$('script[type="application/ld+json"]').each((_, el) => {
    try {
      const data = JSON.parse(ctx.$(el).text());
      function walk(obj: Record<string, unknown>) {
        if (!obj || typeof obj !== "object") return;
        const t = obj["@type"];
        if (t === "Product" || t === "ProductGroup") products.push(obj);
        if (Array.isArray(obj["@graph"])) {
          for (const g of obj["@graph"] as Record<string, unknown>[]) { if (g && typeof g === "object") walk(g); }
        }
      }
      const items = Array.isArray(data) ? data : [data];
      for (const item of items) { if (item && typeof item === "object") walk(item as Record<string, unknown>); }
    } catch { /* skip */ }
  });

  // 1. Machine-readable product data exists
  if (products.length > 0) {
    score += 2;
    findings.push(`${products.length} product(s) in structured data`);
    checks.push(check("Product data exists", true, 2, 2, `${products.length} products`));
  } else {
    checks.push(check("Product data exists", false, 0, 2, "No product schema"));
    recommendations.push("Add Product structured data (JSON-LD) to your pages. This is the primary way ChatGPT Shopping and other AI agents read your product information.");
    // All other checks will fail
    for (let i = 0; i < 13; i++) checks.push(check("N/A", false, 0, i < 4 ? 2 : 1, "No product data"));
    return { name: "ChatGPT Shopping Ready", score: 0, maxScore, status: "fail", findings, recommendations, checks };
  }

  const p = products[0];
  const offers = (Array.isArray(p.offers) ? p.offers[0] : p.offers) as Record<string, unknown> | undefined;

  // 2. Product ID
  const hasId = !!(p.sku || p.gtin || p["@id"] || p.productID);
  if (hasId) { score += 1; checks.push(check("Product ID", true, 1, 1, "Present")); }
  else { checks.push(check("Product ID", false, 0, 1, "Missing")); recommendations.push("Add a unique product identifier (SKU, GTIN, or productID) to each product."); }

  // 3. Title
  if (p.name && String(p.name).length > 3) { score += 2; checks.push(check("Title/name", true, 2, 2, String(p.name).slice(0, 40))); }
  else { checks.push(check("Title/name", false, 0, 2, "Missing or too short")); recommendations.push("Product name is required by all AI shopping platforms."); }

  // 4. Price
  if (offers?.price || offers?.lowPrice) { score += 2; checks.push(check("Price", true, 2, 2, `${offers.price || offers.lowPrice}`)); }
  else { checks.push(check("Price", false, 0, 2, "Missing")); recommendations.push("Price data is required for AI shopping. Add offers.price to your Product schema."); }

  // 5. Currency
  if (offers?.priceCurrency) { score += 1; checks.push(check("Currency", true, 1, 1, String(offers.priceCurrency))); }
  else { checks.push(check("Currency", false, 0, 1, "Missing")); }

  // 6. Availability
  if (offers?.availability) { score += 2; checks.push(check("Availability", true, 2, 2, String(offers.availability).split("/").pop() || "Set")); }
  else { checks.push(check("Availability", false, 0, 2, "Missing")); recommendations.push("Add availability (InStock/OutOfStock) to your product offers. AI agents will not recommend products without stock status."); }

  // 7. Barcodes (GTIN/UPC/EAN)
  const hasBarcodes = !!(p.gtin || p.gtin13 || p.gtin8 || p.gtin14);
  if (hasBarcodes) { score += 1; checks.push(check("Barcodes", true, 1, 1, "GTIN present")); }
  else { checks.push(check("Barcodes", false, 0, 1, "No GTIN/UPC")); recommendations.push("Add GTIN barcodes to products for global identification in AI shopping catalogs."); }

  // 8. Canonical URL
  if (p.url || ctx.$('link[rel="canonical"]').length > 0) { score += 1; checks.push(check("Product URL", true, 1, 1, "Accessible")); }
  else { checks.push(check("Product URL", false, 0, 1, "Missing")); }

  // 9. Media/Images
  if (p.image) {
    const imageCount = Array.isArray(p.image) ? p.image.length : 1;
    score += imageCount >= 3 ? 2 : 1;
    findings.push(`${imageCount} product image(s) in schema`);
    checks.push(check("Product images", imageCount >= 3, imageCount >= 3 ? 2 : 1, 2, `${imageCount} images`));
  } else { checks.push(check("Product images", false, 0, 2, "No images in schema")); recommendations.push("Add product images to your schema. AI agents display these to shoppers."); }

  // 10. Description
  if (p.description && String(p.description).length > 50) { score += 1; checks.push(check("Description", true, 1, 1, `${String(p.description).length} chars`)); }
  else if (p.description) { checks.push(check("Description", false, 0, 1, "Too short (<50 chars)")); }
  else { checks.push(check("Description", false, 0, 1, "Missing")); recommendations.push("Add a product description of at least 50 characters to your schema."); }

  // 11. Categories
  const hasCategories = ctx.$('[itemprop="category"]').length > 0 || ctx.$('[class*="breadcrumb"]').length > 0;
  if (hasCategories) { score += 1; checks.push(check("Categories", true, 1, 1, "Present")); }
  else { checks.push(check("Categories", false, 0, 1, "Missing")); }

  // 12. Condition
  const hasCondition = !!(p.itemCondition);
  if (hasCondition) { score += 1; checks.push(check("Condition", true, 1, 1, String(p.itemCondition).split("/").pop() || "Set")); }
  else { checks.push(check("Condition", false, 0, 1, "Not declared")); }

  // 13. Seller info
  const hasSeller = !!(offers?.seller || p.manufacturer || p.brand);
  if (hasSeller) { score += 1; checks.push(check("Seller info", true, 1, 1, "Present")); }
  else { checks.push(check("Seller info", false, 0, 1, "Missing")); recommendations.push("Add seller or brand information so AI agents can attribute products correctly."); }

  // 14. Multiple variants
  const hasVariants = products.some(pr => Array.isArray(pr.hasVariant) || pr["@type"] === "ProductGroup");
  if (hasVariants) { score += 1; checks.push(check("Variants", true, 1, 1, "ProductGroup/hasVariant")); findings.push("Product variants in schema"); }
  else { checks.push(check("Variants", false, 0, 1, "No variants")); }

  // 15. Offers array
  const offersArray = Array.isArray(p.offers);
  if (offersArray && (p.offers as unknown[]).length > 1) { checks.push(check("Multiple offers", true, 0, 0, `${(p.offers as unknown[]).length} offers`)); }
  else { checks.push(check("Multiple offers", false, 0, 0, "Single or no offers")); }

  // 16. Data freshness (check if page has last-modified or similar)
  const lastMod = ctx.headers["last-modified"];
  if (lastMod) {
    const age = Date.now() - new Date(lastMod).getTime();
    const days = Math.round(age / 86400000);
    if (days < 7) { score += 1; checks.push(check("Data freshness", true, 1, 1, `Updated ${days}d ago`)); }
    else { checks.push(check("Data freshness", false, 0, 1, `${days} days old`)); recommendations.push("Your product data appears stale. AI agents prefer recently updated product information."); }
  } else {
    checks.push(check("Data freshness", false, 0, 1, "No last-modified header"));
  }

  // 17. Price is numeric (no symbols)
  const priceVal = offers?.price || offers?.lowPrice;
  if (priceVal && !String(priceVal).match(/[^0-9.]/)) { checks.push(check("Numeric price", true, 0, 0, String(priceVal))); }
  else if (priceVal) { checks.push(check("Numeric price", false, 0, 0, `"${priceVal}" contains non-numeric chars`)); recommendations.push("Price values in schema should be numeric only (e.g. 29.99, not $29.99)."); }
  else { checks.push(check("Numeric price", false, 0, 0, "No price")); }

  // 18. Availability is valid schema.org URL
  const avail = String(offers?.availability || "");
  if (avail.startsWith("https://schema.org/")) { checks.push(check("Valid availability URL", true, 0, 0, avail.split("/").pop() || "Set")); }
  else if (avail) { checks.push(check("Valid availability URL", false, 0, 0, `"${avail}" (should be schema.org URL)`)); }
  else { checks.push(check("Valid availability URL", false, 0, 0, "Missing")); }

  // 19. Product URL matches canonical
  const canonical = ctx.$('link[rel="canonical"]').attr("href");
  const productUrl = String(p.url || "");
  if (productUrl && canonical && (productUrl === canonical || productUrl.includes(canonical) || canonical.includes(productUrl))) { checks.push(check("URL matches canonical", true, 0, 0, "Consistent")); }
  else if (productUrl || canonical) { checks.push(check("URL matches canonical", false, 0, 0, "Mismatch or missing")); }
  else { checks.push(check("URL matches canonical", false, 0, 0, "Both missing")); }

  return { name: "ChatGPT Shopping Ready", score: Math.min(score, maxScore), maxScore, status: categoryStatus(score, maxScore), findings, recommendations, checks };
}
