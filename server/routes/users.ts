import { Router } from "express";
import db, { UserRow } from "../db";
import {
  requireAuth,
  requireRole,
  hashPassword,
  AuthedRequest,
  MIN_PASSWORD_LENGTH,
} from "../auth";

const router = Router();

// All user management is admin-only.
router.use(requireAuth, requireRole("admin"));

router.get("/", (_req, res) => {
  const rows = db
    .prepare(
      "SELECT id, email, name, role, created_at FROM users ORDER BY created_at DESC"
    )
    .all();
  res.json({ users: rows });
});

router.post("/", (req, res) => {
  const { email, password, name, role } = req.body || {};
  if (!email || !password || !name) {
    return res
      .status(400)
      .json({ error: "email, password and name are required." });
  }
  if (String(password).length < MIN_PASSWORD_LENGTH) {
    return res.status(400).json({
      error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
    });
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(email))) {
    return res.status(400).json({ error: "Invalid email address." });
  }
  const normalizedRole = role === "admin" ? "admin" : "generator";
  const existing = db
    .prepare("SELECT id FROM users WHERE email = ?")
    .get(String(email).toLowerCase());
  if (existing) {
    return res.status(409).json({ error: "A user with that email exists." });
  }
  const info = db
    .prepare(
      "INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, ?)"
    )
    .run(String(email).toLowerCase(), hashPassword(String(password)), name, normalizedRole);
  res.status(201).json({ id: Number(info.lastInsertRowid) });
});

router.delete("/:id", (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  if (id === req.user!.id) {
    return res.status(400).json({ error: "You cannot delete your own account." });
  }
  const user = db.prepare("SELECT id FROM users WHERE id = ?").get(id) as
    | UserRow
    | undefined;
  if (!user) return res.status(404).json({ error: "User not found." });
  db.prepare("DELETE FROM users WHERE id = ?").run(id);
  res.json({ ok: true });
});

export default router;
