/**
 * Smart locale resolution for the legacy-CSV import.
 *
 * The legacy export's COUNTRY column is the *store's* location, not the
 * customer's nationality (each store maps to exactly one country: Forte dei
 * Marmi→Italy, Harrods→UK, Chongqing→China …). Monnalisa's Italian stores are
 * tourist magnets, so "store is in Italy" does NOT mean "customer speaks
 * Italian". This module resolves a *preferred language* locale from the
 * strongest available signals instead of blindly trusting the store country.
 *
 * Signal priority (deterministic pass):
 *   1. Phone country code (explicit "+CC"/"00CC") — the customer's real number.
 *   2. Name script (non-Latin) — a Han/Kana/Cyrillic name is not an Italian.
 *   3. Store-country prior — trusted only when corroborated. For Italy/San
 *      Marino (tourist-ambiguous) we REQUIRE positive Italian evidence (an
 *      Italian-format phone); otherwise we fall back to English rather than
 *      assume Italian.
 *   4. Fallback — English (en_GB), never Italian, for genuinely-unknown origin.
 *
 * Latin-script name *semantics* ("Schockaert" is Flemish, "Dupont" French) are
 * intentionally left to the AI review pass — see openai-normalize.ts.
 */

/** Where we don't know the language, fall back to neutral international English. */
export const ENGLISH_FALLBACK = 'en_GB';

export type LocaleSource = 'phone' | 'name-script' | 'store' | 'fallback';

export type LocaleResolution = {
  locale: string;
  source: LocaleSource;
  confidence: number; // 0..1
  reason: string;
};

/**
 * International dialing code → locale, longest-first for prefix matching.
 * Codes whose language we don't have a supported locale for (e.g. +7 Russia,
 * +90 Turkey, +32 Belgium) are intentionally absent — an international prefix
 * we can't map still resolves to ENGLISH_FALLBACK (we know it's foreign).
 */
const DIALING_CODE_TO_LOCALE: ReadonlyArray<readonly [string, string]> = [
  ['378', 'it_IT'], // San Marino
  ['852', 'zh_CN'], // Hong Kong
  ['853', 'zh_CN'], // Macau
  ['39', 'it_IT'], // Italy
  ['41', 'it_CH'], // Switzerland (brand maps CH → it_CH)
  ['33', 'fr_FR'], // France
  ['49', 'de_DE'], // Germany
  ['34', 'es_ES'], // Spain
  ['44', 'en_GB'], // United Kingdom
  ['86', 'zh_CN'], // China
  ['81', 'ja_JP'], // Japan
  ['65', 'en_GB'], // Singapore (English official)
  ['1', 'en_US'], // US / Canada
];
const DIALING_SORTED = [...DIALING_CODE_TO_LOCALE].sort((a, b) => b[0].length - a[0].length);

/** Store-country (already alias-normalized) → locale, supported codes only. */
const STORE_COUNTRY_TO_LOCALE: Record<string, string> = {
  italy: 'it_IT',
  'san marino': 'it_IT',
  'united states': 'en_US',
  'united kingdom': 'en_GB',
  france: 'fr_FR',
  spain: 'es_ES',
  germany: 'de_DE',
  switzerland: 'it_CH',
  china: 'zh_CN',
  'hong kong': 'zh_CN',
  japan: 'ja_JP',
  singapore: 'en_GB',
};

/**
 * Store countries where the store location is a poor proxy for customer
 * language — luxury tourist destinations. Here we won't assume the store
 * locale without corroborating evidence.
 */
const TOURIST_AMBIGUOUS = new Set(['italy', 'san marino']);

const PLACEHOLDER = (s: string) => !s || s.trim() === '' || s.trim() === '-';

/** Digits after an explicit international prefix ("+"/"00"), or null if none. */
function internationalDigits(phone: string): string | null {
  const t = phone.trim();
  let rest: string;
  if (t.startsWith('+')) rest = t.slice(1);
  else if (t.startsWith('00')) rest = t.slice(2);
  else return null;
  const digits = rest.replace(/\D/g, '');
  return digits || null;
}

/** Resolve a locale from any phone bearing an international prefix. */
export function localeFromInternationalPrefix(
  phones: string[],
): { locale: string; code: string } | null {
  for (const p of phones) {
    if (PLACEHOLDER(p) || p.includes('@')) continue;
    const digits = internationalDigits(p);
    if (!digits) continue;
    for (const [code, locale] of DIALING_SORTED) {
      if (digits.startsWith(code)) return { locale, code };
    }
    // Has an international prefix but an unsupported country code → English.
    return { locale: ENGLISH_FALLBACK, code: digits.slice(0, 3) };
  }
  return null;
}

