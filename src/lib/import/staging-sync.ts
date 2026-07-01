/**
 * Write helpers for the durable customers system (Mongo, via recovery-api).
 *
 * This is the ONLY persistence path — there is no local IndexedDB working copy.
 * Reads go through `recovery-backend/staging-client.ts`; these are the writes.
 */
import { pushCustomers, pushImports } from './recovery-backend/staging-client';
import type { ImportRecord, StagingCustomer } from './types';

const BATCH = 500;

type GetToken = () => Promise<string>;

/** Persist a single edited staging customer (upsert to Mongo). */
export async function persistCustomer(
  rec: StagingCustomer,
  getToken: GetToken,
): Promise<StagingCustomer> {
  const saved: StagingCustomer = { ...rec, updatedAt: Date.now() };
  await pushCustomers([saved], await getToken());
  return saved;
}

/** Upsert many staging customers, re-reading the token per batch (big imports). */
export async function saveCustomers(
  customers: StagingCustomer[],
  getToken: GetToken,
): Promise<void> {
  for (let i = 0; i < customers.length; i += BATCH) {
    await pushCustomers(customers.slice(i, i + BATCH), await getToken());
  }
}

/** Create/update an import record. */
export async function saveImport(rec: ImportRecord, getToken: GetToken): Promise<void> {
  await pushImports([rec], await getToken());
}
