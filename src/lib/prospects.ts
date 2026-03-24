import { query, queryOne } from "./db";
import { scanStore, safeFetch } from "./scanner";
import { detectPlatform } from "./deep-scanner";
import * as cheerio from "cheerio";

export interface Prospect {
  id: number;
  url: string;
  email: string | null;
  storeName: string | null;
  platform: string | null;
  score: number | null;
  grade: string | null;
  status: string;
  source: string | null;
  notes: string | null;
  lastContactedAt: string | null;
  nextFollowupAt: string | null;
  createdAt: string;
}

interface ProspectRow {
  id: number; url: string; email: string | null; store_name: string | null; platform: string | null;
  score: number | null; grade: string | null; status: string; source: string | null; notes: string | null;
  last_contacted_at: string | null; next_followup_at: string | null; created_at: string;
}

function rowToProspect(r: ProspectRow): Prospect {
  return {
    id: r.id, url: r.url, email: r.email, storeName: r.store_name, platform: r.platform,
    score: r.score, grade: r.grade, status: r.status, source: r.source, notes: r.notes,
    lastContactedAt: r.last_contacted_at, nextFollowupAt: r.next_followup_at, createdAt: r.created_at,
  };
}

/* ── Extract contact email from HTML ── */
function extractContactEmail(html: string, url: string): string | null {
  const $ = cheerio.load(html);

  // Check mailto links
  const mailtoLinks: string[] = [];
  $('a[href^="mailto:"]').each((_, el) => {
    const href = $(el).attr("href") || "";
    const email = href.replace("mailto:", "").split("?")[0].trim().toLowerCase();
    if (email && email.includes("@") && !email.includes("example.com")) mailtoLinks.push(email);
  });
  if (mailtoLinks.length > 0) return mailtoLinks[0];

  // Check common email patterns in text
  const bodyText = $("body").text();
  const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const emails = bodyText.match(emailPattern) || [];
  const filtered = emails.filter(e =>
    !e.includes("example.com") && !e.includes("sentry.io") && !e.includes("schema.org")
    && !e.includes("wixpress") && !e.includes("cloudflare")
  );
  if (filtered.length > 0) return filtered[0].toLowerCase();

  // Try common contact patterns from meta/link tags
  const contactMeta = $('meta[name="author"], meta[property="og:email"]').attr("content");
  if (contactMeta && contactMeta.includes("@")) return contactMeta.toLowerCase();

  return null;
}

/* ── Extract store name ── */
function extractStoreName(html: string, url: string): string {
  const $ = cheerio.load(html);
  const ogSiteName = $('meta[property="og:site_name"]').attr("content");
  if (ogSiteName) return ogSiteName;
  const title = $("title").text().split(/[|–-]/)[0].trim();
  if (title && title.length < 60) return title;
  return new URL(url).hostname.replace("www.", "");
}

/* ── Add a single prospect ── */
export async function addProspect(url: string, source: string = "manual"): Promise<Prospect> {
  // Normalize URL
  let normalized = url.trim();
  if (!normalized.startsWith("http")) normalized = "https://" + normalized;
  try { normalized = new URL(normalized).origin; } catch { /* keep as-is */ }

  // Check if already exists
  const existing = await queryOne<ProspectRow>("SELECT * FROM prospects WHERE url = $1", [normalized]);
  if (existing) return rowToProspect(existing);

  // Auto-scan and extract info
  let score: number | null = null;
  let grade: string | null = null;
  let platform: string | null = null;
  let email: string | null = null;
  let storeName: string | null = null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const { html } = await safeFetch(normalized, controller.signal);
      platform = detectPlatform(html);
      email = extractContactEmail(html, normalized);
      storeName = extractStoreName(html, normalized);
    } finally { clearTimeout(timeout); }

    const result = await scanStore(normalized);
    score = result.overallScore;
    grade = result.grade;
  } catch { /* scan failed, still save prospect */ }

  await query(
    "INSERT INTO prospects (url, email, store_name, platform, score, grade, source) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (url) DO NOTHING",
    [normalized, email, storeName, platform, score, grade, source]
  );

  const row = await queryOne<ProspectRow>("SELECT * FROM prospects WHERE url = $1", [normalized]);
  return rowToProspect(row!);
}

