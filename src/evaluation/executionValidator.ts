import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { execFile } from "child_process";
import {
  SpecValidation,
  ExecutionRunResult,
  GeneratedTestCase,
} from "../core/types";

// Playwright async actions that must be awaited to run correctly.
const ASYNC_ACTIONS = [
  "goto",
  "click",
  "dblclick",
  "fill",
  "type",
  "press",
  "check",
  "uncheck",
  "selectOption",
  "hover",
  "setInputFiles",
  "waitForSelector",
  "waitForLoadState",
  "waitForURL",
];

let tsModule: any;
function loadTs(): any {
  if (tsModule !== undefined) return tsModule;
  try {
    // Lazy + optional: only used for the compile check.
    tsModule = require("typescript");
  } catch {
    tsModule = null;
  }
  return tsModule;
}

function checkCompiles(code: string): boolean | null {
  const ts = loadTs();
  if (!ts) return null;
  const result = ts.transpileModule(code, {
    reportDiagnostics: true,
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2021,
    },
  });
  const errors = (result.diagnostics || []).filter(
    (d: any) => d.category === ts.DiagnosticCategory.Error
  );
  return errors.length === 0;
}

/**
 * Statically validate a generated Playwright spec: does it compile, is it a
 * real test with assertions, and does it avoid known-flaky patterns. Produces
 * an executability score (0-100) with no app or browser needed.
 */
export function validateSpec(code: string): SpecValidation {
  const issues: string[] = [];

  const compiles = checkCompiles(code);
  if (compiles === false) issues.push("Does not compile (syntax error).");

  const testCount = (code.match(/\btest\s*\(/g) || []).length;
  if (testCount === 0) issues.push("No test() block found.");

  const hasAssertions = /\bexpect\s*\(/.test(code);
  if (!hasAssertions) issues.push("No assertions (expect) found.");

  const hardWaitCount = (code.match(/waitForTimeout\s*\(/g) || []).length;
  if (hardWaitCount > 0) {
    issues.push(`${hardWaitCount} hard wait(s) (waitForTimeout) — flaky.`);
  }

  const unawaitedActions = countUnawaitedActions(code);
  if (unawaitedActions > 0) {
    issues.push(`${unawaitedActions} async action(s) not awaited.`);
  }

  let score = 100;
  if (compiles === false) score -= 60;
  if (testCount === 0) score -= 50;
  if (!hasAssertions) score -= 25;
  score -= Math.min(hardWaitCount * 10, 20);
  score -= Math.min(unawaitedActions * 10, 20);
  score = Math.max(0, Math.min(100, score));

  return {
    compiles,
    testCount,
    hasAssertions,
    hardWaitCount,
    unawaitedActions,
    issues,
    executabilityScore: score,
  };
}

/** Attach static validation to a generated test case (in place) and return it. */
export function attachValidation(tc: GeneratedTestCase): GeneratedTestCase {
  tc.execution = validateSpec(tc.code);
  return tc;
}

function countUnawaitedActions(code: string): number {
  let count = 0;
  const actionRe = new RegExp(
    `(\\w+)?\\.(${ASYNC_ACTIONS.join("|")})\\s*\\(`,
    "g"
  );
  let m: RegExpExecArray | null;
  while ((m = actionRe.exec(code)) !== null) {
    // Look at the ~12 chars before the match for an `await` / `return`.
    const before = code.slice(Math.max(0, m.index - 12), m.index);
    if (!/(await|return)\s*$/.test(before)) count++;
  }
  return count;
}

// ---------------------------------------------------------------------------
// Live execution (opt-in): actually run specs through Playwright.
// Requires @playwright/test installed and browsers available in projectDir.
// ---------------------------------------------------------------------------

export interface PlaywrightRunOptions {
  /** A directory containing a Playwright project (playwright.config + tests). */
  projectDir: string;
  /** Extra args passed to `playwright test` (e.g. ["--retries=2"]). */
  args?: string[];
  /** Milliseconds before the run is aborted. Default 180000. */
  timeoutMs?: number;
}

/**
 * Run the Playwright tests in `projectDir` and summarise pass/fail/flaky using
 * the JSON reporter. This is the real "execution accuracy" signal, but it needs
 * a runnable target app + installed browsers, so it is opt-in.
 */
export function runPlaywrightSpecs(
  options: PlaywrightRunOptions
): Promise<ExecutionRunResult> {
  const { projectDir, args = [], timeoutMs = 180000 } = options;
  return new Promise((resolve, reject) => {
    const started = Date.now();
    execFile(
      "npx",
      ["playwright", "test", "--reporter=json", ...args],
      { cwd: projectDir, timeout: timeoutMs, maxBuffer: 32 * 1024 * 1024 },
      (_err, stdout) => {
        // Playwright exits non-zero when tests fail; we still parse the report.
        const report = safeParse(stdout);
        if (!report) {
          reject(new Error("Could not parse Playwright JSON report."));
          return;
        }
        resolve(summarise(report, Date.now() - started));
      }
    );
  });
}

function safeParse(stdout: string): any {
  try {
    const start = stdout.indexOf("{");
    return start >= 0 ? JSON.parse(stdout.slice(start)) : null;
  } catch {
    return null;
  }
}

function summarise(report: any, durationMs: number): ExecutionRunResult {
  let passed = 0;
  let failed = 0;
  let flaky = 0;
  let skipped = 0;

  const walk = (suite: any) => {
    for (const s of suite.suites || []) walk(s);
    for (const spec of suite.specs || []) {
      for (const test of spec.tests || []) {
        const status = test.status || test.results?.[0]?.status;
        if (status === "flaky") flaky++;
        else if (status === "skipped") skipped++;
        else if (status === "expected" || status === "passed") passed++;
        else failed++;
      }
    }
  };
  for (const suite of report.suites || []) walk(suite);

  const total = passed + failed + flaky + skipped;
  const denom = passed + failed + flaky;
  return {
    total,
    passed,
    failed,
    flaky,
    skipped,
    passRate: denom > 0 ? Math.round((passed / denom) * 100) : 0,
    durationMs,
    raw: report,
  };
}
