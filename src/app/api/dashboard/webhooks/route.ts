import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, hasActiveSub } from "@/lib/auth";
import { query } from "@/lib/db";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  if (!hasActiveSub(user)) return NextResponse.json([], { status: 200 });

  const hooks = await query<{ id: number; url: string; events: string[]; is_active: boolean; created_at: string }>(
    "SELECT id, url, events, is_active, created_at FROM webhooks WHERE user_id = $1 ORDER BY created_at DESC", [user.id]
  );
  return NextResponse.json(hooks.map(h => ({ id: h.id, url: h.url, events: h.events, isActive: h.is_active, createdAt: h.created_at })));
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  if (!hasActiveSub(user)) return NextResponse.json({ error: "Active subscription required." }, { status: 403 });
  if (!["business", "enterprise", "pro", "agency"].includes(user.plan || "")) {
    return NextResponse.json({ error: "Webhooks require a Business or Enterprise plan." }, { status: 403 });
  }

  const { url, events } = await req.json();
  if (!url || typeof url !== "string") return NextResponse.json({ error: "URL required." }, { status: 400 });

  try { new URL(url); } catch { return NextResponse.json({ error: "Invalid URL." }, { status: 400 }); }

  await query("INSERT INTO webhooks (user_id, url, events) VALUES ($1, $2, $3)", [user.id, url, events || ["scan.completed"]]);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const { id } = await req.json();
  await query("DELETE FROM webhooks WHERE id = $1 AND user_id = $2", [id, user.id]);
  return NextResponse.json({ ok: true });
}
