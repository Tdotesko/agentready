import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, hasActiveSub } from "@/lib/auth";
import { createApiKey, getUserApiKeys, deleteApiKey } from "@/lib/api-keys";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  if (!hasActiveSub(user)) return NextResponse.json({ error: "Active subscription required." }, { status: 403 });

  const keys = await getUserApiKeys(user.id);
  return NextResponse.json(keys);
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  if (!hasActiveSub(user)) return NextResponse.json({ error: "Active subscription required." }, { status: 403 });
  if (!user.isAdmin && user.plan !== "enterprise" && user.plan !== "agency") {
    return NextResponse.json({ error: "API keys require an Enterprise plan." }, { status: 403 });
  }

  const { name } = await req.json();
  const result = await createApiKey(user.id, name || "Default");
  return NextResponse.json(result);
}

export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "Key ID required." }, { status: 400 });

  await deleteApiKey(user.id, id);
  return NextResponse.json({ ok: true });
}
