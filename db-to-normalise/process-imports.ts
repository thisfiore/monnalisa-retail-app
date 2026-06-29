/**
 * Offline batch processor for the two retail imports (Arezzo, Milano).
 *
 * Runs the SAME pipeline the app uses — deterministic normalize
 * (retail-normalize.ts) + the AI repair pass (openai-normalize.ts) — over the
 * source CSVs, then writes a Firebase-ready CSV per store plus a combined one.
 *
 * AI is applied only where it changes the outcome for this no-email cohort:
 * records whose locale is uncertain (fallback / low confidence), i.e. the
 * "is this Latin name actually Italian?" decision. Confident records (Italian
 * phone, non-Latin script, explicit phone country code) pass through
 * deterministically. A conservative E.164 fix (+39 for confirmed Italian
 * mobiles) is applied to everything.
 *
 * Run:  npx tsx db-to-normalise/process-imports.ts
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseRetailCsv } from '../src/lib/import/retail-parse.ts';
import { normalizeRetailRows } from '../src/lib/import/retail-normalize.ts';
import { repairRecord, applyRepairPatches } from '../src/lib/import/openai-normalize.ts';
import { flagsFor, decideStatus } from '../src/lib/import/normalize.ts';
import { isLocaleUncertain } from '../src/lib/import/locale.ts';
import type { RawRetailRow, StagingCustomer } from '../src/lib/import/types.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Make the OpenAI key available to getOpenAiClient() in Node.
const env = readFileSync(resolve(__dirname, '../.env.local'), 'utf-8');
const KEY = env.match(/VITE_OPENAI_API_KEY=(.+)/)?.[1]?.trim();
if (!KEY) throw new Error('VITE_OPENAI_API_KEY not found in .env.local');
process.env.VITE_OPENAI_API_KEY = KEY;

const NOW = Date.parse('2026-06-18T00:00:00Z');
const CONCURRENCY = 12;
const STORES = [
  { label: 'Arezzo', file: 'import-arezzo.csv' },
  { label: 'Milano', file: 'import-milano.csv' },
];

/* --------------------------------------------------------------- helpers */

async function pool<T, R>(
  items: T[],
  size: number,
  worker: (item: T, i: number) => Promise<R>,
  onTick?: (done: number, total: number) => void,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  let done = 0;
  async function run() {
    while (next < items.length) {
      const i = next++;
      results[i] = await worker(items[i], i);
      done++;
      if (onTick && done % 50 === 0) onTick(done, items.length);
    }
  }
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, run));
  return results;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function repairWithRetry(rec: StagingCustomer, tries = 4) {
  for (let t = 0; t < tries; t++) {
    try {
      return await repairRecord(rec);
    } catch (e) {
      if (t === tries - 1) throw e;
      await sleep(800 * (t + 1));
    }
  }
  throw new Error('unreachable');
}

/** Conservative E.164: only confirmed Italian mobiles get +39. */
function toE164(phone: string, locale: string): string {
  if (!phone || phone.startsWith('+')) return phone;
  const d = phone.replace(/\D/g, '');
  if (locale === 'it_IT' && /^3\d{8,9}$/.test(d)) return `+39${d}`;
  return phone;
}

function recomputeStatus(rec: StagingCustomer): StagingCustomer {
  const flags = flagsFor(rec.normalized);
  flags.localeUncertain = isLocaleUncertain({
    source: rec.normalized.localeSource,
    confidence: rec.normalized.localeConfidence,
  });
  return { ...rec, flags, status: decideStatus(rec.normalized, flags) };
}

