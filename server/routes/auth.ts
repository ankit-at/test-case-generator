import { Router } from "express";
import rateLimit from "express-rate-limit";
import db, { UserRow } from "../db";
import {
  verifyPassword,
  issueToken,
  requireAuth,
  AuthedRequest,
} from "../auth";

const router = Router();

// Throttle credential guessing: max 10 login attempts per IP per 15 minutes.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts. Try again later." },
});

router.post("/login", loginLimiter, (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required." });
  }
  const user = db
    .prepare("SELECT * FROM users WHERE email = ?")
    .get(String(email).toLowerCase()) as UserRow | undefined;

  if (!user || !verifyPassword(String(password), user.password_hash)) {
    return res.status(401).json({ error: "Invalid email or password." });
  }

  const token = issueToken(user);
  return res.json({
    token,
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
  });
});

router.get("/me", requireAuth, (req: AuthedRequest, res) => {
  return res.json({ user: req.user });
});

export default router;
