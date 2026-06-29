import { describe, it, expect } from 'vitest';
import { applyRepairPatches, type RepairResult } from '../../lib/import/openai-normalize.ts';
import type { NormalizedFields, StagingCustomer } from '../../lib/import/types.ts';

function makeRec(locale: string): StagingCustomer {
  const normalized: NormalizedFields = {
    firstName: 'Yusupova',
    lastName: '',
    email: '',
    phone: '',
    phoneAlt: '',
    country: 'Italy',
    locale,
    localeSource: 'store',
    localeConfidence: 0.4,
    localeReason: 'store prior',
    csvStore: 'Forte dei Marmi',
    type: 'DOO',
    children: [],
  };
  return {
    id: 'store1:1',
    storeId: 'store1',
    customerId: '1',
    importId: 'imp1',
    source: {} as StagingCustomer['source'],
    normalized,
    status: 'review',
    flags: {} as StagingCustomer['flags'],
    updatedAt: 0,
    createdAt: 0,
  };
}

function result(locale: string | undefined): RepairResult {
  return {
    patches: locale ? { locale } : {},
    confidence: 0.8,
    reasoning: 'Russian name → not an Italian speaker.',
    suggestedActions: ['Collect a valid email address from the customer.'],
    hopeless: false,
  };
}

describe('applyRepairPatches locale handling', () => {
  it('coerces an unsupported locale (ru_RU) to en_GB and notes it', () => {
    const out = applyRepairPatches(makeRec('it_IT'), result('ru_RU'));
    expect(out.normalized.locale).toBe('en_GB');
    expect(out.aiNotes).toContain('ru_RU');
    expect(out.aiNotes).toContain('en_GB');
  });

  it('applies a supported locale as-is', () => {
    const out = applyRepairPatches(makeRec('it_IT'), result('fr_FR'));
    expect(out.normalized.locale).toBe('fr_FR');
  });

  it('leaves the existing locale untouched when no locale patch is returned', () => {
    const out = applyRepairPatches(makeRec('de_DE'), result(undefined));
    expect(out.normalized.locale).toBe('de_DE');
  });
});
