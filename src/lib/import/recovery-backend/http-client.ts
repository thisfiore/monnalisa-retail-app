/**
 * Thin fetch layer for the `recovery-api` microservice (Express + Mongo).
 *
 * Two audiences:
 *  - MANAGER calls (`/links/*`) carry the manager's Firebase ID token.
 *  - PUBLIC customer calls (`/recover/*`) carry no auth — the opaque token is
 *    the capability, and the customer's phone hits the service cross-origin
 *    (CORS allow-listed server-side).
 *
 * Base URL comes from `VITE_RECOVERY_API_URL`.
 */

export function recoveryApiBase(): string {
  const env = (import.meta as { env?: Record<string, string | undefined> }).env;
  const url = env?.VITE_RECOVERY_API_URL;
  if (!url) {
    throw new Error('VITE_RECOVERY_API_URL is not set (required when VITE_RECOVERY_BACKEND=http)');
  }
  return url.replace(/\/+$/, '');
}

export class RecoveryApiError extends Error {
  status: number;
  code?: string;
  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = 'RecoveryApiError';
    this.status = status;
    this.code = code;
  }
}

async function parse(resp: Response): Promise<unknown> {
  const text = await resp.text();
  const data = text ? JSON.parse(text) : {};
  if (!resp.ok) {
    const d = data as { error?: string; detail?: string };
    throw new RecoveryApiError(resp.status, d.detail || d.error || resp.statusText, d.error);
  }
  return data;
}

/** Authenticated manager call to `/links/*`. */
export async function managerFetch(
  path: string,
  token: string,
  init: RequestInit = {},
): Promise<unknown> {
  const resp = await fetch(`${recoveryApiBase()}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
  });
  return parse(resp);
}

/** Public, unauthenticated call to `/recover/*` (the customer's phone). */
export async function publicFetch(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${recoveryApiBase()}${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init.headers ?? {}) },
  });
}
