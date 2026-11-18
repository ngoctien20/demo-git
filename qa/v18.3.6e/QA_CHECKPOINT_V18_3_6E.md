# TIEN404 AI — V18.3.6E QA Checkpoint

**Checkpoint:** `V18.3.6E-PG17-PGTAP-44280016933`  
**Date:** 2026-11-18 JST  
**Status:** `TESTED — 61/61 SYNTHETIC PG17 pgTAP PASS / STAGING NO-GO`

## Evidence

- Draft PR: [#421](https://github.com/ngoctien20/demo-git/pull/421), based on Draft V18.3.6D PR #417.
- GitHub Actions run: [44280016933](https://github.com/ngoctien20/demo-git/actions/runs/44280016933)
- Job: `134718028990`, `success`.
- Runner: `ubuntu-24.04`.
- Database: `tien404_v1836e_disposable`, PostgreSQL `17.12`, container `--network none`.
- Real pgTAP package installed in an isolated derived PostgreSQL 17 image.
- Actual schema setup completed successfully and all **61 of 61** numbered TAP assertions passed.
- Verified log markers: `1..61`, `V18_3_6E_PGTAP_TEST_SCRIPT_FINISHED`, `V18_3_6E_FULL_DML_RLS_PGTAP_PASS`.
- Container was deleted after the test.

## What was tested

- Same-Tenant distinct Store A/B and cross-Tenant Store C positive/negative SELECT.
- Six Commerce tables: products, customers, orders, order_items, conversations, messages.
- Owner A/B, Manager A, Staff A, Tenant Owner with no Store membership, explicit dual-Store owner, revoked/expired members, non-member and missing Auth actor.
- One deliberately overbroad permissive products SELECT policy combined with a restrictive Store boundary.
- Store-local SKU namespace (same SKU across A/B, duplicate in same Store rejected).
- INSERT: correct Store positive, wrong Store denial, order staff order/order-item policy.
- UPDATE: Owner/Manager positive, wrong Store zero-row, Staff price/order total denial.
- DELETE: product/order/order_item denied.
- Cross-Store child FK: Order→Customer B, Order Item→Product B, Message→Conversation B denied.
- Scope immutable trigger: even explicit dual-Store owner cannot relocate Order/Product A→B.
- Legacy NULL product/order invisible, and two independent NULL Store write guards tested.
- Suspended Store deny + continued access to unaffected Store B.
- No unauthorized price/total/store changes persisted after negative cases.

## QA bug and correction

The first execution [44279821461](https://github.com/ngoctien20/demo-git/actions/runs/44279821461) failed one overly specific expected SQLSTATE: the synthetic actor attempting a NULL Store INSERT was rejected by restrictive RLS with `42501`, while the test expected CHECK `23514`. That did **not** expose data or authorize a write. The test was corrected to assert `42501` for the actor, plus a separate privileged fixture-only assertion that bypasses RLS and proves the NOT VALID CHECK rejects new NULL Store with `23514`. The corrected run passed 61/61.

## Connected system read-only recheck

Supabase staging `ifxlvrhyjhbzbrkdsida` remained PostgreSQL 17.11 with:
- 0 canonical `stores`/`store_memberships` tables.
- 0 `store_id` columns on six Commerce tables.
- 0 restrictive public policies.
- 2 public products and 2 public orders.

No staging DDL, migration, backfill, Auth session/JWT, customer PII, workflow execution, credential modification or provider send occurred.

## Known untested boundaries

- SQL tests use **synthetic** `request.jwt.claim.sub` values; no signature, issuer, audience, active real Auth session, or real Owner A/B binding is verified.
- The permission boundary is for a synthetic PostgreSQL NOLOGIN actor and table policies, not PostgREST, API gateway, or production n8n caller.
- Supabase `service_role`/BYPASSRLS is outside this RLS proof.
- Store membership granting/revocation transactions, last-owner invariant and complete Tenant-level administration workflow are not implemented.
- Messenger, Zalo, Website provider installation grants, media rights and Store-scoped channel adapter remain separate gates.
- Real atomic order write/outbox/reservation recovery is not covered; the Staff INSERT cases are fixture capabilities, not an approved production writer design.
- Production's current `UNIQUE(tenant_id,sku)` differs from this synthetic Store-local SKU model. Do not remove/change the live constraint without business approval and compatibility QA.
- V18.3.6D's `channel_installation_id` design is not yet implemented in this fixture.
- The first test failure was a test-expectation mismatch, not a real exploit. Additional independent security review still required.

## Final decision

- `PG17_SYNTHETIC_SCHEMA`: IMPLEMENTED / TESTED.
- `PGTAP_DML_RLS_61`: VERIFIED PASS.
- `COMPOSITE_FK_NEGATIVE_QA`: VERIFIED PASS on covered cases.
- `STAGING_CANONICAL_STORE_SCHEMA`: NOT IMPLEMENTED.
- `REAL_AUTH_AB`: BLOCKED.
- `LEGACY_BACKFILL`, `PROVIDER_SEND`, `WRITER_CUTOVER`, `PRODUCTION_RELEASE`: NO-GO.
- PR #421 remains Draft; do not merge as release or migration approval.

## Rollback

The disposable container was destroyed; no connected system was changed. Close Draft PR #421 and archive QA evidence if the candidate is rejected. No production rollback is needed.
