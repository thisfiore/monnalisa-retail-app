import { describe, it, expect } from 'vitest';
import {
  formatPhoneE164,
  formatBirthdateForApi,
  mapGender,
  childrenToFigli,
  toCreateRequest,
  toUpdateRequest,
  fromGetResponse,
} from '../../lib/api-transforms.ts';
import type { Child, Customer } from '../../lib/types.ts';
import type { PersonAccountGetResponse } from '../../lib/api-types.ts';

// ---------------------------------------------------------------------------
// formatPhoneE164
// ---------------------------------------------------------------------------
describe('formatPhoneE164', () => {
  it('strips spaces from phone number', () => {
    expect(formatPhoneE164('+39 333 123 1231')).toBe('+393331231231');
  });

  it('keeps already-clean E.164 number as-is', () => {
    expect(formatPhoneE164('+393331231231')).toBe('+393331231231');
  });

  it('strips dashes and parentheses', () => {
    expect(formatPhoneE164('+1 (555) 123-4567')).toBe('+15551234567');
  });

  it('handles number without leading +', () => {
    expect(formatPhoneE164('393331231231')).toBe('393331231231');
  });
});

// ---------------------------------------------------------------------------
// formatBirthdateForApi
// ---------------------------------------------------------------------------
describe('formatBirthdateForApi', () => {
  it('appends T00:00:00.000Z to date-only string', () => {
    expect(formatBirthdateForApi('2000-12-25')).toBe('2000-12-25T00:00:00.000Z');
  });

  it('returns full ISO string as-is', () => {
    expect(formatBirthdateForApi('2000-12-25T00:00:00.000Z')).toBe(
      '2000-12-25T00:00:00.000Z',
    );
  });
});

