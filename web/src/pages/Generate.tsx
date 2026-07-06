import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ModuleContext } from "../api/client";

const SCOPE_OPTIONS = [
  "Functional",
  "Non-functional",
  "Security",
  "Performance",
  "Usability",
  "Negative / Edge",
];

export default function Generate() {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [contexts, setContexts] = useState<ModuleContext[]>([]);
  const [moduleContextId, setModuleContextId] = useState<number | "">("");
  const [scopeTypes, setScopeTypes] = useState<string[]>(["Functional"]);
  const [scopeNotes, setScopeNotes] = useState("");

  const [brd, setBrd] = useState<{ text: string; filename: string; preview: string; charCount: number } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.listContexts().then((r) => setContexts(r.moduleContexts)).catch(() => {});
  }, []);

  const toggleScope = (opt: string) => {
    setScopeTypes((prev) =>
      prev.includes(opt) ? prev.filter((s) => s !== opt) : [...prev, opt]
    );
  };

  const handleFile = async (file: File) => {
    setError("");
    setUploading(true);
    try {
      const r = await api.uploadBrd(file);
      setBrd(r);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const generate = async () => {
    setError("");
    if (!title.trim()) return setError("Enter a title.");
    if (!brd) return setError("Upload a BRD PDF first.");
    setBusy(true);
    try {
      const r = await api.createRun({
        title: title.trim(),
        brdText: brd.text,
        brdFilename: brd.filename,
        moduleContextId: moduleContextId === "" ? undefined : Number(moduleContextId),
        scopeTypes,
        scopeNotes: scopeNotes.trim() || undefined,
      });
      navigate(`/runs/${r.runId}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page">
      <h1>Generate test cases</h1>

      <div className="card">
        <label>
          Title
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Checkout — payment flow"
          />
        </label>

        <label>
          BRD (PDF)
          <input
            type="file"
            accept="application/pdf,.pdf"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
        </label>
        {uploading && <div className="muted">Extracting text…</div>}
        {brd && (
          <div className="brd-preview">
            <div className="muted">
              {brd.filename} · {brd.charCount.toLocaleString()} chars extracted
            </div>
            <pre>{brd.preview}{brd.charCount > brd.preview.length ? "…" : ""}</pre>
          </div>
        )}

        <label>
          Module context
          <select
            value={moduleContextId}
            onChange={(e) =>
              setModuleContextId(e.target.value === "" ? "" : Number(e.target.value))
            }
          >
            <option value="">— none —</option>
            {contexts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        {contexts.length === 0 && (
          <div className="muted small">
            No module contexts yet. An admin can add them in Admin settings.
          </div>
        )}

        <div className="field">
          <span className="field-label">Scope</span>
          <div className="chips">
            {SCOPE_OPTIONS.map((opt) => (
              <label key={opt} className={`chip ${scopeTypes.includes(opt) ? "on" : ""}`}>
                <input
                  type="checkbox"
                  checked={scopeTypes.includes(opt)}
                  onChange={() => toggleScope(opt)}
                />
                {opt}
              </label>
            ))}
          </div>
        </div>

        <label>
          Additional context
          <textarea
            value={scopeNotes}
            onChange={(e) => setScopeNotes(e.target.value)}
            rows={3}
            placeholder="Constraints, personas, specific scenarios to emphasise…"
          />
        </label>

        {error && <div className="error">{error}</div>}
        <button onClick={generate} disabled={busy || uploading}>
          {busy ? "Generating… this can take a minute" : "Generate"}
        </button>
      </div>
    </div>
  );
}
