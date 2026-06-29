/**
 * Manager client for the durable "customers system" on the recovery-api
 * (imports + staging customers). Pairs with the `local IndexedDB` working copy:
 * push to move data to Mongo, pull to recover it on another device / in prod.
 */
import { managerFetch } from './http-client';
import type { ImportRecord, StagingCustomer } from '../types';

export async function pushImports(imports: ImportRecord[], token: string): Promise<void> {
  if (imports.length === 0) return;
  await managerFetch('/staging/imports', token, {
    method: 'PUT',
    body: JSON.stringify({ imports }),
  });
}

export async function pullImports(token: string): Promise<ImportRecord[]> {
  const r = (await managerFetch('/staging/imports', token)) as { imports?: ImportRecord[] };
  return r.imports ?? [];
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
