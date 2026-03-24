import { NextRequest, NextResponse } from "next/server";
import { verifyEmail } from "@/lib/users";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Token required." }, { status: 400 });

  const success = await verifyEmail(token);
  if (!success) {
    return NextResponse.json({ error: "Invalid or already used verification link." }, { status: 400 });
  }

  // Redirect to dashboard with success message
  return NextResponse.redirect(new URL("/dashboard?verified=true", req.url));
}
