import { describe, it, expect } from 'vitest';
import { firebaseSignIn } from '../helpers/firebase-auth.ts';

describe('Firebase Authentication', () => {
  it('returns idToken, refreshToken, and localId for valid credentials', async () => {
    const result = await firebaseSignIn(
      'storemanager1@monnalisa.com',
      'zW~]@sD4feIAN#I#36y@',
    );

    expect(result.idToken).toBeDefined();
    expect(typeof result.idToken).toBe('string');
    expect(result.idToken.length).toBeGreaterThan(0);

    expect(result.refreshToken).toBeDefined();
    expect(typeof result.refreshToken).toBe('string');

    expect(result.localId).toBeDefined();
    expect(typeof result.localId).toBe('string');

    expect(result.registered).toBe(true);
    expect(result.email).toBe('storemanager1@monnalisa.com');
  });

  it('throws error for invalid credentials', async () => {
    await expect(
      firebaseSignIn('invalid@example.com', 'wrongpassword'),
    ).rejects.toThrow('Firebase sign-in failed');
  });

  it('returned idToken can be used as Bearer token format', async () => {
    const result = await firebaseSignIn();
    const header = `Bearer ${result.idToken}`;
    expect(header).toMatch(/^Bearer .+/);
  });
});
