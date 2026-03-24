import { NextRequest, NextResponse } from "next/server";
import { findUserByEmail } from "@/lib/users";
import { verifyPassword, createToken } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import bcrypt from "bcryptjs";

// Dummy hash for timing-safe comparison when user doesn't exist
const DUMMY_HASH = bcrypt.hashSync("dummy-timing-safe", 12);

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const { allowed } = checkRateLimit(`login-${ip}`);
  if (!allowed) {
    return NextResponse.json({ error: "Too many login attempts. Wait a minute and try again." }, { status: 429 });
  }

  try {
    const body = await req.json();
    const { email, password } = body;

    if (!email || !password || typeof email !== "string" || typeof password !== "string") {
      return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
    }

    const user = await findUserByEmail(email);

    // Timing-safe: always run bcrypt comparison even if user doesn't exist
    const valid = await verifyPassword(password, user ? user.passwordHash : DUMMY_HASH);

    if (!user || !valid) {
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    }

    const token = createToken(user.id);
    const response = NextResponse.json({
      id: user.id,
      email: user.email,
      plan: user.plan,
      subscriptionStatus: user.subscriptionStatus,
      isAdmin: user.isAdmin,
    });
    response.cookies.set("ar_session", token, {
      httpOnly: true, secure: true, sameSite: "lax", maxAge: 7 * 24 * 60 * 60, path: "/",
    });
    return response;
  } catch {
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
