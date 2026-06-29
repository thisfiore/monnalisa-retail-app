/**
 * Last-purchase date helpers for the import review filter.
 *
 * `normalized.customerLastSale` is heterogeneous by source:
 *   - legacy CSV import  → ISO `YYYY-MM-DD` (see normalize.ts parseCsvDate)
 *   - retail import      → `DD/MM/YYYY` text (see retail-normalize.ts)
 * so the parser accepts both. Retail dates can be Excel-serial ambiguous
 * (day/month swapped); at the month granularity this filter uses, that rarely
 * shifts a record across a boundary, so we accept it rather than drop the row.
 */

/** The "last purchase within N months" ranges offered in the UI. */
export const LAST_SALE_MONTH_RANGES = [1, 2, 3, 6, 12, 24] as const;
export type LastSaleMonths = (typeof LAST_SALE_MONTH_RANGES)[number];

/** Parse a last-sale date string to epoch ms (UTC midnight). Returns undefined
 *  when empty or unparseable. */
export function parseLastSale(s: string | undefined): number | undefined {
  if (!s) return undefined;
  const t = s.trim();
  let y: string, mo: string, d: string;
  const iso = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    [, y, mo, d] = iso;
  } else {
    const dmy = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!dmy) return undefined;
    [, d, mo, y] = dmy;
  }
  const month = Number(mo);
  const day = Number(d);
  if (month < 1 || month > 12 || day < 1 || day > 31) return undefined;
  const ts = Date.UTC(Number(y), month - 1, day);
  return Number.isNaN(ts) ? undefined : ts;
}

/** Whether a last-sale date falls within the last `months` from `now`.
 *  Rows with no parseable date are treated as NOT within range (excluded when a
 *  range is active), since recency is unknown. */
export function isWithinMonths(
  lastSale: string | undefined,
  months: number,
  now: number = Date.now(),
): boolean {
  const ts = parseLastSale(lastSale);
  if (ts === undefined) return false;
  // Compute the cutoff in UTC so the boundary is stable across DST changes
  // (parseLastSale returns UTC midnight, so both sides must be UTC).
  const d = new Date(now);
  const cutoff = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - months, d.getUTCDate());
  return ts >= cutoff;
}
