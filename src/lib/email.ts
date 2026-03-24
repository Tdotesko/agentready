import { Resend } from "resend";

const FROM_EMAIL = process.env.EMAIL_FROM || "onboarding@resend.dev";
const FROM_NAME = process.env.EMAIL_FROM_NAME || "CartParse";

let resend: Resend | null = null;
function getClient(): Resend | null {
  if (resend) return resend;
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  resend = new Resend(key);
  return resend;
}

export async function sendEmail(to: string, subject: string, html: string): Promise<string | null> {
  const client = getClient();
  if (!client) {
    console.log(`[EMAIL SKIPPED] No Resend key. Would send to ${to}: ${subject}`);
    return null;
  }

  try {
    const { data, error } = await client.emails.send({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to,
      subject,
      html,
    });
    if (error) { console.error("[EMAIL ERROR]", error); return null; }
    return data?.id || null;
  } catch (err) {
    console.error("[EMAIL ERROR]", err);
    return null;
  }
}

export function renderTemplate(template: string, vars: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
  }
  return result;
}

/* ── Email Templates ── */

export const TEMPLATES = {
  coldOutreach1: {
    subject: "Your {{store_name}} store scored {{score}}/100 on AI agent readiness",
    html: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;color:#333">
<p>Hi there,</p>
<p>I ran a quick scan on <strong>{{store_name}}</strong> to check how well AI shopping agents can interact with your store.</p>
<p style="font-size:36px;font-weight:700;color:{{score_color}};margin:20px 0">{{score}}/100</p>
<p>AI agents from Google, OpenAI, and Visa are starting to shop on behalf of real customers. Stores that aren't set up for this will lose sales to the ones that are.</p>
<p>Here's what we found:</p>
<ul style="line-height:1.8">
{{findings_list}}
</ul>
<p><a href="https://cartparse.com" style="display:inline-block;padding:12px 24px;background:#e8a443;color:#000;text-decoration:none;border-radius:8px;font-weight:600">See your full report</a></p>
<p style="color:#999;font-size:12px;margin-top:30px">You're receiving this because we scanned {{store_url}}. <a href="{{unsubscribe_url}}" style="color:#999">Unsubscribe</a></p>
</div>`,
  },
  coldOutreach2: {
    subject: "3 things AI agents can't find on {{store_name}}",
    html: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;color:#333">
<p>Quick follow-up about {{store_name}}.</p>
<p>When AI shopping agents visit your store, here are 3 things they can't see:</p>
<ol style="line-height:2">
<li><strong>No structured product data</strong> - agents can't read your product names, prices, or availability</li>
<li><strong>Missing price meta tags</strong> - agents can't compare your prices with competitors</li>
<li><strong>No availability signals</strong> - agents don't know what's in stock</li>
</ol>
<p>These are all fixable. We provide the exact code you need to paste into your {{platform}} store.</p>
<p><a href="https://cartparse.com/signup?plan=growth" style="display:inline-block;padding:12px 24px;background:#e8a443;color:#000;text-decoration:none;border-radius:8px;font-weight:600">Get your fix code</a></p>
<p style="color:#999;font-size:12px;margin-top:30px"><a href="{{unsubscribe_url}}" style="color:#999">Unsubscribe</a></p>
</div>`,
  },
  coldOutreach3: {
    subject: "Your competitors are already optimizing for AI agents",
    html: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;color:#333">
<p>Last email about this.</p>
<p>Over 40% of the latest Y Combinator batch is building infrastructure for AI shopping agents. Google launched the Universal Commerce Protocol with Shopify, Etsy, Target, and Walmart.</p>
<p>The stores that show up when AI agents shop will get the sales. The ones that don't, won't.</p>
<p>Your store scored <strong>{{score}}/100</strong>. That puts you behind most of your competitors.</p>
<p>We can show you exactly what to fix and give you the code to do it.</p>
<p><a href="https://cartparse.com/signup?plan=growth" style="display:inline-block;padding:12px 24px;background:#e8a443;color:#000;text-decoration:none;border-radius:8px;font-weight:600">Fix your store now</a></p>
<p style="color:#999;font-size:12px;margin-top:30px"><a href="{{unsubscribe_url}}" style="color:#999">Unsubscribe</a></p>
</div>`,
  },
  leadNurture1: {
    subject: "Your free scan results for {{store_url}}",
    html: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;color:#333">
<p>Thanks for scanning your store with CartParse.</p>
<p>Your store scored <strong style="font-size:24px;color:{{score_color}}">{{score}}/100</strong> on AI agent readiness.</p>
<p>Want to see the full breakdown with specific fixes and copy-paste code for your platform?</p>
<p><a href="https://cartparse.com/signup?plan=growth" style="display:inline-block;padding:12px 24px;background:#e8a443;color:#000;text-decoration:none;border-radius:8px;font-weight:600">Unlock your full report</a></p>
<p style="color:#999;font-size:12px;margin-top:30px"><a href="{{unsubscribe_url}}" style="color:#999">Unsubscribe</a></p>
</div>`,
  },
  leadNurture2: {
    subject: "Here's what to fix first on {{store_name}}",
    html: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;color:#333">
<p>You scanned {{store_url}} yesterday and scored {{score}}/100.</p>
<p>The #1 thing you should fix first: <strong>add structured product data (JSON-LD)</strong>. This is what AI agents use to understand your products, prices, and availability.</p>
<p>Our paid plans give you the exact code to paste into your store, tailored to your platform. Most fixes take under an hour.</p>
<p><a href="https://cartparse.com/signup?plan=growth" style="display:inline-block;padding:12px 24px;background:#e8a443;color:#000;text-decoration:none;border-radius:8px;font-weight:600">Get your fix code ($49/mo)</a></p>
<p style="color:#999;font-size:12px;margin-top:30px"><a href="{{unsubscribe_url}}" style="color:#999">Unsubscribe</a></p>
</div>`,
  },
  leadNurture3: {
    subject: "Last chance: your AI readiness report is ready",
    html: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;color:#333">
<p>Your {{store_name}} scan results are still waiting for you.</p>
<p>Score: <strong style="color:{{score_color}}">{{score}}/100</strong></p>
<p>AI shopping agents are already live. Visa predicts millions of consumers will use them by the end of 2026. Stores that aren't machine-readable will get skipped.</p>
<p>Your full report includes every issue found, priority-ranked fixes, and the exact code to implement them.</p>
<p><a href="https://cartparse.com/signup?plan=growth" style="display:inline-block;padding:12px 24px;background:#e8a443;color:#000;text-decoration:none;border-radius:8px;font-weight:600">See your full report</a></p>
<p style="color:#999;font-size:12px;margin-top:30px"><a href="{{unsubscribe_url}}" style="color:#999">Unsubscribe</a></p>
</div>`,
  },
};

export function scoreColor(score: number): string {
  if (score >= 75) return "#16a34a";
  if (score >= 45) return "#ca8a04";
  return "#dc2626";
}
