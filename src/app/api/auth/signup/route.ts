import { NextRequest, NextResponse } from "next/server";
import { findUserByEmail, createUser, setVerifyToken } from "@/lib/users";
import { hashPassword, createToken } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { sendEmail } from "@/lib/email";

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

    // Send verification email (non-blocking)
    try {
      const verifyToken = crypto.randomUUID();
      await setVerifyToken(user.id, verifyToken);
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://cartparse.com";
      await sendEmail(user.email, "Verify your CartParse email", `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:500px;margin:0 auto;color:#333">
          <h2 style="color:#e8a443;margin:0 0 16px">Welcome to CartParse</h2>
          <p>Click below to verify your email address.</p>
          <p style="margin:24px 0"><a href="${appUrl}/api/auth/verify-email?token=${verifyToken}" style="display:inline-block;padding:12px 24px;background:#e8a443;color:#000;text-decoration:none;border-radius:8px;font-weight:600">Verify email</a></p>
        </div>
      `);
    } catch { /* verification email failed, non-critical */ }

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
