import { NextRequest, NextResponse } from "next/server";
import { scanStore } from "@/lib/scanner";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url } = body;

    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { error: "Please provide a valid store URL" },
        { status: 400 }
      );
    }

    // Basic URL validation
    const cleaned = url.trim();
    if (cleaned.length < 4 || cleaned.includes(" ")) {
      return NextResponse.json(
        { error: "Please provide a valid store URL" },
        { status: 400 }
      );
    }

    const result = await scanStore(cleaned);
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to scan store";

    if (message.includes("abort") || message.includes("timeout")) {
      return NextResponse.json(
        { error: "The store took too long to respond. Please try again." },
        { status: 504 }
      );
    }

    return NextResponse.json(
      { error: `Could not scan this URL: ${message}` },
      { status: 500 }
    );
  }
}
