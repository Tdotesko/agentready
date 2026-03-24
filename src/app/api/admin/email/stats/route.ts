import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getEmailStats, getEmailQueue, getEmailLog } from "@/lib/email-sequences";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !user.isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const [stats, queue, log] = await Promise.all([getEmailStats(), getEmailQueue(), getEmailLog()]);
  return NextResponse.json({ stats, queue, log });
}
