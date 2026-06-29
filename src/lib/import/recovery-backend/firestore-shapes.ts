/**
 * Firestore document shapes for the recovery-link store, plus the mappers
 * between a local `StagingCustomer`/`RecoveryLink` and the durable doc.
 *
 * Pure (no network) so the PII-minimisation contract is unit-testable: the
 * public projection a customer receives must NEVER carry the legacy source row,
 * sales metrics, full contact details, or the customer id — only what the page
 * needs to greet them and ask for the missing field.
 */
import {
  EMAIL_REGEX,
  E164_REGEX,
  defaultConsent,
  missingKeyFields,
  applyStep1,
  applyChildren,
  type Consent,
} from '../recovery';
import type { NormalizedChild, RecoveryLink, StagingCustomer } from '../types';

/** Minimal snapshot the public recovery page needs — no raw PII. */
export type RecoveryRecord = {
  firstName: string;
  needsEmail: boolean;
  needsPhone: boolean;
  /** Masked hints so the page can say "is this still you?" without exposing data. */
  emailMasked?: string;
  phoneMasked?: string;
  locale: string;
  storeName?: string;
  /** Day/month only — the missing YEAR is what we collect. */
  children: Array<{ dayMonth: string }>;
};

/** What the customer submits back through the Vercel function. */
export type RecoverySubmission = {
  email?: string;
  phone?: string;
  consent?: Consent;
  children?: Array<{ dayMonth: string; year?: number; name?: string; gender?: 'Male' | 'Female' }>;
  step1SubmittedAt?: number;
  completedAt?: number;
};

/** The full `recoveryLinks/{token}` document. */
export type RecoveryDoc = {
  token: string;
  storeId: string;
  importId: string;
  customerRef: string; // staging id `${storeId}:${customerNo}`
  status: 'active' | 'submitted' | 'expired';
  createdAt: number;
  expiresAt: number;
  sentAt?: number;
  sendCount?: number;
  record: RecoveryRecord;
  submission?: RecoverySubmission;
};

/** The ONLY thing an unauthenticated customer is allowed to receive. */
export type RecoveryPublicView = {
  status: RecoveryDoc['status'];
  expired: boolean;
  record: RecoveryRecord;
};

export function maskEmail(email: string): string {
  const [user, domain] = email.split('@');
  if (!domain) return '•••';
  return `${user.slice(0, 1)}•••@${domain}`;
}

export function maskPhone(phone: string): string {
  if (phone.length <= 7) return '••••';
  return `${phone.slice(0, 3)} •••• ${phone.slice(-4)}`;
}

/** Build the minimal record snapshot from a staging customer. */
export function toRecoveryRecord(rec: StagingCustomer): RecoveryRecord {
  const { needsEmail, needsPhone } = missingKeyFields(rec);
  const n = rec.normalized;
  const out: RecoveryRecord = {
    firstName: n.firstName ?? '',
    needsEmail,
    needsPhone,
    locale: n.locale || 'en_GB',
    children: n.children.map((c) => ({ dayMonth: c.dayMonth })),
  };
  if (n.csvStore) out.storeName = n.csvStore;
  if (!needsEmail && n.email && EMAIL_REGEX.test(n.email)) out.emailMasked = maskEmail(n.email);
  if (!needsPhone && n.phone && E164_REGEX.test(n.phone)) out.phoneMasked = maskPhone(n.phone);
  return out;
}

/** Build the durable doc that gets published to Firestore on send. */
export function toRecoveryDoc(rec: StagingCustomer, link: RecoveryLink): RecoveryDoc {
  const doc: RecoveryDoc = {
    token: link.token,
    storeId: link.storeId,
    importId: link.importId,
    customerRef: link.customerId,
    status: link.status,
    createdAt: link.createdAt,
    expiresAt: link.expiresAt,
    record: toRecoveryRecord(rec),
  };
  if (link.sentAt !== undefined) doc.sentAt = link.sentAt;
  if (link.sendCount !== undefined) doc.sendCount = link.sendCount;
  return doc;
}

/**
 * Reduce a full doc to the public projection. This is the security boundary —
 * it allow-lists fields rather than deleting, so new doc fields never leak by
 * default.
 */
export function toPublicView(doc: RecoveryDoc, now: number = Date.now()): RecoveryPublicView {
  return {
    status: doc.status,
    expired: now >= doc.expiresAt,
    record: doc.record,
  };
}

/** Manager-side: fold a customer submission back into the local staging record. */
export function mergeSubmission(rec: StagingCustomer, sub: RecoverySubmission): StagingCustomer {
  let out = rec;
  if (sub.email || sub.phone || sub.consent) {
    out = applyStep1(out, {
      email: sub.email,
      phone: sub.phone,
      consent: sub.consent ?? defaultConsent(),
    });
  }
  if (sub.children && sub.children.length) {
    const children: NormalizedChild[] = sub.children.map((c) => ({
      dayMonth: c.dayMonth,
      yearKnown: c.year !== undefined,
      year: c.year,
      name: c.name,
      gender: c.gender,
    }));
    out = applyChildren(out, children);
  }
  return out;
}
