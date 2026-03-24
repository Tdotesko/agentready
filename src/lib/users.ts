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
