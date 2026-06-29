# Recovery backend (durable token store) — prepared, not wired

> Status: **scaffold only.** Default behaviour is unchanged — the recovery flow
> still runs entirely on the manager's browser IndexedDB (`VITE_RECOVERY_BACKEND`
> unset → `local`). Nothing in this directory is on the live path until that flag
> is flipped and credentials are provisioned. This doc is the design we are
> building toward.

## The problem this solves

A real recovery SMS opens `https://retail.monnalisa.com/recover/<token>` on the
**customer's phone**. That device has no access to the store manager's browser
IndexedDB, where staging records currently live. So cross-device links cannot
resolve today. We need a small, durable, server-reachable store keyed by token.

We leverage **Firebase** (the project already used for manager auth) — specifically
**Cloud Firestore**, accessed over its **REST API** to match this codebase's
SDK-free, `fetch`-only style (see `src/lib/firebase-auth.ts`).

## Two access paths (the security model)

Public visitors (customers) have only an opaque token — no Firebase session. So:

| Actor | Auth | How it reaches Firestore |
|---|---|---|
| **Store manager** (publish link, pull submissions) | Firebase **ID token** (existing login; carries the `store_id` claim) | Browser → Firestore REST directly, governed by `firestore.rules` scoped to the manager's store |
| **Customer** (resolve link, submit data) | none (opaque token only) | Browser → **Vercel function** (`api/recover/[token]`) → Firestore via a **service account** |

Consequence: **Firestore security rules deny all public access.** Every
unauthenticated read/write goes through a server function holding a service
account, so the rules only ever need to allow the authenticated manager, scoped
by `store_id`. The customer never touches Firestore directly and never receives
more than a minimised projection (below).

## Data model

One collection, one document per token: `recoveryLinks/{token}`.

```
recoveryLinks/{token} {
  token, storeId, importId,
  customerRef,                 // staging id `${storeId}:${customerNo}` (manager-side join key)
  status: 'active'|'submitted'|'expired',
  createdAt, expiresAt, sentAt?, sendCount?,

  record: {                    // minimal snapshot the public page needs (PII-minimised)
    firstName,
    needsEmail, needsPhone,    // booleans — which key field to ask for
    emailMasked?, phoneMasked?,// e.g. "m•••@gmail.com" / "+39 •••• 1231" for "is this still you?"
    locale, storeName?,
    children: [{ dayMonth }],  // day/month ONLY — the year is what we're collecting
  },

  submission?: {               // written by the customer via the Vercel function
    email?, phone?,
    consent?: { privacy, loyalty, marketing },
    children?: [{ dayMonth, year?, name?, gender? }],
    step1SubmittedAt?, completedAt?,
  }
}
```

**PII minimisation is the rule, not a nicety.** The legacy `source` row, sales
metrics, full email/phone, and customer id are NEVER published. The public
projection a customer receives is `record` (with masked hints) + `status` only —
see `toPublicProjection()` in `firestore-shapes.ts`, asserted by a unit test.

## Lifecycle

1. **Publish** (manager, on "Send SMS" for real cross-device): write
   `recoveryLinks/{token}` with `record` derived from the staging customer.
   `firestoreRecoveryStore.publish()`.
2. **Resolve** (customer): `GET /api/recover/:token` → function returns the public
   projection. The page renders the same two-step flow as today.
3. **Submit** (customer): `POST /api/recover/:token` → function writes `submission`
   and advances `status`.
4. **Pull** (manager, in the editor/review): read the doc, merge `submission` into
   the local staging record, then run the existing Approve & create pipeline.

## The seam in code

`src/lib/import/recovery-store.ts` defines a `RecoveryStore` interface and selects
an implementation from `VITE_RECOVERY_BACKEND`:

- `local` (default, **active**): wraps the existing IndexedDB helpers; `publish`
  and `pullSubmission` are no-ops / local reads because the page reads the same
  browser. Behaviour is exactly what ships today.
- `firestore` (**scaffold**): `recovery-backend/firestore-store.ts`. Implements the
  same interface against Firestore REST. Throws `RecoveryBackendNotEnabled` until
  `VITE_FIREBASE_PROJECT_ID` is set, so importing it changes nothing by itself.

Existing call sites are intentionally **not** refactored onto the seam yet — that
is the "wiring" step, deliberately deferred.

## What is left to wire (the TODO checklist)

- [ ] Provision a Firestore database in the existing Firebase project.
- [ ] Deploy `firestore.rules`.
- [ ] Create a service account with `datastore.user`; set `GOOGLE_SERVICE_ACCOUNT_JSON`
      and `FIREBASE_PROJECT_ID` on the Vercel project (server-only, no `VITE_`).
- [ ] Implement `getAccessToken()` in `api/recover/[token].ts` (sign a JWT with the
      SA key via WebCrypto, exchange for an OAuth2 access token). Marked TODO.
- [ ] Set `VITE_FIREBASE_PROJECT_ID` and `VITE_RECOVERY_BACKEND=firestore`.
- [ ] Refactor `ensureRecoveryLink` / `SmsComposer` / `CustomerRecovery` onto
      `getRecoveryStore()` and have `CustomerRecovery` fetch via `/api/recover/:token`
      when the token isn't found locally.

## Routing note

`vercel.json` previously rewrote **all** `/api/*` (except `proxy`/`health`) to the
BE proxy, which would have swallowed these functions. The exclusion list now also
covers `send-sms` and `recover` so their Vercel functions are reachable. Under
`vite dev`, `/api/*` is still proxied to the BE gateway, so these functions only
run on a real Vercel deployment (same as `api/proxy.ts`).
