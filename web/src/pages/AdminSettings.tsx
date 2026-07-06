import { useEffect, useState } from "react";
import { api, User, ModuleContext } from "../api/client";
import { useAuth } from "../auth";

export default function AdminSettings() {
  const { user } = useAuth();
  const [tab, setTab] = useState<"users" | "contexts">("users");

  return (
    <div className="page">
      <h1>Admin settings</h1>
      <div className="tabs">
        <button className={tab === "users" ? "on" : ""} onClick={() => setTab("users")}>
          Users
        </button>
        <button className={tab === "contexts" ? "on" : ""} onClick={() => setTab("contexts")}>
          Module contexts
        </button>
      </div>
      {tab === "users" ? <UsersPanel selfId={user!.id} /> : <ContextsPanel />}
    </div>
  );
}

function UsersPanel({ selfId }: { selfId: number }) {
  const [users, setUsers] = useState<User[]>([]);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "generator" });
  const [error, setError] = useState("");

  const load = () => api.listUsers().then((r) => setUsers(r.users)).catch(() => {});
  useEffect(() => { load(); }, []);

  const create = async () => {
    setError("");
    try {
      await api.createUser(form);
      setForm({ name: "", email: "", password: "", role: "generator" });
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const remove = async (id: number) => {
    if (!confirm("Delete this user?")) return;
    try {
      await api.deleteUser(id);
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="grid-2">
      <div className="card">
        <h3>Add user</h3>
        <label>Name<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
        <label>Email<input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
        <label>Password<input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></label>
        <label>
          Role
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            <option value="generator">Generator</option>
            <option value="admin">Admin</option>
          </select>
        </label>
        {error && <div className="error">{error}</div>}
        <button onClick={create}>Create user</button>
      </div>

      <div className="card">
        <h3>Users</h3>
        <table className="table">
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th></th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.name}</td>
                <td>{u.email}</td>
                <td><span className={`badge ${u.role}`}>{u.role}</span></td>
                <td>
                  {u.id !== selfId && (
                    <button className="ghost danger" onClick={() => remove(u.id)}>Delete</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ContextsPanel() {
  const [contexts, setContexts] = useState<ModuleContext[]>([]);
  const [form, setForm] = useState({ name: "", description: "", contextText: "" });
  const [error, setError] = useState("");

  const load = () => api.listContexts().then((r) => setContexts(r.moduleContexts)).catch(() => {});
  useEffect(() => { load(); }, []);

  const create = async () => {
    setError("");
    if (!form.name || !form.contextText) return setError("Name and context text are required.");
    try {
      await api.createContext(form);
      setForm({ name: "", description: "", contextText: "" });
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const remove = async (id: number) => {
    if (!confirm("Delete this context?")) return;
    await api.deleteContext(id);
    load();
  };

  return (
    <div className="grid-2">
      <div className="card">
        <h3>Add module context</h3>
        <label>Name<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Payroll" /></label>
        <label>Description<input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
        <label>
          Context text
          <textarea
            rows={8}
            value={form.contextText}
            onChange={(e) => setForm({ ...form, contextText: e.target.value })}
            placeholder="Domain knowledge, terminology, key flows, constraints the generator should know about this module…"
          />
        </label>
        {error && <div className="error">{error}</div>}
        <button onClick={create}>Save context</button>
      </div>

      <div className="card">
        <h3>Context library</h3>
        {contexts.length === 0 && <div className="muted">None yet.</div>}
        {contexts.map((c) => (
          <div className="ctx-item" key={c.id}>
            <div>
              <strong>{c.name}</strong>
              {c.description && <div className="muted small">{c.description}</div>}
            </div>
            <button className="ghost danger" onClick={() => remove(c.id)}>Delete</button>
          </div>
        ))}
      </div>
    </div>
  );
}
