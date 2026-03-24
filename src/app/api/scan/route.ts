import { NextRequest, NextResponse } from "next/server";
import { scanStore } from "@/lib/scanner";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";

  const { allowed, remaining, resetAt } = checkRateLimit(ip);

  if (!allowed) {
    return NextResponse.json(
      { error: "Too many scans. Please wait a minute and try again." },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil((resetAt - Date.now()) / 1000)),
          "X-RateLimit-Remaining": "0",
        },
      }
    );
  }

  try {
    const contentLength = request.headers.get("content-length");
    if (contentLength && parseInt(contentLength) > 1024) {
      return NextResponse.json(
        { error: "Request too large" },
        { status: 413 }
      );
    }

    const body = await request.json();
    const { url } = body;

    if (!url || typeof url !== "string" || url.length > 2048) {
      return NextResponse.json(
        { error: "Please provide a valid store URL" },
        { status: 400 }
      );
    }

    const result = await scanStore(url);

    return NextResponse.json(result, {
      headers: {
        "X-RateLimit-Remaining": String(remaining),
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to scan store";

    if (message.includes("abort") || message.includes("timeout")) {
      return NextResponse.json(
        { error: "The store took too long to respond. Please try again." },
        { status: 504 }
      );
    }

    if (
      message.includes("cannot be scanned") ||
      message.includes("not allowed") ||
      message.includes("Invalid URL") ||
      message.includes("public domain")
    ) {
      return NextResponse.json({ error: message }, { status: 400 });
    }

    return NextResponse.json(
      { error: `Could not scan this URL: ${message}` },
      { status: 500 }
    );
  }
}
