// Must be first: populates process.env from .env before other modules load.
import "./env";

import express from "express";
import cors from "cors";
import helmet from "helmet";
import * as fs from "fs";
import * as path from "path";

import { seedAdmin } from "./db";
import authRoutes from "./routes/auth";
import userRoutes from "./routes/users";
import moduleContextRoutes from "./routes/moduleContexts";
import brdRoutes from "./routes/brd";
import runRoutes from "./routes/runs";

const app = express();

app.use(helmet());

// CORS allowlist (comma-separated origins). Defaults to the local dev UI.
const allowedOrigins = (process.env.CORS_ORIGIN || "http://localhost:5173")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);
app.use(
  cors({
    origin(origin, cb) {
      // Allow same-origin / non-browser clients (no Origin header).
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      return cb(new Error("Origin not allowed by CORS."));
    },
  })
);

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
