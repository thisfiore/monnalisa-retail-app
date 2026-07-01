/**
 * Free-text search over the "customers to recover" staging records.
 *
 * Mongo-only: the records live in the durable microservice, which does the
 * coarse matching server-side (`/staging/customers/search`). We then refine the
 * candidates with the precise (unit-tested) `matches` rule — so phone hits that
 * ignore formatting still work — and shape them for the unified header dropdown.
 */
import { searchCustomers } from './recovery-backend/staging-client';
import type { StagingCustomer, StagingStatus } from './types';

/** A recovery customer shaped for the unified search dropdown. */
export type RecoverySearchResult = {
  source: 'recovery';
  /** staging primary key `${storeId}:${suffix}` */
  id: string;
  /** import this record belongs to — needed to build the detail route. */
  importId: string;
  /** route param for `/import/:importId/customer/:customerNo` (the id suffix). */
  customerNo: string;
  name: string;
  firstName: string;
  lastName: string;
  email: string; // may be ''
  phone: string | null;
  status: StagingStatus;
};

/** Statuses we never surface in search: `created` already lives in the CRM. */
const HIDDEN_STATUSES: ReadonlySet<StagingStatus> = new Set(['created']);

function digitsOnly(s: string): string {
  return s.replace(/\D+/g, '');
}

/** The route param the customer editor expects: the id minus the `storeId:` prefix. */
function customerNoFromId(id: string, storeId: string): string {
  const prefix = `${storeId}:`;
  return id.startsWith(prefix) ? id.slice(prefix.length) : id;
}

/**
 * Does `rec` match `query`? Every whitespace-separated token must hit the
 * record — either as a substring of the name/email text, or (for numeric
 * tokens) as a digit-run inside either phone number. This lets "carla rossi"
 * match across first+last and "333 12" match a phone regardless of formatting.
 */
function matches(rec: StagingCustomer, tokens: string[]): boolean {
  const n = rec.normalized;
  const text = `${n.firstName} ${n.lastName} ${n.email}`.toLowerCase();
  const phoneDigits = `${digitsOnly(n.phone)} ${digitsOnly(n.phoneAlt)}`;

  return tokens.every((tok) => {
    if (text.includes(tok)) return true;
    const d = digitsOnly(tok);
    return d.length > 0 && phoneDigits.includes(d);
  });
}

function toResult(rec: StagingCustomer): RecoverySearchResult {
  const n = rec.normalized;
  return {
    source: 'recovery',
    id: rec.id,
    importId: rec.importId,
    customerNo: customerNoFromId(rec.id, rec.storeId),
    name: `${n.firstName} ${n.lastName}`.trim(),
    firstName: n.firstName,
    lastName: n.lastName,
    email: n.email,
    phone: n.phone || null,
    status: rec.status,
  };
}

/**
 * Search recovery (staging) customers for a store. Mirrors the CRM search's
 * contract: trimmed query, capped result count, name/email/phone matching.
 * Returns `[]` for an empty query or when no auth token is available (every
 * search is an authenticated call to the microservice).
 */
export async function searchRecoveryCustomers(
  storeId: string,
  query: string,
  limit = 10,
  deps?: { getToken?: () => Promise<string> },
): Promise<RecoverySearchResult[]> {
  const q = query.trim().toLowerCase();
  if (!q || !storeId || !deps?.getToken) return [];

  const tokens = q.split(/\s+/).filter(Boolean);

  // Over-fetch a little: the server filter is coarse, so the precise `matches`
  // refinement below can drop a few — ask for more candidates than we'll show.
  let candidates: StagingCustomer[];
  try {
    candidates = await searchCustomers(q, Math.max(limit * 4, 40), await deps.getToken());
  } catch (e) {
    console.error('Recovery search failed:', e);
    return [];
  }

  const hits: RecoverySearchResult[] = [];
  for (const rec of candidates) {
    if (HIDDEN_STATUSES.has(rec.status)) continue;
    if (matches(rec, tokens)) {
      hits.push(toResult(rec));
      if (hits.length >= limit) break;
    }
  }
  return hits;
}
