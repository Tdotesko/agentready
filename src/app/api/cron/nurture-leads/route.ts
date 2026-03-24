import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { queueLeadNurture, scoreColor } from "@/lib/email-sequences";

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret") || req.nextUrl.searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Find leads from the last 7 days that haven't been nurtured yet
    const leads = await query<{ id: number; email: string; scanned_url: string; score: number; submitted_at: string }>(
      `SELECT l.id, l.email, l.scanned_url, l.score, l.submitted_at
       FROM leads l
       WHERE l.submitted_at > NOW() - INTERVAL '7 days'
       AND NOT EXISTS (SELECT 1 FROM email_queue eq WHERE eq.lead_id = l.id)
       AND NOT EXISTS (SELECT 1 FROM users u WHERE u.email = l.email AND (u.subscription_status = 'active' OR u.subscription_status = 'trialing'))
       LIMIT 50`
    );

    let queued = 0;
    for (const lead of leads) {
      const storeName = lead.scanned_url ? new URL(lead.scanned_url.startsWith("http") ? lead.scanned_url : "https://" + lead.scanned_url).hostname.replace("www.", "") : "your store";

      await queueLeadNurture(lead.id, lead.email, {
        store_url: lead.scanned_url || "",
        store_name: storeName,
        score: String(lead.score || 0),
        score_color: scoreColor(lead.score || 0),
        unsubscribe_url: "https://cartparse.com/unsubscribe",
      });
      queued++;
    }

    return NextResponse.json({ ok: true, leadsProcessed: leads.length, emailsQueued: queued });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
