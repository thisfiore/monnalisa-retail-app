import { createRecoveryLink, getLinkForCustomer } from './staging-db';
import type { RecoveryLink, StagingCustomer } from './types';

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

/**
 * Return a usable recovery link for a staging record, minting a fresh one if
 * none exists or the existing one has expired. Centralises the get-or-create
 * the editor used inline, so the preview button, single send, and bulk send all
 * agree on one token per customer.
 */
export async function ensureRecoveryLink(
  rec: Pick<StagingCustomer, 'id' | 'storeId' | 'importId'>,
  now: number = Date.now(),
): Promise<RecoveryLink> {
  const existing = await getLinkForCustomer(rec.id);
  if (existing && existing.expiresAt > now && existing.status !== 'expired') {
    return existing;
  }
  const fresh: RecoveryLink = {
    token: generateRecoveryToken(),
    customerId: rec.id,
    storeId: rec.storeId,
    importId: rec.importId,
    createdAt: now,
    expiresAt: now + RECOVERY_LINK_TTL_MS,
    status: 'active',
  };
  await createRecoveryLink(fresh);
  return fresh;
}
