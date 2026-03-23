import { describe, it, expect } from 'vitest';
import { fromSearchRecord } from '../../lib/api-transforms.ts';
import type { PersonAccountSearchRecord } from '../../lib/api-types.ts';

// ---------------------------------------------------------------------------
// fromSearchRecord — mapping API search results to frontend SearchResult
// ---------------------------------------------------------------------------
describe('fromSearchRecord', () => {
  it('maps a complete record with first and last name', () => {
    const record: PersonAccountSearchRecord = {
      Name: 'Mario Rossi',
      EmailKey__c: 'mario.rossi@example.com',
      Phone: '+393331234567',
    };
    const result = fromSearchRecord(record);
    expect(result).toEqual({
      name: 'Mario Rossi',
      firstName: 'Mario',
      lastName: 'Rossi',
      email: 'mario.rossi@example.com',
      phone: '+393331234567',
    });
  });

  it('handles compound last name (e.g. "Maria De Luca")', () => {
    const record: PersonAccountSearchRecord = {
      Name: 'Maria De Luca',
      EmailKey__c: 'maria.deluca@example.com',
      Phone: null,
    };
    const result = fromSearchRecord(record);
    expect(result.firstName).toBe('Maria');
    expect(result.lastName).toBe('De Luca');
    expect(result.name).toBe('Maria De Luca');
  });

  it('handles single-word name (goes into lastName)', () => {
    const record: PersonAccountSearchRecord = {
      Name: 'Madonna',
      EmailKey__c: 'madonna@example.com',
      Phone: null,
    };
    const result = fromSearchRecord(record);
    expect(result.firstName).toBe('');
    expect(result.lastName).toBe('Madonna');
  });

  it('handles null Name gracefully', () => {
    const record: PersonAccountSearchRecord = {
      Name: null,
      EmailKey__c: 'test@example.com',
      Phone: null,
    };
    const result = fromSearchRecord(record);
    expect(result.name).toBe('');
    expect(result.firstName).toBe('');
    expect(result.lastName).toBe('');
    expect(result.email).toBe('test@example.com');
  });

  it('handles null EmailKey__c gracefully', () => {
    const record: PersonAccountSearchRecord = {
      Name: 'Test User',
      EmailKey__c: null,
      Phone: '+391234567890',
    };
    const result = fromSearchRecord(record);
    expect(result.email).toBe('');
    expect(result.phone).toBe('+391234567890');
  });

  it('handles all null fields gracefully', () => {
    const record: PersonAccountSearchRecord = {
      Name: null,
      EmailKey__c: null,
      Phone: null,
    };
    const result = fromSearchRecord(record);
    expect(result).toEqual({
      name: '',
      firstName: '',
      lastName: '',
      email: '',
      phone: null,
    });
  });

  it('preserves phone as null when null in API response', () => {
    const record: PersonAccountSearchRecord = {
      Name: 'Mario Rossi',
      EmailKey__c: 'mario@example.com',
      Phone: null,
    };
    const result = fromSearchRecord(record);
    expect(result.phone).toBeNull();
  });

  it('trims extra whitespace in Name', () => {
    const record: PersonAccountSearchRecord = {
      Name: '  Mario   Rossi  ',
      EmailKey__c: 'mario@example.com',
      Phone: null,
    };
    const result = fromSearchRecord(record);
    expect(result.firstName).toBe('Mario');
    expect(result.lastName).toBe('Rossi');
  });
});

// ---------------------------------------------------------------------------
// Autocomplete search behavior — simulating different query scenarios
// ---------------------------------------------------------------------------
describe('search autocomplete scenarios', () => {
  const mockApiResults: PersonAccountSearchRecord[] = [
    { Name: 'Mario Rossi', EmailKey__c: 'mario.rossi@gmail.com', Phone: '+393331234567' },
    { Name: 'Maria Rossi', EmailKey__c: 'maria.rossi@gmail.com', Phone: '+393339876543' },
    { Name: 'Marco Bianchi', EmailKey__c: 'marco.bianchi@email.com', Phone: null },
    { Name: 'Giulia Ferrari', EmailKey__c: 'giulia.ferrari@email.com', Phone: '+393335551234' },
    { Name: 'Sofia De Angelis', EmailKey__c: 'sofia.deangelis@email.com', Phone: null },
  ];

  it('transforms multiple search results correctly', () => {
    const results = mockApiResults.map(fromSearchRecord);
    expect(results).toHaveLength(5);
    expect(results[0].email).toBe('mario.rossi@gmail.com');
    expect(results[4].lastName).toBe('De Angelis');
  });

  it('all results have required fields for display', () => {
    const results = mockApiResults.map(fromSearchRecord);
    for (const result of results) {
      expect(typeof result.name).toBe('string');
      expect(typeof result.email).toBe('string');
      // phone can be null
      expect(result.phone === null || typeof result.phone === 'string').toBe(true);
    }
  });

  it('handles empty API response (no matches)', () => {
    const results: PersonAccountSearchRecord[] = [];
    const transformed = results.map(fromSearchRecord);
    expect(transformed).toEqual([]);
  });

  it('single-result response transforms correctly', () => {
    const singleResult: PersonAccountSearchRecord[] = [
      { Name: 'Unico Cliente', EmailKey__c: 'unico@test.com', Phone: '+391111111111' },
    ];
    const transformed = singleResult.map(fromSearchRecord);
    expect(transformed).toHaveLength(1);
    expect(transformed[0].firstName).toBe('Unico');
    expect(transformed[0].lastName).toBe('Cliente');
  });

  it('results with only phone (no email) still usable for navigation', () => {
    const record: PersonAccountSearchRecord = {
      Name: 'Telefono Solo',
      EmailKey__c: null,
      Phone: '+399999999999',
    };
    const result = fromSearchRecord(record);
    // Email is empty string but phone is available
    expect(result.email).toBe('');
    expect(result.phone).toBe('+399999999999');
  });
});
