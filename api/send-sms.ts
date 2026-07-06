// Vercel Edge Function: server-side SMS send seam for the customer-recovery
// outreach. The provider is selected by the SMS_PROVIDER env var (default
// "dryrun"); real providers are pluggable adapters that slot into sendOne()
// without touching the client.
//
// Note: the client only calls this when VITE_SMS_DRYRUN=false. In the default
// prototype mode it simulates the send in the browser (see
// src/lib/import/sms-send.ts), because under `vite dev` every /api/* is proxied
// to the BE gateway and this function would not run locally.

export const config = { runtime: 'edge' };

type InMsg = { customerId?: string; to?: string; body?: string };
type OutMsg = {
  customerId: string;
  to: string;
  status: 'sent' | 'simulated' | 'failed';
  error?: string;
};

const E164 = /^\+[1-9]\d{1,14}$/;
const MAX_BATCH = 200;
const MAX_BODY = 480; // ~3 SMS segments — a guard, not a billing limit

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json(405, { message: 'Method not allowed' });
  // The recovery workspace is manager-authenticated; require the bearer token
  // even though dry-run doesn't use it, so the contract holds for real sends.
  if (!req.headers.get('authorization')) {
    return json(401, { message: 'Missing Authorization header' });
  }

  let payload: { messages?: InMsg[] };
  try {
    payload = (await req.json()) as { messages?: InMsg[] };
  } catch {
    return json(400, { message: 'Invalid JSON body' });
  }

  const messages = payload.messages ?? [];
  if (!Array.isArray(messages) || messages.length === 0) {
    return json(400, { message: 'No messages to send' });
  }
  if (messages.length > MAX_BATCH) {
    return json(400, { message: `Too many messages (max ${MAX_BATCH})` });
  }

  const provider = (process.env.SMS_PROVIDER ?? 'dryrun').toLowerCase();

  const results: OutMsg[] = [];
  for (const m of messages) {
    const to = (m.to ?? '').trim();
    const body = (m.body ?? '').trim();
    const customerId = m.customerId ?? '';
    if (!E164.test(to)) {
      results.push({ customerId, to, status: 'failed', error: 'Recipient not in E.164 format' });
      continue;
    }
    if (!body) {
      results.push({ customerId, to, status: 'failed', error: 'Empty message body' });
      continue;
    }
    if (body.length > MAX_BODY) {
      results.push({ customerId, to, status: 'failed', error: `Body exceeds ${MAX_BODY} chars` });
      continue;
    }
    results.push(await sendOne(provider, to, body, customerId));
  }

  return json(200, { provider, results });
}

async function sendOne(
  provider: string,
  to: string,
  body: string,
  customerId: string,
): Promise<OutMsg> {
  switch (provider) {
    case 'dryrun':
      console.log(`[SMS dryrun] → ${to}\n${body}`);
      return { customerId, to, status: 'simulated' };

    // --- Real-provider seams. Implement one of these and set SMS_PROVIDER. ---
    case 'skebby':
      // TODO: POST https://api.skebby.it/API/v1.0/REST/sms with SKEBBY_USER /
      // SKEBBY_KEY (or a session key) and a registered sender id.
      return notImplemented(provider, customerId, to);
    case 'twilio':
      return sendTwilio(to, body, customerId);
    case 'smsapi':
      return sendSmsApi(to, body, customerId);
    case 'gateway':
      // TODO: forward to the BE gateway's SMS endpoint (BE owns the provider).
      return notImplemented(provider, customerId, to);

    default:
      return { customerId, to, status: 'failed', error: `Unknown SMS_PROVIDER "${provider}"` };
  }
}

/**
 * Twilio Messages API adapter. Needs TWILIO_SID / TWILIO_TOKEN / TWILIO_FROM
 * (an SMS-capable number or Messaging Service SID). For a US test number, set
 * TWILIO_FROM to your Twilio US number in E.164 (e.g. +1XXXXXXXXXX).
 */
