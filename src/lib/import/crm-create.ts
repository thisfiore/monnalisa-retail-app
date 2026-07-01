/**
 * Shared "create (or update) a Salesforce PersonAccount from a staging record"
 * path — the exact payload the in-store "New Customer" form sends, reused by
 * both the manual "Approve & create" button (ImportCustomerEditor) and the
 * automatic recovery→CRM queue drain (crm-queue.ts).
 *
 * NOTE: there is no Firebase customer record — Firebase is operator-auth only;
 * customers exist solely as Salesforce PersonAccounts (matches the UI flow).
 */
import { customerApi, ApiError } from '../api-client';
import { toCreateRequest, toUpdateRequest, formatPhoneE164 } from '../api-transforms';
import { EMAIL_REGEX, E164_REGEX } from './recovery';
import type { StagingCustomer } from './types';
import type { Customer, Child } from '../types';

export type CrmOp = 'create' | 'update';
export type CrmResult = { accountId?: string; op: CrmOp };

/** Raised when a staging record can't be pushed to the CRM (missing/invalid contact). */
export class CrmValidationError extends Error {}

/** Build the same partial Customer the UI create form sends. */
function toCustomer(rec: StagingCustomer): Partial<Customer> & { gender?: string } {
  const phone = rec.normalized.phone ? formatPhoneE164(rec.normalized.phone) : '';
  return {
    firstName: rec.normalized.firstName,
    lastName: rec.normalized.lastName,
    email: rec.normalized.email,
    phone,
    marketingConsent: rec.consent?.marketing ?? false,
    loyaltyEnrollment: rec.consent?.loyalty ?? true,
    children: rec.normalized.children
      .filter((c) => c.name && c.year && c.gender && c.height !== undefined && c.shoeSize !== undefined)
      .map<Child>((c) => ({
        name: c.name!,
        birthDate: `${c.year}-${c.dayMonth.split('/').reverse().join('-')}`, // DD/MM + year → YYYY-MM-DD
        gender: c.gender === 'Female' ? 'female' : 'male',
        height: c.height,
        shoeSize: c.shoeSize,
      })),
  };
}

/** True when a create error means "this contact already exists in the CRM". */
function isDuplicateError(e: unknown): boolean {
  if (!(e instanceof ApiError)) return false;
  return e.status === 409 || /exist|duplicate|already/i.test(e.message);
}

/**
 * Create the CRM account for a recovered/staging customer — or update it when
 * it already exists (record flagged as already-in-CRM, or the create hits a
 * duplicate). Validates email + E.164 phone the same way the manual button does.
 */
export async function createOrUpdateCrmAccount(
  rec: StagingCustomer,
  token: string,
  storeId: string,
): Promise<CrmResult> {
  if (!EMAIL_REGEX.test(rec.normalized.email)) {
    throw new CrmValidationError('Email is required and must be valid.');
  }
  const phone = rec.normalized.phone ? formatPhoneE164(rec.normalized.phone) : '';
  if (!E164_REGEX.test(phone)) {
    throw new CrmValidationError('Phone must be in E.164 format (e.g. +39…).');
  }

  const customer = toCustomer(rec);
  const locale = rec.normalized.locale || 'it_IT';
  const alreadyInCrm = !!rec.createdAccountId || rec.flags?.alreadyInCrm === true;

  async function update(): Promise<CrmResult> {
    const req = toUpdateRequest(customer, locale);
    const res = await customerApi.updateAccount(customer.email!, req, token);
    return { accountId: res.id ?? rec.createdAccountId, op: 'update' };
  }

  if (alreadyInCrm) {
    return update();
  }

  try {
    const req = toCreateRequest(customer, locale);
    req.store_id = storeId;
    const res = await customerApi.createAccount(req, token);
    return { accountId: res.id, op: 'create' };
  } catch (e) {
    // A duplicate means the customer already exists — update instead of failing.
    if (isDuplicateError(e)) return update();
    throw e;
  }
}
