import { Router } from "express";
import db, { ModuleContextRow } from "../db";
import { requireAuth, requireRole, AuthedRequest } from "../auth";

const router = Router();
router.use(requireAuth);

// Any authenticated user can read the context library (generators select from it).
router.get("/", (_req, res) => {
  const rows = db
    .prepare(
      `SELECT mc.id, mc.name, mc.description, mc.context_text, mc.created_at, u.name AS created_by_name
       FROM module_contexts mc JOIN users u ON u.id = mc.created_by
       ORDER BY mc.name`
    )
    .all();
  res.json({ moduleContexts: rows });
});

// Writes are admin-only.
router.post("/", requireRole("admin"), (req: AuthedRequest, res) => {
  const { name, description, contextText } = req.body || {};
  if (!name || !contextText) {
    return res
      .status(400)
      .json({ error: "name and contextText are required." });
  }
  const info = db
    .prepare(
      "INSERT INTO module_contexts (name, description, context_text, created_by) VALUES (?, ?, ?, ?)"
    )
    .run(name, description || "", contextText, req.user!.id);
  res.status(201).json({ id: Number(info.lastInsertRowid) });
});

router.put("/:id", requireRole("admin"), (req, res) => {
  const id = Number(req.params.id);
  const existing = db
    .prepare("SELECT * FROM module_contexts WHERE id = ?")
    .get(id) as ModuleContextRow | undefined;
  if (!existing) return res.status(404).json({ error: "Context not found." });
  const { name, description, contextText } = req.body || {};
  db.prepare(
    "UPDATE module_contexts SET name = ?, description = ?, context_text = ? WHERE id = ?"
  ).run(
    name ?? existing.name,
    description ?? existing.description,
    contextText ?? existing.context_text,
    id
  );
  res.json({ ok: true });
});

router.delete("/:id", requireRole("admin"), (req, res) => {
  const id = Number(req.params.id);
  db.prepare("DELETE FROM module_contexts WHERE id = ?").run(id);
  res.json({ ok: true });
});

export default router;
