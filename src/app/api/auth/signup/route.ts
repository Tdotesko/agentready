import { NextRequest, NextResponse } from "next/server";
import { findUserByEmail, createUser } from "@/lib/users";
import { hashPassword, createToken } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const { allowed } = checkRateLimit(`signup-${ip}`);
  if (!allowed) {
    return NextResponse.json({ error: "Too many signup attempts. Wait a minute." }, { status: 429 });
  }

  try {
    const { email, password } = await req.json();

    if (!email || !password || typeof email !== "string" || typeof password !== "string") {
      return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email) || email.length > 320) {
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
    }

    const existing = await findUserByEmail(email);
    if (existing) {
      return NextResponse.json({ error: "An account with that email already exists." }, { status: 409 });
    }

    const hash = await hashPassword(password);
    const user = await createUser(email, hash);
    const token = createToken(user.id);

    const response = NextResponse.json({ id: user.id, email: user.email });
    response.cookies.set("ar_session", token, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60,
      path: "/",
    });
    return response;
  } catch {
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
