import { formatPhoneE164, isSupportedLocale } from '../api-transforms';
import { recomputeFlags, decideStatus } from './normalize';
import { getOpenAiClient, OPENAI_MODEL } from './openai-client';
import type { StagingCustomer } from './types';

/**
 * AI "repair" pass for staging customer records.
 *
 * TODO (before any non-prototype use): move this call server-side (Vercel
 * function under `api/`, mirroring `api/proxy.ts`). The current implementation
 * exposes the OpenAI key to the browser via `VITE_OPENAI_API_KEY`, which is
 * only acceptable for an internal prototype on trusted devices.
 */

const MODEL = OPENAI_MODEL;

export type RepairPatches = {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  locale?: string;
};

export type RepairResult = {
  patches: RepairPatches;
  confidence: number; // 0..1
  reasoning: string;
  suggestedActions: string[];
  hopeless: boolean;
};

const REPAIR_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    patches: {
      type: 'object',
      additionalProperties: false,
      properties: {
        firstName: { type: ['string', 'null'] },
        lastName: { type: ['string', 'null'] },
        email: { type: ['string', 'null'] },
        phone: { type: ['string', 'null'] },
        locale: { type: ['string', 'null'] },
      },
      required: ['firstName', 'lastName', 'email', 'phone', 'locale'],
    },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    reasoning: { type: 'string' },
    suggestedActions: {
      type: 'array',
      items: { type: 'string' },
    },
    hopeless: { type: 'boolean' },
  },
  required: ['patches', 'confidence', 'reasoning', 'suggestedActions', 'hopeless'],
} as const;

const SYSTEM_PROMPT = `You are a data-normalization assistant for Monnalisa, an Italian children's-clothing retailer migrating legacy retail-store customer records into a new loyalty CRM.

For each record you receive, the system has already done deterministic cleanup (phone → E.164 if possible, name split on spaces) and a first-pass locale resolution. Your job is to find further repairable issues a rule-based pass can't catch.

CRITICAL — about country and locale:
- The "country" field is the STORE's location, NOT the customer's nationality. Each store maps to one country (e.g. "Forte dei Marmi"→Italy, "Harrods"→UK). Monnalisa's Italian stores are full of foreign tourists, so a record at an Italian store is OFTEN a non-Italian who does NOT speak Italian. NEVER assume Italian just because the store is in Italy.
- "normalized.localeSource" tells you how the deterministic pass chose the locale:
  - "phone": derived from an explicit phone country code (+CC). This is reliable — only override with strong reason.
  - "name-script": derived from a non-Latin name (Han→zh_CN, Kana→ja_JP, Cyrillic/Arabic/etc.→en_GB). Usually reliable.
  - "store": the store-country prior, with some corroboration. Scrutinize.
  - "fallback": the system had no good signal and defaulted to en_GB (English). THIS IS YOUR PRIMARY JOB — use the NAME'S SEMANTICS to do better. A Latin-script name often reveals likely language/culture (e.g. "Schockaert"→Flemish/Belgian, "Dupont"→French, "Müller"→German, "Rossi"/"Esposito"→Italian, "García"→Spanish). Map that to the best supported locale; if the name is clearly Italian, set it_IT. If you genuinely can't tell, leave the en_GB fallback.
- Supported locale codes ONLY: it_IT, it_CH, en_US, en_GB, fr_FR, fr_CH, de_DE, de_CH, es_ES, zh_CN, ja_JP. If the most likely language has no supported code (e.g. Russian, Turkish, Dutch), use en_GB. Prefer a phone country code over name semantics when both point somewhere.

Other examples of fixable issues:
- Obvious email typos: "gmial.com" → "gmail.com", trailing periods, accidentally-pasted whitespace.
- Phone numbers without a country code where the customer's likely country is clear from the name or other phone — prefix the correct code (e.g. a clearly-Italian name with a 10-digit phone starting with "3" → "+39…"). Do NOT prefix +39 just because the store is in Italy.
- Name capitalization that survived our title-casing oddly (e.g. "Mc Donald" → "McDonald").

Important constraints:
- Do NOT invent data. If a field is missing entirely (no email at all, no phone at all), leave it null in patches and explain in suggestedActions what the manager should collect from the customer.
- Children's data (name, height, shoe size) is NEVER in the source — do not attempt to populate it.
- Confidence reflects how sure you are about the patches you returned. If the record is clean already, return empty patches with high confidence and reasoning "no repairs needed".
- When you change the locale, explain WHY in reasoning (what about the name/phone drove it).
- Set hopeless=true only if the record has no useful contact data at all and no way forward without a customer interview. The manager will still review it.

Return patches as plain string values (the field's intended final value), or null if no patch.
`;

export async function repairRecord(rec: StagingCustomer): Promise<RepairResult> {
  const userPayload = {
    source: rec.source,
    normalized: rec.normalized,
    flags: rec.flags,
  };

  const completion = await getOpenAiClient().chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: JSON.stringify(userPayload) },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'repair_result',
        strict: true,
        schema: REPAIR_SCHEMA,
      },
    },
    temperature: 0.1,
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) throw new Error('OpenAI returned empty content');
  const parsed = JSON.parse(content) as {
    patches: Record<string, string | null>;
    confidence: number;
    reasoning: string;
    suggestedActions: string[];
    hopeless: boolean;
  };

  const cleanedPatches: RepairPatches = {};
  for (const key of ['firstName', 'lastName', 'email', 'phone', 'locale'] as const) {
    const v = parsed.patches[key];
    if (v !== null && v !== undefined && v !== '') cleanedPatches[key] = v;
  }

  return {
    patches: cleanedPatches,
    confidence: parsed.confidence,
    reasoning: parsed.reasoning,
    suggestedActions: parsed.suggestedActions,
    hopeless: parsed.hopeless,
  };
}

/** Apply patches to a staging record (returns a new object, doesn't mutate). */
export function applyRepairPatches(
  rec: StagingCustomer,
  result: RepairResult,
): StagingCustomer {
  const n = { ...rec.normalized };
  const notes = [result.reasoning, ...result.suggestedActions];
  if (result.patches.firstName) n.firstName = result.patches.firstName;
  if (result.patches.lastName) n.lastName = result.patches.lastName;
  if (result.patches.email) n.email = result.patches.email;
  if (result.patches.phone) n.phone = formatPhoneE164(result.patches.phone);
  if (result.patches.locale) {
    if (isSupportedLocale(result.patches.locale)) {
      n.locale = result.patches.locale;
    } else {
      // The model proposed a code we don't support (e.g. "ru_RU" for a Russian
      // name). The contract is "no supported locale → en_GB"; coerce so the
      // record stays valid AND the change is actually reflected in the picker,
      // rather than silently writing an unselectable value.
      notes.push(
        `Suggested locale "${result.patches.locale}" isn't supported — applied en_GB instead.`,
      );
      n.locale = 'en_GB';
    }
  }

  // The AI may have fixed the phone/email/locale — recompute the derived flags
  // and status so the queue badges (e.g. "not E.164") reflect the correction.
  const flags = recomputeFlags(n, rec.flags);
  const keepStatus = rec.status === 'created' || rec.status === 'skipped';
  return {
    ...rec,
    normalized: n,
    flags,
    status: keepStatus ? rec.status : decideStatus(n, flags),
    aiNotes: notes.filter(Boolean).join('\n— '),
    aiConfidence: result.confidence,
    updatedAt: Date.now(),
  };
}
