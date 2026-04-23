const FIREBASE_API_KEY = import.meta.env.VITE_FIREBASE_API_KEY as string;

const FIREBASE_SIGN_IN_URL = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`;
const FIREBASE_REFRESH_URL = `https://securetoken.googleapis.com/v1/token?key=${FIREBASE_API_KEY}`;

export type FirebaseSignInResponse = {
  idToken: string;
  email: string;
  refreshToken: string;
  expiresIn: string;
  localId: string;
  registered: boolean;
};

export type FirebaseRefreshResponse = {
  id_token: string;
  refresh_token: string;
  expires_in: string;
  token_type: string;
  user_id: string;
  project_id: string;
};

export type FirebaseErrorResponse = {
  error: {
    code: number;
    message: string;
    errors: { message: string; domain: string; reason: string }[];
  };
};

export async function firebaseSignIn(
  email: string,
  password: string,
): Promise<FirebaseSignInResponse> {
  const response = await fetch(FIREBASE_SIGN_IN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });

  if (!response.ok) {
    const error = (await response.json()) as FirebaseErrorResponse;
    const message = error.error.message;
    if (message === 'EMAIL_NOT_FOUND' || message === 'INVALID_PASSWORD' || message.startsWith('INVALID_LOGIN_CREDENTIALS')) {
      throw new Error('Invalid email or password');
    }
    throw new Error(`Authentication failed: ${message}`);
  }

  return response.json() as Promise<FirebaseSignInResponse>;
}

/**
 * Decode the payload of a Firebase ID token (JWT) and extract the Salesforce
 * Store__c record ID from the user's custom claim.
 *
 * BE sets a custom claim whose value is a JSON object containing `store_id`
 * (e.g. the claim value is `{"store_id": "a0W0E000004p9WdUAI"}`). Firebase may
 * expose custom claims either as parsed objects or as JSON strings, so we scan
 * all top-level claims and accept whichever shape contains `store_id`.
 *
 * Returns null if no such claim is found.
 */
export function extractStoreIdFromToken(idToken: string): string | null {
  try {
    const payloadB64 = idToken.split('.')[1];
    if (!payloadB64) return null;
    const base64 = payloadB64.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const payload = JSON.parse(atob(padded));

    for (const value of Object.values(payload)) {
      if (typeof value === 'string') {
        try {
          const parsed = JSON.parse(value);
          if (parsed && typeof parsed === 'object' && 'store_id' in parsed) {
            const id = (parsed as { store_id: unknown }).store_id;
            if (typeof id === 'string' && id) return id;
          }
        } catch {
          // not JSON, ignore
        }
      } else if (value && typeof value === 'object' && 'store_id' in (value as object)) {
        const id = (value as { store_id: unknown }).store_id;
        if (typeof id === 'string' && id) return id;
      }
    }
    return null;
  } catch {
    return null;
  }
}

export async function firebaseRefreshToken(
  refreshToken: string,
): Promise<FirebaseRefreshResponse> {
  const response = await fetch(FIREBASE_REFRESH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    const error = (await response.json()) as FirebaseErrorResponse;
    throw new Error(`Token refresh failed: ${error.error.message}`);
  }

  return response.json() as Promise<FirebaseRefreshResponse>;
}
