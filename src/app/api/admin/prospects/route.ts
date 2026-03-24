import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getProspects, addProspect, updateProspect, getProspectStats } from "@/lib/prospects";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !user.isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const status = req.nextUrl.searchParams.get("status") || undefined;
  const prospects = await getProspects(status);
  const stats = await getProspectStats();
  return NextResponse.json({ prospects, stats });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !user.isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const { url, source } = await req.json();
  if (!url || typeof url !== "string") return NextResponse.json({ error: "URL required" }, { status: 400 });

  try {
    const prospect = await addProspect(url, source || "manual");
    return NextResponse.json(prospect);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !user.isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const { id, status, notes, email, nextFollowupAt } = await req.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const updated = await updateProspect(id, { status, notes, email, nextFollowupAt });
  return NextResponse.json(updated || { error: "Not found" });
}
