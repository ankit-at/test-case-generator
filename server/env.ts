// Loads .env as a side effect on import. This module must be imported FIRST
// (before db/auth/routes) so process.env is populated before those modules
// read it at initialization time.
import * as fs from "fs";
import * as path from "path";

const envPath = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    // Fill when missing OR present but empty (an empty exported var should not
    // shadow the .env file).
    if (key && !process.env[key]) process.env[key] = value;
  }
}
