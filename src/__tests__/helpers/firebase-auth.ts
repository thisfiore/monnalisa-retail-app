/**
 * Firebase REST API helper for integration tests.
 * Uses the identitytoolkit REST endpoint to sign in and get an idToken.
 */

const FIREBASE_API_KEY = 'AIzaSyD0L9ZGODLxQtKMBjcGI9_N9wTZYr3Qf5Y';
const FIREBASE_SIGN_IN_URL = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`;

export type FirebaseSignInResponse = {
  idToken: string;
  email: string;
  refreshToken: string;
  expiresIn: string;
  localId: string;
  registered: boolean;
};

export type FirebaseErrorResponse = {
  error: {
    code: number;
    message: string;
    errors: { message: string; domain: string; reason: string }[];
  };
};

export async function firebaseSignIn(
  email?: string,
  password?: string,
): Promise<FirebaseSignInResponse> {
  const body = {
    email: email ?? (import.meta.env.TEST_FIREBASE_EMAIL as string | undefined) ?? 'storemanager1@monnalisa.com',
    password: password ?? (import.meta.env.TEST_FIREBASE_PASSWORD as string | undefined) ?? 'zW~]@sD4feIAN#I#36y@',
    returnSecureToken: true,
  };

  const response = await fetch(FIREBASE_SIGN_IN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = (await response.json()) as FirebaseErrorResponse;
    throw new Error(
      `Firebase sign-in failed: ${error.error.message} (${response.status})`,
    );
  }

  return response.json() as Promise<FirebaseSignInResponse>;
}

/** Cache a token for the test suite so we don't re-auth for every test */
let cachedToken: string | null = null;

export async function getTestToken(): Promise<string> {
  if (cachedToken) return cachedToken;
  const result = await firebaseSignIn();
  cachedToken = result.idToken;
  return cachedToken;
}
