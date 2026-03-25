import { type ScanCategory, type CheckContext, type SubCheck, categoryStatus, check } from "./types";

/**
 * Accessibility checks that directly impact AI agents AND real shoppers.
 * Only includes checks that are:
 * 1. Automatable from HTML parsing (no browser rendering needed)
 * 2. Directly relevant to e-commerce conversion
 * 3. Legally required under ADA/EAA 2026 regulations
 */
export function checkAccessibility(ctx: CheckContext): ScanCategory {
  const findings: string[] = [];
  const recommendations: string[] = [];
  const checks: SubCheck[] = [];
  let score = 0;
  const maxScore = 15;

  // 1. All images have alt attributes (2pts)
  // This directly affects AI agents that read alt text to understand products
  const images = ctx.$("img");
  const imagesWithAlt = ctx.$("img[alt]").length;
  const imgRatio = images.length > 0 ? imagesWithAlt / images.length : 1;
  if (imgRatio >= 0.95) { score += 2; checks.push(check("Image alt attributes", true, 2, 2, `${imagesWithAlt}/${images.length} (${Math.round(imgRatio * 100)}%)`)); }
  else if (imgRatio >= 0.7) { score += 1; checks.push(check("Image alt attributes", false, 1, 2, `${imagesWithAlt}/${images.length} (${Math.round(imgRatio * 100)}%)`)); recommendations.push(`${images.length - imagesWithAlt} images are missing alt attributes. Screen readers and AI agents both rely on alt text to understand images.`); }
  else { checks.push(check("Image alt attributes", false, 0, 2, `${imagesWithAlt}/${images.length} (${Math.round(imgRatio * 100)}%)`)); recommendations.push(`Most of your images lack alt attributes. This is an ADA violation and prevents AI agents from understanding your product images.`); }

  // 2. Form inputs have labels (2pts)
  // Agents filling forms need to know what each field is for
  const inputs = ctx.$('input:not([type="hidden"]):not([type="submit"]):not([type="button"]), select, textarea');
  let labeledInputs = 0;
  inputs.each((_, el) => {
    const id = ctx.$(el).attr("id");
    const ariaLabel = ctx.$(el).attr("aria-label");
    const placeholder = ctx.$(el).attr("placeholder");
    const label = id ? ctx.$(`label[for="${id}"]`).length : 0;
    if (label > 0 || ariaLabel || placeholder) labeledInputs++;
  });
  const labelRatio = inputs.length > 0 ? labeledInputs / inputs.length : 1;
  if (labelRatio >= 0.9) { score += 2; checks.push(check("Form labels", true, 2, 2, `${labeledInputs}/${inputs.length} labeled`)); }
  else { checks.push(check("Form labels", false, 0, 2, `${labeledInputs}/${inputs.length} labeled`)); recommendations.push("Some form inputs are missing labels or aria-labels. AI agents and screen readers need these to interact with your forms."); }

  // 3. Heading hierarchy (1pt)
  // Proper heading structure helps agents understand page sections
  const h1Count = ctx.$("h1").length;
  const h2Count = ctx.$("h2").length;
  const hasProperHierarchy = h1Count === 1 && h2Count > 0;
  if (hasProperHierarchy) { score += 1; checks.push(check("Heading hierarchy", true, 1, 1, `H1:${h1Count} H2:${h2Count}`)); }
  else { checks.push(check("Heading hierarchy", false, 0, 1, `H1:${h1Count} H2:${h2Count}`)); }

  // 4. Language attribute (1pt)
  const lang = ctx.$("html").attr("lang");
  if (lang && lang.length >= 2) { score += 1; checks.push(check("Language declared", true, 1, 1, lang)); }
  else { checks.push(check("Language declared", false, 0, 1, "Missing")); recommendations.push("Add lang attribute to your HTML tag. Required for accessibility and helps AI agents determine page language."); }

  // 5. Links have descriptive text (2pts)
  // "Click here" links are useless to AI agents parsing navigation
  const links = ctx.$("a");
  let descriptiveLinks = 0;
  const badLinkTexts = new Set(["click here", "here", "read more", "more", "link", ""]);
  links.each((_, el) => {
    const text = ctx.$(el).text().trim().toLowerCase();
    const ariaLabel = ctx.$(el).attr("aria-label");
    if (ariaLabel || (text.length > 2 && !badLinkTexts.has(text))) descriptiveLinks++;
  });
  const linkRatio = links.length > 0 ? descriptiveLinks / links.length : 1;
  if (linkRatio >= 0.9) { score += 2; checks.push(check("Descriptive link text", true, 2, 2, `${Math.round(linkRatio * 100)}% descriptive`)); }
  else { checks.push(check("Descriptive link text", false, 0, 2, `${Math.round(linkRatio * 100)}% descriptive`)); recommendations.push("Some links use generic text like 'click here'. Use descriptive text (e.g. 'View shipping policy') so AI agents understand where links go."); }

  // 6. ARIA landmarks (1pt)
  // Help agents identify page regions
  const landmarks = ctx.$('[role="main"], [role="navigation"], [role="banner"], [role="contentinfo"], [role="search"], main, nav, header, footer').length;
  if (landmarks >= 3) { score += 1; checks.push(check("ARIA landmarks", true, 1, 1, `${landmarks} landmarks`)); }
  else { checks.push(check("ARIA landmarks", false, 0, 1, `${landmarks} landmarks`)); }

  // 7. Skip navigation link (1pt)
  const hasSkipNav = ctx.$('a[href="#main"], a[href="#content"], a[class*="skip"], a[class*="sr-only"]').length > 0;
  if (hasSkipNav) { score += 1; checks.push(check("Skip navigation", true, 1, 1, "Present")); }
  else { checks.push(check("Skip navigation", false, 0, 1, "Missing")); }

  // 8. Buttons have accessible names (1pt)
  const buttons = ctx.$("button, [role='button'], input[type='submit']");
  let namedButtons = 0;
  buttons.each((_, el) => {
    const text = ctx.$(el).text().trim();
    const ariaLabel = ctx.$(el).attr("aria-label");
    const value = ctx.$(el).attr("value");
    if (text || ariaLabel || value) namedButtons++;
  });
  const btnRatio = buttons.length > 0 ? namedButtons / buttons.length : 1;
  if (btnRatio >= 0.9) { score += 1; checks.push(check("Button labels", true, 1, 1, `${namedButtons}/${buttons.length} named`)); }
  else { checks.push(check("Button labels", false, 0, 1, `${namedButtons}/${buttons.length} named`)); recommendations.push("Some buttons lack accessible names. AI agents need button text to understand available actions."); }

  // 9. No auto-playing media (1pt)
  const autoplay = ctx.$("video[autoplay], audio[autoplay]").length;
  if (autoplay === 0) { score += 1; checks.push(check("No autoplay media", true, 1, 1, "Clean")); }
  else { checks.push(check("No autoplay media", false, 0, 1, `${autoplay} autoplay elements`)); }

  // 10. Table accessibility (1pt) - for product comparison tables
  const tables = ctx.$("table");
  let accessibleTables = 0;
  tables.each((_, el) => {
    const hasHeaders = ctx.$(el).find("th").length > 0;
    const hasCaption = ctx.$(el).find("caption").length > 0;
    const hasSummary = ctx.$(el).attr("summary");
    if (hasHeaders || hasCaption || hasSummary) accessibleTables++;
  });
  if (tables.length === 0 || accessibleTables >= tables.length * 0.8) { score += 1; checks.push(check("Table accessibility", true, 1, 1, tables.length === 0 ? "No tables" : `${accessibleTables}/${tables.length}`)); }
  else { checks.push(check("Table accessibility", false, 0, 1, `${accessibleTables}/${tables.length} accessible`)); }

  if (score >= maxScore * 0.7) findings.push("Good accessibility foundation for AI agents and shoppers");
  else if (score < maxScore * 0.4) findings.push("Significant accessibility gaps that affect both AI agents and disabled shoppers");

  return { name: "Accessibility", score: Math.min(score, maxScore), maxScore, status: categoryStatus(score, maxScore), findings, recommendations, checks };
}
