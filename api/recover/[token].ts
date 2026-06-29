// Vercel Edge Function: PUBLIC recovery-link endpoint for the customer's phone.
//
// SCAFFOLD — NOT WIRED. Returns 501 until a Firestore database + service account
// are provisioned (see docs/recovery-backend.md). The customer has only an
// opaque token (no Firebase session), so this server function is the ONLY path
// that may touch Firestore on their behalf; it uses a service account and
// returns nothing beyond the PII-minimised public projection.
//
// Contract once enabled:
//   GET  /api/recover/:token  → 200 { status, expired, record } | 404
//   POST /api/recover/:token  → 200 { ok: true }   body: { step: 'step1'|'children', ... }
//
// Reachability: vercel.json excludes `recover` from the BE proxy rewrite, so
// this file handles the route on a real Vercel deploy. Under `vite dev`, /api/*
// is proxied to the BE gateway, so it does not run locally (same as api/proxy).

export const config = { runtime: 'edge' };

type ServerConfig = { projectId: string; serviceAccountJson: string };

/** Read server-only config; absent → the backend is not provisioned yet. */
function readConfig(): ServerConfig | null {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!projectId || !serviceAccountJson) return null;
  return { projectId, serviceAccountJson };
}

export default async function handler(req: Request): Promise<Response> {
  const cfg = readConfig();
  if (!cfg) {
    return json(501, {
      message: 'Recovery backend not enabled',
      detail:
        'Set FIREBASE_PROJECT_ID and GOOGLE_SERVICE_ACCOUNT_JSON, then implement getAccessToken(). See docs/recovery-backend.md.',
    });
  }

  const token = new URL(req.url).pathname.split('/').pop() ?? '';
  if (!token) return json(400, { message: 'Missing token' });

  // TODO (enable step): mint a Google OAuth2 access token from the service
  // account (sign a JWT with the SA private key via WebCrypto, exchange at
  // https://oauth2.googleapis.com/token for scope datastore), then use
  // `firestoreFetch({ projectId, bearer: accessToken }, ...)` from
  // src/lib/import/recovery-backend/firestore-rest.ts.
  //
  //   GET  → read recoveryLinks/<token>, return toPublicView(doc)
  //   POST → validate body, PATCH recoveryLinks/<token>.submission, advance status
  //
  // Until getAccessToken() is implemented we fail closed.
  void req.method;
  return json(501, {
    message: 'Recovery backend not enabled',
    detail: 'getAccessToken() (service-account → OAuth2) is not implemented yet.',
  });
}

function json(status: number, data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}
