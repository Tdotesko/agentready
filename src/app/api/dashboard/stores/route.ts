import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, hasActiveSub } from "@/lib/auth";
import { query } from "@/lib/db";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  if (!hasActiveSub(user)) return NextResponse.json([], { status: 200 });

  const stores = await query<{ id: number; url: string; name: string; auto_rescan: boolean; rescan_interval: string; last_rescan_at: string | null; last_score: number | null; created_at: string }>(
    "SELECT * FROM stores WHERE user_id = $1 ORDER BY created_at DESC", [user.id]
  );

  return NextResponse.json(stores.map(s => ({
    id: s.id, url: s.url, name: s.name, autoRescan: s.auto_rescan, rescanInterval: s.rescan_interval,
    lastRescanAt: s.last_rescan_at, lastScore: s.last_score, createdAt: s.created_at,
  })));
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  if (!hasActiveSub(user)) return NextResponse.json({ error: "Active subscription required." }, { status: 403 });

  const { url, name, autoRescan, rescanInterval } = await req.json();
  if (!url || typeof url !== "string") return NextResponse.json({ error: "URL required." }, { status: 400 });

  let normalized = url.trim();
  if (!normalized.startsWith("http")) normalized = "https://" + normalized;
  try { normalized = new URL(normalized).origin; } catch { return NextResponse.json({ error: "Invalid URL." }, { status: 400 }); }

  await query(
    "INSERT INTO stores (user_id, url, name, auto_rescan, rescan_interval) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (user_id, url) DO UPDATE SET name = COALESCE($3, stores.name), auto_rescan = $4, rescan_interval = $5",
    [user.id, normalized, name || null, autoRescan || false, rescanInterval || "weekly"]
  );

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const { id } = await req.json();
  await query("DELETE FROM stores WHERE id = $1 AND user_id = $2", [id, user.id]);
  return NextResponse.json({ ok: true });
}
