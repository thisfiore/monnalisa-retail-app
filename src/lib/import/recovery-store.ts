/**
 * Storage seam for recovery links. The app is Mongo-only: the single backend is
 * the `recovery-api` microservice (`VITE_RECOVERY_BACKEND` is effectively always
 * `http`). Kept as a thin interface so call sites stay decoupled from the wire.
 */
import type { RecoveryLink, RecoveryStage, RecoveryCrm, StagingCustomer } from './types';
import type { RecoverySubmission } from './recovery-backend/firestore-shapes';
import { createHttpRecoveryStore } from './recovery-backend/http-store';

export type RecoveryBackend = 'http';

/** One entry in the recovery→CRM drain queue (the customer submitted an email). */
export type CrmQueueItem = {
  token: string;
  customerId: string; // customerRef = staging id `${storeId}:${customerNo}`
  importId: string;
  submission?: RecoverySubmission;
  crm?: RecoveryCrm;
  stage?: RecoveryStage;
};

/** Outcome the manager browser reports after attempting a CRM create/update. */
export type CrmResultReport = {
  ok: boolean;
  accountId?: string;
  op?: 'create' | 'update';
  error?: string;
};

export interface RecoveryStore {
  readonly backend: RecoveryBackend;
  /** Mint or reuse a link for a staging record. */
  ensureLink(rec: Pick<StagingCustomer, 'id' | 'storeId' | 'importId'>): Promise<RecoveryLink>;
  getLink(token: string): Promise<RecoveryLink | undefined>;
  getLinkForCustomer(customerId: string): Promise<RecoveryLink | undefined>;
  /** Push the minimal record so the link resolves on the customer's device. */
  publish(rec: StagingCustomer, link: RecoveryLink): Promise<void>;
  /** Persist that an SMS was sent (sentAt/sendCount/body) + publish. */
  recordSent(rec: StagingCustomer, link: RecoveryLink, body: string): Promise<RecoveryLink>;
  /** Read what the customer submitted on their device. */
  pullSubmission(token: string): Promise<RecoverySubmission | undefined>;
  /** All links for an import — feeds the outreach tracking dashboard. */
  listLinksForImport(importId: string): Promise<RecoveryLink[]>;
  /** Links awaiting CRM create/update (customer submitted an email). */
  listCrmQueue(importId?: string): Promise<CrmQueueItem[]>;
  /** Report the outcome of a CRM create/update the manager browser performed. */
  reportCrmResult(token: string, result: CrmResultReport): Promise<void>;
  /** Advance the manager outreach funnel stage for a link. */
  setStage(token: string, stage: RecoveryStage): Promise<void>;
}

/**
 * Resolve the recovery store. `getToken` (the manager's Firebase ID token getter)
 * is required — every call is authenticated against the microservice.
 */
export function getRecoveryStore(deps: { getToken: () => Promise<string> }): RecoveryStore {
  if (!deps?.getToken) throw new Error('recovery store requires a getToken provider');
  return createHttpRecoveryStore({ getToken: deps.getToken });
}
