import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { discoverFromUrlList, discoverFromDirectory, recontactLowScoreProspects } from "@/lib/lead-discovery";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !user.isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const { action, urls, directoryUrl } = await req.json();

  try {
    if (action === "urls" && Array.isArray(urls)) {
      const result = await discoverFromUrlList(urls, "admin-manual");
      return NextResponse.json(result);
    }

    if (action === "directory" && typeof directoryUrl === "string") {
      const result = await discoverFromDirectory(directoryUrl);
      return NextResponse.json(result);
    }

    if (action === "recontact") {
      const result = await recontactLowScoreProspects();
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: "Invalid action. Use: urls, directory, or recontact" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
