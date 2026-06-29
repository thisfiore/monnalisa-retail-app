import Papa from 'papaparse';
import type { ParseError } from 'papaparse';
import { flagsFor, decideStatus } from './normalize';
import { isLocaleUncertain } from './locale';
import type { LocaleSource } from './locale';
import type {
  ImportSummary,
  NormalizedChild,
  NormalizedFields,
  RawRetailRow,
  RetailMetrics,
  StagingCustomer,
} from './types';

/**
 * Loader for the already-normalized output of `process-imports.ts`
 * (`db-to-normalise/processed/firebase-*.csv`). This lets the app surface the
 * offline AI-normalized records in the review UI without re-running the AI.
 */

const LOCALE_SOURCES = ['phone', 'name-script', 'store', 'fallback'] as const;

export type ProcessedRow = Record<string, string>;

export type ProcessedParseResult = {
  rows: ProcessedRow[];
  summary: ImportSummary;
  parseErrors: ParseError[];
};

/** Header sniff: the processed export has these exact lower-camel columns. */
export function isProcessedCsv(text: string): boolean {
  const head = (text.startsWith('﻿') ? text.slice(1) : text).slice(0, 2000);
  const firstLine = head.split(/\r?\n/, 1)[0] ?? '';
  return firstLine.includes('custSid') && firstLine.includes('aiProcessed');
}

export function parseProcessedCsv(text: string): ProcessedParseResult {
  const cleaned = text.startsWith('﻿') ? text.slice(1) : text;
  const result = Papa.parse<ProcessedRow>(cleaned, {
    header: true,
    delimiter: ',',
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  const rows: ProcessedRow[] = [];
  const storeCounts = new Map<string, number>();
  let corruptedRows = 0;
  const seen = new Set<string>();

  for (const raw of result.data) {
    const sid = (raw.custSid ?? '').trim();
    if (!sid) {
      corruptedRows++;
      continue;
    }
    if (seen.has(sid)) continue;
    seen.add(sid);
    rows.push(raw);
    const s = raw.storeName || raw.importStore || '(unknown)';
    storeCounts.set(s, (storeCounts.get(s) ?? 0) + 1);
  }
  corruptedRows += result.errors.length;

  return {
    rows,
    parseErrors: result.errors,
    summary: {
      totalRows: result.data.length,
      parsedRows: rows.length,
      corruptedRows,
      totalRowDropped: false,
      csvStoresFound: Array.from(storeCounts.entries())
        .map(([name, rowCount]) => ({ name, rowCount }))
        .sort((a, b) => b.rowCount - a.rowCount),
    },
  };
}

function childFrom(dayMonth: string, year: string): NormalizedChild | null {
  const dm = (dayMonth ?? '').trim();
  if (!dm) return null;
  const y = (year ?? '').trim();
  const yearNum = y ? Number(y) : undefined;
  const yearKnown = yearNum !== undefined && !Number.isNaN(yearNum);
  const child: NormalizedChild = { dayMonth: dm, yearKnown };
  if (yearKnown) child.year = yearNum;
  return child;
}

const num = (s: string): number | undefined => {
  const t = (s ?? '').trim();
  if (!t) return undefined;
  const n = Number(t);
  return Number.isNaN(n) ? undefined : n;
};

function localeSourceOf(s: string): LocaleSource {
  return (LOCALE_SOURCES as readonly string[]).includes(s) ? (s as LocaleSource) : 'fallback';
}

export function buildStagingFromProcessed(
  row: ProcessedRow,
  ctx: { storeId: string; importId: string; now: number },
): StagingCustomer {
  const children = [
    childFrom(row.child1_dayMonth, row.child1_year),
    childFrom(row.child2_dayMonth, row.child2_year),
  ].filter((c): c is NormalizedChild => c !== null);

  const normalized: NormalizedFields = {
    firstName: row.firstName ?? '',
    lastName: row.lastName ?? '',
    email: row.email ?? '',
    phone: row.phone ?? '',
    phoneAlt: row.phoneAlt ?? '',
    country: row.storeCountry ?? '',
    locale: row.locale ?? '',
    localeSource: localeSourceOf(row.localeSource),
    localeConfidence: num(row.localeConfidence) ?? 0,
    localeReason: row.localeReason ?? '',
    csvStore: row.storeName ?? '',
    type: '',
    children,
    customerLastSale: row.lastSaleDate || undefined,
  };

  const flags = flagsFor(normalized);
  flags.localeUncertain = isLocaleUncertain({
    source: normalized.localeSource,
    confidence: normalized.localeConfidence,
  });
  const status = decideStatus(normalized, flags);

  const metrics: RetailMetrics = {
    totalSales: num(row.totalSales),
    totalUnits: num(row.totalUnits),
    ytdSales: num(row.ytdSales),
    storeCredit: num(row.storeCredit),
    firstSaleDate: row.firstSaleDate || undefined,
    lastSaleDate: row.lastSaleDate || undefined,
    dateAmbiguous: row.dateAmbiguous === '1',
  };

  // Minimal RawRetailRow so the editor's Source panel renders.
  const source: RawRetailRow = {
    custSid: row.custSid,
    custId: row.custId ?? '',
    first: row.firstName ?? '',
    last: row.lastName ?? '',
    storeName: row.storeName ?? '',
    sub: row.sub ?? '',
    countryCode: '',
    email: row.email ?? '',
    phone1: row.phone ?? '',
    phone2: row.phoneAlt ?? '',
    compl1: row.child1_dayMonth ?? '',
    compl2: row.child2_dayMonth ?? '',
    firstSaleDate: row.firstSaleDate ?? '',
    lastSaleDate: row.lastSaleDate ?? '',
    totalSales: row.totalSales ?? '',
    totalUnits: row.totalUnits ?? '',
    ytdSales: row.ytdSales ?? '',
    storeCredit: row.storeCredit ?? '',
    dateExcelSerial: row.dateAmbiguous === '1' ? '1' : '0',
  };

  const aiNotes = (row.aiNotes ?? '').trim();
  const aiConfidence = num(row.aiConfidence);

  return {
    id: `${ctx.storeId}:${row.custSid}`,
    storeId: ctx.storeId,
    customerId: row.custSid,
    importId: ctx.importId,
    sourceSchema: 'retail',
    custSid: row.custSid,
    metrics,
    source,
    normalized,
    status,
    flags,
    aiNotes: aiNotes || undefined,
    aiConfidence,
    createdAt: ctx.now,
    updatedAt: ctx.now,
  };
}

export function normalizeProcessedRows(
  rows: ProcessedRow[],
  ctx: { storeId: string; importId: string; now: number },
): StagingCustomer[] {
  const seen = new Set<string>();
  const out: StagingCustomer[] = [];
  for (const row of rows) {
    const sid = (row.custSid ?? '').trim();
    if (!sid || seen.has(sid)) continue;
    seen.add(sid);
    out.push(buildStagingFromProcessed(row, ctx));
  }
  return out;
}
