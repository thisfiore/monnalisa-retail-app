import type { RecoveryLink } from './types';

/**
 * Client-side SMS send wrapper.
 *
 * Prototype default is a DRY RUN that simulates entirely in the browser — no
 * provider, no server — so the whole flow is testable under `vite dev` (where
 * every `/api/*` is proxied to the BE gateway, so the real `api/send-sms`
 * function isn't reachable anyway). Set `VITE_SMS_DRYRUN=false` to POST to
 * `/api/send-sms`, which selects a real provider via the `SMS_PROVIDER` env.
 */

export type SmsRequest = {
  customerId: string; // staging id `${storeId}:${customerNo}`
  to: string; // recipient phone, E.164
  body: string; // final text INCLUDING the recovery link
};

export type SmsOutcome = {
  customerId: string;
  to: string;
  status: 'sent' | 'simulated' | 'failed';
  error?: string;
};

export function smsDryRun(): boolean {
  return import.meta.env.VITE_SMS_DRYRUN !== 'false';
}

export async function sendSmsBatch(
  messages: SmsRequest[],
  getToken: () => Promise<string>,
): Promise<SmsOutcome[]> {
  if (messages.length === 0) return [];

  if (smsDryRun()) {
    for (const m of messages) {
      console.info(`[SMS dry-run] → ${m.to}\n${m.body}`);
    }
    return messages.map((m) => ({
      customerId: m.customerId,
      to: m.to,
      status: 'simulated' as const,
    }));
  }

  const token = await getToken();
  const resp = await fetch('/api/send-sms', {
    method: 'POST',
    headers: { 'content-type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ messages }),
  });
  if (!resp.ok) {
    const detail = await resp.text().catch(() => '');
    throw new Error(`SMS send failed (${resp.status}): ${detail || resp.statusText}`);
  }
  const data = (await resp.json()) as { results: SmsOutcome[] };
  return data.results;
}

/** Stamp a link as opened by the customer (pure — caller persists it). */
export function markLinkOpened(link: RecoveryLink, now: number = Date.now()): RecoveryLink {
  return {
    ...link,
    openedAt: link.openedAt ?? now, // first open wins for the "open" metric
    openCount: (link.openCount ?? 0) + 1,
  };
}

/** Stamp a link as having had an SMS sent (pure — caller persists it). */
export function markLinkSent(
  link: RecoveryLink,
  body: string,
  now: number = Date.now(),
): RecoveryLink {
  return {
    ...link,
    sentAt: now,
    sendCount: (link.sendCount ?? 0) + 1,
    lastSmsBody: body,
  };
}
