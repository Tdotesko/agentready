import { type ScanCategory, type CheckContext, type SubCheck, categoryStatus, check } from "./types";

export function checkIdentifiersTaxonomy(ctx: CheckContext): ScanCategory {
  const findings: string[] = [];
  const recommendations: string[] = [];
  const checks: SubCheck[] = [];
  let score = 0;
  const maxScore = 10;

  // Parse JSON-LD for product identifiers
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

  const products = jsonLdBlocks.filter(b => {
    const t = b["@type"];
    return t === "Product" || t === "ProductGroup";
  });

  if (products.length === 0) {
    // No products found, all checks fail
    checks.push(check("GTIN/UPC/EAN", false, 0, 2, "No product schema"));
    checks.push(check("MPN", false, 0, 1, "No product schema"));
    checks.push(check("SKU", false, 0, 1, "No product schema"));
    checks.push(check("Brand in schema", false, 0, 1, "No product schema"));
    checks.push(check("Product taxonomy", false, 0, 2, "No product schema"));
    checks.push(check("Breadcrumb depth", false, 0, 2, "No breadcrumbs"));
    checks.push(check("ISBN (if applicable)", false, 0, 1, "N/A"));
    recommendations.push("Add Product structured data with identifiers (GTIN, SKU, brand) to help AI agents uniquely identify your products in global catalogs.");
    return { name: "Identifiers & Taxonomy", score: 0, maxScore, status: "fail", findings, recommendations, checks };
  }

  const p = products[0];

  // 1. GTIN/UPC/EAN
  const hasGtin = !!(p.gtin || p.gtin13 || p.gtin8 || p.gtin14 || p.gtin12);
  if (hasGtin) { score += 2; findings.push("GTIN/UPC identifier found"); checks.push(check("GTIN/UPC/EAN", true, 2, 2, "Present")); }
  else { checks.push(check("GTIN/UPC/EAN", false, 0, 2, "Missing")); recommendations.push("Add a GTIN (gtin13 or gtin8) to your Product schema. This is a global product identifier that AI agents and Google use to match products across stores."); }

  // 2. MPN
  const hasMpn = !!(p.mpn);
  if (hasMpn) { score += 1; findings.push("MPN found"); checks.push(check("MPN", true, 1, 1, "Present")); }
  else { checks.push(check("MPN", false, 0, 1, "Missing")); }

  // 3. SKU
  const hasSku = !!(p.sku);
  if (hasSku) { score += 1; findings.push("SKU found"); checks.push(check("SKU", true, 1, 1, String(p.sku))); }
  else { checks.push(check("SKU", false, 0, 1, "Missing")); recommendations.push("Add a unique SKU to your Product schema. This helps agents track specific products."); }

  // 4. Brand
  const hasBrand = !!(p.brand);
  if (hasBrand) { score += 1; findings.push("Brand declared in schema"); checks.push(check("Brand in schema", true, 1, 1, typeof p.brand === "object" ? (p.brand as Record<string, string>).name || "Object" : String(p.brand))); }
  else { checks.push(check("Brand in schema", false, 0, 1, "Missing")); recommendations.push("Add brand information to your Product schema. AI agents use brand to match and compare products."); }

  // 5. Taxonomy/Category
  const hasCategory = ctx.$('[itemprop="category"], [class*="breadcrumb"] a').length > 0 || ctx.html.includes('"category"');
  if (hasCategory) { score += 2; findings.push("Product taxonomy/category found"); checks.push(check("Product taxonomy", true, 2, 2, "Present")); }
  else { checks.push(check("Product taxonomy", false, 0, 2, "Missing")); recommendations.push("Add product categories or Google Product Category to help AI agents classify your products in shopping comparisons."); }

  // 6. Breadcrumb depth
  const breadcrumbs = ctx.$('[class*="breadcrumb"] a, nav[aria-label*="breadcrumb"] a, [itemtype*="BreadcrumbList"] a').length;
  if (breadcrumbs >= 3) { score += 2; findings.push(`Breadcrumb depth: ${breadcrumbs} levels`); checks.push(check("Breadcrumb depth", true, 2, 2, `${breadcrumbs} levels`)); }
  else if (breadcrumbs >= 2) { score += 1; checks.push(check("Breadcrumb depth", false, 1, 2, `${breadcrumbs} levels (aim for 3+)`)); }
  else { checks.push(check("Breadcrumb depth", false, 0, 2, breadcrumbs > 0 ? "Too shallow" : "No breadcrumbs")); recommendations.push("Add breadcrumb navigation with at least 3 levels (Home > Category > Product) for better agent navigation."); }

  // 7. ISBN (check if it's a book-like product)
  const hasIsbn = !!(p.isbn);
  if (hasIsbn) { score += 1; checks.push(check("ISBN (if applicable)", true, 1, 1, String(p.isbn))); }
  else { checks.push(check("ISBN (if applicable)", false, 0, 1, "N/A")); }

  return { name: "Identifiers & Taxonomy", score: Math.min(score, maxScore), maxScore, status: categoryStatus(score, maxScore), findings, recommendations, checks };
}
