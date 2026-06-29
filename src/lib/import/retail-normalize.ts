import {
  decideStatus,
  flagsFor,
  normalizeEmail,
  normalizePhone,
  titleCaseName,
  toE164ForLocale,
} from './normalize';
import { resolveLocale, isLocaleUncertain } from './locale';
import type {
  NormalizedChild,
  NormalizedFields,
  RawRetailRow,
  RetailMetrics,
  StagingCustomer,
} from './types';

/** Newborns are plausible; anything past this is a sentinel/placeholder year. */
const MAX_BIRTH_YEAR = 2027;

/**
 * Store country from the `Sub` store-group code (e.g. "001_OUTLET_ITA" → Italy).
 * This is the STORE's location — used by the locale resolver only as a weak
 * prior / to trigger the Italy tourist rule. The unreliable `Country Code`
 * column is deliberately NOT consulted.
 */
/**
 * Sub codes are token-joined (e.g. "001_OUTLET_ITA", "62_HONG KONG"), so we
 * tokenize on non-letters and match country keywords. A plain `\bUSA\b` would
 * miss "OUTLET_USA" because "_" is a word character.
 */
const TOKEN_COUNTRY: Record<string, string> = {
  ITA: 'Italy', ITALIA: 'Italy',
  CHINA: 'China', CHN: 'China',
  HONG: 'Hong Kong', KONG: 'Hong Kong', HKG: 'Hong Kong',
  SINGAPORE: 'Singapore', SGP: 'Singapore',
  TURKEY: 'Turkey', TUR: 'Turkey',
  RUSSIA: 'Russia', RUS: 'Russia',
  MIAMI: 'United States', USA: 'United States',
  SPAIN: 'Spain', ESP: 'Spain',
  FRANCE: 'France', FRA: 'France',
  BELGIUM: 'Belgium', BEL: 'Belgium',
  TAIWAN: 'Taiwan', TWN: 'Taiwan',
  JAPAN: 'Japan', JPN: 'Japan',
  HARRODS: 'United Kingdom', LONDON: 'United Kingdom', UK: 'United Kingdom', GBR: 'United Kingdom',
};

export function storeCountryFromSub(sub: string): string {
  for (const token of (sub || '').toUpperCase().split(/[^A-Z]+/)) {
    if (token && TOKEN_COUNTRY[token]) return TOKEN_COUNTRY[token];
  }
  return ''; // unknown → resolver falls back to English, never Italian
}

/** "1.234,56" / "367,80" / "0,00" → number; "" → undefined. */
function parseNum(s: string): number | undefined {
  const t = (s ?? '').trim();
  if (!t) return undefined;
  const normalized = t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t;
  const n = Number(normalized);
  return Number.isNaN(n) ? undefined : n;
}

/** Parse a "DD/MM/YYYY" birthday; future/sentinel years → year unknown. */
function parseRetailChild(s: string): NormalizedChild | null {
  const t = (s ?? '').trim();
  if (!t || t === '-') return null;
  const m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const [, d, mo, y] = m;
  const year = Number(y);
  const yearKnown = year >= 1900 && year <= MAX_BIRTH_YEAR;
  const child: NormalizedChild = {
    dayMonth: `${d.padStart(2, '0')}/${mo.padStart(2, '0')}`,
    yearKnown,
  };
  if (yearKnown) child.year = year;
  return child;
}

export function normalizeRetailRow(row: RawRetailRow): NormalizedFields {
  const firstName = titleCaseName(row.first);
  const lastName = titleCaseName(row.last);
  const country = storeCountryFromSub(row.sub);
  const locale = resolveLocale({
    storeCountry: country,
    phones: [row.phone1, row.phone2],
    name: `${row.first} ${row.last}`,
  });

  const children: NormalizedChild[] = [];
  const c1 = parseRetailChild(row.compl1);
  const c2 = parseRetailChild(row.compl2);
  if (c1) children.push(c1);
  if (c2) children.push(c2);

  // E.164-normalise confident Italian mobiles (e.g. 3471682897 → +393471682897),
  // matching the offline batch — so the list doesn't flag them "not E.164".
  return {
    firstName,
    lastName,
    email: normalizeEmail(row.email),
    phone: toE164ForLocale(normalizePhone(row.phone1), locale.locale),
    phoneAlt: toE164ForLocale(normalizePhone(row.phone2), locale.locale),
    country,
    locale: locale.locale,
    localeSource: locale.source,
    localeConfidence: locale.confidence,
    localeReason: locale.reason,
    csvStore: row.storeName,
    type: '',
    children,
    customerLastSale: row.lastSaleDate || undefined,
  };
}

function metricsFromRow(row: RawRetailRow): RetailMetrics {
  return {
    totalSales: parseNum(row.totalSales),
    totalUnits: parseNum(row.totalUnits),
    ytdSales: parseNum(row.ytdSales),
    storeCredit: parseNum(row.storeCredit),
    firstSaleDate: row.firstSaleDate || undefined,
    lastSaleDate: row.lastSaleDate || undefined,
    dateAmbiguous: row.dateExcelSerial === '1',
  };
}

export function buildStagingFromRetail(
  row: RawRetailRow,
  ctx: { storeId: string; importId: string; now: number },
): StagingCustomer {
  const normalized = normalizeRetailRow(row);
  const flags = flagsFor(normalized);
  flags.localeUncertain = isLocaleUncertain({
    source: normalized.localeSource,
    confidence: normalized.localeConfidence,
  });
  const status = decideStatus(normalized, flags);
  return {
    id: `${ctx.storeId}:${row.custSid}`,
    storeId: ctx.storeId,
    customerId: row.custSid,
    importId: ctx.importId,
    sourceSchema: 'retail',
    custSid: row.custSid,
    metrics: metricsFromRow(row),
    source: row,
    normalized,
    status,
    flags,
    createdAt: ctx.now,
    updatedAt: ctx.now,
  };
}

/** Cust SID is unique, so this is a straight map (deduping defensively). */
export function normalizeRetailRows(
  rows: RawRetailRow[],
  ctx: { storeId: string; importId: string; now: number },
): StagingCustomer[] {
  const seen = new Set<string>();
  const out: StagingCustomer[] = [];
  for (const row of rows) {
    if (!row.custSid || seen.has(row.custSid)) continue;
    seen.add(row.custSid);
    out.push(buildStagingFromRetail(row, ctx));
  }
  return out;
}
