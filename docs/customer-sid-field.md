# `Customer_SID__c` — retail Cust SID sync to the CRM

**Status: implemented and tested.** The retail "Cust SID" flows all the way from the
imported spreadsheet to the Salesforce PersonAccount `Customer_SID__c` field on both
create and update, and is read back on fetch.

## Why it exists

The retail export cohort (`export-account-retail.pro.xlsx`) has **no email address**.
`Customer_SID__c` is the stable key that links those accounts back to the retail
source system — it is the only reliable join for the no-email cohort. Because it's a
join key, the rule everywhere is **never blank it**: we only write the field when we
actually have a value, and omit the key entirely otherwise (so an update never wipes
an existing SID).

## The chain (import → CRM)

| Stage | File | What happens |
|-------|------|--------------|
| 1. Parse spreadsheet | `src/lib/import/retail-parse.ts` | Header `Cust SID` → `custSid`; quotes stripped, trimmed, de-duped. Rows without a SID are dropped. |
| 2. Normalize | `src/lib/import/retail-normalize.ts`, `processed-parse.ts` | `custSid` carried onto the `StagingCustomer` (also used as the customer id / dedupe key). |
| 3. Build CRM payload | `src/lib/import/crm-create.ts` → `toCustomer()` | `customerSid: rec.custSid \|\| undefined` copied onto the partial `Customer`. |
| 4. Transform to API request | `src/lib/api-transforms.ts` → `toCreateRequest()` / `toUpdateRequest()` | `if (customer.customerSid) req.Customer_SID__c = customer.customerSid;` — stamped only when present, **never sent empty**. |
| 5. Send | `src/lib/api-client.ts` → `customerApi.createAccount` / `updateAccount` | Posts through the BFF proxy with the manager's Firebase token. |
| 6. Read back | `src/lib/api-transforms.ts` → `fromGetResponse()` | `customerSid: response.Customer_SID__c ?? undefined` mapped back onto the frontend `Customer`. |

Both the manual **"Approve & create"** button (`ImportCustomerEditor`) and the
automatic **recovery → CRM queue** drain (`crm-queue.ts`) go through step 3–5, so the
SID is stamped identically no matter which path creates the account.

## Types

- Frontend model — `src/lib/types.ts`: `Customer.customerSid?: string` (comment:
  *"Retail 'Cust SID' — CRM `Customer_SID__c`, links the no-email retail cohort."*)
- API wire types — `src/lib/api-types.ts`: `Customer_SID__c?: string | null` on the
  create, update, and get response shapes.
- CRM contract — `docs/monnalisa-mid-prd-api-cfg-v0-0-10.yaml`: `Customer_SID__c`
  (`type: string`, `nullable: true`) present on the create/update request schemas and
  in the default fetch field list.

## Guarantees (covered by tests)

`src/__tests__/unit/api-transforms.test.ts`:

- Stamps `Customer_SID__c` when a retail SID is present (create **and** update).
- **Omits** the key entirely when the SID is absent or an empty string — never blanked.
- `fromGetResponse` maps `Customer_SID__c` back to `customerSid` (undefined when absent).

`src/__tests__/unit/import-pipeline.test.ts` verifies the SID survives parse/normalize,
including large signed-integer SIDs kept as text (e.g. `-5044576419462049796`).

## Notes / gotchas

- The SID is a **signed integer stored as text** — it can be negative and can exceed
  `Number.MAX_SAFE_INTEGER`, so it is always handled as a string. Never coerce to a
  number.
- Non-retail imports have no `custSid`, so `Customer_SID__c` is simply never sent for
  them — that's expected, not a bug.
