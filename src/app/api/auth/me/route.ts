import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  return NextResponse.json({
    id: user.id,
    email: user.email,
    plan: user.plan,
    subscriptionStatus: user.subscriptionStatus,
    isAdmin: user.isAdmin,
    emailVerified: user.emailVerified,
  });
}
