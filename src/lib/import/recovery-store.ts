/**
 * Storage seam for recovery links. Lets the app swap the same-browser IndexedDB
 * store for a durable Firestore-backed one (cross-device SMS links) by flipping
 * `VITE_RECOVERY_BACKEND`, without touching call sites.
 *
 * Default is `local` and existing call sites are NOT yet routed through this
 * seam — see docs/recovery-backend.md. This is the prepared foundation; wiring
 * it in is a deliberate later step.
 */
import { ensureRecoveryLink } from './recovery-links';
import {
  getLinkForCustomer,
  getRecoveryLink,
  listRecoveryLinksForImport,
  updateRecoveryLink,
} from './staging-db';
import { markLinkSent } from './sms-send';
import type { RecoveryLink, StagingCustomer } from './types';
import type { RecoverySubmission } from './recovery-backend/firestore-shapes';
import { createFirestoreRecoveryStore } from './recovery-backend/firestore-store';
import { createHttpRecoveryStore } from './recovery-backend/http-store';

export type RecoveryBackend = 'local' | 'firestore' | 'http';

export interface RecoveryStore {
  readonly backend: RecoveryBackend;
  /** Mint or reuse a link for a staging record. */
  ensureLink(rec: Pick<StagingCustomer, 'id' | 'storeId' | 'importId'>): Promise<RecoveryLink>;
  getLink(token: string): Promise<RecoveryLink | undefined>;
  getLinkForCustomer(customerId: string): Promise<RecoveryLink | undefined>;
  /**
   * Push the minimal record so the link resolves on the customer's device.
   * No-op for `local` (the page reads the same browser's IndexedDB).
   */
  publish(rec: StagingCustomer, link: RecoveryLink): Promise<void>;
  /**
   * Persist that an SMS was sent (sentAt/sendCount/body) — and, for durable
   * backends, publish the record in the same write. Returns the updated link.
   */
  recordSent(rec: StagingCustomer, link: RecoveryLink, body: string): Promise<RecoveryLink>;
  /**
   * Read what the customer submitted. `undefined` for `local` — there the page
   * writes straight to the staging record, so there is no separate channel.
   */
  pullSubmission(token: string): Promise<RecoverySubmission | undefined>;
  /** All links for an import — feeds the outreach tracking dashboard. */
  listLinksForImport(importId: string): Promise<RecoveryLink[]>;
}

export const localRecoveryStore: RecoveryStore = {
  backend: 'local',
  ensureLink: (rec) => ensureRecoveryLink(rec),
  getLink: (token) => getRecoveryLink(token),
  getLinkForCustomer: (id) => getLinkForCustomer(id),
  async publish() {
    /* same-browser: nothing to publish */
  },
  async recordSent(_rec, link, body) {
    const marked = markLinkSent(link, body);
    await updateRecoveryLink(marked);
    return marked;
  },
  async pullSubmission() {
    return undefined;
  },
  listLinksForImport: (importId) => listRecoveryLinksForImport(importId),
};

function backendFromEnv(): RecoveryBackend {
  const env = (import.meta as { env?: Record<string, string | undefined> }).env;
  const v = env?.VITE_RECOVERY_BACKEND;
  if (v === 'http') return 'http';
  if (v === 'firestore') return 'firestore';
  return 'local';
}

/**
 * Resolve the active recovery store. Pass `getToken` (the manager's Firebase ID
 * token getter) for the durable backends (`http`/`firestore`); `local` ignores it.
 */
export function getRecoveryStore(deps?: { getToken?: () => Promise<string> }): RecoveryStore {
  const backend = backendFromEnv();
  if (backend === 'http') {
    if (!deps?.getToken) throw new Error('http recovery backend requires a getToken provider');
    return createHttpRecoveryStore({ getToken: deps.getToken });
  }
  if (backend === 'firestore') {
    return createFirestoreRecoveryStore({ getToken: deps?.getToken });
  }
  return localRecoveryStore;
}

/** The active backend without constructing a store (for UI flags / public page). */
export function activeRecoveryBackend(): RecoveryBackend {
  return backendFromEnv();
}
