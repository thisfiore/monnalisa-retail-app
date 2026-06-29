import { describe, it, expect } from 'vitest';
import { parseLastSale, isWithinMonths, LAST_SALE_MONTH_RANGES } from '../../lib/import/last-sale.ts';

const NOW = Date.UTC(2026, 5, 29); // 2026-06-29

describe('parseLastSale', () => {
  it('parses ISO YYYY-MM-DD (legacy import)', () => {
    expect(parseLastSale('2026-03-15')).toBe(Date.UTC(2026, 2, 15));
  });

  it('parses DD/MM/YYYY (retail import)', () => {
    expect(parseLastSale('15/03/2026')).toBe(Date.UTC(2026, 2, 15));
    expect(parseLastSale('5/3/2026')).toBe(Date.UTC(2026, 2, 5));
  });

  it('returns undefined for empty or unparseable input', () => {
    expect(parseLastSale(undefined)).toBeUndefined();
    expect(parseLastSale('')).toBeUndefined();
    expect(parseLastSale('not-a-date')).toBeUndefined();
    expect(parseLastSale('2026/03/15')).toBeUndefined();
    expect(parseLastSale('15/13/2026')).toBeUndefined(); // month out of range
  });
});

describe('isWithinMonths', () => {
  it('includes a sale inside the window and excludes one before it', () => {
    expect(isWithinMonths('2026-05-01', 3, NOW)).toBe(true); // ~2 months ago
    expect(isWithinMonths('2026-01-01', 3, NOW)).toBe(false); // ~6 months ago
  });

  it('treats the boundary as inclusive', () => {
    expect(isWithinMonths('2025-12-29', 6, NOW)).toBe(true); // exactly 6 months back
  });

  it('honours each offered range against a ~7-month-old sale', () => {
    const sevenMonthsAgo = '2025-11-29';
    expect(isWithinMonths(sevenMonthsAgo, 6, NOW)).toBe(false);
    expect(isWithinMonths(sevenMonthsAgo, 12, NOW)).toBe(true);
  });

  it('excludes rows with no/unparseable last-sale date', () => {
    expect(isWithinMonths(undefined, 24, NOW)).toBe(false);
    expect(isWithinMonths('', 24, NOW)).toBe(false);
    expect(isWithinMonths('garbage', 24, NOW)).toBe(false);
  });

  it('offers the agreed month ranges', () => {
    expect([...LAST_SALE_MONTH_RANGES]).toEqual([1, 2, 3, 6, 12, 24]);
  });
});
