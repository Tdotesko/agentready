import { NextRequest, NextResponse } from "next/server";
import { findUserByEmail, setResetToken } from "@/lib/users";
import { sendEmail } from "@/lib/email";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const { allowed } = checkRateLimit(`reset-${ip}`);
  if (!allowed) return NextResponse.json({ error: "Too many attempts. Wait a minute." }, { status: 429 });

  const { email } = await req.json();
  if (!email || typeof email !== "string") return NextResponse.json({ error: "Email required." }, { status: 400 });

  // Always return success to prevent email enumeration
  const successMsg = { ok: true, message: "If an account exists with that email, you will receive a password reset link." };

  const user = await findUserByEmail(email);
  if (!user) return NextResponse.json(successMsg);

  const token = crypto.randomUUID();
  const expires = new Date(Date.now() + 3600000); // 1 hour
  await setResetToken(email, token, expires);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://cartparse.com";
  const resetUrl = `${appUrl}/reset-password?token=${token}`;

  await sendEmail(user.email, "Reset your CartParse password", `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:500px;margin:0 auto;color:#333">
      <h2 style="color:#e8a443;margin:0 0 16px">Reset your password</h2>
      <p>Click the button below to set a new password. This link expires in 1 hour.</p>
      <p style="margin:24px 0">
        <a href="${resetUrl}" style="display:inline-block;padding:12px 24px;background:#e8a443;color:#000;text-decoration:none;border-radius:8px;font-weight:600">Reset password</a>
      </p>
      <p style="color:#999;font-size:12px">If you didn't request this, you can ignore this email.</p>
    </div>
  `);

  return NextResponse.json(successMsg);
}
