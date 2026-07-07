// Typed fetch client. Stores the JWT in localStorage.

const TOKEN_KEY = "tcgen_token";

export interface User {
  id: number;
  email: string;
  name: string;
  role: "admin" | "generator";
}

export interface ModuleContext {
  id: number;
  name: string;
  description: string;
  context_text: string;
  created_at: string;
  created_by_name?: string;
}

export interface RunSummary {
  id: number;
  title: string;
  user_id: number;
  user_name?: string;
  user_email?: string;
  module_name?: string | null;
  status: string;
  avg_score: number | null;
  avg_executability: number | null;
  test_case_count: number;
  error: string | null;
  exec_pass_rate: number | null;
  exec_ran_at: string | null;
  created_at: string;
}

export interface ExecutionResult {
  total: number;
  passed: number;
  failed: number;
  flaky: number;
  skipped: number;
  passRate: number;
  durationMs: number;
  ranAt: string;
}

export interface TestCase {
  id: number;
  skill_id: string | null;
  test_name: string;
  code: string;
  steps: string[];
  assertions: string[];
  tags: string[];
  priority: string;
  score: number | null;
  executability: number | null;
  execution_issues: string[];
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}
export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = new Headers(options.headers);
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (!(options.body instanceof FormData) && options.body) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(`/api${path}`, { ...options, headers });
  if (res.status === 401) {
    clearToken();
    throw new Error("Session expired. Please sign in again.");
  }
  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    if (!res.ok) throw new Error(`Request failed (${res.status}).`);
    return (await res.text()) as unknown as T;
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status}).`);
  return data as T;
}

export const api = {
  login: (email: string, password: string) =>
    request<{ token: string; user: User }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  me: () => request<{ user: User }>("/auth/me"),

  listUsers: () => request<{ users: User[] }>("/users"),
  createUser: (payload: {
    email: string;
    password: string;
    name: string;
    role: string;
  }) => request<{ id: number }>("/users", {
    method: "POST",
    body: JSON.stringify(payload),
  }),
  deleteUser: (id: number) =>
    request<{ ok: boolean }>(`/users/${id}`, { method: "DELETE" }),

  listContexts: () =>
    request<{ moduleContexts: ModuleContext[] }>("/module-contexts"),
  createContext: (payload: {
    name: string;
    description: string;
    contextText: string;
  }) => request<{ id: number }>("/module-contexts", {
    method: "POST",
    body: JSON.stringify(payload),
  }),
  deleteContext: (id: number) =>
    request<{ ok: boolean }>(`/module-contexts/${id}`, { method: "DELETE" }),

  uploadBrd: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return request<{
      filename: string;
      charCount: number;
      preview: string;
      text: string;
    }>("/brd/upload", { method: "POST", body: form });
  },

  createRun: (payload: {
    title: string;
    brdText: string;
    brdFilename?: string;
    moduleContextId?: number;
    scopeTypes: string[];
    scopeNotes?: string;
  }) => request<{ runId: number; testCaseCount: number; avgScore: number | null }>(
    "/runs",
    { method: "POST", body: JSON.stringify(payload) }
  ),

  listRuns: (userId?: number) =>
    request<{ runs: RunSummary[] }>(
      `/runs${userId ? `?userId=${userId}` : ""}`
    ),
  getRun: (id: number) =>
    request<{ run: RunSummary; testCases: TestCase[] }>(`/runs/${id}`),
  executeRun: (id: number, baseUrl: string) =>
    request<ExecutionResult>(`/runs/${id}/execute`, {
      method: "POST",
      body: JSON.stringify({ baseUrl }),
    }),
  exportUrl: (id: number, format: string) => `/api/runs/${id}/export?format=${format}`,
};
