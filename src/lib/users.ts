import { query, queryOne } from "./db";
import type { Plan } from "./config";

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  stripeCustomerId?: string;
  plan?: Plan;
  subscriptionId?: string;
  subscriptionStatus?: string;
  isAdmin: boolean;
  createdAt: string;
}

export interface StoredScan {
  userId: string;
  url: string;
  score: number;
  grade: string;
  resultJson: string;
  scannedAt: string;
}

interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  stripe_customer_id: string | null;
  plan: string | null;
  subscription_id: string | null;
  subscription_status: string | null;
  is_admin: boolean;
  created_at: string;
}

function rowToUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    stripeCustomerId: row.stripe_customer_id || undefined,
    plan: (row.plan as Plan) || undefined,
    subscriptionId: row.subscription_id || undefined,
    subscriptionStatus: row.subscription_status || undefined,
    isAdmin: row.is_admin || false,
    createdAt: row.created_at,
  };
}

export async function findUserByEmail(email: string): Promise<User | null> {
  const row = await queryOne<UserRow>("SELECT * FROM users WHERE email = $1", [email.toLowerCase()]);
  return row ? rowToUser(row) : null;
}

export async function findUserById(id: string): Promise<User | null> {
  const row = await queryOne<UserRow>("SELECT * FROM users WHERE id = $1", [id]);
  return row ? rowToUser(row) : null;
}

export async function findUserByStripeCustomer(customerId: string): Promise<User | null> {
  const row = await queryOne<UserRow>("SELECT * FROM users WHERE stripe_customer_id = $1", [customerId]);
  return row ? rowToUser(row) : null;
}

export async function createUser(email: string, passwordHash: string): Promise<User> {
  const id = crypto.randomUUID();
  await query(
    "INSERT INTO users (id, email, password_hash) VALUES ($1, $2, $3)",
    [id, email.toLowerCase(), passwordHash]
  );
  const user = await findUserById(id);
  return user!;
}

export async function updateUser(id: string, updates: Partial<User>): Promise<User | null> {
  const sets: string[] = [];
  const vals: unknown[] = [];
  let idx = 1;

  if (updates.stripeCustomerId !== undefined) { sets.push(`stripe_customer_id = $${idx++}`); vals.push(updates.stripeCustomerId || null); }
  if (updates.plan !== undefined) { sets.push(`plan = $${idx++}`); vals.push(updates.plan || null); }
  if (updates.subscriptionId !== undefined) { sets.push(`subscription_id = $${idx++}`); vals.push(updates.subscriptionId || null); }
  if (updates.subscriptionStatus !== undefined) { sets.push(`subscription_status = $${idx++}`); vals.push(updates.subscriptionStatus || null); }

  if (sets.length === 0) return findUserById(id);

  vals.push(id);
  await query(`UPDATE users SET ${sets.join(", ")} WHERE id = $${idx}`, vals);
  return findUserById(id);
}

// Scans
export async function saveScan(scan: StoredScan) {
  await query(
    "INSERT INTO scans (user_id, url, score, grade, result_json, scanned_at) VALUES ($1, $2, $3, $4, $5, $6)",
    [scan.userId, scan.url, scan.score, scan.grade, scan.resultJson, scan.scannedAt]
  );
}

export async function getUserScans(userId: string): Promise<StoredScan[]> {
  const rows = await query<{ user_id: string; url: string; score: number; grade: string; result_json: string; scanned_at: string }>(
    "SELECT user_id, url, score, grade, result_json, scanned_at FROM scans WHERE user_id = $1 ORDER BY scanned_at DESC LIMIT 100",
    [userId]
  );
  return rows.map((r) => ({
    userId: r.user_id,
    url: r.url,
    score: r.score,
    grade: r.grade,
    resultJson: r.result_json,
    scannedAt: r.scanned_at,
  }));
}

// Leads
export async function saveLead(email: string, scannedUrl: string, score: number) {
  await query(
    "INSERT INTO leads (email, scanned_url, score) VALUES ($1, $2, $3)",
    [email.toLowerCase(), scannedUrl, score]
  );
}

