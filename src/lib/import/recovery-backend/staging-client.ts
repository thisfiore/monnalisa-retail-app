/**
 * Manager client for the durable "customers system" on the recovery-api
 * (imports + staging customers). Pairs with the `local IndexedDB` working copy:
 * push to move data to Mongo, pull to recover it on another device / in prod.
 */
import { managerFetch, RecoveryApiError } from './http-client';
import type { ImportRecord, StagingCustomer, StagingStatus } from '../types';

export async function pushImports(imports: ImportRecord[], token: string): Promise<void> {
  if (imports.length === 0) return;
  await managerFetch('/staging/imports', token, {
    method: 'PUT',
    body: JSON.stringify({ imports }),
  });
}

export async function pullImports(token: string): Promise<ImportRecord[]> {
  const r = (await managerFetch('/staging/imports', token)) as { imports?: ImportRecord[] };
  return (r.imports ?? []).sort((a, b) => b.uploadedAt - a.uploadedAt);
}

/** A single import by id (the service only exposes a store-scoped list). */
export async function getImport(id: string, token: string): Promise<ImportRecord | undefined> {
  return (await pullImports(token)).find((i) => i.id === id);
}

/** A single staging customer by id (`${storeId}:${customerNo}`). */
export async function getCustomer(
  id: string,
  token: string,
): Promise<StagingCustomer | undefined> {
  try {
    const r = (await managerFetch(
      `/staging/customers/${encodeURIComponent(id)}`,
      token,
    )) as { customer?: StagingCustomer };
    return r.customer ?? undefined;
  } catch (e) {
    if (e instanceof RecoveryApiError && e.status === 404) return undefined;
    throw e;
  }
}

export type StatusCounts = Record<StagingStatus, number> & { all: number };

const ZERO_COUNTS: StatusCounts = {
  all: 0,
  ready: 0,
  review: 0,
  blocked: 0,
  duplicate: 0,
  created: 0,
  failed: 0,
  skipped: 0,
};

/** Per-status counts for an import, aggregated server-side. */
export async function countByStatus(importId: string, token: string): Promise<StatusCounts> {
  const r = (await managerFetch(
    `/staging/customers/counts?importId=${encodeURIComponent(importId)}`,
    token,
  )) as { counts?: Partial<StatusCounts> };
  return { ...ZERO_COUNTS, ...(r.counts ?? {}) };
}

/** Server-side free-text search (name / email / phone / customerId). */
export async function searchCustomers(
  q: string,
  limit: number,
  token: string,
): Promise<StagingCustomer[]> {
  const r = (await managerFetch(
    `/staging/customers/search?q=${encodeURIComponent(q)}&limit=${limit}`,
    token,
  )) as { customers?: StagingCustomer[] };
  return r.customers ?? [];
}

export async function pushCustomers(customers: StagingCustomer[], token: string): Promise<void> {
  if (customers.length === 0) return;
  await managerFetch('/staging/customers', token, {
    method: 'PUT',
    body: JSON.stringify({ customers }),
  });
}

export async function pullCustomers(
  importId: string,
  token: string,
): Promise<StagingCustomer[]> {
  const r = (await managerFetch(
    `/staging/customers?importId=${encodeURIComponent(importId)}`,
    token,
  )) as { customers?: StagingCustomer[] };
  return r.customers ?? [];
}

export async function stagingSummary(token: string): Promise<{ imports: number; customers: number }> {
  return (await managerFetch('/staging/summary', token)) as { imports: number; customers: number };
}
