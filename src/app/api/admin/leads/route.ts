import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getAllLeads } from "@/lib/users";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !user.isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const leads = await getAllLeads();
  return NextResponse.json(leads);
}
