import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getAllScans } from "@/lib/users";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !user.isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const scans = await getAllScans();
  return NextResponse.json(scans);
}
