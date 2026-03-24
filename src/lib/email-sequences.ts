import { query, queryOne } from "./db";
import { sendEmail, renderTemplate, TEMPLATES, scoreColor } from "./email";

/* ── Queue an email ── */
export async function queueEmail(params: {
  recipientEmail: string; subject: string; bodyHtml: string;
  sequenceId?: number; stepId?: number; prospectId?: number; leadId?: number;
  sendAfter?: Date;
}) {
  const sendAfter = params.sendAfter || new Date();
  await query(
    "INSERT INTO email_queue (recipient_email, subject, body_html, sequence_id, step_id, prospect_id, lead_id, send_after) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
    [params.recipientEmail, params.subject, params.bodyHtml, params.sequenceId || null, params.stepId || null, params.prospectId || null, params.leadId || null, sendAfter.toISOString()]
  );
}

/* ── Process pending emails in queue ── */
export async function processEmailQueue(): Promise<{ sent: number; failed: number }> {
  const pending = await query<{ id: number; recipient_email: string; subject: string; body_html: string; sequence_id: number | null; step_id: number | null; prospect_id: number | null; lead_id: number | null }>(
    "SELECT * FROM email_queue WHERE status = 'pending' AND send_after <= NOW() ORDER BY send_after LIMIT 20"
  );

  let sent = 0, failed = 0;

  for (const email of pending) {
    try {
      const messageId = await sendEmail(email.recipient_email, email.subject, email.body_html);

      await query("UPDATE email_queue SET status = 'sent' WHERE id = $1", [email.id]);

      await query(
        "INSERT INTO email_log (recipient_email, subject, sequence_id, step_id, prospect_id, lead_id, status, sendgrid_message_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
        [email.recipient_email, email.subject, email.sequence_id, email.step_id, email.prospect_id, email.lead_id, "sent", messageId]
      );

      // Update prospect last_contacted_at
      if (email.prospect_id) {
        await query("UPDATE prospects SET last_contacted_at = NOW(), status = CASE WHEN status = 'new' THEN 'contacted' ELSE status END WHERE id = $1", [email.prospect_id]);
      }

      sent++;
    } catch {
      failed++;
    }
  }

  return { sent, failed };
}

/* ── Queue cold outreach sequence for a prospect ── */
export async function queueColdOutreach(prospectId: number, email: string, vars: Record<string, string>) {
  const templates = [
    { template: TEMPLATES.coldOutreach1, delayHours: 0 },
    { template: TEMPLATES.coldOutreach2, delayHours: 48 },
    { template: TEMPLATES.coldOutreach3, delayHours: 120 },
  ];

  // Get or create cold outreach sequence
  let seq = await queryOne<{ id: number }>("SELECT id FROM email_sequences WHERE trigger_type = 'prospect_new' LIMIT 1");
  if (!seq) {
    await query("INSERT INTO email_sequences (name, trigger_type) VALUES ($1, $2)", ["Cold Outreach", "prospect_new"]);
    seq = await queryOne<{ id: number }>("SELECT id FROM email_sequences WHERE trigger_type = 'prospect_new' LIMIT 1");
  }

  // Check if already queued
  const existing = await queryOne<{ id: number }>("SELECT id FROM email_queue WHERE prospect_id = $1 AND sequence_id = $2 LIMIT 1", [prospectId, seq!.id]);
  if (existing) return; // Already queued

  for (let i = 0; i < templates.length; i++) {
    const { template, delayHours } = templates[i];
    const sendAfter = new Date(Date.now() + delayHours * 3600000);
    const subject = renderTemplate(template.subject, vars);
    const body = renderTemplate(template.html, vars);

    await queueEmail({
      recipientEmail: email, subject, bodyHtml: body,
      sequenceId: seq!.id, prospectId, sendAfter,
    });
  }
}

/* ── Queue lead nurture sequence ── */
export async function queueLeadNurture(leadId: number, email: string, vars: Record<string, string>) {
  const templates = [
    { template: TEMPLATES.leadNurture1, delayHours: 1 },
    { template: TEMPLATES.leadNurture2, delayHours: 24 },
    { template: TEMPLATES.leadNurture3, delayHours: 72 },
  ];

  let seq = await queryOne<{ id: number }>("SELECT id FROM email_sequences WHERE trigger_type = 'lead_no_signup' LIMIT 1");
  if (!seq) {
    await query("INSERT INTO email_sequences (name, trigger_type) VALUES ($1, $2)", ["Lead Nurture", "lead_no_signup"]);
    seq = await queryOne<{ id: number }>("SELECT id FROM email_sequences WHERE trigger_type = 'lead_no_signup' LIMIT 1");
  }

  const existing = await queryOne<{ id: number }>("SELECT id FROM email_queue WHERE lead_id = $1 AND sequence_id = $2 LIMIT 1", [leadId, seq!.id]);
  if (existing) return;

  for (let i = 0; i < templates.length; i++) {
    const { template, delayHours } = templates[i];
    const sendAfter = new Date(Date.now() + delayHours * 3600000);
    const subject = renderTemplate(template.subject, vars);
    const body = renderTemplate(template.html, vars);

    await queueEmail({
      recipientEmail: email, subject, bodyHtml: body,
      sequenceId: seq!.id, leadId, sendAfter,
    });
  }
}

/* ── Get email stats ── */
export async function getEmailStats() {
  const [queueCount] = await query<{ count: string }>("SELECT COUNT(*) as count FROM email_queue WHERE status = 'pending'");
  const [sentCount] = await query<{ count: string }>("SELECT COUNT(*) as count FROM email_log");
  const [openCount] = await query<{ count: string }>("SELECT COUNT(*) as count FROM email_log WHERE status = 'opened'");
  const [clickCount] = await query<{ count: string }>("SELECT COUNT(*) as count FROM email_log WHERE status = 'clicked'");
  const [bounceCount] = await query<{ count: string }>("SELECT COUNT(*) as count FROM email_log WHERE status = 'bounced'");

  const totalSent = parseInt(sentCount.count);
  return {
    queued: parseInt(queueCount.count),
    sent: totalSent,
    opened: parseInt(openCount.count),
    clicked: parseInt(clickCount.count),
    bounced: parseInt(bounceCount.count),
    openRate: totalSent > 0 ? Math.round((parseInt(openCount.count) / totalSent) * 100) : 0,
    clickRate: totalSent > 0 ? Math.round((parseInt(clickCount.count) / totalSent) * 100) : 0,
  };
}

export async function getEmailQueue() {
  return query<{ id: number; recipient_email: string; subject: string; status: string; send_after: string; prospect_id: number | null; lead_id: number | null }>(
    "SELECT id, recipient_email, subject, status, send_after, prospect_id, lead_id FROM email_queue ORDER BY send_after DESC LIMIT 100"
  );
}

export async function getEmailLog() {
  return query<{ id: number; recipient_email: string; subject: string; status: string; sent_at: string; prospect_id: number | null; lead_id: number | null }>(
    "SELECT id, recipient_email, subject, status, sent_at, prospect_id, lead_id FROM email_log ORDER BY sent_at DESC LIMIT 100"
  );
}

export async function cancelQueuedEmail(id: number) {
  await query("UPDATE email_queue SET status = 'cancelled' WHERE id = $1 AND status = 'pending'", [id]);
}

export { scoreColor };
