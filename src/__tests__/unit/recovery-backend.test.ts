import { describe, it, expect } from 'vitest';
import {
  toRecoveryRecord,
  toRecoveryDoc,
  toPublicView,
  maskEmail,
  maskPhone,
} from '../../lib/import/recovery-backend/firestore-shapes.ts';
import type { NormalizedFields, RecoveryLink, StagingCustomer } from '../../lib/import/types.ts';

function makeRec(overrides: Partial<NormalizedFields> = {}): StagingCustomer {
  const normalized: NormalizedFields = {
    firstName: 'Mario',
    lastName: 'Rossi',
    email: '',
    phone: '+393331231231',
    phoneAlt: '',
    country: 'Italy',
    locale: 'it_IT',
    localeSource: 'phone',
    localeConfidence: 0.9,
    localeReason: 'IT phone code',
    csvStore: 'Forte dei Marmi',
    type: 'DOO',
    children: [{ dayMonth: '12/05', yearKnown: false }],
    ...overrides,
  };
  return {
    id: 'store1:42',
    storeId: 'store1',
    customerId: '42',
    importId: 'imp1',
    source: { secret: 'legacy-row', grossSales: '99999' } as unknown as StagingCustomer['source'],
    normalized,
    status: 'review',
    flags: {} as StagingCustomer['flags'],
    updatedAt: 0,
    createdAt: 0,
  };
}

const link: RecoveryLink = {
  token: 'tok-123',
  customerId: 'store1:42',
  storeId: 'store1',
  importId: 'imp1',
  createdAt: 1000,
  expiresAt: 2000,
  status: 'active',
  sentAt: 1500,
  sendCount: 1,
};

describe('toRecoveryRecord', () => {
  it('flags the missing key field and masks the present one', () => {
    const r = toRecoveryRecord(makeRec()); // has phone, no email
    expect(r.needsEmail).toBe(true);
    expect(r.needsPhone).toBe(false);
    expect(r.phoneMasked).toBe('+39 •••• 1231');
    expect(r.emailMasked).toBeUndefined();
  });

  it('exposes children as day/month only — never the year or name', () => {
    const r = toRecoveryRecord(
      makeRec({ children: [{ dayMonth: '12/05', yearKnown: true, year: 2018, name: 'Lia' }] }),
    );
    expect(r.children).toEqual([{ dayMonth: '12/05' }]);
    expect(JSON.stringify(r)).not.toContain('2018');
    expect(JSON.stringify(r)).not.toContain('Lia');
  });
});

describe('toPublicView — PII boundary', () => {
  it('exposes only status/expired/record and leaks no legacy data', () => {
    const doc = toRecoveryDoc(makeRec({ email: 'mario.rossi@gmail.com' }), link);
    const view = toPublicView(doc, 1800);
    expect(Object.keys(view).sort()).toEqual(['expired', 'record', 'status']);
    const blob = JSON.stringify(view);
    // No identifiers, no raw contact data, no legacy source.
    expect(blob).not.toContain('store1');
    expect(blob).not.toContain('imp1');
    expect(blob).not.toContain('legacy-row');
    expect(blob).not.toContain('99999');
    expect(blob).not.toContain('mario.rossi@gmail.com');
    expect(blob).not.toContain('+393331231231');
  });

  it('computes expiry against the link window', () => {
    const doc = toRecoveryDoc(makeRec(), link); // expiresAt 2000
    expect(toPublicView(doc, 1999).expired).toBe(false);
    expect(toPublicView(doc, 2000).expired).toBe(true);
  });
});

describe('masking helpers', () => {
  it('masks email keeping first char + domain', () => {
    expect(maskEmail('mario.rossi@gmail.com')).toBe('m•••@gmail.com');
    expect(maskEmail('not-an-email')).toBe('•••');
  });
  it('masks phone keeping a short head + last 4', () => {
    expect(maskPhone('+393331231231')).toBe('+39 •••• 1231');
    expect(maskPhone('+391')).toBe('••••');
  });
});
