import { NextRequest, NextResponse } from "next/server";
import { queryOne } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ url: string }> }) {
  const { url } = await params;
  const decoded = decodeURIComponent(url);

  // Find most recent scan for this URL
  const scan = await queryOne<{ score: number; grade: string }>(
    "SELECT score, grade FROM scans WHERE url LIKE $1 ORDER BY scanned_at DESC LIMIT 1",
    [`%${decoded}%`]
  );

  const score = scan?.score ?? 0;
  const grade = scan?.grade ?? "?";
  const color = score >= 75 ? "#16a34a" : score >= 45 ? "#ca8a04" : "#dc2626";

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="28" viewBox="0 0 180 28">
  <rect width="180" height="28" rx="6" fill="#1a1a2e"/>
  <rect x="1" y="1" width="178" height="26" rx="5" fill="#12151c" stroke="#333" stroke-width="0.5"/>
  <text x="10" y="18" font-family="system-ui,sans-serif" font-size="11" fill="#888" font-weight="500">CartParse Score</text>
  <rect x="120" y="4" width="52" height="20" rx="4" fill="${color}20"/>
  <text x="146" y="18" font-family="system-ui,monospace" font-size="12" fill="${color}" font-weight="700" text-anchor="middle">${score} ${grade}</text>
</svg>`;

  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
