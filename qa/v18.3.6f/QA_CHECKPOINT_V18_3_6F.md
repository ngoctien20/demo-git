# TIEN404 AI — V18.3.6F QA CHECKPOINT

**Checkpoint:** `V18.3.6F-PG17-44282693723`  
**Date:** 2026-11-18 JST  
**Status:** `TESTED — DISPOSABLE PG17 ONLY / REAL SERVICE-ROLE ADMISSION BLOCKED`

## GitHub evidence

- Draft PR: [#425](https://github.com/ngoctien20/demo-git/pull/425), based on Draft PR #421 (V18.3.6E).
- Last verified successful run before this checkpoint: [44282693723](https://github.com/ngoctien20/demo-git/actions/runs/44282693723), job `134727386426`.
- PostgreSQL `17.12` with actual pgTAP extension installed inside disposable Docker image.
- Container `tien404-v1836f-pg17` started with `--network none` and no published database port; deleted on successful completion.
- E regression: `61/61` actual pgTAP assertions PASS on a fresh disposable database.
- F membership/gateway: `87/87` actual pgTAP assertions PASS after drop/recreate of the disposable database.
- Concurrent last-Owner revocation: **PASS** (one revoke accepted, one denied with last-Owner exception; exactly one active Store A Owner remains).
- Concurrent receipt consumption: **PASS** (two simultaneous gateway calls for same receipt; exactly one allow, one replay denied).
- Log markers verified: `V18_3_6F_E_REGRESSION_61_PASS`, `1..87`, `V18_3_6F_ADMIN_GATEWAY_87_PASS`, `V18_3_6F_CONCURRENT_LAST_OWNER_PROTECTION_PASS`, `V18_3_6F_CONCURRENT_RECEIPT_SINGLE_USE_PASS`.
- No `not ok`, `Looks like you failed` or SQL ERROR in the successful run logs.

## What was implemented and tested

- `01_MEMBERSHIP_ADMIN.sql`: Store create/activate, invite/accept/revoke, separate Tenant Owner/Store Owner/Manager privileges, private audit records, immutable membership Tenant/Store/user keys and DB trigger blocking removal of final active Store Owner.
- `02_GATEWAY_BYPASS_GUARD.sql`: synthetic private installation + receipt tables, a privileged BYPASSRLS executor with narrowly granted table permissions, and an EXECUTE-only gateway role with no direct table grants. Gateway method checks exact Store+order+installation+capability+audience, consent flags, expiry and single-use proof. The test explicitly demonstrates that a BYPASSRLS principal with raw SELECT privilege can read cross-Store/legacy rows; therefore the exposed gateway must not hold these privileges.
- `03_PGTAP_ADMIN_GATEWAY.sql`: 87 real assertions for human role boundaries, Store activation, last-owner protection, direct SQL denial, cross-Tenant admission, gateway grants, wrong-Store/forged-operation/expired/revoked/replayed proofs, guarded test-only order-status transition and nonce uniqueness.
- GitHub Actions includes concurrent two-session checks in addition to pgTAP.
- All fixtures are synthetic; no live JWT, signed owner consent or real provider permission was claimed.

## QA recovery history

1. Run `44282348343`: E regression PASS; second disposable database creation failed because PostgreSQL roles are cluster-wide and the E test role remained after dropping its database. Fixed CI to drop the synthetic role before rebuilding.
2. Run `44282479601`: E regression and schema setup PASS; 86/87 F assertions passed. The Store Owner -> Store Owner grant correctly denied with `DENY_ACTOR_SCOPE` but the test expected the more explicit `DENY_OWNER_GRANT`. Updated the function to emit the explicit deny reason. Also fixed TAP to unaligned/tuples-only and hardened CI to detect whitespace-prefixed `not ok`.
3. Run `44282693723`: ALL STEPS SUCCESS, including E 61, F 87, both concurrency checks and container removal.

No security finding or data leak was established by the two failed CI attempts; both were isolated test-fixture/test-harness issues and corrected before PASS.

## Connected-system verification

Read-only Supabase staging recheck:
- PostgreSQL `17.11`.
- `public.stores`/`public.store_memberships` count: 0.
- `store_id` on six Commerce tables: 0.
- Public restrictive policies: 0.
- Public Products: 2; Orders: 2.

Read-only n8n inspection confirmed existing Published versions unchanged:
- Messenger `Z7FdV7uDvApfbURQ`: `1064b1b3-d3f1-4a6b-a367-2414ba691522`.
- Zalo Bot `yIJk8LvJoLF40Z62`: `2d912cb0-007f-452f-9536-b92ba12a03e6`.
- Commerce Core `iyfGUiEsZlNTBWOR`: Published `456862c9-e5ee-4bfa-9931-47dbc39ab73d`; current Draft `c96422e0-170b-46a3-8d75-3a2695e645e7`.

No Supabase DDL/DML, Auth session/JWT inspection, n8n workflow mutation, credential change, customer data access, webhook or provider send occurred.

## Known blockers and security boundaries

**Do not interpret simulated flags as signatures or real proof.**

- `auth.uid()` in disposable PG17 reads a synthetic SQL GUC; it does NOT validate JWT signature/session.
- Receipt `server_verified`, `owner_consented` and private installation status are synthetic fixtures; no provider account grant or owner consent was validated.
- The privileged executor has BYPASSRLS. A leaked executor credential or unrestricted direct SQL access bypasses RLS, including cross-Store and NULL legacy rows. The test proves constrained routing in this synthetic model, not production service-role safety.
- Administrative functions are created as SECURITY DEFINER by a privileged fixture owner; production requires dedicated least-privilege function ownership and independent security review.
- Receipt issuance, protected HTTP gateway, issuer cryptographic proof, principal binding, atomic order writer, outbox/recovery and real Auth A/B remain unimplemented/untested.
- Store-membership admin APIs, rate limits, invitation delivery/expiry and last-Owner lifetime rules require further review.
- No real Store mapping, live migration, media rights or provider permissions approved.

## Release decision

- `SYNTHETIC_MEMBERSHIP_ADMIN`: IMPLEMENTED / TESTED.
- `LAST_OWNER_INVARIANT`: TESTED (including two-session concurrent revoke).
- `SYNTHETIC_PRIVILEGED_GATEWAY_NEGATIVE_QA`: TESTED.
- `SINGLE_USE_RECEIPT_CONCURRENCY`: TESTED.
- `REAL_SUPABASE_AUTH_AB`, `SIGNED_ATTESTATION`, `SERVICE_ROLE_REAL_PATH`: BLOCKED.
- `STAGING_DDL`, `LEGACY_BACKFILL`, `CHANNEL_SEND`, `PRODUCTION_WRITER`, `RELEASE`: NO-GO.
- Draft PR #425 remains unmerged. This checkpoint is evidence only, not migration/release approval.

## Rollback

The disposable PG17 container was deleted after execution; no connected environments were modified. Close Draft PR #425 if the candidate is rejected. No staging/production rollback is necessary.
