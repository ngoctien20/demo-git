# TIEN404 V17.2C.17 — Replay-Resistant Private A/B Consent × Trusted Store Authority

Date: 2026-11-18 JST.
Parent: Draft PR #392, predecessor V17.2C.16 checkpoint `929bae9e810b9480aca25874c7e0e926610538cb`.
**No deployed consent service, no real JWT UAT and no Supabase schema change.**

## Verified baseline
- At V17.2C.16 checkpoint, GitHub source-only run [44170833699](https://github.com/ngoctien20/demo-git/actions/runs/44170833699) and ephemeral PostgreSQL RLS/rollback run [44170833707](https://github.com/ngoctien20/demo-git/actions/runs/44170833707) completed SUCCESS.
- Consent verifier remained a source-only Node library; Supabase independent A/B operator consent and live JWT binding remain unverified.

## Review finding
The original receipt contract verified Ed25519 signatures, distinct subjects and stores, but accepted any two distinct Store values as long as the signed payload matched. A malicious or misbound signer could use a different Store in the same synthetic Tenant. It also did not compare a signed receipt ID with a server-controlled revoked/used receipt registry, so it could not fail closed against previously consumed receipts.

## Implemented source-only changes
- `qa/v172c-rpc-closure/v172c16-private-ab-consent-admission.cjs`:
  - Signs `receiptId` as part of canonical JSON.
  - Validates exactly two distinct, 32-character lowercase hexadecimal receipt IDs.
  - Pins Store A/B to trusted `expectedStoreRefs`; issuer+subject IDs remain pinned to independent trusted refs.
  - Checks `reviewerRef` against trusted independent reviewer identity and forbids it equaling the issuer.
  - Requires distinct proof references and checks separate server-provided `revokedReceiptIds` and `usedReceiptIds` ledgers.
  - Denies missing trusted ledger, tampered Store, duplicate/revoked/used receipt, reviewer mismatch.
  - Continues to return `REVIEW_REQUIRED_NOT_JWT_GO` at best, never automatic GO.
- Expanded synthetic tests in `qa/v172c-rpc-closure/v172c16-private-ab-consent-admission.test.cjs` covering these scenarios. No private credentials or actual session identifiers committed.

## Critical limitations
- These trust settings and revoked/used arrays are **test inputs only**. A real protected server must enforce authorization, identity binding, reviewer independence, non-replay and revocation using an authenticated private authoritative database; it must not accept trust flags or signing keys from a request.
- Merely checking a receipt ID is not a single-use guarantee. The real system requires an atomic conditional consume operation (transaction or unique constraint) after independent approval to prevent concurrent replays.
- The signed receipt ID is no substitute for actual current Supabase Auth session verification or provider authority.
- CI verifies source-only behavior, not an operating consent service or real Supabase JWT signature.
- Supabase staging has actual Commerce rows and no disposable branch; do not create a migration there or repurpose the BIO project.

## Next real-world gate
1. Independently verify A/B via authenticated private sessions and obtain each person's explicit scoped consent.
2. Stand up a separately approved private consent service and database-backed atomic receipt registry (security/access/retention review first).
3. Authorize creation of disposable Supabase QA branch/project, cost, backup/restore before any execution.
4. Apply candidate Store schema and run signed real JWT A/B cross-Store negative UAT only on dedicated synthetic fixtures.

## Status
VERIFIED prior QA, IMPLEMENTED Draft source, TESTED new CI pending, PROPOSED private consent service, BLOCKED private two-actor evidence and disposable Supabase. No production, n8n, Zalo or customer data modified. Rollback via Draft PR revert.
