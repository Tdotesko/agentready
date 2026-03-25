import { type ScanCategory, type CheckContext, type SubCheck, categoryStatus, check } from "./types";

export async function checkUCPProtocol(ctx: CheckContext): Promise<ScanCategory> {
  const findings: string[] = [];
  const recommendations: string[] = [];
  const checks: SubCheck[] = [];
  let score = 0;
  const maxScore = 25;

  const baseUrl = new URL(ctx.url).origin;

  // 1. Check /.well-known/ucp endpoint
  let ucpProfile: Record<string, unknown> | null = null;
  try {
    const res = await fetch(`${baseUrl}/.well-known/ucp`, {
      signal: ctx.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; CartParseBot/1.0)", Accept: "application/json" },
      redirect: "follow",
    });
    if (res.ok) {
      const text = await res.text();
      try {
        ucpProfile = JSON.parse(text);
        score += 5;
        findings.push("UCP profile found at /.well-known/ucp");
        checks.push(check("UCP endpoint exists", true, 5, 5, "/.well-known/ucp accessible"));
      } catch {
        findings.push("UCP endpoint exists but contains invalid JSON");
        checks.push(check("UCP endpoint exists", false, 0, 5, "Invalid JSON at /.well-known/ucp"));
        recommendations.push("Your /.well-known/ucp endpoint returns invalid JSON. Fix the JSON syntax to enable AI agent discovery.");
      }
    } else {
      checks.push(check("UCP endpoint exists", false, 0, 5, "Not found"));
      recommendations.push("Add a UCP (Universal Commerce Protocol) profile at /.well-known/ucp. This is how Google AI Mode and other shopping agents discover your store capabilities. See ucp.dev for the specification.");
    }
  } catch {
    checks.push(check("UCP endpoint exists", false, 0, 5, "Request failed"));
    recommendations.push("Add a UCP profile at /.well-known/ucp to enable AI shopping agent discovery.");
  }

  if (ucpProfile) {
    // 2. Version declared
    const version = ucpProfile.version as string | undefined;
    if (version && /^\d{4}-\d{2}-\d{2}$/.test(version)) {
      score += 2;
      findings.push(`UCP version: ${version}`);
      checks.push(check("UCP version", true, 2, 2, version));
    } else {
      checks.push(check("UCP version", false, 0, 2, "Missing or invalid format"));
      recommendations.push("Declare a UCP version in YYYY-MM-DD format in your profile.");
    }

    // 3. Services declared
    const services = ucpProfile.services as Record<string, unknown> | undefined;
    if (services && Object.keys(services).length > 0) {
      score += 3;
      findings.push(`${Object.keys(services).length} service binding(s) declared`);
      checks.push(check("Service bindings", true, 3, 3, `${Object.keys(services).length} services`));
    } else {
      checks.push(check("Service bindings", false, 0, 3, "No services declared"));
      recommendations.push("Declare at least one service binding (REST, MCP, A2A, or Embedded) in your UCP profile.");
    }

    // 4. Payment handlers
    const payments = ucpProfile.payment_handlers || ucpProfile.paymentHandlers;
    if (payments) {
      score += 3;
      findings.push("Payment handlers declared");
      checks.push(check("Payment handlers", true, 3, 3, "Present"));
    } else {
      checks.push(check("Payment handlers", false, 0, 3, "Not declared"));
      recommendations.push("Declare payment handlers in your UCP profile so AI agents know how to process payments on your store.");
    }

    // 5. Capabilities
    const capabilities = ucpProfile.capabilities as Record<string, unknown> | undefined;
    if (capabilities && Object.keys(capabilities).length > 0) {
      score += 2;
      findings.push(`${Object.keys(capabilities).length} capabilities advertised`);
      checks.push(check("Capabilities registry", true, 2, 2, `${Object.keys(capabilities).length} capabilities`));
    } else {
      checks.push(check("Capabilities registry", false, 0, 2, "Empty"));
    }

    // 6. Signing keys
    const keys = ucpProfile.signing_keys || ucpProfile.signingKeys || ucpProfile.keys;
    if (keys) {
      score += 2;
      findings.push("Signing keys present");
      checks.push(check("Signing keys", true, 2, 2, "JWK keys found"));
    } else {
      checks.push(check("Signing keys", false, 0, 2, "Not found"));
      recommendations.push("Add signing keys (JWK format) to your UCP profile for webhook verification.");
    }
  } else {
    // Fill remaining checks as not applicable
    checks.push(check("UCP version", false, 0, 2, "No UCP profile"));
    checks.push(check("Service bindings", false, 0, 3, "No UCP profile"));
    checks.push(check("Payment handlers", false, 0, 3, "No UCP profile"));
    checks.push(check("Capabilities registry", false, 0, 2, "No UCP profile"));
    checks.push(check("Signing keys", false, 0, 2, "No UCP profile"));
  }

  // 7. CORS headers for agents
  const corsHeader = ctx.headers["access-control-allow-origin"];
  if (corsHeader) {
    score += 2;
    findings.push("CORS headers present");
    checks.push(check("CORS for agents", true, 2, 2, corsHeader));
  } else {
    checks.push(check("CORS for agents", false, 0, 2, "No CORS headers"));
    recommendations.push("Add CORS headers to allow AI shopping agents to interact with your store API.");
  }

  // 8. HTTPS on all endpoints
  if (ctx.url.startsWith("https://")) {
    score += 2;
    checks.push(check("HTTPS", true, 2, 2, "Secure"));
  } else {
    checks.push(check("HTTPS", false, 0, 2, "Not HTTPS"));
  }

  // 9-10. Additional protocol signals from HTML
  const hasApiLink = ctx.$('link[rel="api"], meta[name="api-url"], link[rel="alternate"][type="application/json"]').length > 0;
  if (hasApiLink) {
    score += 2;
    findings.push("API endpoint reference found in HTML");
    checks.push(check("API discoverability", true, 2, 2, "Link/meta found"));
  } else {
    checks.push(check("API discoverability", false, 0, 2, "No API links in HTML"));
  }

  const hasMcpEndpoint = ctx.html.includes("mcp") || ctx.html.includes("model-context-protocol");
  if (hasMcpEndpoint) {
    score += 2;
    findings.push("MCP (Model Context Protocol) reference detected");
    checks.push(check("MCP support", true, 2, 2, "Reference found"));
  } else {
    checks.push(check("MCP support", false, 0, 2, "Not detected"));
  }

  return { name: "UCP Protocol", score: Math.min(score, maxScore), maxScore, status: categoryStatus(score, maxScore), findings, recommendations, checks };
}
