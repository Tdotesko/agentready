import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, hasActiveSub } from "@/lib/auth";
import { deepScan } from "@/lib/deep-scanner";
import { saveScan } from "@/lib/users";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  if (!hasActiveSub(user)) return NextResponse.json({ error: "Active subscription required." }, { status: 403 });

  const { url } = await req.json();
  if (!url || typeof url !== "string") return NextResponse.json({ error: "URL required." }, { status: 400 });

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