async function sendTwilio(to: string, body: string, customerId: string): Promise<OutMsg> {
  const sid = process.env.TWILIO_SID;
  const token = process.env.TWILIO_TOKEN;
  const from = process.env.TWILIO_FROM;
  if (!sid || !token || !from) {
    return {
      customerId,
      to,
      status: 'failed',
      error: 'Twilio not configured (need TWILIO_SID / TWILIO_TOKEN / TWILIO_FROM)',
    };
  }
  const form = new URLSearchParams({ To: to, Body: body });
  // A Messaging Service SID (MGxx…) uses MessagingServiceSid; a number uses From.
  if (from.startsWith('MG')) form.set('MessagingServiceSid', from);
  else form.set('From', from);

  try {
    const resp = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${btoa(`${sid}:${token}`)}`,
          'content-type': 'application/x-www-form-urlencoded',
        },
        body: form.toString(),
      },
    );
    const data = (await resp.json()) as { sid?: string; status?: string; message?: string };
    if (!resp.ok) {
      return { customerId, to, status: 'failed', error: data.message || `Twilio ${resp.status}` };
    }
    return { customerId, to, status: 'sent' };
  } catch (e) {
    return { customerId, to, status: 'failed', error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * SMSAPI.com adapter (https://www.smsapi.com/docs). Sends a single message via
 * the classic `POST /sms.do` endpoint with `format=json`, authenticated with an
 * OAuth2 access token.
 *
 * Env:
 *   SMSAPI_TOKEN    — OAuth2 access token (required). Create under
 *                     smsapi.com → API → OAuth/Tokens.
 *   SMSAPI_FROM     — verified sender name. If unset, SMSAPI uses your account
 *                     default (the "Test" eco sender on trial accounts).
 *   SMSAPI_BASE_URL — host override (default https://api.smsapi.com). Use
 *                     https://api.smsapi.pl for the Polish region.
 *   SMSAPI_TEST     — "1" to validate without sending or charging (test mode).
 *   SMSAPI_SHORTEN  — "0" to disable link shortening. Default ON: any URL in the
 *                     body is wrapped in SMSAPI's [%goto:url%] shortener so it is
 *                     delivered as a tracked cut.li link. SMSAPI blocks RAW links
 *                     ("Not allowed to send messages with link"); routing through
 *                     the shortener is their sanctioned way to include a URL.
 *
 * Recipient is sent without the leading "+" (SMSAPI expects bare international
 * digits, e.g. 393331234567). Encoding is forced to UTF-8 so accented copy and
 * emoji are delivered as UCS-2 by SMSAPI's auto-detection.
 */
/**
 * Wrap every http(s) URL in SMSAPI's `[%goto:url%]` shortener token so the link
 * is delivered as a tracked cut.li short link (SMSAPI rejects raw links). No-op
 * if disabled, if there is no URL, or if the body already uses the token.
 */
function shortenLinks(body: string): string {
  if (process.env.SMSAPI_SHORTEN === '0' || body.includes('[%goto:')) return body;
  return body.replace(/https?:\/\/\S+/g, (url) => `[%goto:${url}%]`);
}

async function sendSmsApi(to: string, body: string, customerId: string): Promise<OutMsg> {
  const token = process.env.SMSAPI_TOKEN;
  if (!token) {
    return { customerId, to, status: 'failed', error: 'SMSAPI not configured (need SMSAPI_TOKEN)' };
  }
  const base = (process.env.SMSAPI_BASE_URL ?? 'https://api.smsapi.com').replace(/\/+$/, '');

  const form = new URLSearchParams({
    to: to.replace(/^\+/, ''),
    message: shortenLinks(body),
    format: 'json',
    encoding: 'utf-8',
  });
  if (process.env.SMSAPI_FROM) form.set('from', process.env.SMSAPI_FROM);
  if (process.env.SMSAPI_TEST === '1') form.set('test', '1');

  type SmsApiResult = {
    count?: number;
    list?: Array<{ id?: string; status?: string; number?: string }>;
    error?: number;
    message?: string;
    invalid_numbers?: Array<{ number?: string; message?: string }>;
  };

  try {
    const resp = await fetch(`${base}/sms.do`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: form.toString(),
    });
    const data = (await resp.json().catch(() => ({}))) as SmsApiResult;
    // SMSAPI returns HTTP 200 with an `error` code in the body on failure.
    if (!resp.ok || data.error != null) {
      const invalid = data.invalid_numbers?.[0]?.message;
      const error = invalid || data.message || `SMSAPI error ${data.error ?? resp.status}`;
      return { customerId, to, status: 'failed', error };
    }
    return { customerId, to, status: 'sent' };
  } catch (e) {
    return { customerId, to, status: 'failed', error: e instanceof Error ? e.message : String(e) };
  }
}

function notImplemented(provider: string, customerId: string, to: string): OutMsg {
  return {
    customerId,
    to,
    status: 'failed',
    error: `SMS_PROVIDER="${provider}" adapter is not implemented yet`,
  };
}

function json(status: number, data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}
