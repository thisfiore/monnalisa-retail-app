/**
 * Firestore-backed recovery store (manager/browser side).
 *
 * Implemented but DORMANT: it throws `RecoveryBackendNotEnabled` unless
 * `VITE_FIREBASE_PROJECT_ID` is set and a token provider is supplied, and no
 * call site selects it yet (default backend is `local`). Reads/writes use the
 * manager's Firebase ID token and are governed by `firestore.rules`. The public
 * customer side never comes through here — it goes via `api/recover/[token]`.
 */
import { ensureRecoveryLink } from '../recovery-links';
import { getLinkForCustomer, getRecoveryLink } from '../staging-db';
import { markLinkSent } from '../sms-send';
import type { RecoveryLink, StagingCustomer } from '../types';
import type { RecoveryStore } from '../recovery-store';
import { firestoreFetch, fromFields, toFields, type FirestoreConfig } from './firestore-rest';
import { toRecoveryDoc, type RecoveryDoc, type RecoverySubmission } from './firestore-shapes';

export class RecoveryBackendNotEnabled extends Error {
  constructor(reason: string) {
    super(`Firestore recovery backend not enabled: ${reason}`);
    this.name = 'RecoveryBackendNotEnabled';
  }
}

function projectId(): string {
  const env = (import.meta as { env?: Record<string, string | undefined> }).env;
  const id = env?.VITE_FIREBASE_PROJECT_ID;
  if (!id) throw new RecoveryBackendNotEnabled('VITE_FIREBASE_PROJECT_ID is not set');
  return id;
}

export function createFirestoreRecoveryStore(deps: {
  getToken?: () => Promise<string>;
}): RecoveryStore {
  async function config(): Promise<FirestoreConfig> {
    if (!deps.getToken) throw new RecoveryBackendNotEnabled('no token provider supplied');
    return { projectId: projectId(), bearer: await deps.getToken() };
  }

  return {
    backend: 'firestore',

    // The token itself is still minted locally (crypto.randomUUID + IndexedDB);
    // publish() is what makes it resolvable cross-device.
    ensureLink: (rec) => ensureRecoveryLink(rec),
    getLink: (token) => getRecoveryLink(token),
    getLinkForCustomer: (id) => getLinkForCustomer(id),

    async publish(rec: StagingCustomer, link: RecoveryLink) {
      const cfg = await config();
      const doc = toRecoveryDoc(rec, link);
      // PATCH upserts the document at recoveryLinks/<token>.
      await firestoreFetch(cfg, `recoveryLinks/${link.token}`, {
        method: 'PATCH',
        body: { fields: toFields(doc as unknown as Record<string, unknown>) },
      });
    },

    async recordSent(rec: StagingCustomer, link: RecoveryLink, body: string) {
      const marked = markLinkSent(link, body);
      const cfg = await config();
      await firestoreFetch(cfg, `recoveryLinks/${marked.token}`, {
        method: 'PATCH',
        body: { fields: toFields(toRecoveryDoc(rec, marked) as unknown as Record<string, unknown>) },
      });
      return marked;
    },

    async listLinksForImport(): Promise<RecoveryLink[]> {
      // The dashboard query isn't implemented for the dormant Firestore adapter.
      throw new RecoveryBackendNotEnabled('listLinksForImport not supported (use the http backend)');
    },

    async pullSubmission(token: string): Promise<RecoverySubmission | undefined> {
      const cfg = await config();
      const raw = (await firestoreFetch(cfg, `recoveryLinks/${token}`)) as {
        fields?: Parameters<typeof fromFields>[0];
      };
      if (!raw.fields) return undefined;
      const doc = fromFields(raw.fields) as unknown as RecoveryDoc;
      return doc.submission;
    },
  };
}
