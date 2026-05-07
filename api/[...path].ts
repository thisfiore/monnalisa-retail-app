// Vercel Edge Function: server-side proxy that forwards every /api/* request
// to the BE API gateway. The browser stays same-origin (no CORS), and the
// target gateway is selected per Vercel project via the BE_BASE_URL env var:
//   Production project  → BE_BASE_URL=https://<prod-gateway>
//   Staging project     → BE_BASE_URL=https://monnalisa-mid-dev-api-gw-1lcvs0vu.ew.gateway.dev
// Local dev does NOT hit this function — vite.config.ts proxy handles it.

export const config = { runtime: 'edge' };

const HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'host',
  'content-length',
]);

export default async function handler(req: Request): Promise<Response> {
  const beBaseUrl = process.env.BE_BASE_URL;
  if (!beBaseUrl) {
    return new Response(
      JSON.stringify({ message: 'BE_BASE_URL is not configured on this Vercel project' }),
      { status: 500, headers: { 'content-type': 'application/json' } },
    );
  }

  const incoming = new URL(req.url);
  const targetPath = incoming.pathname.replace(/^\/api\//, '/');
  const targetUrl = `${beBaseUrl.replace(/\/$/, '')}${targetPath}${incoming.search}`;

  const fwdHeaders = new Headers();
  for (const [key, value] of req.headers) {
    const lk = key.toLowerCase();
    if (HOP_BY_HOP.has(lk)) continue;
    if (lk.startsWith('x-vercel-') || lk.startsWith('x-forwarded-')) continue;
    fwdHeaders.set(key, value);
  }

  const init: RequestInit = { method: req.method, headers: fwdHeaders };
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    init.body = await req.arrayBuffer();
  }

  let beResp: Response;
  try {
    beResp = await fetch(targetUrl, init);
  } catch (error) {
    return new Response(
      JSON.stringify({
        message: 'Upstream request failed',
        detail: error instanceof Error ? error.message : String(error),
      }),
      { status: 502, headers: { 'content-type': 'application/json' } },
    );
  }

  const respHeaders = new Headers();
  for (const [key, value] of beResp.headers) {
    const lk = key.toLowerCase();
    if (HOP_BY_HOP.has(lk)) continue;
    if (lk.startsWith('access-control-')) continue;
    respHeaders.set(key, value);
  }

  return new Response(beResp.body, { status: beResp.status, headers: respHeaders });
}
