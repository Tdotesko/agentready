import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { queueColdOutreach, scoreColor } from "@/lib/email-sequences";
import { queryOne } from "@/lib/db";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !user.isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const { prospectId } = await req.json();
  if (!prospectId) return NextResponse.json({ error: "prospectId required" }, { status: 400 });

  const prospect = await queryOne<{ id: number; url: string; email: string | null; store_name: string | null; score: number | null; grade: string | null; platform: string | null }>(
    "SELECT id, url, email, store_name, score, grade, platform FROM prospects WHERE id = $1", [prospectId]
  );
  if (!prospect) return NextResponse.json({ error: "Prospect not found" }, { status: 404 });
  if (!prospect.email) return NextResponse.json({ error: "No email address found for this prospect. Add one manually." }, { status: 400 });

  const vars = {
    store_name: prospect.store_name || new URL(prospect.url).hostname,
    store_url: prospect.url,
    score: String(prospect.score || 0),
    score_color: scoreColor(prospect.score || 0),
    grade: prospect.grade || "?",
    platform: prospect.platform || "your",
    findings_list: "<li>Details available in full scan report</li>",
    unsubscribe_url: "https://cartparse.dev",
  };

  await queueColdOutreach(prospect.id, prospect.email, vars);
  return NextResponse.json({ ok: true, message: `Cold outreach sequence queued for ${prospect.email}` });
}
