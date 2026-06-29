/**
 * Minimal Firestore REST helpers — encode/decode the typed "Value" wire format
 * and a thin authed fetch. SDK-free, matching `src/lib/firebase-auth.ts`.
 *
 * The encode/decode functions are pure and unit-tested. `firestoreFetch` is the
 * single network seam; both the manager (Firebase ID token) and the server
 * function (service-account access token) use it with their own bearer token.
 */

export type FirestoreValue =
  | { nullValue: null }
  | { booleanValue: boolean }
  | { integerValue: string }
  | { doubleValue: number }
  | { stringValue: string }
  | { arrayValue: { values?: FirestoreValue[] } }
  | { mapValue: { fields?: Record<string, FirestoreValue> } };

/** Encode a plain JSON value into a Firestore REST Value. */
export function toValue(v: unknown): FirestoreValue {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') {
    return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  }
  if (typeof v === 'string') return { stringValue: v };
  if (Array.isArray(v)) {
    return { arrayValue: { values: v.map(toValue) } };
  }
  if (typeof v === 'object') {
    return { mapValue: { fields: toFields(v as Record<string, unknown>) } };
  }
  // Fallback — stringify anything exotic rather than throwing.
  return { stringValue: String(v) };
}

/** Encode a plain object into a Firestore `fields` map (skips undefined). */
export function toFields(obj: Record<string, unknown>): Record<string, FirestoreValue> {
  const fields: Record<string, FirestoreValue> = {};
  for (const [k, val] of Object.entries(obj)) {
    if (val === undefined) continue;
    fields[k] = toValue(val);
  }
  return fields;
}

/** Decode a Firestore REST Value back into a plain JSON value. */
export function fromValue(value: FirestoreValue): unknown {
  if ('nullValue' in value) return null;
  if ('booleanValue' in value) return value.booleanValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return value.doubleValue;
  if ('stringValue' in value) return value.stringValue;
  if ('arrayValue' in value) return (value.arrayValue.values ?? []).map(fromValue);
  if ('mapValue' in value) return fromFields(value.mapValue.fields ?? {});
  return null;
}

/** Decode a Firestore `fields` map back into a plain object. */
export function fromFields(fields: Record<string, FirestoreValue>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields)) out[k] = fromValue(v);
  return out;
}

export type FirestoreConfig = {
  projectId: string;
  /** Firebase ID token (manager) or service-account access token (server). */
  bearer: string;
  /** Default '(default)'. */
  databaseId?: string;
};

function documentsUrl(cfg: FirestoreConfig, path: string): string {
  const db = cfg.databaseId ?? '(default)';
  const clean = path.replace(/^\/+/, '');
  return `https://firestore.googleapis.com/v1/projects/${cfg.projectId}/databases/${db}/documents/${clean}`;
}

/**
 * Authed Firestore REST call. `path` is relative to `.../documents/`
 * (e.g. `recoveryLinks/<token>`). Returns the parsed JSON body.
 */
export async function firestoreFetch(
  cfg: FirestoreConfig,
  path: string,
  init: { method?: string; body?: unknown; query?: string } = {},
): Promise<unknown> {
  const url = documentsUrl(cfg, path) + (init.query ? `?${init.query}` : '');
  const resp = await fetch(url, {
    method: init.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${cfg.bearer}`,
      ...(init.body ? { 'content-type': 'application/json' } : {}),
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  if (!resp.ok) {
    const detail = await resp.text().catch(() => '');
    throw new Error(`Firestore ${init.method ?? 'GET'} ${path} failed (${resp.status}): ${detail}`);
  }
  return resp.json();
}
