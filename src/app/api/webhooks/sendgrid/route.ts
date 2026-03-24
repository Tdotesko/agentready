import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

// Email event webhook - handles both Resend and SendGrid formats
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const events = Array.isArray(body) ? body : [body];

    for (const event of events) {
      let messageId: string | null = null;
      let status: string | null = null;

      // Resend format
      if (event.type && event.data?.email_id) {
        messageId = event.data.email_id;
        switch (event.type) {
          case "email.delivered": status = "delivered"; break;
          case "email.opened": status = "opened"; break;
          case "email.clicked": status = "clicked"; break;
          case "email.bounced": status = "bounced"; break;
          case "email.complained": status = "spam"; break;
        }
      }

      // SendGrid format (fallback)
      if (!messageId && event.sg_message_id) {
        messageId = event.sg_message_id.split(".")[0];
        switch (event.event) {
          case "delivered": status = "delivered"; break;
          case "open": status = "opened"; break;
          case "click": status = "clicked"; break;
          case "bounce": case "dropped": status = "bounced"; break;
          case "spamreport": status = "spam"; break;
        }
      }

      if (messageId && status) {
        await query("UPDATE email_log SET status = $1 WHERE sendgrid_message_id = $2", [status, messageId]);
      }
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
