import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api, RunSummary, TestCase, ExecutionResult } from "../api/client";

export default function RunDetail() {
  const { id } = useParams();
  const runId = Number(id);
  const [run, setRun] = useState<RunSummary | null>(null);
  const [cases, setCases] = useState<TestCase[]>([]);
  const [open, setOpen] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [baseUrl, setBaseUrl] = useState("");
  const [running, setRunning] = useState(false);
  const [execResult, setExecResult] = useState<ExecutionResult | null>(null);
  const [execError, setExecError] = useState("");

  const runTests = async () => {
    setExecError("");
    setExecResult(null);
    setRunning(true);
    try {
      setExecResult(await api.executeRun(runId, baseUrl.trim()));
    } catch (e) {
      setExecError((e as Error).message);
    } finally {
      setRunning(false);
    }
  };

  useEffect(() => {
    api
      .getRun(runId)
      .then((r) => {
        setRun(r.run);
        setCases(r.testCases);
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [runId]);

  if (loading) return <div className="page muted">Loading…</div>;
  if (error) return <div className="page error">{error}</div>;
  if (!run) return null;

  return (
    <div className="page">
      <div className="breadcrumb">
        <Link to="/dashboard">← Dashboard</Link>
      </div>
      <div className="page-head">
        <h1>{run.title}</h1>
        <div className="exports">
          <a href={api.exportUrl(run.id, "spec")}>.spec.ts</a>
          <a href={api.exportUrl(run.id, "json")}>JSON</a>
          <a href={api.exportUrl(run.id, "xlsx")}>XLSX</a>
        </div>
      </div>
      <div className="muted meta">
        {run.module_name || "no module"} · {run.test_case_count} cases ·
        {run.avg_score != null ? ` avg ${run.avg_score}/100 · ` : " "}
        <span className={`badge ${run.status}`}>{run.status}</span>
      </div>
      {run.error && <div className="error">{run.error}</div>}

      <div className="card run-tests">
        <h4>Run these tests against a target</h4>
        <div className="run-row">
          <input
            placeholder="Target base URL, e.g. https://your-app.com"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
          />
          <button onClick={runTests} disabled={running || !baseUrl.trim()}>
            {running ? "Running…" : "Run tests"}
          </button>
        </div>
        {execError && <div className="error">{execError}</div>}
        {execResult && (
          <div className="exec-result">
            <span className="pass">{execResult.passed} passed</span>
            <span className="fail">{execResult.failed} failed</span>
            <span className="flaky">{execResult.flaky} flaky</span>
            <span className="muted">{execResult.skipped} skipped</span>
            <strong>{execResult.passRate}% pass rate</strong>
          </div>
        )}
        <div className="muted small">
          Requires @playwright/test + browsers on the server and a reachable URL.
        </div>
      </div>

      <div className="cases">
        {cases.map((c) => (
          <div className="card case" key={c.id}>
            <div className="case-head" onClick={() => setOpen(open === c.id ? null : c.id)}>
              <div>
                <strong>{c.test_name}</strong>
                <div className="tags">
                  {c.tags.map((t) => (
                    <span className="tag" key={t}>{t}</span>
                  ))}
                </div>
              </div>
              <div className="case-meta">
                <span className={`prio ${c.priority}`}>{c.priority}</span>
                {c.score != null && (
                  <span className="score" title="LLM-as-judge quality score">
                    Q {c.score}
                  </span>
                )}
                {c.executability != null && (
                  <span
                    className={`exec ${c.executability >= 80 ? "ok" : c.executability >= 50 ? "warn" : "bad"}`}
                    title="Executability: compiles, has assertions, no flaky waits"
                  >
                    E {c.executability}
                  </span>
                )}
              </div>
            </div>
            {open === c.id && (
              <div className="case-body">
                {c.steps.length > 0 && (
                  <>
                    <h4>Steps</h4>
                    <ol>
                      {c.steps.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ol>
                  </>
                )}
                {c.execution_issues.length > 0 && (
                  <>
                    <h4>Executability issues</h4>
                    <ul className="issues">
                      {c.execution_issues.map((issue, i) => (
                        <li key={i}>{issue}</li>
                      ))}
                    </ul>
                  </>
                )}
                <h4>Code</h4>
                <pre>{c.code}</pre>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
