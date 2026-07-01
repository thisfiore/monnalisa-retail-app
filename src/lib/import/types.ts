/**
 * Types for the legacy-CSV → loyalty-CRM normalization workspace.
 * Mirrors the staging-DB schema described in the plan; would translate 1:1 to
 * Firestore docs in Phase 2.
 */

/** Raw CSV row as parsed — keys mirror the legacy column headers verbatim. */
export type RawCsvRow = {
  country: string;
  store: string;
  type: string;
  customerId: string;
  customerFullName: string;
  customerAdded: string;
  customerLastSaleDate: string;
  email: string;
  phone1: string;
  phone2: string;
  compleanno1: string;
  compleanno2: string;
  qty: string;
  grossSales: string;
  netSales: string;
  discount: string;
  discountPct: string;
};

/**
 * Raw row from the newer retail-account export (the no-email cohort).
 * Keys mirror the cleaned CSV produced by `db-to-normalise/xlsx-to-csv.py`,
 * which already strips the Cust SID quotes and normalizes dates to text.
 */
export type RawRetailRow = {
  custSid: string; // stable unique key (signed integer as text)
  custId: string; // legacy CUSTOMER ID — joins back to the old CSV
  first: string;
  last: string;
  storeName: string;
  sub: string; // store-group code, e.g. "001_OUTLET_ITA" — encodes store country
  countryCode: string; // ISO3; UNRELIABLE as customer nationality (default-polluted)
  email: string; // ~always empty (this is the no-email cohort)
  phone1: string;
  phone2: string;
  compl1: string;
  compl2: string;
  firstSaleDate: string;
  lastSaleDate: string;
  totalSales: string;
  totalUnits: string;
  ytdSales: string;
  storeCredit: string;
  dateExcelSerial: string; // "1" → dates came from Excel serials (day/month may be swapped)
};

/** Retail value signals carried through for prioritization (not pushed to CRM). */
export type RetailMetrics = {
  totalSales?: number;
  totalUnits?: number;
  ytdSales?: number;
  storeCredit?: number;
  firstSaleDate?: string; // DD/MM/YYYY (may be Excel-serial ambiguous)
  lastSaleDate?: string;
  dateAmbiguous?: boolean;
};

/** A child birthday we extracted from COMPLEANNO 1/2 — only day+month are real. */
export type NormalizedChild = {
  dayMonth: string; // "DD/MM"
  yearKnown: boolean; // always false from legacy CSV
  year?: number;
  name?: string;
  gender?: 'Male' | 'Female';
  height?: number; // cm
  shoeSize?: number;
};

export type NormalizedFields = {
  firstName: string;
  lastName: string;
  email: string; // may be empty
  phone: string; // E.164 if possible, else best-effort cleaned string
  phoneAlt: string; // PHONE 2 if present
  country: string; // source country name (= the STORE's location, not the customer's)
  locale: string; // resolved preferred-language locale code
  localeSource: 'phone' | 'name-script' | 'store' | 'fallback'; // how `locale` was derived
  localeConfidence: number; // 0..1 confidence in the resolved locale
  localeReason: string; // human-readable explanation of the resolution
  csvStore: string; // source CSV store name
  type: string; // DOO / DOS / TPOS / ''
  children: NormalizedChild[];
  customerAdded?: string; // ISO date
  customerLastSale?: string; // ISO date
};

export type StagingFlags = {
  emailMissing: boolean;
  emailInvalid: boolean;
  phoneMissing: boolean;
  phoneNotE164: boolean;
  nameMissing: boolean;
  childYearUnknown: boolean;
  localeUncertain: boolean; // locale fell back / low confidence — needs a second look
  alreadyInCrm: boolean;
  duplicateAcrossStores: boolean;
  csvRowCorrupted: boolean;
};

export type StagingStatus =
  | 'ready' // can be pushed as-is
  | 'review' // missing/ambiguous fields — manager action needed
  | 'blocked' // no email AND no phone — unreachable
  | 'duplicate' // already exists in CRM
  | 'created' // successfully pushed to CRM
  | 'failed' // push attempted but errored — see lastError
  | 'skipped'; // manager explicitly dropped

