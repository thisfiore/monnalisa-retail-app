import { formatPhoneE164, localeFromCountry } from '../api-transforms';
import { resolveLocale, isLocaleUncertain } from './locale';
import type {
  NormalizedChild,
  NormalizedFields,
  RawCsvRow,
  StagingCustomer,
  StagingFlags,
  StagingStatus,
} from './types';

const E164_REGEX = /^\+[1-9]\d{1,14}$/;
const EMAIL_REGEX = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const PLACEHOLDER = (s: string) => !s || s === '-';

/** CSV country spellings → spellings the existing `localeFromCountry` expects. */
const CSV_COUNTRY_ALIASES: Record<string, string> = {
  USA: 'United States',
  US: 'United States',
  UK: 'United Kingdom',
  'GREAT BRITAIN': 'United Kingdom',
};

export function mapCsvCountry(country: string): { country: string; locale: string } {
  const trimmed = country.trim();
  const aliased = CSV_COUNTRY_ALIASES[trimmed.toUpperCase()] ?? trimmed;
  return { country: aliased, locale: localeFromCountry(aliased) };
}

/**
 * Legacy CSV name format is "LASTNAME FIRSTNAME" (e.g. "SOK LUDMILA").
 * That's opposite of the convention in `api-transforms.splitName` which treats
 * the first token as the first name — so we have a dedicated splitter here.
 */
