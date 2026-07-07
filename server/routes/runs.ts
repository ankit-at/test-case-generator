import { Router } from "express";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import db, { RunRow, TestCaseRow } from "../db";
import { requireAuth, AuthedRequest } from "../auth";
import { runGeneration } from "../pipeline/runGeneration";
import { OutputFormatter } from "../../src/generation/outputFormatter";
import { runPlaywrightSpecs } from "../../src/evaluation/executionValidator";
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

// Execute a run's generated specs through Playwright and record the results.
// Needs @playwright/test installed and a target base URL.
router.post("/:id/execute", async (req: AuthedRequest, res) => {
  const run = loadOwnedRun(req, Number(req.params.id));
  if (!run) return res.status(404).json({ error: "Run not found." });

  const baseUrl =
    (req.body && req.body.baseUrl) || process.env.TCGEN_TEST_BASE_URL || "";
  if (!baseUrl) {
    return res.status(400).json({
      error:
        "A target base URL is required. Provide baseUrl or set TCGEN_TEST_BASE_URL.",
    });
  }

  const rows = db
    .prepare("SELECT * FROM test_cases WHERE run_id = ? ORDER BY id")
    .all(run.id) as TestCaseRow[];
  if (rows.length === 0) {
    return res.status(400).json({ error: "This run has no test cases." });
  }

  let dir: string | undefined;
  try {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), `qaforge-run-${run.id}-`));
    fs.mkdirSync(path.join(dir, "tests"));
    fs.writeFileSync(
      path.join(dir, "playwright.config.ts"),
      `import { defineConfig } from '@playwright/test';\n` +
        `export default defineConfig({\n` +
        `  testDir: './tests',\n` +
        `  use: { baseURL: ${JSON.stringify(baseUrl)} },\n` +
        `});\n`
    );
    rows.forEach((row, i) => {
      fs.writeFileSync(
        path.join(dir!, "tests", `case-${i + 1}.spec.ts`),
        row.code
      );
    });

    const result = await runPlaywrightSpecs({ projectDir: dir });
    const ranAt = new Date().toISOString();
    db.prepare(
      `UPDATE runs SET exec_pass_rate=?, exec_summary=?, exec_ran_at=? WHERE id=?`
    ).run(
      result.passRate,
      JSON.stringify({
        total: result.total,
        passed: result.passed,
        failed: result.failed,
        flaky: result.flaky,
        skipped: result.skipped,
        durationMs: result.durationMs,
      }),
      ranAt,
      run.id
    );
    res.json({ ...result, ranAt });
  } catch (err) {
    console.error(`Execution failed for run ${run.id}:`, err);
    res.status(500).json({
      error:
        "Execution failed. Ensure @playwright/test and browsers are installed (npx playwright install) and the base URL is reachable.",
    });
  } finally {
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
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
