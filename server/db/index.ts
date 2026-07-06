import Database from "better-sqlite3";
import * as fs from "fs";
import * as path from "path";
import bcrypt from "bcryptjs";

const DB_PATH = process.env.TCGEN_DB_PATH || path.resolve(process.cwd(), "tcgen.db");

export type Role = "admin" | "generator";

export interface UserRow {
  id: number;
  email: string;
  password_hash: string;
  name: string;
  role: Role;
  created_at: string;
}

export interface ModuleContextRow {
  id: number;
  name: string;
  description: string;
  context_text: string;
  created_by: number;
  created_at: string;
}

export interface RunRow {
  id: number;
  title: string;
  user_id: number;
  module_context_id: number | null;
  brd_filename: string | null;
  brd_text: string | null;
  scope: string;
  status: string;
  avg_score: number | null;
  test_case_count: number;
  error: string | null;
  created_at: string;
}

export interface TestCaseRow {
  id: number;
  run_id: number;
  skill_id: string | null;
  test_name: string;
  code: string;
  steps: string;
  assertions: string;
  tags: string;
  priority: string;
  score: number | null;
}

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','generator')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS module_contexts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  context_text TEXT NOT NULL,
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  user_id INTEGER NOT NULL REFERENCES users(id),
  module_context_id INTEGER REFERENCES module_contexts(id),
  brd_filename TEXT,
  brd_text TEXT,
  scope TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'completed',
  avg_score REAL,
  test_case_count INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS test_cases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id INTEGER NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  skill_id TEXT,
  test_name TEXT NOT NULL,
  code TEXT NOT NULL,
  steps TEXT NOT NULL DEFAULT '[]',
  assertions TEXT NOT NULL DEFAULT '[]',
  tags TEXT NOT NULL DEFAULT '[]',
  priority TEXT NOT NULL DEFAULT 'medium',
  score REAL
);
`);

/** Create the seed admin from env if no users exist yet. */
export function seedAdmin(): void {
  const count = (db.prepare("SELECT COUNT(*) AS n FROM users").get() as { n: number }).n;
  if (count > 0) return;

  const email = process.env.ADMIN_EMAIL || "admin@example.com";
  const password = process.env.ADMIN_PASSWORD || "admin123";
  const name = process.env.ADMIN_NAME || "Administrator";
  const hash = bcrypt.hashSync(password, 10);
  db.prepare(
    "INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, 'admin')"
  ).run(email.toLowerCase(), hash, name);
  console.log(`Seeded admin user: ${email} (change the password after first login)`);
}

export default db;
