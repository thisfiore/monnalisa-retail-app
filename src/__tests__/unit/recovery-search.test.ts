import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { StagingCustomer, StagingStatus, NormalizedFields } from '../../lib/import/types.ts';

// The search reads the local staging store; stub it so the matching logic is
// exercised in isolation (no IndexedDB).
const listCustomers = vi.fn();
vi.mock('../../lib/import/staging-db.ts', () => ({
  listCustomers: (...args: unknown[]) => listCustomers(...args),
}));

import { searchRecoveryCustomers } from '../../lib/import/recovery-search.ts';

const STORE = 'store-1';

function normalized(over: Partial<NormalizedFields> = {}): NormalizedFields {
  return {
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    phoneAlt: '',
    country: 'Italy',
    locale: 'it_IT',
    localeSource: 'store',
    localeConfidence: 1,
    localeReason: '',
    csvStore: '',
    type: '',
    children: [],
    ...over,
  };
}

function customer(
  customerId: string,
  norm: Partial<NormalizedFields>,
  status: StagingStatus = 'ready',
): StagingCustomer {
  return {
    id: `${STORE}:${customerId}`,
    storeId: STORE,
    customerId,
    importId: 'imp-1',
    source: {} as StagingCustomer['source'],
    normalized: normalized(norm),
    status,
    flags: {} as StagingCustomer['flags'],
    updatedAt: 0,
    createdAt: 0,
  };
}

beforeEach(() => {
  listCustomers.mockReset();
});

describe('searchRecoveryCustomers', () => {
  it('returns [] for an empty query without touching the store', async () => {
    expect(await searchRecoveryCustomers(STORE, '   ', 10)).toEqual([]);
    expect(listCustomers).not.toHaveBeenCalled();
  });

  it('returns [] when no storeId is given', async () => {
    expect(await searchRecoveryCustomers('', 'mario', 10)).toEqual([]);
    expect(listCustomers).not.toHaveBeenCalled();
  });

  it('matches across first + last name with multiple tokens', async () => {
    listCustomers.mockResolvedValue([
      customer('1', { firstName: 'Carla', lastName: 'Rossi' }),
      customer('2', { firstName: 'Marco', lastName: 'Bianchi' }),
    ]);
    const out = await searchRecoveryCustomers(STORE, 'carla rossi', 10);
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe('Carla Rossi');
    expect(out[0].source).toBe('recovery');
  });

  it('matches a phone by digits regardless of formatting', async () => {
    listCustomers.mockResolvedValue([
      customer('1', { firstName: 'Carla', phone: '+39 333 123 4567' }),
    ]);
    expect(await searchRecoveryCustomers(STORE, '3331234', 10)).toHaveLength(1);
    expect(await searchRecoveryCustomers(STORE, '333 1234', 10)).toHaveLength(1);
    expect(await searchRecoveryCustomers(STORE, '999', 10)).toHaveLength(0);
  });

  it('matches the alternate phone too', async () => {
    listCustomers.mockResolvedValue([
      customer('1', { firstName: 'Carla', phone: '+39111', phoneAlt: '+39 222 333' }),
    ]);
    expect(await searchRecoveryCustomers(STORE, '222333', 10)).toHaveLength(1);
  });

  it('hides records already created in the CRM', async () => {
    listCustomers.mockResolvedValue([
      customer('1', { firstName: 'Carla', lastName: 'Rossi' }, 'created'),
      customer('2', { firstName: 'Carlo', lastName: 'Rossi' }, 'ready'),
    ]);
    const out = await searchRecoveryCustomers(STORE, 'rossi', 10);
    expect(out.map((r) => r.name)).toEqual(['Carlo Rossi']);
  });

  it('derives the route customerNo from the id suffix', async () => {
    listCustomers.mockResolvedValue([
      customer('abc-uuid', { firstName: 'Carla' }),
    ]);
    const [r] = await searchRecoveryCustomers(STORE, 'carla', 10);
    expect(r.customerNo).toBe('abc-uuid');
    expect(r.importId).toBe('imp-1');
  });

  it('respects the result limit', async () => {
    listCustomers.mockResolvedValue(
      Array.from({ length: 5 }, (_, i) => customer(String(i), { firstName: 'Carla' })),
    );
    expect(await searchRecoveryCustomers(STORE, 'carla', 2)).toHaveLength(2);
  });

  it('keeps phone null when the record has none', async () => {
    listCustomers.mockResolvedValue([customer('1', { firstName: 'Carla', phone: '' })]);
    const [r] = await searchRecoveryCustomers(STORE, 'carla', 10);
    expect(r.phone).toBeNull();
    expect(r.email).toBe('');
  });
});
