import { describe, it, expect } from 'vitest';
import {
  computeFunnel,
  recoveryState,
  isReadyForCrm,
} from '../../lib/import/outreach-stats.ts';
import { markLinkOpened, markLinkSent } from '../../lib/import/sms-send.ts';
import type { RecoveryLink } from '../../lib/import/types.ts';

const NOW = 1_000_000;
function link(over: Partial<RecoveryLink> = {}): RecoveryLink {
  return {
    token: 't',
    customerId: 's:1',
    storeId: 's',
    importId: 'i',
    createdAt: NOW,
    expiresAt: NOW + 1000,
    status: 'active',
    ...over,
  };
}

describe('recoveryState', () => {
  it('walks the funnel newest-stage-wins', () => {
    expect(recoveryState(link(), NOW)).toBe('not-sent');
    expect(recoveryState(link({ sentAt: NOW }), NOW)).toBe('sent');
    expect(recoveryState(link({ sentAt: NOW, openedAt: NOW }), NOW)).toBe('opened');
    expect(recoveryState(link({ sentAt: NOW, openedAt: NOW, step1SubmittedAt: NOW }), NOW)).toBe('step1');
    expect(recoveryState(link({ completedAt: NOW, status: 'submitted' }), NOW)).toBe('completed');
  });

  it('reports expired only when not completed and past TTL', () => {
    expect(recoveryState(link({ sentAt: NOW }), NOW + 5000)).toBe('expired');
    expect(recoveryState(link({ completedAt: NOW }), NOW + 5000)).toBe('completed');
  });
});

describe('isReadyForCrm', () => {
  it('is true once step 1 (contact + consent) was submitted', () => {
    expect(isReadyForCrm(link())).toBe(false);
    expect(isReadyForCrm(link({ step1SubmittedAt: NOW }))).toBe(true);
  });
});

describe('computeFunnel', () => {
  it('counts each stage and rates against sent', () => {
    const links = [
      link({ token: 'a' }), // minted only
      link({ token: 'b', sentAt: NOW }), // sent
      link({ token: 'c', sentAt: NOW, openedAt: NOW }), // opened
      link({ token: 'd', sentAt: NOW, openedAt: NOW, step1SubmittedAt: NOW }), // step1
      link({ token: 'e', sentAt: NOW, openedAt: NOW, step1SubmittedAt: NOW, completedAt: NOW, status: 'submitted' }),
    ];
    const f = computeFunnel(links, NOW);
    expect(f.minted).toBe(5);
    expect(f.sent).toBe(4);
    expect(f.opened).toBe(3);
    expect(f.step1).toBe(2);
    expect(f.completed).toBe(1);
    expect(f.openRate).toBeCloseTo(3 / 4);
    expect(f.step1Rate).toBeCloseTo(2 / 4);
    expect(f.completedRate).toBeCloseTo(1 / 4);
  });

  it('handles zero sent without dividing by zero', () => {
    const f = computeFunnel([link()], NOW);
    expect(f.sent).toBe(0);
    expect(f.openRate).toBe(0);
  });
});

describe('markLinkOpened', () => {
  it('stamps first-open and increments the count', () => {
    const a = markLinkOpened(link(), NOW);
    expect(a.openedAt).toBe(NOW);
    expect(a.openCount).toBe(1);
    const b = markLinkOpened(a, NOW + 500);
    expect(b.openedAt).toBe(NOW); // first open wins
    expect(b.openCount).toBe(2);
  });

  it('markLinkSent increments send count and stores the body', () => {
    const s = markLinkSent(link(), 'hello +link', NOW);
    expect(s.sentAt).toBe(NOW);
    expect(s.sendCount).toBe(1);
    expect(s.lastSmsBody).toBe('hello +link');
  });
});
