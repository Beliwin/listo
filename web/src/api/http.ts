import type { PullResponse, PushRequest, PushResponse, SnapshotResponse } from "@listo/shared";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code?: string,
  ) {
    super(`api error ${status}${code ? ` (${code})` : ""}`);
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    credentials: "include",
    headers: body !== undefined ? { "content-type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const code = await res
      .json()
      .then((j: { error?: string }) => j.error)
      .catch(() => undefined);
    throw new ApiError(res.status, code);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** The sync transport the engine depends on (stubbed in tests). */
export interface SyncApi {
  push(req: PushRequest): Promise<PushResponse>;
  pull(since: number, epoch: number): Promise<PullResponse>;
  snapshot(): Promise<SnapshotResponse>;
}

export interface SessionInfo {
  authenticated: boolean;
  issuedAt?: number;
  expiresAt?: number;
}

export const api = {
  login: (password: string, deviceName?: string) =>
    request<{ ok: true }>("POST", "/api/auth/login", { password, deviceName }),
  logout: () => request<{ ok: true }>("POST", "/api/auth/logout"),
  session: () => request<SessionInfo>("GET", "/api/auth/session"),

  push: (req: PushRequest) => request<PushResponse>("POST", "/api/sync/push", req),
  pull: (since: number, epoch: number) =>
    request<PullResponse>("GET", `/api/sync/pull?since=${since}&epoch=${epoch}`),
  snapshot: () => request<SnapshotResponse>("GET", "/api/sync/snapshot"),
  suggestions: (limit = 12) =>
    request<{ suggestions: { catalogId: string; count: number; lastAt: number }[] }>(
      "GET",
      `/api/suggestions?limit=${limit}`,
    ),
} satisfies SyncApi & Record<string, unknown>;