/* ── Bulk import ── */
export async function bulkImportProspects(urls: string[], source: string = "import"): Promise<{ imported: number; skipped: number }> {
  let imported = 0, skipped = 0;
  for (const url of urls.slice(0, 100)) {
    try {
      const existing = await queryOne<{ id: number }>("SELECT id FROM prospects WHERE url LIKE $1", [`%${new URL(url.startsWith("http") ? url : "https://" + url).hostname}%`]);
      if (existing) { skipped++; continue; }
      await addProspect(url, source);
      imported++;
    } catch { skipped++; }
  }
  return { imported, skipped };
}

/* ── Rescan a prospect ── */
export async function rescanProspect(id: number): Promise<Prospect | null> {
  const row = await queryOne<ProspectRow>("SELECT * FROM prospects WHERE id = $1", [id]);
  if (!row) return null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const { html } = await safeFetch(row.url, controller.signal);
      const platform = detectPlatform(html);
      const email = row.email || extractContactEmail(html, row.url);
      const storeName = row.store_name || extractStoreName(html, row.url);
      await query("UPDATE prospects SET platform = $1, email = COALESCE($2, email), store_name = COALESCE($3, store_name) WHERE id = $4", [platform, email, storeName, id]);
    } finally { clearTimeout(timeout); }

    const result = await scanStore(row.url);
    await query("UPDATE prospects SET score = $1, grade = $2 WHERE id = $3", [result.overallScore, result.grade, id]);
  } catch { /* scan failed */ }

  const updated = await queryOne<ProspectRow>("SELECT * FROM prospects WHERE id = $1", [id]);
  return updated ? rowToProspect(updated) : null;
}

/* ── CRUD ── */
export async function getProspects(status?: string): Promise<Prospect[]> {
  const rows = status
    ? await query<ProspectRow>("SELECT * FROM prospects WHERE status = $1 ORDER BY created_at DESC LIMIT 200", [status])
    : await query<ProspectRow>("SELECT * FROM prospects ORDER BY created_at DESC LIMIT 200");
  return rows.map(rowToProspect);
}

export async function updateProspect(id: number, updates: { status?: string; notes?: string; email?: string; nextFollowupAt?: string }): Promise<Prospect | null> {
  const sets: string[] = [];
  const vals: unknown[] = [];
  let idx = 1;
  if (updates.status) { sets.push(`status = $${idx++}`); vals.push(updates.status); }
  if (updates.notes !== undefined) { sets.push(`notes = $${idx++}`); vals.push(updates.notes); }
  if (updates.email) { sets.push(`email = $${idx++}`); vals.push(updates.email); }
  if (updates.nextFollowupAt) { sets.push(`next_followup_at = $${idx++}`); vals.push(updates.nextFollowupAt); }
  if (sets.length === 0) return null;
  vals.push(id);
  await query(`UPDATE prospects SET ${sets.join(", ")} WHERE id = $${idx}`, vals);
  const row = await queryOne<ProspectRow>("SELECT * FROM prospects WHERE id = $1", [id]);
  return row ? rowToProspect(row) : null;
}

export async function getProspectStats(): Promise<{ total: number; byStatus: Record<string, number>; avgScore: number }> {
  const [total] = await query<{ count: string }>("SELECT COUNT(*) as count FROM prospects");
  const statusRows = await query<{ status: string; count: string }>("SELECT status, COUNT(*) as count FROM prospects GROUP BY status");
  const [avg] = await query<{ avg: string }>("SELECT COALESCE(AVG(score), 0) as avg FROM prospects WHERE score IS NOT NULL");
  const byStatus: Record<string, number> = {};
  for (const r of statusRows) byStatus[r.status] = parseInt(r.count);
  return { total: parseInt(total.count), byStatus, avgScore: Math.round(parseFloat(avg.avg)) };
}
