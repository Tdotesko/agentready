import { query, queryOne } from "./db";
import { findUserById, type User } from "./users";
import crypto from "crypto";

function hashKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}

export async function createApiKey(userId: string, name: string): Promise<{ key: string; prefix: string }> {
  const key = `cp_${crypto.randomBytes(24).toString("hex")}`;
  const prefix = key.slice(0, 10);
  const hash = hashKey(key);

  await query(
    "INSERT INTO api_keys (user_id, key_hash, key_prefix, name) VALUES ($1, $2, $3, $4)",
    [userId, hash, prefix, name]
  );

  return { key, prefix };
}

export async function validateApiKey(key: string): Promise<User | null> {
  const hash = hashKey(key);
  const row = await queryOne<{ user_id: string }>(
    "SELECT user_id FROM api_keys WHERE key_hash = $1",
    [hash]
  );
  if (!row) return null;

  // Update last used
  await query("UPDATE api_keys SET last_used_at = NOW() WHERE key_hash = $1", [hash]);

  return findUserById(row.user_id);
}

export async function getUserApiKeys(userId: string): Promise<{ id: number; keyPrefix: string; name: string; lastUsedAt: string | null; createdAt: string }[]> {
  const rows = await query<{ id: number; key_prefix: string; name: string; last_used_at: string | null; created_at: string }>(
    "SELECT id, key_prefix, name, last_used_at, created_at FROM api_keys WHERE user_id = $1 ORDER BY created_at DESC",
    [userId]
  );
  return rows.map(r => ({ id: r.id, keyPrefix: r.key_prefix, name: r.name || "", lastUsedAt: r.last_used_at, createdAt: r.created_at }));
}

export async function deleteApiKey(userId: string, keyId: number) {
  await query("DELETE FROM api_keys WHERE id = $1 AND user_id = $2", [keyId, userId]);
}
