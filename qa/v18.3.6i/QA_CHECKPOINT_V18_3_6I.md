# TIEN404 AI — V18.3.6I QA Checkpoint

**Checkpoint:** `V18.3.6I-PG17-RACE-44314566087`  
**Date:** 2026-11-18 JST  
**Status:** `OFFLINE SIGNED BINDING TESTED / DISPOSABLE PG17 RACE TESTED / PRODUCTION AUTHORITY NO-GO`

## Parent and branch

- Parent checkpoint: V18.3.6H — Draft PR #435, head `d3eb5684420b7deb611652c121b52b9f49e946f3`.
- V18.3.6I Draft PR: [#438](https://github.com/ngoctien20/demo-git/pull/438).
- Branch: `qa/v1836i-issuer-nonce-race-admission-20261118`.
- Base branch: `qa/v1836h-session-nonce-independent-gate-20261118`.

## Verified test evidence (before this checkpoint commit)

GitHub Actions [run #44314566087](https://github.com/ngoctien20/demo-git/actions/runs/44314566087):
- Job `134837158772`, `offline-signed-binding`: SUCCESS.
- Job `134837157988`, `disposable-pg17-atomic`: SUCCESS.
- V18.3.6G Node.js regression: **93/93 PASS**.
- V18.3.6H Node.js regression: **47/47 PASS**.
- V18.3.6I signed issuer→nonce unit tests: **24/24 PASS**.
- V18.3.6I actual PostgreSQL 17.12 pgTAP binding: **42/42 PASS**.
- **TOTAL 206/206 numbered assertions PASS**, plus five additional CI acceptance steps.
- Concurrent acceptance: session revoked first → `DENY_SESSION`, no nonce burned.
- Concurrent acceptance: Store membership revoked first → `DENY_MEMBERSHIP`, no nonce burned.
- Concurrent same-JTI race → exactly one `ACCEPTED`, one `REPLAY`.
- Admission-first ordering → the first transaction admitted, later session revocation committed, any new JTI then denied.
- PostgreSQL restart → previously consumed JTI still `REPLAY`.
- Runtime module secret/network-scope scan PASS.
- Disposable PostgreSQL 17.12 container started with `--network none` and no exposed network port, and Docker cleanup step SUCCESS.

Verified log markers:
- `V18_3_6I_G_REGRESSION_93_PASS`
- `V18_3_6I_H_REGRESSION_47_PASS`
- `V18_3_6I_SIGNED_BINDING_24_PASS`
- `V18_3_6I_SOURCE_SCOPE_SCAN_PASS`
- `V18_3_6I_PG17_BINDING_42_PASS`
- `V18_3_6I_SESSION_REVOKE_BEFORE_ADMIT_DENIED`
- `V18_3_6I_MEMBERSHIP_REVOKE_BEFORE_ADMIT_DENIED`
- `V18_3_6I_CONCURRENT_ONE_SUCCESS_ONE_REPLAY_PASS`
- `V18_3_6I_ADMIT_BEFORE_REVOKE_LINEARIZATION_PASS`
- `V18_3_6I_RESTART_PERSISTENCE_PASS`

## What was implemented

- `protected-issuer-nonce-binding.mjs`: invokes G Ed25519 verifier with a server-created per-request nonce callback. The callback, only invoked after cryptographic verification, constructs server-bound HMAC Tenant/Store/subject/session/revision digests and SHA-256 token fingerprint. No raw JWT/session/identity forwarded to the DB callback. Only exact `ACCEPTED` returns an offline read-only proof; the proof explicitly reports `operationExecuted=false` and `productionAdmitted=false`.
- `01_PG17_ATOMIC_BINDING.sql`: private synthetic session/member state and nonce ledger. A SECURITY DEFINER SQL function with private EXECUTE-only role locks session row then Store membership row, verifies active/unrevoked/current revision/capability, then inserts one-use JTI with unique `(issuer,jti)`; denies without burning JTI on stale authority.
- `02_PGTAP_BINDING.sql`: actual PG17 read/denial tests including SQL ACL, wrong Store/session/subject, signed-digest shape, expiry, prior revocation, stale member revision and nonce persistence.
- Dedicated CI workflow includes real two-connection race tests and process restart.

## QA correction history

1. [Run #44314212532](https://github.com/ngoctien20/demo-git/actions/runs/44314212532): PostgreSQL job and all races SUCCESS. New Node issuer wrapper incorrectly applied short-field maximum length to a signed JWT; 20/24 Node tests failed with `REQUEST_REJECTED`. Fixed input length validator.
2. [Run #44314344262](https://github.com/ngoctien20/demo-git/actions/runs/44314344262): PostgreSQL job SUCCESS, Node 23/24. On backend exception, G verifier normalizes a nested callback error to `NONCE_STORE_UNAVAILABLE`; test expected internal `ATOMIC_ADMISSION_UNAVAILABLE`. Corrected assertion to the observed fail-closed outer contract without weakening denial.
3. [Run #44314566087](https://github.com/ngoctien20/demo-git/actions/runs/44314566087): all Node and PostgreSQL jobs SUCCESS. No failed assertions in final successful job logs.

## Read-only connected-system recheck

Supabase staging project `ifxlvrhyjhbzbrkdsida`:
- PostgreSQL `17.11`.
- `public.stores`/`public.store_memberships`: **0** canonical tables.
- `store_id` across six Commerce business tables: **0**.
- Public restrictive RLS policies: **0**.
- Public Products **2**, Orders **2** (aggregate counts only; no row PII).
- No DDL, DML, trigger, migration, RLS change or permission grant was applied.

n8n Published workflows read-only verified:
- Messenger `Z7FdV7uDvApfbURQ` Published `1064b1b3-d3f1-4a6b-a367-2414ba691522`.
- Zalo Bot `yIJk8LvJoLF40Z62` Published `2d912cb0-007f-452f-9536-b92ba12a03e6`.
- Commerce Core `iyfGUiEsZlNTBWOR` Published `456862c9-e5ee-4bfa-9931-47dbc39ab73d`; separate Draft `c96422e0-170b-46a3-8d75-3a2695e645e7`.
- No n8n workflow edited, executed or published; no provider sends, credential changes or real Commerce writes.

## Security limitations — MUST NOT CLAIM PRODUCTION READINESS

- G Ed25519 cryptography is genuine with CI-generated ephemeral test keys, but all Supabase Auth and membership callbacks are synthetic. No real JWT, real Auth session, consent or provider grant was inspected.
- I JS verifier and I PostgreSQL SQL function are independently tested contracts, **not an integrated hosted service**. The privileged SQL function relies on its caller being a trusted verified gateway; it does not verify an Ed25519 signature. A compromised privileged executor could pass forged digests.
- Synthetic PG17 session revocation is only a local fixture. Real Supabase Auth revocation across services is asynchronous and cannot be assumed to share these row locks. No immediate production session-revocation guarantee was proven.
- Nonce admission in a separate database transaction **does not authorize subsequent Commerce reads/writes**. Store-aware data operation must enforce authority within the same trusted transactional boundary. Neither real customer read nor writer path is implemented.
- No independent human security reviewer signed off. Existing P0 issues (real Auth A/B, service-role bypass, canonical Store schema, issuer key custody, provider/owner consent, human review) remain BLOCKED.
- PostgreSQL HA/PITR, issuance rotation, nonce retention/cleanup and real hosted recovery not tested.

## Gate decision

| Gate | Status |
|---|---|
| G regressions | VERIFIED 93/93 |
| H regressions | VERIFIED 47/47 |
| I protected issuer→nonce binding (synthetic) | IMPLEMENTED / TESTED 24/24 |
| I real PG17 atomic nonce/authority constraints | IMPLEMENTED / TESTED 42/42 |
| I PG17 two-session races and restart persistence | TESTED 5/5 |
| I current staging production readiness | NO-GO |
| Real Supabase Auth A/B | BLOCKED |
| Independent human security review | BLOCKED |
| Live hosted protected gateway/issuer/nonce | BLOCKED |
| Supabase staging migration, legacy backfill, provider sends, Commerce writer | NO-GO |
| Production release | NO-GO |

## Rollback

Only a Draft PR and isolated GitHub Actions changed. PostgreSQL disposable CI container removed. Rollback by closing PR #438; no connected system rollback is necessary.

**Checkpoint caveat:** this file is committed after first successful run. Re-check the final commit's own workflow run and update PR evidence before stating the final SHA has passed.
