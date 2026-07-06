import express from "express";
import cors from "cors";
import * as fs from "fs";
import * as path from "path";

// Load .env before anything reads process.env.
loadDotEnv();

import { seedAdmin } from "./db";
import authRoutes from "./routes/auth";
import userRoutes from "./routes/users";
import moduleContextRoutes from "./routes/moduleContexts";
import brdRoutes from "./routes/brd";
import runRoutes from "./routes/runs";

const app = express();
app.use(cors());
app.use(express.json({ limit: "20mb" }));

app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/module-contexts", moduleContextRoutes);
app.use("/api/brd", brdRoutes);
app.use("/api/runs", runRoutes);

// Serve the built frontend if present (production single-server mode).
const webDist = path.resolve(process.cwd(), "dist-web");
if (fs.existsSync(webDist)) {
  app.use(express.static(webDist));
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(webDist, "index.html"));
  });
}

seedAdmin();

const PORT = Number(process.env.PORT || 3001);
app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
});

function loadDotEnv(): void {
  const envPath = path.resolve(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    // Fill the value when it is missing OR present but empty (an empty
    // exported var should not shadow the .env file).
    if (key && !process.env[key]) process.env[key] = value;
  }
}
