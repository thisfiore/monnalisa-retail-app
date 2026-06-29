import { openDB } from 'idb';
import type { DBSchema, IDBPDatabase } from 'idb';
import type { ImportRecord, RecoveryLink, StagingCustomer, StagingStatus } from './types';

const DB_NAME = 'monnalisa-import';
const DB_VERSION = 3;

interface ImportDB extends DBSchema {
  imports: {
    key: string;
    value: ImportRecord;
    indexes: { 'by-storeId': string; 'by-uploadedAt': number };
  };
  stagingCustomers: {
    key: string;
    value: StagingCustomer;
    indexes: {
      'by-storeId': string;
      'by-importId': string;
      'by-status': StagingStatus;
      'by-store-status': [string, StagingStatus];
    };
  };
  recoveryLinks: {
    key: string;
    value: RecoveryLink;
    indexes: { 'by-customerId': string; 'by-storeId': string; 'by-importId': string };
  };
}

let dbPromise: Promise<IDBPDatabase<ImportDB>> | null = null;

function getDb(): Promise<IDBPDatabase<ImportDB>> {
  if (!dbPromise) {
    dbPromise = openDB<ImportDB>(DB_NAME, DB_VERSION, {
      upgrade(db, _oldVersion, _newVersion, tx) {
        if (!db.objectStoreNames.contains('imports')) {
          const imports = db.createObjectStore('imports', { keyPath: 'id' });
          imports.createIndex('by-storeId', 'storeId');
          imports.createIndex('by-uploadedAt', 'uploadedAt');
        }

        if (!db.objectStoreNames.contains('stagingCustomers')) {
          const staging = db.createObjectStore('stagingCustomers', { keyPath: 'id' });
          staging.createIndex('by-storeId', 'storeId');
          staging.createIndex('by-importId', 'importId');
          staging.createIndex('by-status', 'status');
          staging.createIndex('by-store-status', ['storeId', 'status']);
        }

        // v2: token → staging-record mapping for the public recovery page.
        if (!db.objectStoreNames.contains('recoveryLinks')) {
          const links = db.createObjectStore('recoveryLinks', { keyPath: 'token' });
          links.createIndex('by-customerId', 'customerId');
        }

        // v3: index recovery links by store/import for the outreach dashboard.
        const links = tx.objectStore('recoveryLinks');
        if (!links.indexNames.contains('by-storeId')) {
          links.createIndex('by-storeId', 'storeId');
        }
        if (!links.indexNames.contains('by-importId')) {
          links.createIndex('by-importId', 'importId');
        }
      },
    });
  }
  return dbPromise;
}

export async function createImport(rec: ImportRecord): Promise<void> {
  const db = await getDb();
  await db.put('imports', rec);
}

export async function updateImport(rec: ImportRecord): Promise<void> {
  const db = await getDb();
  await db.put('imports', rec);
}

export async function getImport(id: string): Promise<ImportRecord | undefined> {
  const db = await getDb();
  return db.get('imports', id);
}

export async function listImportsForStore(storeId: string): Promise<ImportRecord[]> {
  const db = await getDb();
  const all = await db.getAllFromIndex('imports', 'by-storeId', storeId);
  return all.sort((a, b) => b.uploadedAt - a.uploadedAt);
}

export async function addCustomersBatch(customers: StagingCustomer[]): Promise<void> {
  if (customers.length === 0) return;
  const db = await getDb();
  const tx = db.transaction('stagingCustomers', 'readwrite');
  await Promise.all(customers.map((c) => tx.store.put(c)));
  await tx.done;
}

export async function getCustomer(id: string): Promise<StagingCustomer | undefined> {
  const db = await getDb();
  return db.get('stagingCustomers', id);
}

export async function updateCustomer(c: StagingCustomer): Promise<void> {
  const db = await getDb();
  await db.put('stagingCustomers', { ...c, updatedAt: Date.now() });
}

export type CustomerListFilter = {
  storeId: string;
  importId?: string;
  status?: StagingStatus;
};

export async function listCustomers(filter: CustomerListFilter): Promise<StagingCustomer[]> {
  const db = await getDb();
  let results: StagingCustomer[];
  if (filter.status) {
    results = await db.getAllFromIndex('stagingCustomers', 'by-store-status', [
      filter.storeId,
      filter.status,
    ]);
  } else {
    results = await db.getAllFromIndex('stagingCustomers', 'by-storeId', filter.storeId);
  }
  if (filter.importId) {
    results = results.filter((c) => c.importId === filter.importId);
  }
  return results;
}

export async function countByStatus(
  storeId: string,
  importId?: string,
): Promise<Record<StagingStatus, number>> {
  const all = await listCustomers({ storeId, importId });
  const counts = {
    ready: 0,
    review: 0,
    blocked: 0,
    duplicate: 0,
    created: 0,
    failed: 0,
    skipped: 0,
  };
  for (const c of all) counts[c.status]++;
  return counts;
}

export async function createRecoveryLink(link: RecoveryLink): Promise<void> {
  const db = await getDb();
  await db.put('recoveryLinks', link);
}

export async function getRecoveryLink(token: string): Promise<RecoveryLink | undefined> {
  const db = await getDb();
  return db.get('recoveryLinks', token);
}

/** Reuse an existing active link for a record instead of minting duplicates. */
export async function getLinkForCustomer(
  customerId: string,
): Promise<RecoveryLink | undefined> {
  const db = await getDb();
  const links = await db.getAllFromIndex('recoveryLinks', 'by-customerId', customerId);
  return links.sort((a, b) => b.createdAt - a.createdAt)[0];
}

export async function updateRecoveryLink(link: RecoveryLink): Promise<void> {
  const db = await getDb();
  await db.put('recoveryLinks', link);
}

/** All recovery links for a store — feeds the outreach tracking dashboard. */
export async function listRecoveryLinksForStore(storeId: string): Promise<RecoveryLink[]> {
  const db = await getDb();
  return db.getAllFromIndex('recoveryLinks', 'by-storeId', storeId);
}

/** All recovery links minted for a given import. */
export async function listRecoveryLinksForImport(importId: string): Promise<RecoveryLink[]> {
  const db = await getDb();
  return db.getAllFromIndex('recoveryLinks', 'by-importId', importId);
}

/** Danger zone — used by a "reset" button in the UI during prototype work. */
export async function deleteAllForStore(storeId: string): Promise<void> {
  const db = await getDb();
  const txC = db.transaction('stagingCustomers', 'readwrite');
  const customers = await txC.store.index('by-storeId').getAllKeys(storeId);
  await Promise.all(customers.map((k) => txC.store.delete(k)));
  await txC.done;
  const txI = db.transaction('imports', 'readwrite');
  const imports = await txI.store.index('by-storeId').getAllKeys(storeId);
  await Promise.all(imports.map((k) => txI.store.delete(k)));
  await txI.done;
}
