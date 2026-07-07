import { Router } from "express";
import db, { RunRow, TestCaseRow } from "../db";
import { requireAuth, AuthedRequest } from "../auth";
import { runGeneration } from "../pipeline/runGeneration";
import { OutputFormatter } from "../../src/generation/outputFormatter";
import { GeneratedTestCase } from "../../src/core/types";

const router = Router();
router.use(requireAuth);

// Create a run and generate test cases (synchronous for local use).
router.post("/", async (req: AuthedRequest, res) => {
  const { title, brdText, brdFilename, moduleContextId, scopeTypes, scopeNotes } =
    req.body || {};
  if (!title || !brdText) {
    return res.status(400).json({ error: "title and brdText are required." });
  }
  try {
    const outcome = await runGeneration({
      userId: req.user!.id,
      title: String(title),
      brdText: String(brdText),
      brdFilename: brdFilename ? String(brdFilename) : undefined,
      moduleContextId: moduleContextId ? Number(moduleContextId) : undefined,
      scopeTypes: Array.isArray(scopeTypes) ? scopeTypes.map(String) : [],
      scopeNotes: scopeNotes ? String(scopeNotes) : undefined,
    });
    res.status(201).json(outcome);
  } catch (err) {
    // Log the detail server-side; return a safe, generic message to the client.
    console.error(`Run generation failed for user ${req.user!.id}:`, err);
    res.status(500).json({
      error:
        "Generation failed. Check the server logs and that ANTHROPIC_API_KEY is valid.",
    });
  }
});

// List runs. Generators see their own; admins see all and can filter by user.
router.get("/", (req: AuthedRequest, res) => {
  const isAdmin = req.user!.role === "admin";
  const filterUserId = req.query.userId ? Number(req.query.userId) : undefined;

  let sql = `SELECT r.*, u.name AS user_name, u.email AS user_email, mc.name AS module_name
             FROM runs r JOIN users u ON u.id = r.user_id
             LEFT JOIN module_contexts mc ON mc.id = r.module_context_id`;
  const clauses: string[] = [];
  const params: unknown[] = [];

  if (!isAdmin) {
    clauses.push("r.user_id = ?");
    params.push(req.user!.id);
  } else if (filterUserId) {
    clauses.push("r.user_id = ?");
    params.push(filterUserId);
  }
  if (clauses.length) sql += " WHERE " + clauses.join(" AND ");
  sql += " ORDER BY r.created_at DESC";

  const rows = db.prepare(sql).all(...params);
  res.json({ runs: rows });
});

// Run detail with its test cases (owner or admin only).
router.get("/:id", (req: AuthedRequest, res) => {
  const run = loadOwnedRun(req, Number(req.params.id));
  if (!run) return res.status(404).json({ error: "Run not found." });
  const cases = db
    .prepare("SELECT * FROM test_cases WHERE run_id = ? ORDER BY id")
    .all(run.id) as TestCaseRow[];
  res.json({
    run,
    testCases: cases.map((c) => ({
      ...c,
      steps: safeParse(c.steps),
      assertions: safeParse(c.assertions),
      tags: safeParse(c.tags),
      execution_issues: safeParse(c.execution_issues),
    })),
  });
});

// Export a run in a given format.
router.get("/:id/export", async (req: AuthedRequest, res) => {
  const run = loadOwnedRun(req, Number(req.params.id));
  if (!run) return res.status(404).json({ error: "Run not found." });
  const format = String(req.query.format || "spec");
  const rows = db
    .prepare("SELECT * FROM test_cases WHERE run_id = ? ORDER BY id")
    .all(run.id) as TestCaseRow[];
  const testCases = rows.map(rowToGenerated);
  const formatter = new OutputFormatter();
  const base = `run-${run.id}`;

  if (format === "json") {
    res.setHeader("Content-Disposition", `attachment; filename="${base}.json"`);
    res.type("application/json").send(formatter.formatJSON(testCases));
  } else if (format === "xlsx") {
    const buf = await formatter.formatXLSX(testCases);
    res.setHeader("Content-Disposition", `attachment; filename="${base}.xlsx"`);
    res.type(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    ).send(buf);
  } else {
    res.setHeader("Content-Disposition", `attachment; filename="${base}.spec.ts"`);
    res.type("text/plain").send(formatter.formatPlaywright(testCases));
  }
});

function loadOwnedRun(req: AuthedRequest, id: number): RunRow | undefined {
  const run = db.prepare("SELECT * FROM runs WHERE id = ?").get(id) as
    | RunRow
    | undefined;
  if (!run) return undefined;
  if (req.user!.role !== "admin" && run.user_id !== req.user!.id) return undefined;
  return run;
}

function rowToGenerated(row: TestCaseRow): GeneratedTestCase {
  return {
    skillId: row.skill_id || "",
    framework: "playwright",
    code: row.code,
    metadata: {
      testName: row.test_name,
      steps: safeParse(row.steps),
      assertions: safeParse(row.assertions),
      tags: safeParse(row.tags),
      priority: (row.priority as any) || "medium",
    },
    rawResponse: "",
    timestamp: new Date().toISOString(),
    evaluation: row.score != null ? ({ overallScore: row.score } as any) : undefined,
  };
}

function safeParse(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default router;
