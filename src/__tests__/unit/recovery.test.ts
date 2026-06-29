import { describe, it, expect } from 'vitest';
import {
  applyChildren,
  applyStep1,
  defaultConsent,
  missingKeyFields,
  isLinkUsable,
} from '../../lib/import/recovery.ts';
import type { NormalizedFields, StagingCustomer } from '../../lib/import/types.ts';

function makeRec(over: Partial<NormalizedFields>): StagingCustomer {
  const normalized: NormalizedFields = {
    firstName: 'Mario',
    lastName: 'Rossi',
    email: '',
    phone: '',
    phoneAlt: '',
    country: 'Italy',
    locale: 'it_IT',
    localeSource: 'store',
    localeConfidence: 1,
    localeReason: 'test fixture',
    csvStore: 'Forte dei Marmi',
    type: 'DOO',
    children: [],
    ...over,
  };
  return {
    id: 'store1:42',
    storeId: 'store1',
    customerId: '42',
    importId: 'imp1',
    source: {} as StagingCustomer['source'],
    normalized,
    status: 'review',
    flags: {} as StagingCustomer['flags'],
    updatedAt: 0,
    createdAt: 0,
  };
}

describe('missingKeyFields', () => {
  it('flags missing email when only a valid phone is present', () => {
    const rec = makeRec({ email: '', phone: '+393331234567' });
    expect(missingKeyFields(rec)).toEqual({ needsEmail: true, needsPhone: false });
  });

  it('flags missing phone when only a valid email is present', () => {
    const rec = makeRec({ email: 'mario@example.com', phone: '' });
    expect(missingKeyFields(rec)).toEqual({ needsEmail: false, needsPhone: true });
  });

  it('flags both when neither is usable', () => {
    const rec = makeRec({ email: 'not-an-email', phone: '333 1234567' });
    expect(missingKeyFields(rec)).toEqual({ needsEmail: true, needsPhone: true });
  });
});

describe('defaultConsent', () => {
  it('pre-checks loyalty and marketing, and gates privacy', () => {
    expect(defaultConsent()).toEqual({ privacy: false, loyalty: true, marketing: true });
  });
});

describe('applyStep1', () => {
  it('fills the missing email, normalizes phone to E.164, and records consent', () => {
    const rec = makeRec({ email: '', phone: '+393331234567' });
    const out = applyStep1(rec, {
      email: 'mario@example.com',
      phone: '+39 333 765 4321',
      consent: { privacy: true, loyalty: true, marketing: false },
    });
    expect(out.normalized.email).toBe('mario@example.com');
    expect(out.normalized.phone).toBe('+393337654321');
    expect(out.consent).toEqual({ privacy: true, loyalty: true, marketing: false });
    expect(out.customerSubmittedAt).toBeGreaterThan(0);
  });

  it('keeps existing values when a field is left blank', () => {
    const rec = makeRec({ email: 'keep@example.com', phone: '+393331234567' });
    const out = applyStep1(rec, { consent: defaultConsent() });
    expect(out.normalized.email).toBe('keep@example.com');
    expect(out.normalized.phone).toBe('+393331234567');
  });
});

describe('applyChildren', () => {
  it('sets yearKnown from the supplied year', () => {
    const rec = makeRec({ children: [{ dayMonth: '05/03', yearKnown: false }] });
    const out = applyChildren(rec, [
      { dayMonth: '05/03', yearKnown: false, year: 2018, name: 'Lucia', gender: 'Female' },
      { dayMonth: '12/09', yearKnown: false },
    ]);
    expect(out.normalized.children[0]).toMatchObject({ year: 2018, yearKnown: true, name: 'Lucia' });
    expect(out.normalized.children[1].yearKnown).toBe(false);
    expect(out.customerSubmittedAt).toBeGreaterThan(0);
  });
});

describe('isLinkUsable', () => {
  it('is usable before expiry and not after', () => {
    expect(isLinkUsable(1000, 500)).toBe(true);
    expect(isLinkUsable(1000, 1500)).toBe(false);
  });
});
