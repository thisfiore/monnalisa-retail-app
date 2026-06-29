/**
 * Pure aggregation for the recovery-outreach tracking dashboard.
 *
 * Works off `RecoveryLink` records (one per customer/token). Kept DOM/React-free
 * so it unit-tests directly and so the same funnel maths runs whether the links
 * come from IndexedDB (prototype) or the durable backend (Phase 2).
 */
import type { RecoveryLink } from './types';

/** The furthest stage a single recipient has reached, newest-wins. */
export type RecoveryState =
  | 'not-sent' // link minted (e.g. previewed) but no SMS sent
  | 'sent' // SMS sent, not yet opened
  | 'opened' // opened the link, no data yet
  | 'step1' // submitted contact + consent (step 1)
  | 'completed' // finished (step 2 / children) — status 'submitted'
  | 'expired'; // link past its TTL and never completed

export function recoveryState(link: RecoveryLink, now: number = Date.now()): RecoveryState {
  if (link.completedAt || link.status === 'submitted') return 'completed';
  if (link.step1SubmittedAt) return 'step1';
  if (link.openedAt) return 'opened';
  if (link.expiresAt <= now) return 'expired';
  if (link.sentAt) return 'sent';
  return 'not-sent';
}

/** True once the customer gave consent + contact — the manager can create/update the CRM record. */
export function isReadyForCrm(link: RecoveryLink): boolean {
  return !!link.step1SubmittedAt; // step 1 carries consent + email/phone
}

export type RecoveryFunnel = {
  recipients: number; // links that have had at least one SMS sent
  minted: number; // total links (incl. preview-only, never sent)
  sent: number;
  opened: number;
  step1: number;
  completed: number;
  expired: number;
  // rates are of `sent` (the real denominator for an outreach campaign)
  openRate: number;
  step1Rate: number;
  completedRate: number;
};

const pct = (n: number, d: number) => (d > 0 ? n / d : 0);

export function computeFunnel(links: RecoveryLink[], now: number = Date.now()): RecoveryFunnel {
  let minted = 0;
  let sent = 0;
  let opened = 0;
  let step1 = 0;
  let completed = 0;
  let expired = 0;

  for (const l of links) {
    minted++;
    if (l.sentAt) sent++;
    if (l.openedAt) opened++;
    if (l.step1SubmittedAt) step1++;
    if (l.completedAt || l.status === 'submitted') completed++;
    if (recoveryState(l, now) === 'expired') expired++;
  }

  return {
    recipients: sent,
    minted,
    sent,
    opened,
    step1,
    completed,
    expired,
    openRate: pct(opened, sent),
    step1Rate: pct(step1, sent),
    completedRate: pct(completed, sent),
  };
}
