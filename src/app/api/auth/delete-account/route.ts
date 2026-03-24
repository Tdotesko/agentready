import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { query } from "@/lib/db";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const { confirm } = await req.json();
  if (confirm !== "DELETE") return NextResponse.json({ error: "Type DELETE to confirm." }, { status: 400 });

  // Delete all user data (cascade)
  await query("DELETE FROM email_queue WHERE prospect_id IN (SELECT id FROM prospects WHERE url IN (SELECT url FROM scans WHERE user_id = $1))", [user.id]);
  await query("DELETE FROM email_log WHERE prospect_id IN (SELECT id FROM prospects WHERE url IN (SELECT url FROM scans WHERE user_id = $1))", [user.id]);
  await query("DELETE FROM webhooks WHERE user_id = $1", [user.id]);
  await query("DELETE FROM api_keys WHERE user_id = $1", [user.id]);
  await query("DELETE FROM stores WHERE user_id = $1", [user.id]);
  await query("DELETE FROM scans WHERE user_id = $1", [user.id]);
  await query("DELETE FROM users WHERE id = $1", [user.id]);

  // Clear session
  const response = NextResponse.json({ ok: true, message: "Account deleted." });
  response.cookies.set("ar_session", "", { httpOnly: true, secure: true, sameSite: "lax", maxAge: 0, path: "/" });
  return response;
}
