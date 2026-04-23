import type { Child, Customer } from './types.ts';
import type {
  ChildInfo,
  Gender,
  PersonAccountCreateRequest,
  PersonAccountGetResponse,
  PersonAccountSearchRecord,
  PersonAccountUpdateRequest,
} from './api-types.ts';

const COUNTRY_TO_LOCALE: Record<string, string> = {
  Italy: 'it_IT',
  France: 'fr_FR',
  Germany: 'de_DE',
  Spain: 'es_ES',
  Switzerland: 'it_CH',
  'United Kingdom': 'en_GB',
  'United States': 'en_US',
  China: 'zh_CN',
  Japan: 'ja_JP',
};

/** Map the customer's country (as selected in the form) to a BFF locale code. */
export function localeFromCountry(country: string | undefined): string {
  if (!country) return 'it_IT';
  return COUNTRY_TO_LOCALE[country] ?? 'it_IT';
}

/**
 * Strip all whitespace and non-digit characters except leading '+'.
 * Input:  "+39 333 123 1231"  →  "+393331231231"
 */
export function formatPhoneE164(phone: string): string {
  const plus = phone.startsWith('+') ? '+' : '';
  const digits = phone.replace(/\D/g, '');
  return plus + digits;
}

/**
 * Convert a YYYY-MM-DD date to the ISO format the backend expects on writes:
 * "2000-12-25" → "2000-12-25T00:00:00.000Z"
 *
 * If already in full ISO format, return as-is.
 */
export function formatBirthdateForApi(date: string): string {
  if (date.includes('T')) return date;
  return `${date}T00:00:00.000Z`;
}

/**
 * Map frontend gender strings to the backend Gender enum.
 * "male" → "Male", "female" → "Female", anything else → null
 */
export function mapGender(gender: string | undefined): Gender | null {
  if (!gender) return null;
  const lower = gender.toLowerCase();
  if (lower === 'male') return 'Male';
  if (lower === 'female') return 'Female';
  return null;
}

/**
 * Convert a frontend Child array (max 4) into the fixed figlio1–figlio4 slots.
 */
export function childrenToFigli(children: Child[]): {
  figlio1: ChildInfo | null;
  figlio2: ChildInfo | null;
  figlio3: ChildInfo | null;
  figlio4: ChildInfo | null;
} {
  const slots = children.slice(0, 4);

  function toChildInfo(child: Child | undefined): ChildInfo | null {
    if (!child || !child.name || !child.birthDate) return null;
    return {
      nome__c: child.name,
      data_di_nascita__c: child.birthDate, // YYYY-MM-DD, no transform needed
      sesso__c: mapGender(child.gender) ?? 'Male',
      altezza__c: child.height ?? 0,
      numero_calzature__c: child.shoeSize ?? 0,
    };
  }

  return {
    figlio1: toChildInfo(slots[0]),
    figlio2: toChildInfo(slots[1]),
    figlio3: toChildInfo(slots[2]),
    figlio4: toChildInfo(slots[3]),
  };
}


/**
 * Build a PersonAccountCreateRequest from a partial Customer.
 */
export function toCreateRequest(
  customer: Partial<Customer>,
  locale = 'it_IT',
): PersonAccountCreateRequest {
  const req: PersonAccountCreateRequest = {
    FirstName: customer.firstName ?? '',
    LastName: customer.lastName ?? '',
    PersonEmail: customer.email ?? '',
    Phone: customer.phone ? formatPhoneE164(customer.phone) : '',
    marketingConsent__c: customer.marketingConsent ?? false,
    LoyaltyRequest__c: customer.loyaltyEnrollment ?? false,
    Preferred_Locale__c: locale,
  };

  if (customer.dateOfBirth) {
    req.PersonBirthdate = formatBirthdateForApi(customer.dateOfBirth);
  }

  const gender = mapGender((customer as CustomerWithExtras).gender);
  if (gender) {
    req.Gender__c = gender;
  }

  if (customer.children && customer.children.length > 0) {
    const figli = childrenToFigli(customer.children);
    req.figlio1 = figli.figlio1;
    req.figlio2 = figli.figlio2;
    req.figlio3 = figli.figlio3;
    req.figlio4 = figli.figlio4;
  }

  return req;
}

/** Extended Customer that may carry a gender field (not in current frontend type) */
type CustomerWithExtras = Customer & {
  gender?: string;
};

/**
 * Build a PersonAccountUpdateRequest from a partial Customer.
 */
