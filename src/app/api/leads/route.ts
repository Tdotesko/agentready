import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { saveLead } from "@/lib/users";
import { queryOne } from "@/lib/db";
import { queueLeadNurture, scoreColor } from "@/lib/email-sequences";

export async function POST(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";

  const { allowed } = checkRateLimit(`lead-${ip}`);
  if (!allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  try {
    const body = await request.json();
    const { email, scannedUrl, score } = body;

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Valid email required" }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email) || email.length > 320) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanUrl = typeof scannedUrl === "string" ? scannedUrl.slice(0, 2048) : "";
    const cleanScore = typeof score === "number" ? score : 0;

    await saveLead(cleanEmail, cleanUrl, cleanScore);

    // Auto-queue nurture sequence if they haven't signed up
    try {
      const existingUser = await queryOne<{ id: string }>("SELECT id FROM users WHERE email = $1", [cleanEmail]);
      if (!existingUser) {
        const lead = await queryOne<{ id: number }>("SELECT id FROM leads WHERE email = $1 ORDER BY submitted_at DESC LIMIT 1", [cleanEmail]);
        if (lead) {
          const storeName = cleanUrl ? new URL(cleanUrl.startsWith("http") ? cleanUrl : "https://" + cleanUrl).hostname.replace("www.", "") : "your store";
          await queueLeadNurture(lead.id, cleanEmail, {
            store_url: cleanUrl,
            store_name: storeName,
            score: String(cleanScore),
            score_color: scoreColor(cleanScore),
            unsubscribe_url: "https://cartparse.com/unsubscribe",
          });
        }
      }
    } catch { /* nurture queue failed, not critical */ }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }
}
