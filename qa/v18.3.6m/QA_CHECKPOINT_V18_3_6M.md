# TIEN404 AI — V18.3.6M Final QA Checkpoint

**Checkpoint:** `V18.3.6M-PG17-AUTH-DELETE-44504954874`  
**Date:** 2026-11-19 JST  
**Status:** `DISPOSABLE POSTGRESQL17 QA TESTED / REAL AUTH DELETE BEHAVIOR BLOCKED / PRODUCTION NO-GO`

## Parent and PR
- Parent V18.3.6L Draft PR #444, HEAD `d7e8080ee699b38d9952f96358fbc0a57e3b28a0`, GitHub Actions #44501805804 SUCCESS (245/245).
- V18.3.6M Draft PR [#449](https://github.com/ngoctien20/demo-git/pull/449); branch `qa/v1836m-pg17-session-delete-grants-crypto-20261119`; base V18.3.6L branch. OPEN DRAFT / UNMERGED.

## PostgreSQL 17.12 and CI evidence

**Last successful pre-checkpoint run:** [GitHub Actions #44504954874](https://github.com/ngoctien20/demo-git/actions/runs/44504954874), jobs:
- `offline-crypto-grant` ID `135494021223`: SUCCESS.
- `disposable-postgres17` ID `135494020743`: SUCCESS.
- G/H/I/K/L Node inherited QA: **245/245 PASS**.
- M crypto and privileged SQL metadata negative QA: **29/29 PASS**.
- Actual PostgreSQL 17.12 pgTAP: **53/53 PASS**.
- **327/327 numbered assertions PASS**.
- **4 additional PostgreSQL two-connection integration cases PASS:**
  1. DELETE-first holds row lock; read waits and returns `DENY_SESSION`; rejected JTI not consumed.
  2. READ-first holds row lock through the transaction; DELETE waits; first read `ALLOW_CATALOG`, subsequent read `DENY_SESSION`.
  3. Two simultaneous reads of one signed synthetic JTI: exactly one `ALLOW_CATALOG`, one `REPLAY`; persisted JTI count 1.
  4. Session row lock contention plus `lock_timeout`: database query errors (no success response), JTI not burned.
- Final log markers:
  - `V18_3_6M_PREDECESSOR_245_PASS`
  - `V18_3_6M_CRYPTO_GRANT_29_PASS`
  - `V18_3_6M_SOURCE_SCOPE_AUDIT_PASS`
  - `V18_3_6M_PGTAP_53_PASS`
  - `V18_3_6M_DELETE_FIRST_DENY_PASS`
  - `V18_3_6M_READ_FIRST_DELETE_SECOND_PASS`
  - `V18_3_6M_IDENTICAL_JTI_ATOMIC_PASS`
  - `V18_3_6M_LOCK_TIMEOUT_FAIL_CLOSED_PASS`
- No failed Node assertion, pgTAP `not ok`, or SQL ERROR in successful job logs. Docker PostgreSQL 17.12 container `--network none` / no exposed port destroyed after run.

### Failures recovered transparently

Initial run #44504692314: Node offline regression PASS, PG17 51/52 pgTAP PASS. One overly strict string test expected `search_path=` rather than allowing PostgreSQL's equivalent empty quoting; also one intended version assertion was mistakenly omitted in test-file generation. Fixed only test SQL: added G01 and normalized comparison to verify pinned **empty** `search_path`. Successful run #44504954874 has all **53/53 PASS** and 4/4 races.

## Technical deliverables

- `01_DISPOSABLE_AUTH_DELETE_LOCK.sql`: synthetic `qa_m_auth.sessions`, scoped Store A/B in same synthetic Tenant, other Tenant C, fake catalog and unique one-use nonce. Private SECURITY DEFINER read-only function obtains locks in consistent order session→membership→catalog→nonce. Does **not** verify Ed25519, JWT or real user identities.
- `02_DISPOSABLE_PGTAP_AUTH_RLS.sql`: 53 real PG17 tests including no direct table grants to gateway, private schema isolation, RLS enabled, Store A/B mutual denial, missing/expired/deleted sessions, stale membership, wrong role/audience, nonce replay and SHA256 HMAC vector.
- `crypto-privilege-compatibility.mjs` + `test-crypto-grant-compatibility.mjs`: 29 negative tests for ephemeral Node Ed25519 proof/forgery, PostgreSQL HMAC parity, absence of approved DB Ed25519 verification, SQL grant metadata risk; never authorizes production.
- `LIVE_STAGING_PRIVILEGE_METADATA_AUDIT.md`: aggregate metadata risk inventory only.
- `AUTH_DELETE_LOCK_RACE_MATRIX.md`: ordering, missing sessions, timeout and limitations.
- `CRYPTO_VERIFIER_COMPATIBILITY.md`: current extension observations and blocked production verifier choices.
- Dedicated GitHub Actions `tien404-v1836m-pg17-auth-delete.yml`.

## Connected staging — VERIFIED READ-ONLY METADATA, NOT MUTATED

Supabase project `ifxlvrhyjhbzbrkdsida`, PostgreSQL 17.11:
- Public functions **8**; public SECURITY DEFINER functions **4**.
- Effective EXECUTE of public SECURITY DEFINER: `anon` **1**, `authenticated` **2**, `service_role` **1**. These counts may overlap; function bodies and Data API settings were **not** examined. **This is an actionable review finding, not a proven exploit. No grant changed.**
- Extensions: `pgcrypto` installed; `pgsodium` and `pgjwt` available but not installed; no Ed25519-named verifier found in scoped `public`/`extensions` metadata query. SQL Ed25519 support remains **unverified**.
- `auth.sessions` table exists but **zero rows / identifiers / Auth tokens accessed**.
- `public.stores` and `public.store_memberships`: **0**; Store `store_id` columns across 6 Commerce tables: **0**; restrictive public Store RLS policies **0**.
- Product row aggregate: **2**; order row aggregate **2**; no row-level data.
- No migration, DDL, DML or permission/credential modification.

n8n Published metadata rechecked unchanged:
- Messenger `Z7FdV7uDvApfbURQ`: `1064b1b3-d3f1-4a6b-a367-2414ba691522`.
- Zalo Bot `yIJk8LvJoLF40Z62`: `2d912cb0-007f-452f-9536-b92ba12a03e6`.
- Commerce Core `iyfGUiEsZlNTBWOR`: Published `456862c9-e5ee-4bfa-9931-47dbc39ab73d`, separate Draft `c96422e0-170b-46a3-8d75-3a2695e645e7`.
- No n8n execution, alteration or provider send.

## Remaining P0 / human review blockers

1. **Real Supabase Auth signout and PostgreSQL DELETE semantics:** synthetic `qa_m_auth.sessions` DELETE-lock race is real PG behavior but **NOT a real Auth API sign-out test**. Other Auth expiry/disable/reset/cleanup paths unverified. Real private access to `auth.sessions` and function body must be independently admitted.
2. **Privileged SQL review:** public SECDEF effective grants signal exposure potential. Inspect actual bodies/owners/exposed schemas *privately with authorization*; do not revoke grants blindly. SQL function parameters in disposable demo are forgeable because it does not perform signature validation.
3. **Crypto key custody:** Node Ed25519 verified offline, pgcrypto HMAC verified in PG. No supported managed DB Ed25519 verifier confirmed; no KMS key created, rotated or reviewed. K's synthetic HMAC key is forbidden in production.
4. **Canonical Store authority:** missing real Store tables/columns/policies, real same-Tenant Owner A/B and consent proof.
5. **Independent human security review:** absent. Six L P0 and three P1 findings remain OPEN.
6. **Production release:** providers, orders, inventory, notification outbox, credentials, subscription/billing and live Commerce writes remain out of scope, NO-GO.

## Gate disposition

| Gate | Status |
|---|---|
| V18.3.6G-L inherited QA | VERIFIED 245/245 |
| M offline Ed25519/metadata grant QA | IMPLEMENTED/TESTED 29/29 |
| M disposable PG17 auth.delete/private ACL | IMPLEMENTED/TESTED 53/53 |
| M real PG17 separate-connection DELETE/read/timeout/replay | TESTED 4/4 |
| Live public SECURITY DEFINER grants | VERIFIED COUNTS / REVIEW REQUIRED |
| Real Supabase Auth signout to auth.sessions race | BLOCKED |
| Supported database Ed25519 proof verifier | BLOCKED |
| Real Owner A/B & Store RLS | BLOCKED |
| Real protected gateway/grant change | BLOCKED / NEEDS APPROVAL |
| Production writer, sends, merge as release | NO-GO |

## Rollback / next proposal

Only QA files and dedicated GitHub Actions are new. CI database is destroyed and no linked system changed. Closing unmerged Draft PR #449 is sufficient rollback. Do not merge or deploy this as a migration.

**Safe next gate:** `V18.3.6N — Privileged Function Body Review Authorization × Auth Service Delete Semantics Contract × Production Crypto Trust Boundary Decision`. A separate approval is required before reading sensitive function bodies, changing grants or using real Auth A/B.

**Final-HEAD acceptance condition:** this checkpoint file is committed after successful CI #44504954874. Verify a new run on final commit before declaring the final PR HEAD accepted.