// ---------------------------------------------------------------------------
// mapGender
// ---------------------------------------------------------------------------
describe('mapGender', () => {
  it('maps "male" to "Male"', () => {
    expect(mapGender('male')).toBe('Male');
  });

  it('maps "female" to "Female"', () => {
    expect(mapGender('female')).toBe('Female');
  });

  it('maps "Male" to "Male" (case-insensitive)', () => {
    expect(mapGender('Male')).toBe('Male');
  });

  it('returns null for "other"', () => {
    expect(mapGender('other')).toBeNull();
  });

  it('returns null for undefined', () => {
    expect(mapGender(undefined)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(mapGender('')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// childrenToFigli
// ---------------------------------------------------------------------------
describe('childrenToFigli', () => {
  it('converts array of children to figlio slots', () => {
    const children: (Child & { height?: string; shoeSize?: string })[] = [
      { name: 'Mario', birthDate: '2015-06-15', gender: 'male', height: '120', shoeSize: '30' },
      { name: 'Luisa', birthDate: '2018-09-20', gender: 'female', height: '110', shoeSize: '28' },
    ];

    const result = childrenToFigli(children);

    expect(result.figlio1).toEqual({
      nome__c: 'Mario',
      data_di_nascita__c: '2015-06-15',
      sesso__c: 'Male',
      altezza__c: '120',
      numero_calzature__c: '30',
    });
    expect(result.figlio2).toEqual({
      nome__c: 'Luisa',
      data_di_nascita__c: '2018-09-20',
      sesso__c: 'Female',
      altezza__c: '110',
      numero_calzature__c: '28',
    });
    expect(result.figlio3).toBeNull();
    expect(result.figlio4).toBeNull();
  });

  it('returns all null for empty array', () => {
    const result = childrenToFigli([]);
    expect(result.figlio1).toBeNull();
    expect(result.figlio2).toBeNull();
    expect(result.figlio3).toBeNull();
    expect(result.figlio4).toBeNull();
  });

  it('caps at 4 children even if more provided', () => {
    const children: (Child & { height?: string; shoeSize?: string })[] = [
      { name: 'A', birthDate: '2020-01-01', gender: 'male', height: '100', shoeSize: '26' },
      { name: 'B', birthDate: '2020-01-01', gender: 'female', height: '100', shoeSize: '26' },
      { name: 'C', birthDate: '2020-01-01', gender: 'male', height: '100', shoeSize: '26' },
      { name: 'D', birthDate: '2020-01-01', gender: 'female', height: '100', shoeSize: '26' },
      { name: 'E', birthDate: '2020-01-01', gender: 'male', height: '100', shoeSize: '26' },
    ];

    const result = childrenToFigli(children);
    expect(result.figlio1?.nome__c).toBe('A');
    expect(result.figlio4?.nome__c).toBe('D');
  });

  it('returns null for child with missing name', () => {
    const children: Child[] = [{ birthDate: '2020-01-01', gender: 'male' }];
    const result = childrenToFigli(children);
    expect(result.figlio1).toBeNull();
  });

  it('returns null for child with missing birthDate', () => {
    const children: Child[] = [{ name: 'Test', gender: 'male' }];
    const result = childrenToFigli(children);
    expect(result.figlio1).toBeNull();
  });

  it('defaults height and shoeSize to empty string when not provided', () => {
    const children: Child[] = [
      { name: 'Mario', birthDate: '2015-06-15', gender: 'male' },
    ];
    const result = childrenToFigli(children);
    expect(result.figlio1?.altezza__c).toBe('');
    expect(result.figlio1?.numero_calzature__c).toBe('');
  });
});

// ---------------------------------------------------------------------------
// toCreateRequest
// ---------------------------------------------------------------------------
describe('toCreateRequest', () => {
  it('maps a full customer to a create request', () => {
    const customer: Partial<Customer> = {
      firstName: 'Mario',
      lastName: 'Rossi',
      email: 'mario.rossi@example.com',
      phone: '+39 333 123 4567',
      dateOfBirth: '1990-05-15',
      marketingConsent: true,
      loyaltyEnrollment: true,
    };

    const req = toCreateRequest(customer);

    expect(req.FirstName).toBe('Mario');
    expect(req.LastName).toBe('Rossi');
    expect(req.PersonEmail).toBe('mario.rossi@example.com');
    expect(req.Phone).toBe('+393331234567');
    expect(req.PersonBirthdate).toBe('1990-05-15T00:00:00.000Z');
    expect(req.marketingConsent__c).toBe(true);
    expect(req.LoyaltyRequest__c).toBe(true);
    expect(req.Preferred_Locale__c).toBe('it_IT');
  });

  it('uses provided locale', () => {
    const req = toCreateRequest({ firstName: 'Test', lastName: 'User', email: 'test@test.com' }, 'fr_FR');
    expect(req.Preferred_Locale__c).toBe('fr_FR');
  });

  it('defaults consent fields to false when undefined', () => {
    const req = toCreateRequest({});
    expect(req.marketingConsent__c).toBe(false);
    expect(req.LoyaltyRequest__c).toBe(false);
  });

  it('omits PersonBirthdate when not provided', () => {
    const req = toCreateRequest({ firstName: 'Test' });
    expect(req.PersonBirthdate).toBeUndefined();
  });

  it('omits Gender__c when not provided', () => {
    const req = toCreateRequest({ firstName: 'Test' });
    expect(req.Gender__c).toBeUndefined();
  });

  it('maps gender when provided via extended type', () => {
    const customer = { firstName: 'Test', gender: 'female' } as Partial<Customer> & { gender?: string };
    const req = toCreateRequest(customer);
    expect(req.Gender__c).toBe('Female');
  });
});

// ---------------------------------------------------------------------------
// toUpdateRequest
// ---------------------------------------------------------------------------
describe('toUpdateRequest', () => {
  it('only includes fields that are explicitly set', () => {
    const req = toUpdateRequest({ firstName: 'Mario' });
    expect(req.FirstName).toBe('Mario');
    expect(req.LastName).toBeUndefined();
    expect(req.Phone).toBeUndefined();
  });

  it('formats phone in update request', () => {
    const req = toUpdateRequest({ phone: '+39 333 123 4567' });
    expect(req.Phone).toBe('+393331234567');
  });

  it('sets phone to null when empty string', () => {
    const req = toUpdateRequest({ phone: '' });
    expect(req.Phone).toBeNull();
  });

  it('includes children as figlio slots', () => {
    const children: (Child & { height?: string; shoeSize?: string })[] = [
      { name: 'Sofia', birthDate: '2018-07-22', gender: 'female', height: '110', shoeSize: '28' },
    ];
    const req = toUpdateRequest({ children } as Partial<Customer>);
    expect(req.figlio1?.nome__c).toBe('Sofia');
    expect(req.figlio2).toBeNull();
    expect(req.figlio3).toBeNull();
    expect(req.figlio4).toBeNull();
  });

  it('includes locale when provided', () => {
    const req = toUpdateRequest({}, 'en_US');
    expect(req.Preferred_Locale__c).toBe('en_US');
  });

  it('formats birthdate in update request', () => {
    const req = toUpdateRequest({ dateOfBirth: '1990-05-15' });
    expect(req.PersonBirthdate).toBe('1990-05-15T00:00:00.000Z');
  });

  it('sets birthdate to null when empty string', () => {
    const req = toUpdateRequest({ dateOfBirth: '' });
    expect(req.PersonBirthdate).toBeNull();
  });

  it('maps address fields to Shipping* API fields', () => {
    const req = toUpdateRequest({
      address: 'Via Lucini 19',
      city: 'Milano',
      postalCode: '20125',
      country: 'Italy',
    });
    expect(req.ShippingStreet).toBe('Via Lucini 19');
    expect(req.ShippingCity).toBe('Milano');
    expect(req.ShippingPostalCode).toBe('20125');
    expect(req.ShippingCountry).toBe('Italy');
  });

  it('sets Shipping fields to null when address fields are empty strings', () => {
    const req = toUpdateRequest({
      address: '',
      city: '',
      postalCode: '',
      country: '',
    });
    expect(req.ShippingStreet).toBeNull();
    expect(req.ShippingCity).toBeNull();
    expect(req.ShippingPostalCode).toBeNull();
    expect(req.ShippingCountry).toBeNull();
  });

  it('omits Shipping fields when address fields are not provided', () => {
    const req = toUpdateRequest({ firstName: 'Test' });
    expect(req).not.toHaveProperty('ShippingStreet');
    expect(req).not.toHaveProperty('ShippingCity');
    expect(req).not.toHaveProperty('ShippingPostalCode');
    expect(req).not.toHaveProperty('ShippingCountry');
  });
});

// ---------------------------------------------------------------------------
// fromGetResponse
// ---------------------------------------------------------------------------
describe('fromGetResponse', () => {
  it('maps a full backend response to partial Customer', () => {
    const response: PersonAccountGetResponse = {
      Id: '001MB00000OOMCtYAP',
      FirstName: 'Mario',
      LastName: 'Rossi',
      EmailKey__c: 'mario.rossi@example.com',
      Phone: '+393331234567',
      PersonBirthdate: '1990-05-15',
      Gender__c: 'Male',
      MarketingConsent__c: true,
      LoyaltyConsent__c: true,
      LoyaltyTier__c: 'Silver',
      TotalQualifyingPoints__c: 1250,
    };

    const customer = fromGetResponse(response);

    expect(customer.id).toBe('001MB00000OOMCtYAP');
    expect(customer.firstName).toBe('Mario');
    expect(customer.lastName).toBe('Rossi');
    expect(customer.email).toBe('mario.rossi@example.com');
    expect(customer.phone).toBe('+393331234567');
    expect(customer.dateOfBirth).toBe('1990-05-15');
    expect(customer.marketingConsent).toBe(true);
    expect(customer.loyaltyEnrollment).toBe(true);
    expect(customer.rank).toBe('Silver');
  });

  it('handles null/missing fields gracefully', () => {
    const response: PersonAccountGetResponse = {};

    const customer = fromGetResponse(response);

    expect(customer.id).toBe('');
    expect(customer.firstName).toBe('');
    expect(customer.lastName).toBe('');
    expect(customer.email).toBe('');
    expect(customer.phone).toBeUndefined();
    expect(customer.dateOfBirth).toBeUndefined();
    expect(customer.marketingConsent).toBe(false);
    expect(customer.loyaltyEnrollment).toBe(false);
    expect(customer.rank).toBeUndefined();
  });

  it('maps tier case-insensitively', () => {
    const response: PersonAccountGetResponse = { LoyaltyTier__c: 'gold' };
    expect(fromGetResponse(response).rank).toBe('Gold');
  });

  it('returns undefined rank for unknown tier', () => {
    const response: PersonAccountGetResponse = { LoyaltyTier__c: 'Diamond' };
    expect(fromGetResponse(response).rank).toBeUndefined();
  });
});
