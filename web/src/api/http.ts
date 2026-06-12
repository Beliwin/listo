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
  username?: string;
  isAdmin?: boolean;
  issuedAt?: number;
  expiresAt?: number;
}

export interface AccountSummary {
  ok: true;
  username: string;
  isAdmin: boolean;
}

export interface UserRecord {
  id: string;
  username: string;
  isAdmin: boolean;
  createdAt: number;
}

export interface PendingInvite {
  id: string;
  kind: "invite" | "reset";
  isAdmin: boolean;
  label: string | null;
  targetUsername: string | null;
  createdAt: number;
  expiresAt: number;
}

export interface MintedInvite {
  id?: string;
  token: string;
  expiresAt: number;
}

export interface InviteInfo {
  valid: boolean;
  kind?: "invite" | "reset";
  /** Username being reset (kind = 'reset'); null for a fresh invite. */
  username?: string | null;
}

export const api = {
  login: (username: string, password: string) =>
    request<AccountSummary>("POST", "/api/auth/login", { username, password }),
  logout: () => request<{ ok: true }>("POST", "/api/auth/logout"),
  session: () => request<SessionInfo>("GET", "/api/auth/session"),

  // Invitation enrolment (public).
  inviteInfo: (token: string) => request<InviteInfo>("GET", `/api/invite/${encodeURIComponent(token)}`),
  acceptInvite: (token: string, password: string, username?: string) =>
    request<AccountSummary>("POST", `/api/invite/${encodeURIComponent(token)}/accept`, {
      username,
      password,
    }),

  // Account management (authenticated; admin endpoints require an admin session).
  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ ok: true }>("POST", "/api/account/password", { currentPassword, newPassword }),
  listUsers: () => request<{ users: UserRecord[] }>("GET", "/api/users"),
  deleteUser: (id: string) => request<{ ok: true }>("DELETE", `/api/users/${encodeURIComponent(id)}`),
  resetLink: (id: string) =>
    request<MintedInvite>("POST", `/api/users/${encodeURIComponent(id)}/reset-link`),
  listInvitations: () => request<{ invitations: PendingInvite[] }>("GET", "/api/invitations"),
  createInvitation: (opts: { isAdmin?: boolean; label?: string } = {}) =>
    request<MintedInvite>("POST", "/api/invitations", opts),
  revokeInvitation: (id: string) =>
    request<{ ok: true }>("DELETE", `/api/invitations/${encodeURIComponent(id)}`),

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
