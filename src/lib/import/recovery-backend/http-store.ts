/**
 * HTTP-backed recovery store (manager/browser side) talking to the
 * `recovery-api` microservice. Selected by `VITE_RECOVERY_BACKEND=http`.
 *
 * Links + tracking + submissions live in Mongo; the manager's staging customers
 * stay in local IndexedDB. The token is minted client-side (uuid) and the doc
 * is created server-side on the first `publish`/`recordSent` (which is why it
 * resolves on the customer's phone after the SMS goes out).
 */
import { RECOVERY_LINK_TTL_MS } from '../recovery-links';
import { markLinkSent } from '../sms-send';
import type { RecoveryLink, StagingCustomer } from '../types';
import type { RecoveryStore } from '../recovery-store';
import { managerFetch, RecoveryApiError } from './http-client';
import {
  toRecoveryRecord,
  type RecoverySubmission,
} from './firestore-shapes';

const ms = (d: unknown): number | undefined =>
  d ? new Date(d as string).getTime() : undefined;

/** Backend document (or tracking projection) → the frontend `RecoveryLink`. */
export function docToLink(
  doc: Record<string, unknown>,
  fallback?: { storeId?: string; importId?: string },
): RecoveryLink {
  const submission = (doc.submission ?? {}) as Record<string, unknown>;
  return {
    token: String(doc.token),
    customerId: String(doc.customerRef),
    storeId: String(doc.storeId ?? fallback?.storeId ?? ''),
    importId: String(doc.importId ?? fallback?.importId ?? ''),
    createdAt: ms(doc.createdAt) ?? 0,
    expiresAt: ms(doc.expiresAt) ?? 0,
    status: (doc.status as RecoveryLink['status']) ?? 'active',
    openedAt: ms(doc.openedAt),
    openCount: typeof doc.openCount === 'number' ? doc.openCount : undefined,
    step1SubmittedAt: ms(submission.step1SubmittedAt),
    completedAt: ms(submission.completedAt),
    sentAt: ms(doc.sentAt),
    sendCount: typeof doc.sendCount === 'number' ? doc.sendCount : undefined,
    lastSmsBody: typeof doc.lastSmsBody === 'string' ? doc.lastSmsBody : undefined,
  };
}

function publishBody(rec: StagingCustomer, link: RecoveryLink): Record<string, unknown> {
  return {
    storeId: link.storeId,
    importId: link.importId,
    customerRef: link.customerId,
    record: toRecoveryRecord(rec),
    expiresAt: new Date(link.expiresAt).toISOString(),
    ...(link.sentAt ? { sentAt: new Date(link.sentAt).toISOString() } : {}),
    ...(typeof link.sendCount === 'number' ? { sendCount: link.sendCount } : {}),
    ...(link.lastSmsBody ? { lastSmsBody: link.lastSmsBody } : {}),
  };
}

export function createHttpRecoveryStore(deps: { getToken: () => Promise<string> }): RecoveryStore {
  const token = () => deps.getToken();

  async function getLinkForCustomer(id: string): Promise<RecoveryLink | undefined> {
    try {
      const doc = (await managerFetch(
        `/links?customerRef=${encodeURIComponent(id)}`,
        await token(),
      )) as Record<string, unknown>;
      return docToLink(doc);
    } catch (e) {
      if (e instanceof RecoveryApiError && e.status === 404) return undefined;
      throw e;
    }
  }

  async function put(rec: StagingCustomer, link: RecoveryLink): Promise<void> {
    await managerFetch(`/links/${encodeURIComponent(link.token)}`, await token(), {
      method: 'PUT',
      body: JSON.stringify(publishBody(rec, link)),
    });
  }

  return {
    backend: 'http',

    async ensureLink(rec) {
      const now = Date.now();
      const existing = await getLinkForCustomer(rec.id);
      if (existing && existing.expiresAt > now && existing.status !== 'expired') return existing;
      // Mint the token now; the server doc is created on publish()/recordSent().
      return {
        token: crypto.randomUUID(),
        customerId: rec.id,
        storeId: rec.storeId,
        importId: rec.importId,
        createdAt: now,
        expiresAt: now + RECOVERY_LINK_TTL_MS,
        status: 'active',
      };
    },

    async getLink(tok) {
      try {
        const doc = (await managerFetch(
          `/links/${encodeURIComponent(tok)}`,
          await token(),
        )) as Record<string, unknown>;
        return docToLink(doc);
      } catch (e) {
        if (e instanceof RecoveryApiError && e.status === 404) return undefined;
        throw e;
      }
    },

    getLinkForCustomer,

    async publish(rec, link) {
      await put(rec, link);
    },

    async recordSent(rec, link, body) {
      const marked = markLinkSent(link, body);
      await put(rec, marked);
      return marked;
    },

    async pullSubmission(tok): Promise<RecoverySubmission | undefined> {
      const doc = (await managerFetch(
        `/links/${encodeURIComponent(tok)}`,
        await token(),
      )) as { submission?: RecoverySubmission };
      return doc.submission;
    },

    async listLinksForImport(importId) {
      const res = (await managerFetch(
        `/links?importId=${encodeURIComponent(importId)}`,
        await token(),
      )) as { links?: Record<string, unknown>[] };
      return (res.links ?? []).map((d) => docToLink(d, { importId }));
    },
  };
}
