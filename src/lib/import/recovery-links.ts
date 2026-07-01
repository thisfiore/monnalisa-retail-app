/** Recovery links live for 30 days — long enough for an SMS follow-up cycle. */
export const RECOVERY_LINK_TTL_MS = 30 * 24 * 60 * 60 * 1000;

// 64-char URL-safe (base64url) alphabet → use `& 63` for zero modulo bias.
const TOKEN_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

/**
 * Short, URL-safe, high-entropy recovery token. Default 12 chars ≈ 72 bits —
 * far beyond brute-forceable over HTTP, yet ~1/3 the length of a UUID so the SMS
 * link stays short (helps keep the whole message inside one 160-char segment).
 */
export function generateRecoveryToken(length = 12): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < length; i++) out += TOKEN_ALPHABET[bytes[i] & 63];
  return out;
}
