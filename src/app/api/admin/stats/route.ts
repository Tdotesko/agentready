import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getAdminStats } from "@/lib/users";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !user.isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const stats = await getAdminStats();
    return NextResponse.json(stats);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
