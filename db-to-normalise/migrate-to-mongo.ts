/**
 * One-off migration: reconstruct the local customers system from the source
 * CSVs (the same files that populated the browser IndexedDB) through the live
 * pipeline, and emit Mongo-shaped NDJSON for `mongoimport` (upsert by `key`).
 *
 * Run:  npx tsx db-to-normalise/migrate-to-mongo.ts
 * Then: mongoimport --db recovery --collection importrecords      --mode upsert --upsertFields key --file /tmp/mig-imports.ndjson
 *       mongoimport --db recovery --collection stagingcustomerdocs --mode upsert --upsertFields key --file /tmp/mig-customers.ndjson
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseRetailCsv } from '../src/lib/import/retail-parse.ts';
import { normalizeRetailRows } from '../src/lib/import/retail-normalize.ts';
import { parseLegacyCsv } from '../src/lib/import/csv-parse.ts';
import { dedupAndNormalize } from '../src/lib/import/normalize.ts';
import type { ImportRecord, StagingCustomer } from '../src/lib/import/types.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const here = (f: string) => resolve(__dirname, f);

// Dev/local store id (FALLBACK_STORE_ID_DEV in src/lib/auth.tsx). If the
// logged-in account carries a different store_id claim, re-key with that value.
const STORE_ID = 'a0W0E000004p9WdUAI';
const NOW = Date.now();

type Job = { importId: string; filename: string; schema: 'retail' | 'legacy' };
// Real importIds the app already pushed (so reconstructed customers align with
// the existing import records — keyed by `${storeId}:${custSid}`, so re-import
// just upserts the right importId onto the same customer docs).
const JOBS: Job[] = [
  { importId: 'imp_1781786475388_ix4y7k', filename: 'import-arezzo.csv', schema: 'retail' },
  { importId: 'imp_1781786461515_i54xts', filename: 'import-milano.csv', schema: 'retail' },
  { importId: 'imp_1782716382107_11l612', filename: 'test-group.csv', schema: 'retail' },
  // sample.csv intentionally omitted: the on-disk file diverged from the
  // 61-row sample in IndexedDB, so it can't be faithfully reconstructed here —
  // it migrates via the in-app sync from the real local data instead.
];

const importLines: string[] = [];
const customerLines: string[] = [];

for (const job of JOBS) {
  const text = readFileSync(here(job.filename), 'utf-8');
  const ctx = { storeId: STORE_ID, importId: job.importId, now: NOW };

  let customers: StagingCustomer[];
  let summary: { totalRows: number; parsedRows: number; csvStoresFound: ImportRecord['csvStoresFound'] };

  if (job.schema === 'retail') {
    const { rows, summary: s } = parseRetailCsv(text);
    customers = normalizeRetailRows(rows, ctx);
    summary = s;
  } else {
    const { rows, summary: s } = parseLegacyCsv(text);
    customers = dedupAndNormalize(rows, ctx);
    summary = s;
  }

  const importRec: ImportRecord = {
    id: job.importId,
    filename: job.filename,
    storeId: STORE_ID,
    uploadedAt: NOW,
    totalRows: summary.totalRows,
    parsedRows: customers.length,
    skippedRows: 0,
    csvStoresFound: summary.csvStoresFound,
    ownedCsvStores: summary.csvStoresFound.map((s) => s.name),
  };
  importLines.push(JSON.stringify({ key: importRec.id, storeId: STORE_ID, data: importRec }));

  for (const c of customers) {
    customerLines.push(
      JSON.stringify({
        key: c.id,
        storeId: c.storeId,
        importId: c.importId,
        status: c.status,
        data: c,
      }),
    );
  }

  const byStatus = customers.reduce<Record<string, number>>((a, c) => {
    a[c.status] = (a[c.status] ?? 0) + 1;
    return a;
  }, {});
  console.error(`${job.filename}: ${customers.length} customers`, byStatus);
}

writeFileSync('/tmp/mig-imports.ndjson', importLines.join('\n') + '\n');
writeFileSync('/tmp/mig-customers.ndjson', customerLines.join('\n') + '\n');
console.error(`\nstoreId=${STORE_ID}`);
console.error(`Wrote ${importLines.length} imports and ${customerLines.length} customers to /tmp/mig-*.ndjson`);
