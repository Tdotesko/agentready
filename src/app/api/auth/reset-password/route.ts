import { NextRequest, NextResponse } from "next/server";
import { findUserByResetToken, updatePassword } from "@/lib/users";
import { hashPassword } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { token, password } = await req.json();

  if (!token || !password || typeof token !== "string" || typeof password !== "string") {
    return NextResponse.json({ error: "Token and password required." }, { status: 400 });
  }

  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }

  const user = await findUserByResetToken(token);
  if (!user) {
    return NextResponse.json({ error: "Invalid or expired reset link. Request a new one." }, { status: 400 });
  }

  const hash = await hashPassword(password);
  await updatePassword(user.id, hash);

  return NextResponse.json({ ok: true, message: "Password updated. You can now sign in." });
}
