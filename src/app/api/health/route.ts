import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";

let dbInitialized = false;

export async function GET() {
  if (!dbInitialized) {
    try {
      await initDb();
      dbInitialized = true;
    } catch {
      return NextResponse.json(
        { status: "error", message: "Service temporarily unavailable" },
        { status: 503 }
      );
    }
  }

  return NextResponse.json(
    { status: "ok", timestamp: new Date().toISOString() },
    { status: 200 }
  );
}
