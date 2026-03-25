import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, hasActiveSub } from "@/lib/auth";
import { deepScan } from "@/lib/deep-scanner";
import { checkRateLimit } from "@/lib/rate-limit";
import type { Plan } from "@/lib/config";

const COMPARE_PLANS: Plan[] = ["pro", "agency", "business", "enterprise"];

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  if (!hasActiveSub(user)) return NextResponse.json({ error: "Active subscription required." }, { status: 403 });
  if (!user.isAdmin && (!user.plan || !COMPARE_PLANS.includes(user.plan))) {
    return NextResponse.json({ error: "Competitor comparison requires a Business or Enterprise plan." }, { status: 403 });
  }

  const { allowed } = checkRateLimit(`compare-${user.id}`);
  if (!allowed) return NextResponse.json({ error: "Too many comparisons. Wait a minute." }, { status: 429 });

  const { myUrl, competitorUrl } = await req.json();
  if (!myUrl || !competitorUrl || typeof myUrl !== "string" || typeof competitorUrl !== "string") {
    return NextResponse.json({ error: "Both URLs required." }, { status: 400 });
  }

  try {
    const [myResult, competitorResult] = await Promise.all([
      deepScan(myUrl),
      deepScan(competitorUrl),
    ]);

    // Build category-by-category comparison with specific action items
    const gaps = myResult.aggregatedCategories.map((myCat, i) => {
      const theirCat = competitorResult.aggregatedCategories[i];
      if (!theirCat) return null;
      const myPct = myCat.maxScore > 0 ? Math.round((myCat.score / myCat.maxScore) * 100) : 0;
      const theirPct = theirCat.maxScore > 0 ? Math.round((theirCat.score / theirCat.maxScore) * 100) : 0;

      // Things they have that you don't
      const theyHave = theirCat.findings.filter((f) => !myCat.findings.includes(f));

      // Your recommendations that would close the gap
      const youNeed = myCat.recommendations;

      return {
        category: myCat.name,
        you: myPct,
        competitor: theirPct,
        gap: theirPct - myPct,
        theyHave,
        youNeed,
      };
    }).filter(Boolean);

    // Generate a plain-English "how to beat them" plan
    const behindCategories = gaps.filter(g => g && g.gap > 0).sort((a, b) => (b?.gap || 0) - (a?.gap || 0));
    const aheadCategories = gaps.filter(g => g && g.gap < 0);

    const beatThemPlan: { priority: number; action: string; category: string; impact: string; difficulty: string }[] = [];
    let priority = 1;

    for (const gap of behindCategories) {
      if (!gap) continue;

      // For each category where they're ahead, pick the top recommendations
      for (const rec of gap.youNeed.slice(0, 2)) {
        const impact = gap.gap >= 20 ? "high" : gap.gap >= 10 ? "medium" : "low";
        const difficulty = rec.toLowerCase().includes("add") ? "easy" : rec.toLowerCase().includes("schema") ? "medium" : "easy";

        beatThemPlan.push({
          priority: priority++,
          action: rec,
          category: gap.category,
          impact,
          difficulty,
        });
      }
    }

    // Summary in plain English
    const scoreDiff = competitorResult.overallScore - myResult.overallScore;
    let summary = "";
    if (scoreDiff > 0) {
      summary = `They're ${scoreDiff} points ahead of you. The biggest gaps are in ${behindCategories.slice(0, 3).map(g => g?.category).join(", ")}. Fix the top ${Math.min(5, beatThemPlan.length)} items below and you'll close most of that gap.`;
    } else if (scoreDiff < 0) {
      summary = `You're ${Math.abs(scoreDiff)} points ahead! You're winning in ${aheadCategories.slice(0, 3).map(g => g?.category).join(", ")}. Keep it up, but there's still room to improve in ${behindCategories.slice(0, 2).map(g => g?.category).join(" and ") || "a few areas"}.`;
    } else {
      summary = `You're tied. Focus on the areas below where they score higher to pull ahead.`;
    }

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
      scoreDiff,
      summary,
      beatThemPlan: beatThemPlan.slice(0, 10),
      myFull: myResult,
      competitorFull: competitorResult,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Comparison failed.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
