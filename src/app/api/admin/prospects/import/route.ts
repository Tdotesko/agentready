import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { bulkImportProspects } from "@/lib/prospects";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !user.isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const { urls } = await req.json();
  if (!Array.isArray(urls)) return NextResponse.json({ error: "urls array required" }, { status: 400 });

  const result = await bulkImportProspects(urls);
  return NextResponse.json(result);
}
