import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getAllUsers, adminUpdateUser } from "@/lib/users";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !user.isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const users = await getAllUsers();
  return NextResponse.json(users.map(u => ({
    id: u.id,
    email: u.email,
    plan: u.plan,
    subscriptionStatus: u.subscriptionStatus,
    stripeCustomerId: u.stripeCustomerId,
    isAdmin: u.isAdmin,
    createdAt: u.createdAt,
  })));
}

export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !user.isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { userId, plan, subscriptionStatus, isAdmin } = await req.json();
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const updated = await adminUpdateUser(userId, { plan, subscriptionStatus, isAdmin });
  if (!updated) return NextResponse.json({ error: "User not found" }, { status: 404 });

  return NextResponse.json({ ok: true, user: { id: updated.id, email: updated.email, plan: updated.plan, subscriptionStatus: updated.subscriptionStatus, isAdmin: updated.isAdmin } });
}
