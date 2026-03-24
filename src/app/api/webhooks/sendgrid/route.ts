import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

// SendGrid Event Webhook - tracks opens, clicks, bounces
export async function POST(req: NextRequest) {
  try {
    const events = await req.json();
    if (!Array.isArray(events)) return NextResponse.json({ ok: true });

    for (const event of events) {
      const messageId = event.sg_message_id?.split(".")[0];
      if (!messageId) continue;

      let status: string | null = null;
      switch (event.event) {
        case "delivered": status = "delivered"; break;
        case "open": status = "opened"; break;
        case "click": status = "clicked"; break;
        case "bounce": case "dropped": status = "bounced"; break;
        case "spamreport": status = "spam"; break;
        case "unsubscribe": status = "unsubscribed"; break;
      }

      if (status) {
        await query(
          "UPDATE email_log SET status = $1 WHERE sendgrid_message_id = $2",
          [status, messageId]
        );
      }
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true }); // Always return 200 to SendGrid
  }
}
