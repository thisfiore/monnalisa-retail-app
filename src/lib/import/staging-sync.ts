/**
 * Sync the local customers system (IndexedDB) with the durable Mongo store.
 *
 *  - moveToBackend: push every import + its staging customers to Mongo
 *    ("Move to Mongo" / recover the locally-processed contacts into the DB).
 *  - recoverFromBackend: pull them back into IndexedDB (another device / prod).
 *
 * Pushes in batches and re-reads the token per batch so a long upload doesn't
 * fail on token expiry.
 */
import {
  addCustomersBatch,
  createImport,
  listCustomers,
  listImportsForStore,
} from './staging-db';
import {
  pullCustomers,
  pullImports,
  pushCustomers,
  pushImports,
} from './recovery-backend/staging-client';

const BATCH = 500;

export type SyncProgress = { phase: 'imports' | 'customers'; done: number; total: number };

export async function moveToBackend(
  storeId: string,
  getToken: () => Promise<string>,
  onProgress?: (p: SyncProgress) => void,
): Promise<{ imports: number; customers: number }> {
  const imports = await listImportsForStore(storeId);
  await pushImports(imports, await getToken());
  onProgress?.({ phase: 'imports', done: imports.length, total: imports.length });

  // Gather all customers across imports, then push in batches.
  const all: Awaited<ReturnType<typeof listCustomers>> = [];
  for (const imp of imports) {
    all.push(...(await listCustomers({ storeId, importId: imp.id })));
  }
  let done = 0;
  for (let i = 0; i < all.length; i += BATCH) {
    const slice = all.slice(i, i + BATCH);
    await pushCustomers(slice, await getToken());
    done += slice.length;
    onProgress?.({ phase: 'customers', done, total: all.length });
  }
  return { imports: imports.length, customers: all.length };
}

export async function recoverFromBackend(
  getToken: () => Promise<string>,
  onProgress?: (p: SyncProgress) => void,
): Promise<{ imports: number; customers: number }> {
  const imports = await pullImports(await getToken());
  for (const imp of imports) await createImport(imp);
  onProgress?.({ phase: 'imports', done: imports.length, total: imports.length });

  let done = 0;
  let total = 0;
  for (const imp of imports) {
    const customers = await pullCustomers(imp.id, await getToken());
    await addCustomersBatch(customers);
    done += customers.length;
    total += customers.length;
    onProgress?.({ phase: 'customers', done, total });
  }
  return { imports: imports.length, customers: total };
}