export type StagingCustomer = {
  /** synthetic primary key: `${storeId}:${customerId-or-uuid}` */
  id: string;
  storeId: string;
  customerId: string; // CSV CUSTOMER ID (may be '-' for missing-id rows); = Cust SID for retail imports
  importId: string;
  /** Which export this came from — drives how `source` is shaped. */
  sourceSchema?: 'legacy-csv' | 'retail';
  /** Stable retail key (Cust SID). Present only on retail imports. */
  custSid?: string;
  /** Retail value signals (sales, store credit). Present only on retail imports. */
  metrics?: RetailMetrics;
  source: RawCsvRow | RawRetailRow;
  normalized: NormalizedFields;
  status: StagingStatus;
  flags: StagingFlags;
  aiNotes?: string;
  aiConfidence?: number;
  reviewNotes?: string;
  createdAccountId?: string;
  lastError?: string;
  contactedAt?: number; // epoch ms — when manager noted they called the customer
  /** Consents the customer supplied on the self-recovery page. */
  consent?: { privacy: boolean; loyalty: boolean; marketing: boolean };
  /** epoch ms — last time the customer saved data via the recovery link. */
  customerSubmittedAt?: number;
  updatedAt: number;
  createdAt: number;
};

/**
 * Single-enum manager outreach funnel on a recovery link.
 * `new` → `sent` (first SMS) → `manual1`/`manual2` (manager phoned them) →
 * `dormant` (sleeping). `converted` is terminal, set when the CRM account is
 * created/updated for this link.
 */
export type RecoveryStage = 'new' | 'sent' | 'manual1' | 'manual2' | 'dormant' | 'converted';

/** CRM sync state for a link, mirrored from the recovery-api queue. */
export type RecoveryCrm = {
  state: 'none' | 'pending' | 'done' | 'failed';
  op?: 'create' | 'update';
  accountId?: string;
  attempts?: number;
  lastError?: string;
};

/**
 * Token → staging-record mapping behind the public `/recover/:token` page.
 * Stored in IndexedDB for the prototype; the same shape moves to a backend KV
 * store in Phase 2 so SMS links can resolve cross-device.
 */
export type RecoveryLink = {
  token: string; // short URL-safe token (generateRecoveryToken) — keeps the SMS link short
  customerId: string; // staging id `${storeId}:${customerNo}`
  storeId: string;
  importId: string;
  createdAt: number;
  expiresAt: number; // createdAt + 30 days
  status: 'active' | 'submitted' | 'expired';
  /** epoch ms — first time the customer opened the link (the "open" metric). */
  openedAt?: number;
  /** how many times the link has been opened. */
  openCount?: number;
  step1SubmittedAt?: number;
  completedAt?: number;
  /** epoch ms — last time an outreach SMS was sent for this link. */
  sentAt?: number;
  /** how many outreach SMS have been sent for this link. */
  sendCount?: number;
  /** last SMS body sent (audit/debug; includes the link). */
  lastSmsBody?: string;
  /** manager outreach funnel stage (single source of truth for the dashboard). */
  stage?: RecoveryStage;
  /** CRM sync state mirrored from the recovery-api queue. */
  crm?: RecoveryCrm;
};

export type ImportRecord = {
  id: string;
  filename: string;
  storeId: string;
  uploadedAt: number;
  totalRows: number;
  parsedRows: number;
  skippedRows: number;
  /** raw CSV store names found in the file, with row counts */
  csvStoresFound: Array<{ name: string; rowCount: number }>;
  /** CSV store names the manager confirmed belong to their store */
  ownedCsvStores: string[];
};

export type ImportSummary = {
  totalRows: number;
  parsedRows: number;
  corruptedRows: number;
  totalRowDropped: boolean; // summary "Total" row found and dropped
  csvStoresFound: Array<{ name: string; rowCount: number }>;
};
