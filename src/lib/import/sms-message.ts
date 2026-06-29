/**
 * SMS message composition for the customer-recovery outreach.
 *
 * Pure (no DOM, no network) so it unit-tests directly and keeps the composer
 * component thin. Key design rule: the recovery LINK is always appended by the
 * system at send time — it is never part of the editable body — so neither a
 * manager nor the AI can accidentally drop or mangle the token.
 */

/** Placeholder a manager/template can use; replaced with the customer's name. */
export const NAME_PLACEHOLDER = '{name}';

/** Language buckets we ship a default template for; everything else → 'en'. */
export type SmsLang = 'it' | 'en' | 'fr' | 'de' | 'es';

export const SMS_LANGS: ReadonlyArray<{ code: SmsLang; label: string }> = [
  { code: 'it', label: 'Italian' },
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'French' },
  { code: 'de', label: 'German' },
  { code: 'es', label: 'Spanish' },
];

const LANG_BY_PREFIX: Record<string, SmsLang> = {
  it: 'it',
  en: 'en',
  fr: 'fr',
  de: 'de',
  es: 'es',
};

/** Map a BFF locale code (e.g. "fr_CH") to a template language; default 'en'. */
export function smsLangForLocale(locale: string | undefined): SmsLang {
  const prefix = (locale ?? '').slice(0, 2).toLowerCase();
  return LANG_BY_PREFIX[prefix] ?? 'en';
}

/** Default outreach body per language — keeps {name}; the link is appended later. */
const DEFAULT_BODIES: Record<SmsLang, string> = {
  it: `Ciao ${NAME_PLACEHOLDER}, è Monnalisa. Completa i tuoi dati e unisciti al nostro programma fedeltà:`,
  en: `Hi ${NAME_PLACEHOLDER}, it's Monnalisa. Complete your details and join our loyalty programme:`,
  fr: `Bonjour ${NAME_PLACEHOLDER}, c'est Monnalisa. Complétez vos informations et rejoignez notre programme de fidélité :`,
  de: `Hallo ${NAME_PLACEHOLDER}, hier ist Monnalisa. Vervollständigen Sie Ihre Daten und treten Sie unserem Treueprogramm bei:`,
  es: `Hola ${NAME_PLACEHOLDER}, somos Monnalisa. Completa tus datos y únete a nuestro programa de fidelidad:`,
};

export function defaultSmsBody(lang: SmsLang): string {
  return DEFAULT_BODIES[lang];
}

/**
 * Replace {name} with the customer's first name and tidy whitespace. An empty
 * name collapses cleanly (e.g. "Ciao {name}," → "Ciao,").
 */
export function renderSmsBody(body: string, firstName: string | undefined): string {
  const name = (firstName ?? '').trim();
  return body
    .split(NAME_PLACEHOLDER)
    .join(name)
    .replace(/\s+([,.;:!?])/g, '$1') // drop space left dangling before punctuation
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

/**
 * The final SMS text actually sent: rendered body + the recovery link on its
 * own line. This is the single place the link is attached.
 */
export function composeSms(
  body: string,
  firstName: string | undefined,
  url: string,
): string {
  return `${renderSmsBody(body, firstName)}\n${url}`;
}

// --- length / segment hint -------------------------------------------------

// GSM 03.38 basic + extended sets. Approximate (extended chars actually cost 2
// septets) — good enough for a UI hint, not for billing.
const GSM7_BASIC =
  '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà';
const GSM7_EXT = '^{}\\[~]|€';

function isGsm7(text: string): boolean {
  for (const ch of text) {
    if (GSM7_BASIC.indexOf(ch) === -1 && GSM7_EXT.indexOf(ch) === -1) return false;
  }
  return true;
}

export type SmsLength = {
  length: number;
  segments: number;
  encoding: 'GSM-7' | 'UCS-2';
};

/** Character count + rough segment count, so the UI can warn on long messages. */
export function smsLength(text: string): SmsLength {
  const length = [...text].length;
  if (isGsm7(text)) {
    const segments = length <= 160 ? 1 : Math.ceil(length / 153);
    return { length, segments: Math.max(1, segments), encoding: 'GSM-7' };
  }
  const segments = length <= 70 ? 1 : Math.ceil(length / 67);
  return { length, segments: Math.max(1, segments), encoding: 'UCS-2' };
}
