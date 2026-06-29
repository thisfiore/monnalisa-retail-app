/**
 * Mode-aware data layer for the public recovery page. Hides whether the record
 * comes from local IndexedDB (same-browser prototype) or the durable
 * microservice (real cross-device SMS), so `CustomerRecovery.tsx` renders one
 * shape and submits through one interface.
 */
import { activeRecoveryBackend } from './recovery-store';
import {
  getCustomer,
  getRecoveryLink,
  updateCustomer,
  updateRecoveryLink,
} from './staging-db';
import {
  applyChildren,
  applyStep1,
  isLinkUsable,
  missingKeyFields,
  type Consent,
} from './recovery';
import { markLinkOpened } from './sms-send';
import {
  fetchPublicView,
  submitStep1 as httpStep1,
  submitChildren as httpChildren,
  submitComplete as httpComplete,
} from './recovery-backend/public-client';
import type { NormalizedChild, RecoveryLink, StagingCustomer } from './types';

export type RecoveryView = {
  firstName: string;
  needsEmail: boolean;
  needsPhone: boolean;
  /** Confirmed contact shown to the customer (raw locally, masked over http). */
  emailHint?: string;
  phoneHint?: string;
  /** Raw values to prefill inputs on edit — local only; never sent cross-device. */
  emailPrefill?: string;
  phonePrefill?: string;
  locale: string;
  children: NormalizedChild[];
  status: 'active' | 'submitted' | 'expired';
};

export type Step1Input = { email?: string; phone?: string; consent: Consent };

export type RecoveryController = {
  view: RecoveryView;
  submitStep1(input: Step1Input): Promise<void>;
  /** Save the children the customer entered, then mark the flow complete. */
  submitChildren(children: NormalizedChild[]): Promise<void>;
  /** Finish without changing children (the "Skip" path) — keeps imported data. */
  finish(): Promise<void>;
};

export type LoadResult = RecoveryController | 'invalid' | 'expired';

export async function loadRecovery(token: string): Promise<LoadResult> {
  return activeRecoveryBackend() === 'http' ? loadHttp(token) : loadLocal(token);
}

async function loadLocal(token: string): Promise<LoadResult> {
  const link = await getRecoveryLink(token);
  if (!link) return 'invalid';
  if (!isLinkUsable(link.expiresAt)) return 'expired';
  const customer = await getCustomer(link.customerId);
  if (!customer) return 'invalid';

  // Record the open.
  let curLink: RecoveryLink = markLinkOpened(link);
  await updateRecoveryLink(curLink);

  let current: StagingCustomer = customer;
  const { needsEmail, needsPhone } = missingKeyFields(current);
  const n = current.normalized;

  return {
    view: {
      firstName: n.firstName ?? '',
      needsEmail,
      needsPhone,
      emailHint: !needsEmail ? n.email : undefined,
      phoneHint: !needsPhone ? n.phone : undefined,
      emailPrefill: n.email || undefined,
      phonePrefill: n.phone || undefined,
      locale: n.locale || 'en_GB',
      children: n.children,
      status: link.status,
    },
    async submitStep1(input) {
      current = applyStep1(current, input);
      await updateCustomer(current);
      curLink = { ...curLink, step1SubmittedAt: Date.now() };
      await updateRecoveryLink(curLink);
    },
    async submitChildren(children) {
      current = applyChildren(current, children);
      await updateCustomer(current);
      curLink = { ...curLink, completedAt: Date.now(), status: 'submitted' };
      await updateRecoveryLink(curLink);
    },
    async finish() {
      curLink = { ...curLink, completedAt: Date.now(), status: 'submitted' };
      await updateRecoveryLink(curLink);
    },
  };
}

async function loadHttp(token: string): Promise<LoadResult> {
  const res = await fetchPublicView(token); // GET also records the open server-side
  if (res.kind === 'not-found') return 'invalid';
  if (res.kind === 'expired') return 'expired';
  const r = res.view.record;

  return {
    view: {
      firstName: r.firstName,
      needsEmail: r.needsEmail,
      needsPhone: r.needsPhone,
      emailHint: r.emailMasked,
      phoneHint: r.phoneMasked,
      phonePrefill: undefined, // raw contact never crosses to the customer device
      locale: r.locale || 'en_GB',
      children: r.children.map((c) => ({ dayMonth: c.dayMonth, yearKnown: false })),
      status: res.view.status,
    },
    submitStep1: (input) => httpStep1(token, input),
    submitChildren: (children) =>
      httpChildren(
        token,
        children.map((c) => ({ dayMonth: c.dayMonth, year: c.year, name: c.name, gender: c.gender })),
      ),
    finish: () => httpComplete(token),
  };
}