export function splitLegacyName(fullName: string): { firstName: string; lastName: string } {
  const cleaned = fullName.trim().replace(/\s+/g, ' ');
  if (!cleaned || cleaned === '-') return { firstName: '', lastName: '' };
  const parts = cleaned.split(' ');
  if (parts.length === 1) return { firstName: '', lastName: titleCase(parts[0]) };
  return {
    lastName: titleCase(parts[0]),
    firstName: titleCase(parts.slice(1).join(' ')),
  };
}

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split(' ')
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ')
    .replace(/'([a-z])/g, (_, c) => `'${c.toUpperCase()}`); // O'connor → O'Connor
}

/** Parse "DD/MM/YYYY" → ISO "YYYY-MM-DD"; return undefined on failure. */
export function parseCsvDate(s: string): string | undefined {
  if (PLACEHOLDER(s)) return undefined;
  const m = s.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return undefined;
  const [, d, mo, y] = m;
  return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

/**
 * Parse a COMPLEANNO field.
 *
 * Legacy quirk: every COMPLEANNO 1/2 value has year=2026 (placeholder), but
 * day and month are real (365 distinct DD/MM values across 81k rows). So we
 * extract DD/MM and mark `yearKnown: false`.
 */
export function parseCompleanno(s: string): NormalizedChild | null {
  if (PLACEHOLDER(s)) return null;
  const m = s.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const [, d, mo, y] = m;
  const yearKnown = y !== '2026';
  const child: NormalizedChild = {
    dayMonth: `${d.padStart(2, '0')}/${mo.padStart(2, '0')}`,
    yearKnown,
  };
  if (yearKnown) child.year = Number(y);
  return child;
}

export function normalizeEmail(raw: string): string {
  if (PLACEHOLDER(raw)) return '';
  return raw.trim().toLowerCase();
}

export function titleCaseName(s: string): string {
  if (PLACEHOLDER(s)) return '';
  return titleCase(s.trim().replace(/\s+/g, ' '));
}

export function normalizePhone(raw: string): string {
  if (PLACEHOLDER(raw)) return '';
  // If it contains an @ it's an email accidentally landed in the phone column.
  if (raw.includes('@')) return '';
  return formatPhoneE164(raw);
}

/** Compute deterministic flags + an initial status. */
export function flagsFor(n: NormalizedFields): StagingFlags {
  return {
    emailMissing: !n.email,
    emailInvalid: !!n.email && !EMAIL_REGEX.test(n.email),
    phoneMissing: !n.phone,
    phoneNotE164: !!n.phone && !E164_REGEX.test(n.phone),
    nameMissing: !n.firstName && !n.lastName,
    childYearUnknown: n.children.some((c) => !c.yearKnown),
    localeUncertain: isLocaleUncertain({ source: n.localeSource, confidence: n.localeConfidence }),
    alreadyInCrm: false,
    duplicateAcrossStores: false,
    csvRowCorrupted: false,
  };
}

/** Dialing codes we can confidently prefix from a resolved locale. */
const LOCALE_DIAL_CODE: Record<string, string> = {
  it_IT: '39',
};

/**
 * Best-effort E.164 from a resolved locale. Conservative by design: only a
 * confident Italian mobile (locale it_IT + a `3XXXXXXXXX` number) gets `+39`.
 * Foreign / tourist numbers are left as-is — we don't know their country code,
 * which is exactly what the recovery flow collects. Matches the offline
 * `process-imports.ts` behaviour so in-app and batch results agree.
 */
export function toE164ForLocale(phone: string, locale: string): string {
  if (!phone || phone.startsWith('+')) return phone;
  const digits = phone.replace(/\D/g, '');
  if (locale === 'it_IT' && /^3\d{8,9}$/.test(digits)) return `+${LOCALE_DIAL_CODE.it_IT}${digits}`;
  return phone;
}

/**
 * Recompute the field-derived flags after an edit, preserving the "sticky"
 * flags `flagsFor` can't know about (CRM-dup check, cross-store dup, corrupted).
 */
export function recomputeFlags(n: NormalizedFields, prev: StagingFlags): StagingFlags {
  return {
    ...flagsFor(n),
    alreadyInCrm: prev.alreadyInCrm,
    duplicateAcrossStores: prev.duplicateAcrossStores,
    csvRowCorrupted: prev.csvRowCorrupted,
  };
}

/** Statuses a re-normalization must not clobber (manager/terminal decisions). */
const TERMINAL_STATUSES: ReadonlySet<StagingStatus> = new Set(['created', 'skipped']);

/** Refresh flags + status after a correction, keeping terminal states intact. */
export function refreshStaging(rec: StagingCustomer): StagingCustomer {
  const flags = recomputeFlags(rec.normalized, rec.flags);
  const status = TERMINAL_STATUSES.has(rec.status)
    ? rec.status
    : decideStatus(rec.normalized, flags);
  return { ...rec, flags, status };
}

export function decideStatus(n: NormalizedFields, f: StagingFlags): StagingStatus {
  if (f.alreadyInCrm) return 'duplicate';
  if (f.emailMissing && f.phoneMissing) return 'blocked';
  // ready = both contacts valid + name parsed + locale resolved
  if (
    !f.emailMissing &&
    !f.emailInvalid &&
    !f.phoneMissing &&
    !f.phoneNotE164 &&
    !f.nameMissing &&
    !!n.locale &&
    !f.localeUncertain
  ) {
    return 'ready';
  }
  return 'review';
}

export function normalizeRow(row: RawCsvRow): NormalizedFields {
  const { firstName, lastName } = splitLegacyName(row.customerFullName);
  const { country } = mapCsvCountry(row.country);
  // Locale is resolved from the strongest available signal — NOT the store
  // country alone (it's a tourist's shopping location, not their language).
  // We read the original phone strings so an explicit "+CC" prefix survives,
  // and the raw full name so a non-Latin script is still detectable.
  const locale = resolveLocale({
    storeCountry: country,
    phones: [row.phone1, row.phone2],
    name: row.customerFullName,
  });
  const children: NormalizedChild[] = [];
  const c1 = parseCompleanno(row.compleanno1);
  const c2 = parseCompleanno(row.compleanno2);
  if (c1) children.push(c1);
  if (c2) children.push(c2);

  return {
    firstName,
    lastName,
    email: normalizeEmail(row.email),
    phone: normalizePhone(row.phone1),
    phoneAlt: normalizePhone(row.phone2),
    country,
    locale: locale.locale,
    localeSource: locale.source,
    localeConfidence: locale.confidence,
    localeReason: locale.reason,
    csvStore: row.store,
    type: PLACEHOLDER(row.type) ? '' : row.type,
    children,
    customerAdded: parseCsvDate(row.customerAdded),
    customerLastSale: parseCsvDate(row.customerLastSaleDate),
  };
}

/**
 * Build a `StagingCustomer` from one raw CSV row.
 * Caller is responsible for dedup across multiple rows with the same customerId.
 */
export function buildStagingFromRow(
  row: RawCsvRow,
  ctx: { storeId: string; importId: string; now: number },
): StagingCustomer {
  const normalized = normalizeRow(row);
  const flags = flagsFor(normalized);
  const status = decideStatus(normalized, flags);
  const customerId = PLACEHOLDER(row.customerId)
    ? `noid-${Math.random().toString(36).slice(2, 10)}`
    : row.customerId;
  return {
    id: `${ctx.storeId}:${customerId}`,
    storeId: ctx.storeId,
    customerId,
    importId: ctx.importId,
    source: row,
    normalized,
    status,
    flags,
    createdAt: ctx.now,
    updatedAt: ctx.now,
  };
}

/** Merge several raw rows that share the same customerId into one staging record. */
export function mergeRowsForCustomer(
  rows: RawCsvRow[],
  ctx: { storeId: string; importId: string; now: number },
): StagingCustomer {
  // Sort by CUSTOMER ADDED descending so the first row is the freshest source.
  const sorted = [...rows].sort((a, b) => {
    const da = parseCsvDate(a.customerAdded) ?? '';
    const db = parseCsvDate(b.customerAdded) ?? '';
    return db.localeCompare(da);
  });
  const primary = sorted[0];

  const base = buildStagingFromRow(primary, ctx);
  if (sorted.length === 1) return base;

  // Backfill empty fields from older rows.
  for (const r of sorted.slice(1)) {
    const n = normalizeRow(r);
    if (!base.normalized.email && n.email) base.normalized.email = n.email;
    if (!base.normalized.phone && n.phone) base.normalized.phone = n.phone;
    if (!base.normalized.phoneAlt && n.phoneAlt) base.normalized.phoneAlt = n.phoneAlt;
    // Add children we don't already have (by dayMonth).
    for (const child of n.children) {
      if (!base.normalized.children.find((c) => c.dayMonth === child.dayMonth)) {
        if (base.normalized.children.length < 4) base.normalized.children.push(child);
      }
    }
  }
  // A backfilled phone may carry a country code the primary row lacked, so
  // re-resolve the locale against the merged contact data.
  const reLocale = resolveLocale({
    storeCountry: base.normalized.country,
    phones: [base.normalized.phone, base.normalized.phoneAlt],
    name: primary.customerFullName,
  });
  base.normalized.locale = reLocale.locale;
  base.normalized.localeSource = reLocale.source;
  base.normalized.localeConfidence = reLocale.confidence;
  base.normalized.localeReason = reLocale.reason;
  base.flags = flagsFor(base.normalized);
  // Mark cross-store dup if rows come from multiple stores.
  const distinctStores = new Set(sorted.map((r) => r.store));
  if (distinctStores.size > 1) base.flags.duplicateAcrossStores = true;
  base.status = decideStatus(base.normalized, base.flags);
  return base;
}

/**
 * Dedup a batch of rows by customerId and produce one staging record per
 * unique customer. Rows whose CUSTOMER ID is "-" stay as separate records
 * (we generate a synthetic id each).
 */
export function dedupAndNormalize(
  rows: RawCsvRow[],
  ctx: { storeId: string; importId: string; now: number },
): StagingCustomer[] {
  const grouped = new Map<string, RawCsvRow[]>();
  const noIdRows: RawCsvRow[] = [];
  for (const row of rows) {
    if (PLACEHOLDER(row.customerId)) {
      noIdRows.push(row);
      continue;
    }
    const list = grouped.get(row.customerId);
    if (list) list.push(row);
    else grouped.set(row.customerId, [row]);
  }
  const out: StagingCustomer[] = [];
  for (const [, rs] of grouped) out.push(mergeRowsForCustomer(rs, ctx));
  for (const r of noIdRows) out.push(buildStagingFromRow(r, ctx));
  return out;
}
