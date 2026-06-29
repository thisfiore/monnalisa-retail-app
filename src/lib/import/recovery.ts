/**
 * Pure helpers behind the public customer self-recovery page.
 *
 * Kept free of React/DOM so they can be unit-tested directly, and so the page
 * component (`CustomerRecovery.tsx`) stays thin. Customer submissions are
 * written back onto the IndexedDB staging record, feeding the existing manager
 * "check CRM duplicate → Approve & create" pipeline.
 */
import { formatPhoneE164 } from '../api-transforms';
import type { NormalizedChild, StagingCustomer } from './types';

/** Shared with ImportCustomerEditor — validity gates for the recovery flow. */
export const EMAIL_REGEX = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
export const E164_REGEX = /^\+[1-9]\d{1,14}$/;

export type Consent = { privacy: boolean; loyalty: boolean; marketing: boolean };

/** Loyalty and marketing pre-checked, privacy an explicit gate. */
export function defaultConsent(): Consent {
  return { privacy: false, loyalty: true, marketing: true };
}

/** Which key contact fields the customer still needs to supply. */
export function missingKeyFields(rec: StagingCustomer): {
  needsEmail: boolean;
  needsPhone: boolean;
} {
  const { email, phone } = rec.normalized;
  return {
    needsEmail: !email || !EMAIL_REGEX.test(email),
    needsPhone: !phone || !E164_REGEX.test(phone),
  };
}

/** Absolute URL for a recovery token, used by the manager "preview" button. */
export function recoveryUrl(token: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/recover/${token}`;
}

/** Whether a link can still be opened by the customer. */
export function isLinkUsable(expiresAt: number, now: number = Date.now()): boolean {
  return now < expiresAt;
}

/**
 * Step 1 — merge the customer's key contact data + consents onto the record.
 * Only overwrites email/phone when a non-empty value was supplied; phone is
 * normalized to E.164.
 */
export function applyStep1(
  rec: StagingCustomer,
  input: { email?: string; phone?: string; consent: Consent },
): StagingCustomer {
  const email = input.email?.trim();
  const phone = input.phone?.trim();
  return {
    ...rec,
    normalized: {
      ...rec.normalized,
      email: email ? email : rec.normalized.email,
      phone: phone ? formatPhoneE164(phone) : rec.normalized.phone,
    },
    consent: input.consent,
    customerSubmittedAt: Date.now(),
  };
}

/**
 * Step 2 — merge children the customer confirmed/added. `yearKnown` is derived
 * from whether a year is present so the approve flow can build a full birthDate.
 */
export function applyChildren(
  rec: StagingCustomer,
  children: NormalizedChild[],
): StagingCustomer {
  return {
    ...rec,
    normalized: {
      ...rec.normalized,
      children: children.map((c) => ({ ...c, yearKnown: c.year !== undefined })),
    },
    customerSubmittedAt: Date.now(),
  };
}
