import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, RunSummary, User } from "../api/client";
import { useAuth } from "../auth";

export default function Dashboard() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [filterUser, setFilterUser] = useState<number | "">("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = () => {
    setLoading(true);
    api
      .listRuns(isAdmin && filterUser !== "" ? Number(filterUser) : undefined)
      .then((r) => setRuns(r.runs))
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  };

  useEffect(load, [filterUser]);

  useEffect(() => {
    if (isAdmin) api.listUsers().then((r) => setUsers(r.users)).catch(() => {});
  }, [isAdmin]);

  return (
    <div className="page">
      <div className="page-head">
        <h1>{isAdmin ? "All test case runs" : "My test case runs"}</h1>
        {isAdmin && (
          <label className="inline">
            Filter by user
            <select
              value={filterUser}
              onChange={(e) =>
                setFilterUser(e.target.value === "" ? "" : Number(e.target.value))
              }
            >
              <option value="">All users</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.email})
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {error && <div className="error">{error}</div>}
      {loading ? (
        <div className="muted">Loading…</div>
      ) : runs.length === 0 ? (
        <div className="empty card">
          No runs yet.{" "}
          {user?.role !== "admin" && <Link to="/generate">Generate your first set →</Link>}
        </div>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Title</th>
              {isAdmin && <th>User</th>}
              <th>Module</th>
              <th>Cases</th>
              <th>Quality</th>
              <th>Exec</th>
              <th>Status</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((r) => (
              <tr key={r.id}>
                <td>
                  <Link to={`/runs/${r.id}`}>{r.title}</Link>
                </td>
                {isAdmin && <td>{r.user_name}</td>}
                <td>{r.module_name || "—"}</td>
                <td>{r.test_case_count}</td>
                <td>{r.avg_score != null ? `${r.avg_score}/100` : "—"}</td>
                <td>
                  {r.avg_executability != null ? `${r.avg_executability}/100` : "—"}
                  {r.exec_pass_rate != null && (
                    <span className="pass-rate" title="Playwright pass rate">
                      {" "}· {r.exec_pass_rate}% pass
                    </span>
                  )}
                </td>
                <td>
                  <span className={`badge ${r.status}`}>{r.status}</span>
                </td>
                <td className="muted">{new Date(r.created_at + "Z").toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
