// Vercel Edge Function: server-side proxy that forwards every BE call to the
// gateway selected per Vercel project via the BE_BASE_URL env var.
//
// Routing: vercel.json rewrites every /api/<rest> (except /api/health and
// /api/proxy itself) to /api/proxy?_p=<rest>. This function reads _p, strips
// it from the forwarded query string, and proxies to ${BE_BASE_URL}/<_p>.
// The browser stays same-origin so there is no CORS handshake to negotiate.

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
    return jsonError(500, 'BE_BASE_URL is not configured on this Vercel project');
  }

  const incoming = new URL(req.url);
  const originalPath = incoming.searchParams.get('_p');
  if (!originalPath) {
    return jsonError(400, 'Missing _p query param (proxy invoked outside its rewrite)');
  }

  const forwardedQuery = new URLSearchParams(incoming.searchParams);
  forwardedQuery.delete('_p');
  const queryString = forwardedQuery.toString();
  const targetUrl =
    `${beBaseUrl.replace(/\/$/, '')}/${originalPath.replace(/^\/+/, '')}` +
    (queryString ? `?${queryString}` : '');

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
    return jsonError(
      502,
      'Upstream request failed',
      error instanceof Error ? error.message : String(error),
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

function jsonError(status: number, message: string, detail?: string): Response {
  const body = detail ? { message, detail } : { message };
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}
