import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { deepScan } from "@/lib/deep-scanner";
import { saveScan, findUserById } from "@/lib/users";
import { sendEmail, scoreColor } from "@/lib/email";

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret") || req.nextUrl.searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Find stores due for rescan
    const stores = await query<{ id: number; user_id: string; url: string; name: string; last_score: number | null; rescan_interval: string; last_rescan_at: string | null }>(
      `SELECT * FROM stores WHERE auto_rescan = TRUE AND (
        (rescan_interval = 'daily' AND (last_rescan_at IS NULL OR last_rescan_at < NOW() - INTERVAL '1 day'))
        OR (rescan_interval = 'weekly' AND (last_rescan_at IS NULL OR last_rescan_at < NOW() - INTERVAL '7 days'))
      ) LIMIT 10`
    );

    let scanned = 0, alerts = 0;

    for (const store of stores) {
      try {
        const result = await deepScan(store.url);
        const oldScore = store.last_score;
        const newScore = result.overallScore;

        // Save scan
        await saveScan({
          userId: store.user_id,
          url: result.rootUrl,
          score: newScore,
          grade: result.grade,
          resultJson: JSON.stringify(result),
          scannedAt: result.scannedAt,
        });

        // Update store
        await query("UPDATE stores SET last_rescan_at = NOW(), last_score = $1 WHERE id = $2", [newScore, store.id]);
        scanned++;

        // Send alert if score changed significantly
        if (oldScore !== null && Math.abs(newScore - oldScore) >= 5) {
          const user = await findUserById(store.user_id);
          if (user) {
            const direction = newScore > oldScore ? "improved" : "dropped";
            const diff = Math.abs(newScore - oldScore);
            const color = newScore > oldScore ? scoreColor(newScore) : "#dc2626";

            await sendEmail(user.email, `Your ${store.name || store.url} score ${direction} by ${diff} points`, `
              <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:500px;margin:0 auto;color:#333">
                <h2 style="color:${color};margin:0 0 16px">Score ${direction}: ${oldScore} &rarr; ${newScore}</h2>
                <p>Your store <strong>${store.name || store.url}</strong> was rescanned and the AI agent readiness score ${direction} from <strong>${oldScore}</strong> to <strong style="color:${color}">${newScore}/100</strong>.</p>
                <p style="margin:20px 0"><a href="${process.env.NEXT_PUBLIC_APP_URL || "https://cartparse.com"}/dashboard" style="display:inline-block;padding:12px 24px;background:#e8a443;color:#000;text-decoration:none;border-radius:8px;font-weight:600">View full report</a></p>
              </div>
            `);
            alerts++;
          }
        }
      } catch { /* individual store scan failed, continue */ }
    }

    return NextResponse.json({ ok: true, scanned, alerts, storesChecked: stores.length });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