export function toUpdateRequest(
  customer: Partial<Customer>,
  locale?: string,
): PersonAccountUpdateRequest {
  const req: PersonAccountUpdateRequest = {};

  if (customer.firstName !== undefined) req.FirstName = customer.firstName;
  if (customer.lastName !== undefined) req.LastName = customer.lastName;
  if (customer.phone !== undefined) {
    req.Phone = customer.phone ? formatPhoneE164(customer.phone) : null;
  }
  if (customer.dateOfBirth !== undefined) {
    req.PersonBirthdate = customer.dateOfBirth
      ? formatBirthdateForApi(customer.dateOfBirth)
      : null;
  }
  if (customer.marketingConsent !== undefined) {
    req.marketingConsent__c = customer.marketingConsent;
  }
  if (customer.loyaltyEnrollment !== undefined) {
    req.LoyaltyRequest__c = customer.loyaltyEnrollment;
  }
  if (locale !== undefined) {
    req.Preferred_Locale__c = locale;
  }

  const gender = mapGender((customer as CustomerWithExtras).gender);
  if ((customer as CustomerWithExtras).gender !== undefined) {
    req.Gender__c = gender;
  }

  if (customer.children) {
    const figli = childrenToFigli(customer.children);
    req.figlio1 = figli.figlio1;
    req.figlio2 = figli.figlio2;
    req.figlio3 = figli.figlio3;
    req.figlio4 = figli.figlio4;
  }

  if (customer.address !== undefined) req.ShippingStreet = customer.address || null;
  if (customer.city !== undefined) req.ShippingCity = customer.city || null;
  if (customer.postalCode !== undefined) req.ShippingPostalCode = customer.postalCode || null;
  if (customer.country !== undefined) req.ShippingCountry = customer.country || null;

  return req;
}

/**
 * Map a PersonAccountGetResponse to a partial Customer for the frontend.
 */
export function fromGetResponse(
  response: PersonAccountGetResponse,
): Partial<Customer> {
  const children: Child[] = [];
  for (const figlio of [response.figlio1, response.figlio2, response.figlio3, response.figlio4]) {
    if (figlio) {
      children.push({
        name: figlio.nome__c,
        birthDate: figlio.data_di_nascita__c,
        gender: figlio.sesso__c === 'Male' ? 'male' : figlio.sesso__c === 'Female' ? 'female' : undefined,
        height: figlio.altezza__c || undefined,
        shoeSize: figlio.numero_calzature__c || undefined,
      });
    }
  }

  return {
    id: response.Id ?? '',
    firstName: response.FirstName ?? '',
    lastName: response.LastName ?? '',
    email: response.EmailKey__c ?? '',
    phone: response.Phone ?? undefined,
    dateOfBirth: response.PersonBirthdate ?? undefined,
    address: response.ShippingStreet ?? undefined,
    city: response.ShippingCity ?? undefined,
    postalCode: response.ShippingPostalCode ?? undefined,
    country: response.ShippingCountry ?? undefined,
    children: children.length > 0 ? children : undefined,
    marketingConsent: response.MarketingConsent__c ?? false,
    loyaltyEnrollment: response.LoyaltyConsent__c ?? false,
    loyaltyDoubleOptIn: response.LoyaltyDoubleOptIn__c ?? false,
    rank: mapTierToRank(response.LoyaltyTier__c),
  };
}

const TIER_TO_RANK: Record<string, 'Family' | 'Flower' | 'Fairytale' | 'Fashion'> = {
  bronze: 'Family',
  silver: 'Flower',
  gold: 'Fairytale',
  platinum: 'Fashion',
  family: 'Family',
  flower: 'Flower',
  fairytale: 'Fairytale',
  fashion: 'Fashion',
};

function mapTierToRank(
  tier: string | null | undefined,
): 'Family' | 'Flower' | 'Fairytale' | 'Fashion' | undefined {
  if (!tier) return undefined;
  return TIER_TO_RANK[tier.toLowerCase()];
}

/**
 * Split a Salesforce "Name" field (e.g. "Mario Rossi") into first/last.
 * If there's only one token, it goes into lastName (Salesforce convention).
 */
function splitName(name: string | null | undefined): {
  firstName: string;
  lastName: string;
} {
  if (!name) return { firstName: '', lastName: '' };
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: '', lastName: parts[0] };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

export type SearchResult = {
  name: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
};

/**
 * Map a PersonAccountSearchRecord from the API to a frontend SearchResult.
 */
export function fromSearchRecord(
  record: PersonAccountSearchRecord,
): SearchResult {
  const { firstName, lastName } = splitName(record.Name);
  return {
    name: record.Name ?? '',
    firstName,
    lastName,
    email: record.EmailKey__c ?? '',
    phone: record.Phone ?? null,
  };
}
