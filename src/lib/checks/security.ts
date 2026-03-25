import { type ScanCategory, type CheckContext, type SubCheck, categoryStatus, check } from "./types";

export function checkSecurityTrust(ctx: CheckContext): ScanCategory {
  const findings: string[] = [];
  const recommendations: string[] = [];
  const checks: SubCheck[] = [];
  let score = 0;
  const maxScore = 15;

  // 1. HTTPS
  if (ctx.url.startsWith("https://")) { score += 2; checks.push(check("HTTPS", true, 2, 2, "Secure")); }
  else { checks.push(check("HTTPS", false, 0, 2, "Not secure")); recommendations.push("Switch to HTTPS. AI agents and browsers flag insecure sites."); }

  // 2. HSTS
  if (ctx.headers["strict-transport-security"]) { score += 1; checks.push(check("HSTS", true, 1, 1, "Present")); findings.push("HSTS header set"); }
  else { checks.push(check("HSTS", false, 0, 1, "Missing")); }

  // 3. X-Content-Type-Options
  if (ctx.headers["x-content-type-options"]?.includes("nosniff")) { score += 1; checks.push(check("X-Content-Type-Options", true, 1, 1, "nosniff")); }
  else { checks.push(check("X-Content-Type-Options", false, 0, 1, "Missing")); }

  // 4. X-Frame-Options
  if (ctx.headers["x-frame-options"]) { score += 1; checks.push(check("X-Frame-Options", true, 1, 1, ctx.headers["x-frame-options"])); }
  else { checks.push(check("X-Frame-Options", false, 0, 1, "Missing")); }

  // 5. CSP
  if (ctx.headers["content-security-policy"]) { score += 1; checks.push(check("Content-Security-Policy", true, 1, 1, "Present")); findings.push("CSP header configured"); }
  else { checks.push(check("Content-Security-Policy", false, 0, 1, "Missing")); }

  // 6. Mixed content
  const httpResources = ctx.$('img[src^="http:"], script[src^="http:"], link[href^="http:"]').length;
  if (httpResources === 0) { score += 1; checks.push(check("No mixed content", true, 1, 1, "Clean")); }
  else { checks.push(check("No mixed content", false, 0, 1, `${httpResources} HTTP resources on HTTPS page`)); recommendations.push(`Found ${httpResources} resources loaded over HTTP on an HTTPS page. This triggers mixed content warnings.`); }

  // 7. Privacy policy link
  const hasPrivacy = ctx.$('a[href*="privacy"], a[href*="Privacy"]').length > 0;
  if (hasPrivacy) { score += 1; checks.push(check("Privacy policy", true, 1, 1, "Linked")); findings.push("Privacy policy linked"); }
  else { checks.push(check("Privacy policy", false, 0, 1, "Not found")); recommendations.push("Add a link to your privacy policy. AI agents check for this as a trust signal."); }

  // 8. Terms link
  const hasTerms = ctx.$('a[href*="terms"], a[href*="Terms"], a[href*="tos"]').length > 0;
  if (hasTerms) { score += 1; checks.push(check("Terms of service", true, 1, 1, "Linked")); }
  else { checks.push(check("Terms of service", false, 0, 1, "Not found")); }

  // 9. Contact info
  const hasContact = ctx.$('a[href*="contact"], a[href*="mailto:"], a[href^="tel:"], a[href*="support"]').length > 0;
  if (hasContact) { score += 1; checks.push(check("Contact info", true, 1, 1, "Accessible")); findings.push("Contact/support accessible"); }
  else { checks.push(check("Contact info", false, 0, 1, "Not found")); recommendations.push("Add visible contact information. AI agents use this as a trust signal when recommending stores."); }

  // 10. Trust badges
  const hasTrust = ctx.$('[class*="trust"], [class*="secure"], [class*="badge"], [alt*="secure"], [alt*="trust"], [alt*="verified"], [class*="guarantee"]').length > 0;
  if (hasTrust) { score += 1; checks.push(check("Trust badges", true, 1, 1, "Detected")); findings.push("Trust/security badges found"); }
  else { checks.push(check("Trust badges", false, 0, 1, "None found")); }

  // 11. Payment security icons
  const hasPaymentIcons = ctx.$('[class*="payment"], [alt*="visa"], [alt*="mastercard"], [alt*="paypal"], [alt*="stripe"], img[src*="payment"]').length > 0;
  if (hasPaymentIcons) { score += 1; checks.push(check("Payment security", true, 1, 1, "Icons found")); }
  else { checks.push(check("Payment security", false, 0, 1, "Not visible")); }

  // 12. CORS
  if (ctx.headers["access-control-allow-origin"]) { score += 2; checks.push(check("CORS configured", true, 2, 2, ctx.headers["access-control-allow-origin"])); }
  else { checks.push(check("CORS configured", false, 0, 2, "Not set")); }

  // 13. Referrer-Policy
  if (ctx.headers["referrer-policy"]) { checks.push(check("Referrer-Policy", true, 0, 0, ctx.headers["referrer-policy"])); }
  else { checks.push(check("Referrer-Policy", false, 0, 0, "Not set")); }

  // 14. Permissions-Policy
  if (ctx.headers["permissions-policy"]) { checks.push(check("Permissions-Policy", true, 0, 0, "Set")); }
  else { checks.push(check("Permissions-Policy", false, 0, 0, "Not set")); }

  // 15. Server header exposure
  const server = ctx.headers["server"] || "";
  if (!server || server === "cloudflare") { checks.push(check("Server header", true, 0, 0, server || "Hidden")); }
  else { checks.push(check("Server header", false, 0, 0, `Exposed: ${server}`)); }

  // 16. X-Powered-By hidden
  if (!ctx.headers["x-powered-by"]) { checks.push(check("X-Powered-By hidden", true, 0, 0, "Hidden")); }
  else { checks.push(check("X-Powered-By hidden", false, 0, 0, `Exposed: ${ctx.headers["x-powered-by"]}`)); }

  return { name: "Security & Trust", score: Math.min(score, maxScore), maxScore, status: categoryStatus(score, maxScore), findings, recommendations, checks };
}
