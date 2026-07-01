/**
 * Data layer for the public recovery page. The record is served by the durable
 * microservice (Mongo) so the link resolves on the customer's own device, and
 * submissions post back through the same token-gated interface.
 */
import {
  fetchPublicView,
  submitStep1 as httpStep1,
  submitChildren as httpChildren,
  submitComplete as httpComplete,
} from './recovery-backend/public-client';
import type { Consent } from './recovery';
import type { NormalizedChild } from './types';

export type RecoveryView = {
  firstName: string;
  needsEmail: boolean;
  needsPhone: boolean;
  /** Confirmed contact shown to the customer (masked). */
  emailHint?: string;
  phoneHint?: string;
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
