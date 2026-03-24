import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";

let dbInitialized = false;

export async function GET() {
  if (!dbInitialized) {
    try {
      await initDb();
      dbInitialized = true;
    } catch (err) {
      return NextResponse.json(
        { status: "error", error: "Database not ready", detail: String(err) },
        { status: 503 }
      );
    }
  }

  return NextResponse.json(
    { status: "ok", db: "connected", timestamp: new Date().toISOString() },
    { status: 200 }
  );
}
