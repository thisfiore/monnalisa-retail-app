import { describe, it, expect } from 'vitest';
import { docToLink } from '../../lib/import/recovery-backend/http-store.ts';
import { computeFunnel, recoveryState } from '../../lib/import/outreach-stats.ts';

describe('docToLink (backend doc → frontend RecoveryLink)', () => {
  it('maps a full doc, flattening submission timestamps and parsing ISO dates', () => {
    const created = '2026-06-20T10:00:00.000Z';
    const expires = '2026-07-20T10:00:00.000Z';
    const link = docToLink({
      token: 'tok1',
      customerRef: 'store9:abc',
      storeId: 'store9',
      importId: 'imp1',
      status: 'submitted',
      createdAt: created,
      expiresAt: expires,
      sentAt: '2026-06-20T11:00:00.000Z',
      sendCount: 2,
      openedAt: '2026-06-20T12:00:00.000Z',
      openCount: 3,
      lastSmsBody: 'hi',
      submission: {
        step1SubmittedAt: '2026-06-20T13:00:00.000Z',
        completedAt: '2026-06-20T14:00:00.000Z',
      },
    });

    expect(link.token).toBe('tok1');
    expect(link.customerId).toBe('store9:abc'); // customerRef → customerId
    expect(link.storeId).toBe('store9');
    expect(link.importId).toBe('imp1');
    expect(link.createdAt).toBe(Date.parse(created));
    expect(link.expiresAt).toBe(Date.parse(expires));
    expect(link.openedAt).toBe(Date.parse('2026-06-20T12:00:00.000Z'));
    expect(link.openCount).toBe(3);
    expect(link.sendCount).toBe(2);
    expect(link.step1SubmittedAt).toBe(Date.parse('2026-06-20T13:00:00.000Z'));
    expect(link.completedAt).toBe(Date.parse('2026-06-20T14:00:00.000Z'));
    // The mapped link drives the same funnel/state logic as local links.
    expect(recoveryState(link, Date.parse('2026-06-21T00:00:00Z'))).toBe('completed');
  });

  it('uses the importId fallback for the tracking-list projection (no storeId/importId fields)', () => {
    const link = docToLink(
      {
        token: 't2',
        customerRef: 's:2',
        status: 'active',
        createdAt: '2026-06-20T10:00:00.000Z',
        expiresAt: '2026-07-20T10:00:00.000Z',
        sentAt: '2026-06-20T11:00:00.000Z',
        openedAt: '2026-06-20T12:00:00.000Z',
      },
      { importId: 'imp1' },
    );
    expect(link.importId).toBe('imp1');
    expect(link.step1SubmittedAt).toBeUndefined();
    expect(recoveryState(link, Date.parse('2026-06-20T13:00:00Z'))).toBe('opened');
  });

  it('a list of mapped links produces a coherent funnel', () => {
    const base = {
      customerRef: 's:x',
      status: 'active',
      createdAt: '2026-06-20T10:00:00.000Z',
      expiresAt: '2026-07-20T10:00:00.000Z',
    };
    const links = [
      docToLink({ ...base, token: 'a', sentAt: '2026-06-20T11:00:00Z' }, { importId: 'i' }),
      docToLink(
        { ...base, token: 'b', sentAt: '2026-06-20T11:00:00Z', openedAt: '2026-06-20T12:00:00Z' },
        { importId: 'i' },
      ),
      docToLink(
        {
          ...base,
          token: 'c',
          sentAt: '2026-06-20T11:00:00Z',
          openedAt: '2026-06-20T12:00:00Z',
          submission: { step1SubmittedAt: '2026-06-20T13:00:00Z', completedAt: '2026-06-20T14:00:00Z' },
          status: 'submitted',
        },
        { importId: 'i' },
      ),
    ];
    const f = computeFunnel(links, Date.parse('2026-06-21T00:00:00Z'));
    expect(f).toMatchObject({ sent: 3, opened: 2, step1: 1, completed: 1 });
  });
});
