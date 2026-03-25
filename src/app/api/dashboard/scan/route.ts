import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, hasActiveSub } from "@/lib/auth";
import { deepScan } from "@/lib/deep-scanner";
import { saveScan } from "@/lib/users";
import { checkRateLimit } from "@/lib/rate-limit";
import { query } from "@/lib/db";
import { getPlanConfig } from "@/lib/config";

async function fireWebhooks(userId: string, event: string, payload: Record<string, unknown>) {
  try {
    const hooks = await query<{ url: string }>(
      "SELECT url FROM webhooks WHERE user_id = $1 AND is_active = TRUE",
      [userId]
    );

    await Promise.allSettled(
      hooks.map(hook => {
        let body: string;

        // Format for Discord webhooks
        if (hook.url.includes("discord.com/api/webhooks")) {
          const score = Number(payload.score) || 0;
          const color = score >= 72 ? 0x22c55e : score >= 58 ? 0xeab308 : 0xef4444;
          body = JSON.stringify({
            embeds: [{
              title: `Scan Complete: ${payload.url}`,
              description: `**Score: ${payload.score}/100** (${payload.grade})\nPlatform: ${payload.platform}\nPages scanned: ${payload.totalPages}\nIssues found: ${payload.issues}`,
              color,
              footer: { text: "CartParse" },
              timestamp: new Date().toISOString(),
            }],
          });
        } else {
          // Standard webhook format for other services
          body = JSON.stringify({ event, data: payload, timestamp: new Date().toISOString() });
        }

        return fetch(hook.url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
        });
      })
    );
  } catch { /* webhooks are non-critical */ }
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  if (!hasActiveSub(user)) return NextResponse.json({ error: "Active subscription required." }, { status: 403 });

  const { allowed } = checkRateLimit(`dash-scan-${user.id}`);
  if (!allowed) return NextResponse.json({ error: "Too many scans. Wait a minute." }, { status: 429 });

  const contentLength = req.headers.get("content-length");
  if (contentLength && parseInt(contentLength) > 2048) {
    return NextResponse.json({ error: "Request too large." }, { status: 413 });
  }

  const { url } = await req.json();
  if (!url || typeof url !== "string" || url.length > 2048) return NextResponse.json({ error: "Valid URL required." }, { status: 400 });

  try {
    const planConfig = getPlanConfig(user.plan || undefined, user.isAdmin);
    const result = await deepScan(url, planConfig.pages);

    await saveScan({
      userId: user.id,
      url: result.rootUrl,
      score: result.overallScore,
      grade: result.grade,
      resultJson: JSON.stringify(result),
      scannedAt: result.scannedAt,
    });

    // Fire webhooks
    fireWebhooks(user.id, "scan.completed", {
      url: result.rootUrl,
      score: result.overallScore,
      grade: result.grade,
      platform: result.platform,
      totalPages: result.totalPages,
      issues: result.actionPlan.length,
    });

    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Scan failed.";

    if (msg === "CLOUDFLARE_BLOCK") return NextResponse.json({ error: "This site uses Cloudflare bot protection. Try scanning a specific product page URL." }, { status: 403 });
    if (msg === "BOT_BLOCKED") return NextResponse.json({ error: "This site blocked our scanner." }, { status: 403 });
    if (msg === "JS_ONLY_SITE") return NextResponse.json({ error: "This site requires JavaScript to render. AI agents may have the same issue." }, { status: 200 });

    return NextResponse.json({ error: "Scan failed. Check the URL and try again." }, { status: 500 });
  }
}
