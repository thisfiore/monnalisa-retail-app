import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { StagingCustomer, StagingStatus, NormalizedFields } from '../../lib/import/types.ts';

// The search calls the durable microservice (`searchCustomers`) for candidates,
// then refines them with the precise client-side `matches` rule. Stub the
// network call so the matching/shaping logic is exercised in isolation.
const searchCustomers = vi.fn();
vi.mock('../../lib/import/recovery-backend/staging-client.ts', () => ({
  searchCustomers: (...args: unknown[]) => searchCustomers(...args),
}));

import { searchRecoveryCustomers } from '../../lib/import/recovery-search.ts';

const STORE = 'store-1';
const getToken = vi.fn(async () => 'tok');

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
  searchCustomers.mockReset();
  getToken.mockClear();
});

describe('searchRecoveryCustomers', () => {
  it('returns [] for an empty query without calling the service', async () => {
    expect(await searchRecoveryCustomers(STORE, '   ', 10, { getToken })).toEqual([]);
    expect(searchCustomers).not.toHaveBeenCalled();
  });

  it('returns [] when no storeId is given', async () => {
    expect(await searchRecoveryCustomers('', 'mario', 10, { getToken })).toEqual([]);
    expect(searchCustomers).not.toHaveBeenCalled();
  });

  it('returns [] when no auth token provider is available', async () => {
    expect(await searchRecoveryCustomers(STORE, 'mario', 10)).toEqual([]);
    expect(searchCustomers).not.toHaveBeenCalled();
  });

  it('refines candidates across first + last name with multiple tokens', async () => {
    searchCustomers.mockResolvedValue([
      customer('1', { firstName: 'Carla', lastName: 'Rossi' }),
      customer('2', { firstName: 'Marco', lastName: 'Bianchi' }),
    ]);
    const out = await searchRecoveryCustomers(STORE, 'carla rossi', 10, { getToken });
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe('Carla Rossi');
    expect(out[0].source).toBe('recovery');
    expect(searchCustomers).toHaveBeenCalledTimes(1);
  });

  it('matches a phone by digits regardless of formatting', async () => {
    searchCustomers.mockResolvedValue([
      customer('1', { firstName: 'Carla', phone: '+39 333 123 4567' }),
    ]);
    expect(await searchRecoveryCustomers(STORE, '3331234', 10, { getToken })).toHaveLength(1);
    expect(await searchRecoveryCustomers(STORE, '333 1234', 10, { getToken })).toHaveLength(1);
    expect(await searchRecoveryCustomers(STORE, '999', 10, { getToken })).toHaveLength(0);
  });

  it('matches the alternate phone too', async () => {
    searchCustomers.mockResolvedValue([
      customer('1', { firstName: 'Carla', phone: '+39111', phoneAlt: '+39 222 333' }),
    ]);
    expect(await searchRecoveryCustomers(STORE, '222333', 10, { getToken })).toHaveLength(1);
  });

  it('hides records already created in the CRM', async () => {
    searchCustomers.mockResolvedValue([
      customer('1', { firstName: 'Carla', lastName: 'Rossi' }, 'created'),
      customer('2', { firstName: 'Carlo', lastName: 'Rossi' }, 'ready'),
    ]);
    const out = await searchRecoveryCustomers(STORE, 'rossi', 10, { getToken });
    expect(out.map((r) => r.name)).toEqual(['Carlo Rossi']);
  });

  it('derives the route customerNo from the id suffix', async () => {
    searchCustomers.mockResolvedValue([customer('abc-uuid', { firstName: 'Carla' })]);
    const [r] = await searchRecoveryCustomers(STORE, 'carla', 10, { getToken });
    expect(r.customerNo).toBe('abc-uuid');
    expect(r.importId).toBe('imp-1');
  });

  it('respects the result limit', async () => {
    searchCustomers.mockResolvedValue(
      Array.from({ length: 5 }, (_, i) => customer(String(i), { firstName: 'Carla' })),
    );
    expect(await searchRecoveryCustomers(STORE, 'carla', 2, { getToken })).toHaveLength(2);
  });

  it('keeps phone null when the record has none', async () => {
    searchCustomers.mockResolvedValue([customer('1', { firstName: 'Carla', phone: '' })]);
    const [r] = await searchRecoveryCustomers(STORE, 'carla', 10, { getToken });
    expect(r.phone).toBeNull();
    expect(r.email).toBe('');
  });

  it('returns [] when the service call fails', async () => {
    searchCustomers.mockRejectedValueOnce(new Error('network down'));
    const out = await searchRecoveryCustomers(STORE, 'carla', 10, { getToken });
    expect(out).toEqual([]);
  });
});