const csvCell = (v: unknown): string => {
  // Flatten embedded newlines (AI notes are multi-line) so every record is a
  // single physical CSV line — safest for naive Firebase CSV importers.
  const s = (v === undefined || v === null ? '' : String(v)).replace(/\s*[\r\n]+\s*/g, ' / ');
  return /[",]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const HEADER = [
  'custSid', 'custId', 'importStore', 'storeName', 'sub', 'storeCountry',
  'firstName', 'lastName', 'email', 'phone', 'phoneAlt',
  'locale', 'localeSource', 'localeConfidence', 'localeReason', 'status',
  'aiProcessed', 'aiLocaleChanged', 'aiConfidence', 'aiNotes',
  'totalSales', 'totalUnits', 'ytdSales', 'storeCredit',
  'firstSaleDate', 'lastSaleDate', 'dateAmbiguous',
  'child1_dayMonth', 'child1_year', 'child2_dayMonth', 'child2_year',
  'consentPrivacy', 'consentLoyalty', 'consentMarketing', 'processedAt',
];

type OutRow = StagingCustomer & {
  importStore: string;
  aiProcessed: boolean;
  aiLocaleChanged: boolean;
};

function toCsvRow(rec: OutRow): string {
  const n = rec.normalized;
  const m = rec.metrics ?? {};
  const ch = n.children;
  const src = rec.source as RawRetailRow;
  const cells = [
    rec.custSid, src.custId, rec.importStore, n.csvStore,
    src.sub, n.country,
    n.firstName, n.lastName, n.email, n.phone, n.phoneAlt,
    n.locale, n.localeSource, n.localeConfidence.toFixed(2), n.localeReason, rec.status,
    rec.aiProcessed, rec.aiLocaleChanged, rec.aiConfidence ?? '', rec.aiNotes ?? '',
    m.totalSales ?? '', m.totalUnits ?? '', m.ytdSales ?? '', m.storeCredit ?? '',
    m.firstSaleDate ?? '', m.lastSaleDate ?? '', m.dateAmbiguous ? 1 : 0,
    ch[0]?.dayMonth ?? '', ch[0]?.year ?? '', ch[1]?.dayMonth ?? '', ch[1]?.year ?? '',
    rec.consent?.privacy ?? '', rec.consent?.loyalty ?? '', rec.consent?.marketing ?? '',
    new Date(NOW).toISOString().slice(0, 10),
  ];
  return cells.map(csvCell).join(',');
}

/* ------------------------------------------------------------------ main */

async function processStore(label: string, file: string): Promise<OutRow[]> {
  const text = readFileSync(resolve(__dirname, file), 'utf-8');
  const { rows } = parseRetailCsv(text);
  const staged = normalizeRetailRows(rows, { storeId: label.toLowerCase(), importId: `imp_${label}`, now: NOW });

  const limit = process.env.LIMIT ? Number(process.env.LIMIT) : Infinity;
  const uncertain = staged.filter((c) => c.flags.localeUncertain).slice(0, limit);
  console.error(`\n[${label}] ${staged.length} records · AI-processing ${uncertain.length} uncertain-locale records…`);

  const aiById = new Map<string, { localeChanged: boolean }>();
  let aiErrors = 0;
  await pool(
    uncertain,
    CONCURRENCY,
    async (rec) => {
      const before = rec.normalized.locale;
      try {
        const result = await repairWithRetry(rec);
        const patched = applyRepairPatches(rec, result);
        // mutate in place within `staged` via id lookup later
        Object.assign(rec, patched);
        aiById.set(rec.id, { localeChanged: patched.normalized.locale !== before });
      } catch (e) {
        aiErrors++;
        console.error(`  ! AI failed for ${rec.custSid}: ${e instanceof Error ? e.message : e}`);
      }
    },
    (d, t) => console.error(`  …${d}/${t}`),
  );
  if (aiErrors) console.error(`  (${aiErrors} AI errors left as deterministic)`);

  // Finalize: E.164 fix, recompute status, tag AI metadata.
  return staged.map((rec) => {
    rec.normalized.phone = toE164(rec.normalized.phone, rec.normalized.locale);
    rec.normalized.phoneAlt = toE164(rec.normalized.phoneAlt, rec.normalized.locale);
    const finalized = recomputeStatus(rec);
    const ai = aiById.get(rec.id);
    return { ...finalized, importStore: label, aiProcessed: !!ai, aiLocaleChanged: ai?.localeChanged ?? false };
  });
}

function summarize(label: string, recs: OutRow[]) {
  const tally = (f: (r: OutRow) => string) =>
    recs.reduce<Record<string, number>>((a, r) => ((a[f(r)] = (a[f(r)] ?? 0) + 1), a), {});
  const aiChanged = recs.filter((r) => r.aiLocaleChanged).length;
  const e164 = recs.filter((r) => r.normalized.phone.startsWith('+39')).length;
  console.error(`\n===== ${label} (${recs.length}) =====`);
  console.error('  status:', tally((r) => r.status));
  console.error('  locale:', tally((r) => r.normalized.locale));
  console.error(`  AI-processed: ${recs.filter((r) => r.aiProcessed).length} · locale changed by AI: ${aiChanged}`);
  console.error(`  phones normalized to +39 E.164: ${e164}`);
}

async function main() {
  const outDir = resolve(__dirname, 'processed');
  mkdirSync(outDir, { recursive: true });

  const all: OutRow[] = [];
  for (const { label, file } of STORES) {
    const recs = await processStore(label, file);
    summarize(label, recs);
    const csv = '﻿' + [HEADER.join(','), ...recs.map(toCsvRow)].join('\n') + '\n';
    const out = resolve(outDir, `firebase-${label.toLowerCase()}.csv`);
    writeFileSync(out, csv);
    console.error(`  → wrote ${out}`);
    all.push(...recs);
  }

  const combined = '﻿' + [HEADER.join(','), ...all.map(toCsvRow)].join('\n') + '\n';
  writeFileSync(resolve(outDir, 'firebase-all.csv'), combined);
  summarize('COMBINED', all);
  console.error(`\n✓ Done. ${all.length} records written to db-to-normalise/processed/`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
