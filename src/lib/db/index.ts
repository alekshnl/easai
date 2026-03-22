import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import { createClient, type Client } from "@libsql/client";
import * as schema from "./schema";
import path from "path";
import fs from "fs";

// Lazy singleton — only created on first access (never during build)
let _client: Client | null = null;
let _db: LibSQLDatabase<typeof schema> | null = null;

function getDataDir() {
  return path.join(process.cwd(), "data");
}

function getDbPath() {
  return path.join(getDataDir(), "easai.db");
}

function ensureDataDir() {
  const dataDir = getDataDir();
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

function getClient(): Client {
  if (!_client) {
    ensureDataDir();
    _client = createClient({ url: `file:${getDbPath()}` });
  }
  return _client;
}

export function getDb(): LibSQLDatabase<typeof schema> {
  if (!_db) {
    _db = drizzle(getClient(), { schema });
  }
  return _db;
}

// Convenience export — resolved lazily at call time via Proxy
export const db = new Proxy({} as LibSQLDatabase<typeof schema>, {
  get(_target, prop) {
    const instance = getDb();
    const value = (instance as unknown as Record<string | symbol, unknown>)[prop];
    return typeof value === "function" ? value.bind(instance) : value;
  },
});

export async function initializeDatabase() {
  ensureDataDir();
  const client = getClient();

  await client.executeMultiple(`
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 5000;

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      workspace_folder TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      provider TEXT NOT NULL,
      auth_type TEXT NOT NULL,
      access_token TEXT,
      refresh_token TEXT,
      id_token TEXT,
      api_key TEXT,
      plan_type TEXT,
      token_expires_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL DEFAULT 'New Chat',
      project_id TEXT,
      account_id TEXT,
      model TEXT,
      reasoning_effort TEXT DEFAULT 'medium',
      workspace_folder TEXT,
      archived INTEGER DEFAULT 0,
      message_count INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      model TEXT,
      account_id TEXT,
      metadata TEXT DEFAULT '{}',
      created_at INTEGER NOT NULL,
      finished_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      account_id TEXT NOT NULL,
      model TEXT NOT NULL,
      reasoning_effort TEXT NOT NULL DEFAULT 'medium',
      mode TEXT NOT NULL DEFAULT 'build',
      status TEXT NOT NULL DEFAULT 'pending',
      user_message_id TEXT NOT NULL,
      assistant_message_id TEXT NOT NULL,
      history_snapshot TEXT NOT NULL,
      cancel_requested_at INTEGER,
      queued_at INTEGER NOT NULL,
      started_at INTEGER,
      finished_at INTEGER,
      failed_at INTEGER,
      cancelled_at INTEGER,
      error TEXT,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS job_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id TEXT NOT NULL,
      session_id TEXT NOT NULL,
      message_id TEXT NOT NULL,
      type TEXT NOT NULL,
      payload TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_jobs_session_status_queued ON jobs(session_id, status, queued_at);
    CREATE INDEX IF NOT EXISTS idx_job_events_session_id ON job_events(session_id, id);
    CREATE INDEX IF NOT EXISTS idx_job_events_job_id ON job_events(job_id, id);
  `);
}
