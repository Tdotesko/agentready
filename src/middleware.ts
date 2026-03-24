import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const ALLOWED_ORIGINS = new Set([
  "https://agentready-production-5931.up.railway.app",
  "https://agentready.dev",
  "http://localhost:3000",
]);

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Security headers
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");

  // CORS for API routes - only allow known origins
  if (request.nextUrl.pathname.startsWith("/api/")) {
    const origin = request.headers.get("origin") || "";
    if (ALLOWED_ORIGINS.has(origin)) {
      response.headers.set("Access-Control-Allow-Origin", origin);
    }
    response.headers.set("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type");

    // Handle preflight
    if (request.method === "OPTIONS") {
      return new NextResponse(null, { status: 204, headers: response.headers });
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
