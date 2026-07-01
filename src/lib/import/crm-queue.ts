/**
 * Drains the recovery→CRM queue from the manager browser.
 *
 * A customer recovering their email marks the link `crm.state='pending'` in the
 * recovery-api Mongo (the backend holds no CRM credential). Whenever a manager
 * app is open, this drains that queue: it loads the full staging record, folds
 * in what the customer submitted, and creates/updates the Salesforce account
 * with the logged-in manager's token — the exact path the manual "Approve &
 * create" button uses — then reports the outcome back so the link flips to
 * `converted`.
 */
import { getCustomer } from './recovery-backend/staging-client';
import { persistCustomer } from './staging-sync';
import { mergeSubmission } from './recovery-backend/firestore-shapes';
import { createOrUpdateCrmAccount } from './crm-create';
import type { RecoveryStore } from './recovery-store';
import type { StagingCustomer } from './types';

export type CrmQueueSummary = {
  total: number;
  created: number;
  updated: number;
  failed: number;
  skipped: number; // queued link with no staging record found
};

export type ProcessCrmQueueDeps = {
  storeId: string;
  getToken: () => Promise<string>;
  store: RecoveryStore;
  importId?: string;
  onProgress?: (done: number, total: number) => void;
};

/** Process every pending/failed CRM-queue link for the store (best-effort, sequential). */
export async function processCrmQueue(deps: ProcessCrmQueueDeps): Promise<CrmQueueSummary> {
  const { storeId, getToken, store, importId, onProgress } = deps;
  const items = await store.listCrmQueue(importId);
  const summary: CrmQueueSummary = {
    total: items.length,
    created: 0,
    updated: 0,
    failed: 0,
    skipped: 0,
  };

  let done = 0;
  for (const item of items) {
    try {
      const token = await getToken();
      let rec = await getCustomer(item.customerId, token);
      if (!rec) {
        summary.skipped++;
        continue;
      }
      if (item.submission) {
        rec = mergeSubmission(rec, item.submission);
      }

      const { accountId, op } = await createOrUpdateCrmAccount(rec, token, storeId);

      // Mirror the manual-approve write so the staging record reflects the push.
      const patched: StagingCustomer = {
        ...rec,
        status: 'created',
        createdAccountId: accountId ?? rec.createdAccountId,
        lastError: undefined,
        ...(item.submission ? { customerSubmittedAt: Date.now() } : {}),
      };
      await persistCustomer(patched, getToken);

      await store.reportCrmResult(item.token, { ok: true, accountId, op });
      if (op === 'create') summary.created++;
      else summary.updated++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      summary.failed++;
      await store.reportCrmResult(item.token, { ok: false, error: msg }).catch(() => {});
    } finally {
      done++;
      onProgress?.(done, items.length);
    }
  }

  return summary;
}
