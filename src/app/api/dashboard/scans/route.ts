import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getUserScans } from "@/lib/users";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const scans = await getUserScans(user.id);
  return NextResponse.json(scans);
}
