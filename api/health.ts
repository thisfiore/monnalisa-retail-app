// Diagnostic endpoint: returns a tiny JSON so we can verify the Vercel
// function pipeline is working independently of BE connectivity.
// Hit /api/health from a browser after deploy.

export const config = { runtime: 'edge' };

export default function handler(): Response {
  return new Response(
    JSON.stringify({
      ok: true,
      hasBeBaseUrl: typeof process.env.BE_BASE_URL === 'string' && process.env.BE_BASE_URL.length > 0,
      runtime: 'edge',
      timestamp: new Date().toISOString(),
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );
}
