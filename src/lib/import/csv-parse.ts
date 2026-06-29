import Papa from 'papaparse';
import type { ParseError } from 'papaparse';
import type { ImportSummary, RawCsvRow } from './types';

/**
 * Parse a legacy Retail Pro CSV export.
 *
 * Quirks the parser handles:
 *  - UTF-8 BOM at the start of the file
 *  - Semicolon delimiter (not comma)
 *  - A leading "Total" summary row (line 2 of the file) that must be dropped
 *  - "-" placeholder values left as-is — interpretation happens in normalize.ts
 *  - Lines with embedded newlines or stray quotes that confuse the parser —
 *    Papa reports these as errors and we skip them rather than abort.
 */

const HEADER_MAP: Record<string, keyof RawCsvRow> = {
  COUNTRY: 'country',
  STORE: 'store',
  TYPE: 'type',
  'CUSTOMER ID': 'customerId',
  'CUSTOMER FULL NAME': 'customerFullName',
  'CUSTOMER ADDED': 'customerAdded',
  'CUSTOMER LST SALE DATE': 'customerLastSaleDate',
  'CUSTOMER EMAIL ADDR': 'email',
  'CUSTOMER PHONE 1': 'phone1',
  'CUSTOMER PHONE 2': 'phone2',
  'COMPLEANNO 1': 'compleanno1',
  'COMPLEANNO 2': 'compleanno2',
  QTY: 'qty',
  GROSS_SALES: 'grossSales',
  NET_SALES: 'netSales',
  DISCOUNT: 'discount',
  'DISCOUNT %': 'discountPct',
};

export type ParseResult = {
  rows: RawCsvRow[];
  summary: ImportSummary;
  parseErrors: ParseError[];
};

export function parseLegacyCsv(text: string): ParseResult {
  // Strip BOM if present.
  const cleaned = text.startsWith('﻿') ? text.slice(1) : text;

  const result = Papa.parse<Record<string, string>>(cleaned, {
    header: true,
    delimiter: ';',
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  let totalRowDropped = false;
  const rows: RawCsvRow[] = [];
  const storeCounts = new Map<string, number>();
  let corruptedRows = 0;

  for (const raw of result.data) {
    // The leading "Total" summary row has all metric values but no customer id;
    // its COUNTRY cell literally reads "Total".
    const country = (raw.COUNTRY ?? '').trim();
    if (country.toLowerCase() === 'total') {
      totalRowDropped = true;
      continue;
    }

    const mapped: Partial<RawCsvRow> = {};
    for (const [csvKey, ourKey] of Object.entries(HEADER_MAP)) {
      mapped[ourKey] = (raw[csvKey] ?? '').trim();
    }
    const row = mapped as RawCsvRow;

    // Quick sanity check — if essentially nothing is present, treat as corrupted.
    if (!row.country && !row.store && !row.customerId && !row.customerFullName) {
      corruptedRows++;
      continue;
    }

    rows.push(row);

    const s = row.store || '(unknown)';
    storeCounts.set(s, (storeCounts.get(s) ?? 0) + 1);
  }

  // Papa-reported errors count as corrupted.
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
      totalRowDropped,
      csvStoresFound,
    },
  };
}

/** Read a File from a drag-drop into a text string. */
export async function readFileAsText(file: File): Promise<string> {
  return await file.text();
}
