import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  statement_timeout: 15000,
});

let initialized = false;
let initPromise: Promise<void> | null = null;

async function ensureInit() {
  if (initialized) return;
  // Use a single promise to prevent concurrent initialization
  if (!initPromise) {
    initPromise = initDb().then(() => { initialized = true; }).catch((err) => { initPromise = null; throw err; });
  }
  await initPromise;
}

export async function query<T = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<T[]> {
  await ensureInit();
  const result = await pool.query(text, params);
  return result.rows as T[];
}

export async function queryOne<T = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<T | null> {
  await ensureInit();
  const result = await pool.query(text, params);
  return (result.rows[0] as T) || null;
}

export async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      stripe_customer_id TEXT,
      plan TEXT,
      subscription_id TEXT,
      subscription_status TEXT,
      is_admin BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS scans (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      url TEXT NOT NULL,
      score INTEGER NOT NULL,
      grade TEXT NOT NULL,
      result_json TEXT NOT NULL,
      scanned_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS leads (
      id SERIAL PRIMARY KEY,
      email TEXT NOT NULL,
      scanned_url TEXT,
      score INTEGER,
      submitted_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_stripe ON users(stripe_customer_id);
    CREATE INDEX IF NOT EXISTS idx_scans_user ON scans(user_id);

    -- Migrations
    DO $$ BEGIN ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
    DO $$ BEGIN ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
    DO $$ BEGIN ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMPTZ; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
    DO $$ BEGIN ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
    DO $$ BEGIN ALTER TABLE users ADD COLUMN IF NOT EXISTS verify_token TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;

    -- Lead generation tables
    CREATE TABLE IF NOT EXISTS prospects (
      id SERIAL PRIMARY KEY,
      url TEXT NOT NULL UNIQUE,
      email TEXT,
      store_name TEXT,
      platform TEXT,
      score INTEGER,
      grade TEXT,
      status TEXT DEFAULT 'new',
      source TEXT,
      notes TEXT,
      last_contacted_at TIMESTAMPTZ,
      next_followup_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS email_sequences (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      trigger_type TEXT NOT NULL,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS email_steps (
      id SERIAL PRIMARY KEY,
      sequence_id INTEGER REFERENCES email_sequences(id) ON DELETE CASCADE,
      step_order INTEGER NOT NULL,
      delay_hours INTEGER NOT NULL,
      subject TEXT NOT NULL,
      body_html TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS email_log (
      id SERIAL PRIMARY KEY,
      recipient_email TEXT NOT NULL,
      subject TEXT NOT NULL,
      sequence_id INTEGER REFERENCES email_sequences(id),
      step_id INTEGER REFERENCES email_steps(id),
      prospect_id INTEGER REFERENCES prospects(id),
      lead_id INTEGER,
      status TEXT DEFAULT 'sent',
      sendgrid_message_id TEXT,
      sent_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS email_queue (
      id SERIAL PRIMARY KEY,
      recipient_email TEXT NOT NULL,
      subject TEXT NOT NULL,
      body_html TEXT NOT NULL,
      sequence_id INTEGER,
      step_id INTEGER,
      prospect_id INTEGER,
      lead_id INTEGER,
      send_after TIMESTAMPTZ NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_prospects_status ON prospects(status);
    CREATE INDEX IF NOT EXISTS idx_prospects_url ON prospects(url);
    CREATE INDEX IF NOT EXISTS idx_email_queue_pending ON email_queue(status, send_after);
    CREATE INDEX IF NOT EXISTS idx_email_log_recipient ON email_log(recipient_email);
  `);
}
