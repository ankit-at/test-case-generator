import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api, RunSummary, TestCase } from "../api/client";

export default function RunDetail() {
  const { id } = useParams();
  const runId = Number(id);
  const [run, setRun] = useState<RunSummary | null>(null);
  const [cases, setCases] = useState<TestCase[]>([]);
  const [open, setOpen] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

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
                {c.score != null && <span className="score">{c.score}/100</span>}
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
