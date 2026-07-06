import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import db, { UserRow, Role } from "../db";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const TOKEN_TTL = "12h";

export interface AuthUser {
  id: number;
  email: string;
  name: string;
  role: Role;
}

export interface AuthedRequest extends Request {
  user?: AuthUser;
}

export function verifyPassword(plain: string, hash: string): boolean {
  return bcrypt.compareSync(plain, hash);
}

export function hashPassword(plain: string): string {
  return bcrypt.hashSync(plain, 10);
}

export function issueToken(user: UserRow): string {
  const payload: AuthUser = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_TTL });
}

export function requireAuth(
  req: AuthedRequest,
  res: Response,
  next: NextFunction
): void {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) {
    res.status(401).json({ error: "Missing authorization token." });
    return;
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthUser;
    // Confirm the user still exists.
    const row = db
      .prepare("SELECT id, email, name, role FROM users WHERE id = ?")
      .get(decoded.id) as AuthUser | undefined;
    if (!row) {
      res.status(401).json({ error: "User no longer exists." });
      return;
    }
    req.user = row;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token." });
  }
}

export function requireRole(role: Role) {
  return (req: AuthedRequest, res: Response, next: NextFunction): void => {
    if (!req.user || req.user.role !== role) {
      res.status(403).json({ error: `Requires ${role} role.` });
      return;
    }
    next();
  };
}
