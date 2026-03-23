import { describe, it, expect, beforeAll } from 'vitest';
import { getTestToken } from '../helpers/firebase-auth.ts';
import { customerApi, ApiError } from '../../lib/api-client.ts';

let token: string;

beforeAll(async () => {
  token = await getTestToken();
});

// The store manager email is a Firebase user but NOT a Salesforce customer.
// We use it only for auth. For customer lookups, we test shape validation.
const STORE_MANAGER_EMAIL = 'storemanager1@monnalisa.com';
const UNKNOWN_EMAIL = 'definitely-not-existing-user-xyz@example.com';

describe('checkEmailExists', () => {
  it('returns response with { exists: boolean } shape', async () => {
    const result = await customerApi.checkEmailExists(STORE_MANAGER_EMAIL, token);
    expect(result).toHaveProperty('exists');
    expect(typeof result.exists).toBe('boolean');
  });

  it('returns { exists: false } for an unknown email', async () => {
    const result = await customerApi.checkEmailExists(UNKNOWN_EMAIL, token);
    expect(result).toHaveProperty('exists');
    expect(result.exists).toBe(false);
  });
});

describe('getAccount', () => {
  it('returns 404 for email not in Salesforce', async () => {
    try {
      await customerApi.getAccount(UNKNOWN_EMAIL, token);
      expect.fail('Expected ApiError with status 404');
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).status).toBe(404);
    }
  });

  it('404 error body contains error details', async () => {
    try {
      await customerApi.getAccount(UNKNOWN_EMAIL, token);
      expect.fail('Expected ApiError');
    } catch (error) {
      const apiError = error as ApiError;
      // BFF returns { detail: ... } on 404, not { status, message }
      expect(apiError.body).toBeDefined();
      expect(typeof apiError.body).toBe('object');
    }
  });
});

describe('getLoyaltyLedger', () => {
  it('returns response matching LoyaltyPointLedgerResponse shape', async () => {
    // Even for a non-customer email, the API should return a valid shape or 404.
    // We test the contract either way.
    try {
      const result = await customerApi.getLoyaltyLedger(STORE_MANAGER_EMAIL, token);
      expect(result).toHaveProperty('totalSize');
      expect(typeof result.totalSize).toBe('number');
      expect(result).toHaveProperty('records');
      expect(Array.isArray(result.records)).toBe(true);

      if (result.records.length > 0) {
        const entry = result.records[0];
        expect(entry).toHaveProperty('Points__c');
        expect(entry).toHaveProperty('OperationDate__c');
        expect(entry).toHaveProperty('Status__c');
      }
    } catch (error) {
      // 404 is also acceptable if the email has no ledger
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).status).toBe(404);
    }
  });

  it('respects the limit parameter', async () => {
    try {
      const result = await customerApi.getLoyaltyLedger(STORE_MANAGER_EMAIL, token, 1);
      expect(result.records.length).toBeLessThanOrEqual(1);
    } catch (error) {
      // 404 is acceptable if no ledger exists
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).status).toBe(404);
    }
  });
});

describe('authorization', () => {
  it('rejects requests without a valid token', async () => {
    try {
      await customerApi.checkEmailExists(STORE_MANAGER_EMAIL, 'invalid-token');
      expect.fail('Expected ApiError for unauthorized request');
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      const apiError = error as ApiError;
      expect([401, 403]).toContain(apiError.status);
    }
  });
});
