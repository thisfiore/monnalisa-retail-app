import { describe, it, expect, beforeAll } from 'vitest';
import { getTestToken } from '../helpers/firebase-auth.ts';
import { customerApi, ApiError } from '../../lib/api-client.ts';
import { fromSearchRecord } from '../../lib/api-transforms.ts';

let token: string;

beforeAll(async () => {
  token = await getTestToken();
});

describe('customerApi.search', () => {
  it('returns an array of PersonAccountSearchRecord', async () => {
    // "Mario" is a common Italian name likely to exist in Salesforce
    const results = await customerApi.search('Mario', token);
    expect(Array.isArray(results)).toBe(true);

    if (results.length > 0) {
      const record = results[0];
      // Verify shape matches PersonAccountSearchRecord
      expect(record).toHaveProperty('Name');
      expect(record).toHaveProperty('EmailKey__c');
      expect(record).toHaveProperty('Phone');
    }
  });

  it('returns empty array for gibberish query', async () => {
    const results = await customerApi.search('xyznonexistent9999', token);
    expect(Array.isArray(results)).toBe(true);
    expect(results).toHaveLength(0);
  });

  it('respects the limit parameter', async () => {
    const results = await customerApi.search('a', token, 2);
    expect(results.length).toBeLessThanOrEqual(2);
  });

  it('transforms search results to frontend SearchResult shape', async () => {
    const results = await customerApi.search('a', token, 5);
    const transformed = results.map(fromSearchRecord);

    for (const item of transformed) {
      expect(typeof item.name).toBe('string');
      expect(typeof item.firstName).toBe('string');
      expect(typeof item.lastName).toBe('string');
      expect(typeof item.email).toBe('string');
      expect(item.phone === null || typeof item.phone === 'string').toBe(true);
    }
  });

  it('rejects requests without a valid token', async () => {
    try {
      await customerApi.search('test', 'invalid-token');
      expect.fail('Expected ApiError for unauthorized request');
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      const apiError = error as ApiError;
      expect([401, 403]).toContain(apiError.status);
    }
  });
});
