import Papa from 'papaparse';
import type { ParseError } from 'papaparse';
import type { ImportSummary, RawRetailRow } from './types';

/**
 * Parser for the newer retail-account export (the no-email cohort), after it has
 * been run through `db-to-normalise/xlsx-to-csv.py` into a clean text CSV.
 *
 * Differs from the legacy parser (`csv-parse.ts`): separate First/Last, a stable
 * `Cust SID` key, no "Total" summary row, and richer value columns. Store
 * ownership is keyed on `Store Name`.
 */

const HEADER_MAP: Record<string, keyof RawRetailRow> = {
  'Cust SID': 'custSid',
  'Cust ID': 'custId',
  First: 'first',
  Last: 'last',
  'Store Name': 'storeName',
  Sub: 'sub',
  'Country Code': 'countryCode',
  Email: 'email',
  Phone1: 'phone1',
  Phone2: 'phone2',
  'Compl 1': 'compl1',
  'Compl 2': 'compl2',
  'First Sale Dt': 'firstSaleDate',
  'Last Sale Dt': 'lastSaleDate',
  'Total Sales': 'totalSales',
  'Total Units': 'totalUnits',
  'YTD Sales': 'ytdSales',
  'Store Credit': 'storeCredit',
  date_excel_serial: 'dateExcelSerial',
};

export type RetailParseResult = {
  rows: RawRetailRow[];
  summary: ImportSummary;
  parseErrors: ParseError[];
};

/** Cheap header sniff so the upload UI can pick the right parser. */
export function isRetailCsv(text: string): boolean {
  const head = (text.startsWith('﻿') ? text.slice(1) : text).slice(0, 2000);
  const firstLine = head.split(/\r?\n/, 1)[0] ?? '';
  return firstLine.includes('Cust SID');
}

export function parseRetailCsv(text: string): RetailParseResult {
  const cleaned = text.startsWith('﻿') ? text.slice(1) : text;

  const result = Papa.parse<Record<string, string>>(cleaned, {
    header: true,
    delimiter: ';',
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  const rows: RawRetailRow[] = [];
  const storeCounts = new Map<string, number>();
  let corruptedRows = 0;
  const seenSid = new Set<string>();

  for (const raw of result.data) {
    const mapped: Partial<RawRetailRow> = {};
    for (const [csvKey, ourKey] of Object.entries(HEADER_MAP)) {
      mapped[ourKey] = (raw[csvKey] ?? '').trim();
    }
    const row = mapped as RawRetailRow;
    // Defensive: strip any stray quotes that survived conversion.
    row.custSid = row.custSid.replace(/^"+|"+$/g, '').trim();

    // Cust SID is the key; a row without it (or a duplicate) is unusable.
    if (!row.custSid) {
      corruptedRows++;
      continue;
    }
    if (seenSid.has(row.custSid)) continue;
    seenSid.add(row.custSid);

    rows.push(row);
    const s = row.storeName || '(unknown)';
    storeCounts.set(s, (storeCounts.get(s) ?? 0) + 1);
  }

  corruptedRows += result.errors.length;

  const csvStoresFound = Array.from(storeCounts.entries())
    .map(([name, rowCount]) => ({ name, rowCount }))
    .sort((a, b) => b.rowCount - a.rowCount);

  return {
    rows,
    parseErrors: result.errors,
    summary: {
      totalRows: result.data.length,
      parsedRows: rows.length,
      corruptedRows,
      totalRowDropped: false,
      csvStoresFound,
    },
  };
}
