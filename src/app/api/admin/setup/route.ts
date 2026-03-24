import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

// One-time setup endpoint to make the first admin user.
// Secured by JWT_SECRET. Remove or disable after first use.
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-admin-secret");
  if (secret !== process.env.JWT_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { email } = await req.json();
  if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 });

  await query("UPDATE users SET is_admin = TRUE WHERE email = $1", [email.toLowerCase()]);

  return NextResponse.json({ ok: true, message: `${email} is now an admin` });
}
