import { NextRequest, NextResponse } from "next/server";
import { findUserByEmail, updateUser } from "@/lib/users";
import type { Plan } from "@/lib/config";

// Temporary admin endpoint for testing - remove before production
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-admin-secret");
  if (secret !== process.env.JWT_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { email, plan } = await req.json();
  const user = await findUserByEmail(email);
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  await updateUser(user.id, {
    plan: plan as Plan,
    subscriptionStatus: "active",
    subscriptionId: `sub_test_${Date.now()}`,
  });

  return NextResponse.json({ ok: true, email, plan });
}