// ─── Admin Queries ───

export async function getAllUsers(): Promise<User[]> {
  const rows = await query<UserRow>("SELECT * FROM users ORDER BY created_at DESC");
  return rows.map(rowToUser);
}

export async function getAdminStats(): Promise<{
  totalUsers: number;
  activeSubscriptions: number;
  totalScans: number;
  totalLeads: number;
  revenueByPlan: { plan: string; count: number }[];
  recentSignups: User[];
  scansByDay: { date: string; count: number }[];
}> {
  const [userCount] = await query<{ count: string }>("SELECT COUNT(*) as count FROM users");
  const [activeCount] = await query<{ count: string }>("SELECT COUNT(*) as count FROM users WHERE subscription_status = 'active' OR subscription_status = 'trialing'");
  const [scanCount] = await query<{ count: string }>("SELECT COUNT(*) as count FROM scans");
  const [leadCount] = await query<{ count: string }>("SELECT COUNT(*) as count FROM leads");

  const revenueByPlan = await query<{ plan: string; count: string }>(
    "SELECT COALESCE(plan, 'free') as plan, COUNT(*) as count FROM users WHERE subscription_status = 'active' GROUP BY plan"
  );

  const recentRows = await query<UserRow>("SELECT * FROM users ORDER BY created_at DESC LIMIT 10");

  const scansByDay = await query<{ date: string; count: string }>(
    "SELECT DATE(scanned_at) as date, COUNT(*) as count FROM scans WHERE scanned_at > NOW() - INTERVAL '30 days' GROUP BY DATE(scanned_at) ORDER BY date"
  );

  return {
    totalUsers: parseInt(userCount.count),
    activeSubscriptions: parseInt(activeCount.count),
    totalScans: parseInt(scanCount.count),
    totalLeads: parseInt(leadCount.count),
    revenueByPlan: revenueByPlan.map(r => ({ plan: r.plan, count: parseInt(r.count) })),
    recentSignups: recentRows.map(rowToUser),
    scansByDay: scansByDay.map(r => ({ date: r.date, count: parseInt(r.count) })),
  };
}

export async function adminUpdateUser(id: string, updates: { plan?: string; subscriptionStatus?: string; isAdmin?: boolean }): Promise<User | null> {
  const sets: string[] = [];
  const vals: unknown[] = [];
  let idx = 1;

  if (updates.plan !== undefined) { sets.push(`plan = $${idx++}`); vals.push(updates.plan || null); }
  if (updates.subscriptionStatus !== undefined) { sets.push(`subscription_status = $${idx++}`); vals.push(updates.subscriptionStatus || null); }
  if (updates.isAdmin !== undefined) { sets.push(`is_admin = $${idx++}`); vals.push(updates.isAdmin); }

  if (sets.length === 0) return findUserById(id);
  vals.push(id);
  await query(`UPDATE users SET ${sets.join(", ")} WHERE id = $${idx}`, vals);
  return findUserById(id);
}

export async function getAllLeads(): Promise<{ email: string; scannedUrl: string; score: number; submittedAt: string }[]> {
  const rows = await query<{ email: string; scanned_url: string; score: number; submitted_at: string }>(
    "SELECT email, scanned_url, score, submitted_at FROM leads ORDER BY submitted_at DESC LIMIT 200"
  );
  return rows.map(r => ({ email: r.email, scannedUrl: r.scanned_url, score: r.score, submittedAt: r.submitted_at }));
}

export async function getAllScans(): Promise<{ userId: string; url: string; score: number; grade: string; scannedAt: string }[]> {
  const rows = await query<{ user_id: string; url: string; score: number; grade: string; scanned_at: string }>(
    "SELECT user_id, url, score, grade, scanned_at FROM scans ORDER BY scanned_at DESC LIMIT 200"
  );
  return rows.map(r => ({ userId: r.user_id, url: r.url, score: r.score, grade: r.grade, scannedAt: r.scanned_at }));
}
