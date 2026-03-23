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
