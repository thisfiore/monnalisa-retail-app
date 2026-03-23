/**
 * TypeScript types matching the Monnalisa Loyalty BFF OpenAPI v0.0.6 spec.
 * These represent the exact JSON shapes sent to / received from the backend.
 */

export type Gender = 'Male' | 'Female';

export type ChildInfo = {
  nome__c: string;
  data_di_nascita__c: string; // YYYY-MM-DD
  sesso__c: Gender;
  altezza__c: number; // height in cm
  numero_calzature__c: number; // shoe size
};

// POST /customers/createAccount
export type PersonAccountCreateRequest = {
  FirstName: string;
  LastName: string;
  PersonEmail: string;
  Phone: string; // E.164: ^\+[1-9]\d{1,14}$
  PersonBirthdate?: string | null; // YYYY-MM-DDTHH:MM:SS.sssZ
  marketingConsent__c: boolean; // lowercase m!
  LoyaltyRequest__c: boolean;
  Preferred_Locale__c: string; // e.g. "it_IT"
  Gender__c?: Gender | null;
  figlio1?: ChildInfo | null;
  figlio2?: ChildInfo | null;
  figlio3?: ChildInfo | null;
  figlio4?: ChildInfo | null;
};

// PATCH /customers/updateAccount?email=
export type PersonAccountUpdateRequest = {
  FirstName?: string | null;
  LastName?: string | null;
  Phone?: string | null; // E.164
  PersonBirthdate?: string | null; // YYYY-MM-DDTHH:MM:SS.sssZ
  marketingConsent__c?: boolean | null;
  LoyaltyRequest__c?: boolean | null;
  Preferred_Locale__c?: string | null;
  Gender__c?: Gender | null;
  figlio1?: ChildInfo | null;
  figlio2?: ChildInfo | null;
  figlio3?: ChildInfo | null;
  figlio4?: ChildInfo | null;
  ShippingStreet?: string | null;
  ShippingPostalCode?: string | null;
  ShippingCity?: string | null;
  ShippingState?: string | null;
  ShippingCountry?: string | null;
  Region__c?: string | null;
  Country_id__c?: string | null;
};

// GET /customers/getAccount?email=
export type PersonAccountGetResponse = {
  Id?: string | null;
  FirstName?: string | null;
  LastName?: string | null;
  EmailKey__c?: string | null;
  Customer_no__c?: string | null;
  Customer_id__c?: string | null;
  Type__c?: string | null;
  RetailProcustomerId__c?: string | null;
  Phone?: string | null;
  PersonBirthdate?: string | null; // YYYY-MM-DD (receive format)
  Gender__c?: Gender | null;
  MarketingConsent__c?: boolean | null; // uppercase M in response!
  LoyaltyConsent__c?: boolean | null;
  LoyaltyConsentDate__c?: string | null;
  LoyaltyTier__c?: string | null;
  TotalQualifyingPoints__c?: number | null;
  LoyaltyDoubleOptIn__c?: boolean | null;
  figlio1?: ChildInfo | null;
  figlio2?: ChildInfo | null;
  figlio3?: ChildInfo | null;
  figlio4?: ChildInfo | null;
  ShippingStreet?: string | null;
  ShippingPostalCode?: string | null;
  ShippingCity?: string | null;
  ShippingState?: string | null;
  ShippingCountry?: string | null;
  Region__c?: string | null;
  Country_id__c?: string | null;
};

// GET /customers/checkEmailExists?email=  &  GET /customers/checkPhoneExists?phone=
export type PersonAccountExistsResponse = {
  exists: boolean;
};

// POST createAccount / PATCH updateAccount response
export type PersonAccountPatchResponse = {
  id: string;
  success: boolean;
  errors: unknown[];
};

export type LoyaltyPointLedgerEntry = {
  AppliedRules__c?: string | null;
  Points__c?: number | null;
  OperationDate__c?: string | null;
  Status__c?: string | null;
  TransactionNumber__c?: string | null;
};

// GET /customers/getLoyaltyLedger?email=
export type LoyaltyPointLedgerResponse = {
  totalSize: number;
  records: LoyaltyPointLedgerEntry[];
};

export type SalesforceErrorResponse = {
  status?: string;
  message: string;
};

export type ValidationErrorDetail = {
  loc: (string | number)[];
  msg: string;
  type: string;
};

export type HTTPValidationError = {
  detail: ValidationErrorDetail[];
};

// GET /customers/search?q=&limit=
export type PersonAccountSearchRecord = {
  Name: string | null;
  EmailKey__c: string | null;
  Phone: string | null;
};
