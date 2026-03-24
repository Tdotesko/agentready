import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, hasActiveSub } from "@/lib/auth";
import { deepScan } from "@/lib/deep-scanner";
import { saveScan } from "@/lib/users";
import { checkRateLimit } from "@/lib/rate-limit";

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
    const result = await deepScan(url);

    await saveScan({
      userId: user.id,
      url: result.rootUrl,
      score: result.overallScore,
      grade: result.grade,
      resultJson: JSON.stringify(result),
      scannedAt: result.scannedAt,
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
