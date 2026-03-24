import { NextRequest, NextResponse } from "next/server";
import { autoDiscover, recontactLowScoreProspects } from "@/lib/lead-discovery";

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret") || req.nextUrl.searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const discovery = await autoDiscover();
    const recontact = await recontactLowScoreProspects();

    return NextResponse.json({
      ok: true,
      discovery,
      recontact,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
