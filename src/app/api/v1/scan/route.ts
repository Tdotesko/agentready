import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/lib/api-keys";
import { hasActiveSub } from "@/lib/auth";
import { deepScan } from "@/lib/deep-scanner";
import { saveScan } from "@/lib/users";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return NextResponse.json({ error: "API key required. Use Authorization: Bearer cp_..." }, { status: 401 });
  }

  const apiKey = authHeader.slice(7);
  const user = await validateApiKey(apiKey);
  if (!user) return NextResponse.json({ error: "Invalid API key." }, { status: 401 });
  if (!hasActiveSub(user)) return NextResponse.json({ error: "Active subscription required." }, { status: 403 });

  // Only enterprise users and admins get API access
  if (!user.isAdmin && user.plan !== "enterprise" && user.plan !== "agency") {
    return NextResponse.json({ error: "API access requires an Enterprise plan." }, { status: 403 });
  }

  const { allowed } = checkRateLimit(`api-${user.id}`);
  if (!allowed) return NextResponse.json({ error: "Rate limit exceeded." }, { status: 429 });

  const body = await req.json();
  const { url } = body;
  if (!url || typeof url !== "string") return NextResponse.json({ error: "url field required." }, { status: 400 });

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
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
