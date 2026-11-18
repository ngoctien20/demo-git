# TIEN404 AI — V17.2C.40G Atomic Owner Consent × Idempotency × Revocation Race QA

**Date:** 2026-11-18 JST  
**Parent:** V17.2C.40F  
**Draft PR:** #392  
**Tested SQL/test commit:** 1c2a4897175bca195fae1f755d8ca019ee4fbc50  
**Status:** EPHEMERAL POSTGRESQL QA PASS / SYNTHETIC ONLY / REAL OWNER AUTHORITY NO-GO.

## 1. Purpose and audit of prior work

V17.2C.18 already tested a single atomic receipt consume with a one-winner concurrent update. V17.2C.19 already tested two-receipt all-or-nothing pair consumption and replay. V17.2C.21/V24 remain dependency-injected and HTTPS route candidates, not hosted services.

V40G adds the missing transaction-level model for **challenge consumption + consent-event persistence**, and tests both possible orderings of a membership-revocation race. It also checks that an idempotent retry does not bypass current session, membership or revocation checks.

## 2. IMPLEMENTED — ephemeral-only SQL candidate

File: `qa/v172c-rpc-closure/v172c40g-private-owner-consent-revocation-NOT_EXECUTED.sql`.

Creates a separate synthetic schema `tien404_v172c40g_qa` only inside the disposable PostgreSQL 17 CI container:
- `owner_sessions`: synthetic active session and expiry/revocation state.
- `owner_memberships`: synthetic per-Tenant/per-Store owner/manager membership.
- `owner_challenges`: SHA-256-shaped challenge digest, session/actor/Tenant/Store/decision/version/operation binding, short expiry and single-use state.
- `owner_consent_events`: append-only accept/decline event, unique challenge and idempotency key.
- `owner_revocation_events`: append-only membership/consent revocation ledger.

The candidate function `consume_owner_consent`:
1. Serializes duplicate idempotency keys.
2. Returns an existing event only for an identical retry, after rechecking current session, membership and consent revocation.
3. Locks in a consistent order: session → challenge → membership.
4. Validates active session, current owner membership, exact challenge binding, operation and expiry.
5. Consumes the challenge and appends the consent event in the same database transaction.
6. Returns only `CONSENT_RECORDED_NOT_AUTHORITY_GRANTED`; it never grants Store authority or real Auth UAT.

The current admission check `check_current_consent` revalidates session, actor, Tenant, Store, membership, challenge lineage and revocation. Its maximum positive result is `REVIEW_REQUIRED_NOT_AUTHORITY_GO`.

Other controls:
- SECURITY INVOKER functions with `search_path=''`.
- No EXECUTE or schema/table privileges for `anon` or `authenticated`.
- Append-only consent and revocation events.
- Membership revocation records an event and deactivates the membership in the same transaction.
- Consent withdrawal appends a revocation event; it does not edit the original consent receipt.

**Important:** this SQL file is explicitly NOT EXECUTED on Supabase. It uses synthetic identifiers and proves transaction mechanics only. Cryptographic signatures and real Supabase Auth/session verification remain upstream private-service responsibilities.

## 3. TESTED — both revocation race orderings

File: `qa/v172c-rpc-closure/v172c40g-owner-consent-revocation-ci-drill.sh`.

| Test | Expected result | Observed |
|---|---|---|
| First valid synthetic consent | Record event, no authority | PASS |
| Same idempotency key + same payload | Return same event, no duplicate | PASS |
| Same key + different challenge | DENY conflict | PASS |
| Reuse consumed challenge with new key | DENY replay | PASS |
| Expired challenge / inactive session | DENY | PASS |
| Wrong session binding / manager role | DENY | PASS |
| Revocation locks membership first | Consent waits, then DENY; challenge stays issued; no event | PASS |
| Consent locks membership first | Consent event commits; revocation waits; current admission then DENY | PASS |
| Retry after membership revocation | DENY; no stale idempotent success | PASS |
| Retry after consent withdrawal | DENY | PASS |
| Retry after session revocation | DENY | PASS |
| Session/Store or challenge decision lineage mismatch | DENY current admission | PASS |
| Update/delete consent or revocation history | DENY append-only mutation | PASS |
| anon/authenticated schema/function access | DENY | PASS |
| SECURITY INVOKER check | PASS | PASS |