/** A name written in a non-Latin script tells us the customer is not Italian. */
export function localeFromNameScript(
  name: string,
): { locale: string; confidence: number; script: string } | null {
  if (PLACEHOLDER(name)) return null;
  // Kana before Han: a Japanese name may mix kanji with kana.
  if (/[぀-ヿ]/.test(name)) return { locale: 'ja_JP', confidence: 0.85, script: 'kana' };
  if (/[一-鿿]/.test(name)) return { locale: 'zh_CN', confidence: 0.85, script: 'Han' };
  // Scripts with no supported locale → neutral English (still: not Italian).
  if (/[Ѐ-ӿ]/.test(name))
    return { locale: ENGLISH_FALLBACK, confidence: 0.7, script: 'Cyrillic' };
  if (/[؀-ۿ]/.test(name))
    return { locale: ENGLISH_FALLBACK, confidence: 0.7, script: 'Arabic' };
  if (/[Ͱ-Ͽ]/.test(name))
    return { locale: ENGLISH_FALLBACK, confidence: 0.7, script: 'Greek' };
  if (/[가-힯]/.test(name))
    return { locale: ENGLISH_FALLBACK, confidence: 0.65, script: 'Hangul' };
  return null; // Latin script — can't decide from script alone (left to AI).
}

/**
 * Positive evidence that a *bare* (no international prefix) phone is Italian:
 * an Italian mobile (starts with 3, 10 digits). Landlines are intentionally
 * excluded — a leading "0" is too common across countries to be evidence.
 */
export function phoneLooksItalian(phones: string[]): boolean {
  for (const p of phones) {
    if (PLACEHOLDER(p) || p.includes('@')) continue;
    if (internationalDigits(p)) continue; // handled by the prefix path
    let d = p.replace(/\D/g, '');
    if (d.startsWith('0039')) d = d.slice(4);
    else if (d.length === 12 && d.startsWith('39')) d = d.slice(2);
    if (/^3\d{8,9}$/.test(d)) return true; // Italian mobile
  }
  return false;
}

function resolution(
  locale: string,
  source: LocaleSource,
  confidence: number,
  reason: string,
): LocaleResolution {
  return { locale, source, confidence, reason };
}

/**
 * Resolve the best-guess preferred-language locale for an imported customer.
 * `storeCountry` should already be alias-normalized (see mapCsvCountry).
 */
export function resolveLocale(input: {
  storeCountry: string;
  phones: string[];
  name: string;
}): LocaleResolution {
  const phones = input.phones.filter((p) => !PLACEHOLDER(p));

  // 1. Explicit phone country code — overrides everything, even the store.
  const intl = localeFromInternationalPrefix(phones);
  if (intl) {
    return resolution(intl.locale, 'phone', 0.95, `Phone country code +${intl.code} → ${intl.locale}`);
  }

  // 2. Non-Latin name script — a Han/Kana/Cyrillic name is not an Italian.
  const script = localeFromNameScript(input.name);
  if (script) {
    return resolution(
      script.locale,
      'name-script',
      script.confidence,
      `Name in ${script.script} script → ${script.locale}`,
    );
  }

  // 3. Store-country prior.
  const key = input.storeCountry.trim().toLowerCase();
  if (TOURIST_AMBIGUOUS.has(key)) {
    if (phoneLooksItalian(phones)) {
      return resolution('it_IT', 'store', 0.85, 'Italian-format phone at an Italian store');
    }
    return resolution(
      ENGLISH_FALLBACK,
      'fallback',
      0.4,
      `Store is in ${input.storeCountry} but there's no Italian phone or name evidence — likely a tourist, not assuming Italian`,
    );
  }
  const mapped = STORE_COUNTRY_TO_LOCALE[key];
  if (mapped) {
    return resolution(mapped, 'store', 0.7, `Store country ${input.storeCountry} → ${mapped}`);
  }

  // 4. Unknown / unsupported origin — English, never Italian.
  return resolution(
    ENGLISH_FALLBACK,
    'fallback',
    0.3,
    `Unknown or unsupported store country "${input.storeCountry}" — defaulting to English`,
  );
}

/** A locale we're not confident enough about to push without a second look. */
export function isLocaleUncertain(res: { source: LocaleSource; confidence: number }): boolean {
  return res.source === 'fallback' || res.confidence < 0.6;
}
