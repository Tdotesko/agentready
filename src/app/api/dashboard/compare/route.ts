import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, hasActiveSub } from "@/lib/auth";
import { deepScan } from "@/lib/deep-scanner";
import type { Plan } from "@/lib/config";

const COMPARE_PLANS: Plan[] = ["pro", "agency", "business", "enterprise"];

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  if (!hasActiveSub(user)) return NextResponse.json({ error: "Active subscription required." }, { status: 403 });
  if (!user.plan || !COMPARE_PLANS.includes(user.plan)) {
    return NextResponse.json({ error: "Competitor comparison requires a Business or Enterprise plan." }, { status: 403 });
  }

  const { myUrl, competitorUrl } = await req.json();
  if (!myUrl || !competitorUrl) return NextResponse.json({ error: "Both URLs required." }, { status: 400 });

  try {
    const [myResult, competitorResult] = await Promise.all([
      deepScan(myUrl),
      deepScan(competitorUrl),
    ]);

    const gaps = myResult.aggregatedCategories.map((myCat, i) => {
      const theirCat = competitorResult.aggregatedCategories[i];
      if (!theirCat) return null;
      const myPct = myCat.maxScore > 0 ? Math.round((myCat.score / myCat.maxScore) * 100) : 0;
      const theirPct = theirCat.maxScore > 0 ? Math.round((theirCat.score / theirCat.maxScore) * 100) : 0;
      return {
        category: myCat.name,
        you: myPct,
        competitor: theirPct,
        gap: theirPct - myPct,
        theyHave: theirCat.findings.filter((f) => !myCat.findings.includes(f)),
        youNeed: myCat.recommendations.filter((r) => !theirCat.recommendations.includes(r) || true),
      };
    }).filter(Boolean);

    return NextResponse.json({
      you: {
        url: myResult.rootUrl,
        score: myResult.overallScore,
        grade: myResult.grade,
        platform: myResult.platform,
        pages: myResult.totalPages,
      },
      competitor: {
        url: competitorResult.rootUrl,
        score: competitorResult.overallScore,
        grade: competitorResult.grade,
        platform: competitorResult.platform,
        pages: competitorResult.totalPages,
      },
      gaps,
      scoreDiff: competitorResult.overallScore - myResult.overallScore,
      myFull: myResult,
      competitorFull: competitorResult,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Comparison failed.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