The key race result is deliberate:
- If revocation commits first, the consent transaction cannot record a consent event.
- If consent commits first, a later revocation does not rewrite history; the subsequent current-admission check denies. Consent is never treated as a Store grant.

## 4. CI evidence and corrections

At tested code commit `1c2a4897175bca195fae1f755d8ca019ee4fbc50`:
- PostgreSQL 17 run [#44266588800](https://github.com/ngoctien20/demo-git/actions/runs/44266588800) completed SUCCESS. Log contains: `PASS: atomic challenge+consent, idempotent retry, replay/expiry/session/role DENY, both revocation race orderings DENY current admission, append-only audit, no API-role execution.`
- All 3 PR checks SUCCESS: [no-send source contract](https://github.com/ngoctien20/demo-git/actions/runs/44266588812/job/134672529031), [protected consent source contract](https://github.com/ngoctien20/demo-git/actions/runs/44266588892/job/134672528980), [PostgreSQL 17 + V40G](https://github.com/ngoctien20/demo-git/actions/runs/44266588800/job/134672528692).
- Two initial QA defects were corrected before the passing run: non-hex fixture labels were replaced with valid lowercase hex digests; the PL/pgSQL `event_id` RETURNING reference was qualified to avoid output-variable ambiguity. The expired fixture interval was also kept strictly within the ten-minute constraint.
- Existing V40D 41/41, V40E 22/22 and V40F 18/18 regression suites passed in the same PostgreSQL job.

## 5. Security boundary and limitations

- The synthetic SQL is not an actual owner consent service. The test does not validate JWT signatures, Auth issuer/audience, real `auth.sessions`, human intent or digital signatures.
- The SQL caller must be a protected private server; never expose these functions as public RPC or use client-supplied Tenant/Store/actor authority.
- A successful consent record remains review-only. A separate owner decision, independent reviewer, canonical Store authority and release approval are still required.
- The model does not create a hosted service, private Supabase branch, schema migration, RLS policy, grant, credential, HTTPS endpoint or provider send.
- Current S3 selection remains locked. No Store refs, owner consents or alias mappings were added to the S3 record.

## 6. Status and rollback

- **VERIFIED:** Existing V18/V19 atomic-consent coverage and V21/V24 source-only limitations reviewed.
- **IMPLEMENTED:** V40G ephemeral SQL candidate and CI race drill.
- **TESTED:** V40G PostgreSQL drill PASS; 3/3 PR checks SUCCESS.
- **PROPOSED:** Production-grade private adapter with real Auth/session verification and transaction binding; not deployed.
- **BLOCKED:** Real owner evidence, S1/S2 decision, hosted private service, current Auth session adapter and independent reviewer.
- **NO-GO:** Supabase DDL/RLS/branch creation, Store grants, Order reads/writes, n8n Published changes, provider dispatch and production.
- **Rollback:** Revert V40G SQL/shell/workflow commits from Draft PR #392. CI PostgreSQL container self-destructs. No hosted rollback is required.

## 7. Next checkpoint

**V17.2C.40H — Protected Consent Adapter V2 × Single Atomic Service Boundary × S3 Transition No-Authority Integration Tests.**

The next source-only candidate should replace the split adapter contract (`verifyConsentChallenge` then `recordExplicitConsent`) with one trusted atomic `consumeAndRecordConsent` boundary, while preserving the V21/V24 candidates untouched. It must return only a consent-recorded/review-required state, keep all routes disabled, and reject any request that tries to turn consent into Store membership or Commerce writer authority.
