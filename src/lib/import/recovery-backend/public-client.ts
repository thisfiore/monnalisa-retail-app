/**
 * PUBLIC customer client for the recovery microservice — no auth, the opaque
 * token is the capability. Used by `CustomerRecovery` when
 * `VITE_RECOVERY_BACKEND=http` so the page resolves on the customer's phone
 * (a different device than the manager's browser).
 */
import { publicFetch } from './http-client';
import type { Consent } from '../recovery';
import type { RecoveryPublicView } from './firestore-shapes';

export type PublicViewResult =
  | { kind: 'ok'; view: RecoveryPublicView }
  | { kind: 'expired' }
  | { kind: 'not-found' };

export async function fetchPublicView(token: string): Promise<PublicViewResult> {
  const resp = await publicFetch(`/recover/${encodeURIComponent(token)}`);
  if (resp.status === 404) return { kind: 'not-found' };
  if (resp.status === 410) return { kind: 'expired' };
  if (!resp.ok) throw new Error(`recover view failed (${resp.status})`);
  const view = (await resp.json()) as RecoveryPublicView;
  if (view.expired) return { kind: 'expired' };
  return { kind: 'ok', view };
}

async function post(token: string, body: unknown): Promise<void> {
  const resp = await publicFetch(`/recover/${encodeURIComponent(token)}`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const detail = await resp.text().catch(() => '');
    throw new Error(`submit failed (${resp.status}): ${detail}`);
  }
}

export function submitStep1(
  token: string,
  input: { email?: string; phone?: string; consent: Consent },
): Promise<void> {
  return post(token, { step: 'step1', ...input });
}

export function submitChildren(
  token: string,
  children: Array<{ dayMonth: string; year?: number; name?: string; gender?: 'Male' | 'Female' }>,
): Promise<void> {
  return post(token, { step: 'children', children });
}

/** Finish without sending children (the customer skipped step 2). */
export function submitComplete(token: string): Promise<void> {
  return post(token, { step: 'complete' });
}
