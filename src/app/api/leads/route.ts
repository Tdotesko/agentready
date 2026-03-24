import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import fs from "fs/promises";
import path from "path";

const LEADS_FILE = path.join(process.cwd(), "data", "leads.json");

interface Lead {
  email: string;
  scannedUrl: string;
  score: number;
  submittedAt: string;
}

async function appendLead(lead: Lead) {
  const dir = path.dirname(LEADS_FILE);
  await fs.mkdir(dir, { recursive: true });

  let leads: Lead[] = [];
  try {
    const data = await fs.readFile(LEADS_FILE, "utf-8");
    leads = JSON.parse(data);
  } catch {
    // File doesn't exist yet
  }

  leads.push(lead);
  await fs.writeFile(LEADS_FILE, JSON.stringify(leads, null, 2));
}

export async function POST(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";

  const { allowed } = checkRateLimit(`lead-${ip}`);
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429 }
    );
  }

  try {
    const body = await request.json();
    const { email, scannedUrl, score } = body;

    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { error: "Valid email required" },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email) || email.length > 320) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    await appendLead({
      email: email.toLowerCase().trim(),
      scannedUrl: typeof scannedUrl === "string" ? scannedUrl.slice(0, 2048) : "",
      score: typeof score === "number" ? score : 0,
      submittedAt: new Date().toISOString(),
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to save" },
      { status: 500 }
    );
  }
}
