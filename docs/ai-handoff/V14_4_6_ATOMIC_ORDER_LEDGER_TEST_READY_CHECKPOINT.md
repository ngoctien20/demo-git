# TIEN404 AI V14.4.6 — Atomic Order Request × Inventory Ledger Test-Ready Checkpoint

**Date:** 2026-11-16 JST
**GitHub Draft PR:** https://github.com/ngoctien20/demo-git/pull/108
**Branch:** work/v1446-atomic-order-ledger-pg17-qa-20261116
**Base:** V14.4.5 Draft PR #107 HEAD bbe4dc84dbe2b41bceeb542a1a058ea2538487ea
**Supabase project:** tien404-staging ref ifxlvrhyjhbzbrkdsida (UNMODIFIED)
**Release status:** EXPERIMENTAL / QA TEST READY — NOT HOSTED, NOT RELEASED

## 1. Actual audit

Read-only preflight on Supabase staging: PG 17.11, public.products 2, public.orders 2; public.stores absent, public.store_memberships absent, 6 legacy tenant PERMISSIVE SELECT policies remain. Product V2 hosted not deployed. This task DID NOT run SQL, migration or DML against Supabase.

Inherited V14.4.5 sources verified six workflow Draft/Published versions and 579/579 offline Node regression pass. Google Sheets DEMO is separated from n8n Data Tables Commerce sandbox; no existing Published workflows updated.

Operator backup from V14.2 exists in local Windows with pg_dump success, pg_restore --list success and SHA256 recorded. **No real isolated backup restore test has passed yet**. It remains a HARD P0 gate, not waived.

## 2. IMPLEMENTED on GitHub Draft PR #108

**01_DISPOSABLE_PG17_ONLY.sql**
- Strong explicit guard: exact CI database name, postgres user, required custom GUC marker and PostgreSQL 17 major BEFORE ANY DDL, repeated for runtime function calls. Creates qa_v1446 schema ONLY on GitHub-hosted throwaway database. DO NOT run on hosted Supabase or a restored local backup.
- 3 entirely fake stores: Store A+B share tenant and SKU but have independently priced and stocked products, Store C is a different tenant. Synthetic actors/member roles only — NOT real Supabase Auth.
- Request Order: validates role, Store, SKU, stock availability, price and expected_total; writes requested order WITHOUT holding or deducting stock.
- Exactly scoped idempotency: unique(tenant,store,request_id) and per-request transaction advisory lock; replay of same key/payload returns same order, modified payload blocks.
- Merchant accept: exact tenant+Store owner membership, SELECT order FOR UPDATE and atomic inventory conditional UPDATE available >= requested qty; reserves on hand but does not deduct yet; immutable RESERVE ledger.
- Fulfil: consumes on_hand and reserved once, immutable FULFIL ledger; repeated fulfil does not change stock twice.
- Cancel: requested->cancelled no stock; confirmed->cancelled releases reserved via immutable RELEASE event. Fulfilled refund/return deliberately rejected pending merchant policy.
- Ledger immutable UPDATE/DELETE trigger, event constraints, composite store-aware FK. Real Prod RLS/GRANT not emulated by this synthetic postgres user; do NOT call it a hosted JWT acceptance.
- Business policy (reserve on merchant acceptance) is PROPOSED FOR FIXTURE ONLY. No merchant approval has been given yet.

**02_pg17_assertions.sh**
30 direct PostgreSQL 17 SQL business/invariant assertions, including tenant/Store isolation, server VND price, idempotency payload conflict, correct pending no-stock effect, owner/buyer role split, confirm/fulfil/cancel transitions, immutability and retry.

**03_pg17_concurrency.sh**
8 direct assertions using two separate concurrent PostgreSQL connections:
- 2 separate Orders each demand quantity 2 while stock=3. Exactly one merchant accept wins and one fails insufficient stock; no oversell; one reserve ledger event.
- 2 simultaneous submissions of same request key/payload. Exactly one returns new request, one replay, one row committed.
- Store B stock remains unchanged by Store A concurrency.

**CI workflow**
.github/workflows/v1446-atomic-order-ledger-qa.yml. GitHub service postgres:17 disposable DB tien404_v1446_ci, no secrets, no external messages, no real Supabase data. Other job runs inherited **579/579** Node tests PASS.

**User test manual**
qa/atomic-ledger-v1446/TEST_IT_YOURSELF.md. Steps for running again via GitHub Actions **Re-run jobs** and manually testing a separate n8n QA laboratory.

## 3. VERIFIED TESTS

**GitHub Actions run 43741773162:** https://github.com/ngoctien20/demo-git/actions/runs/43741773162
- 2/2 jobs completed SUCCESS.
- 30/30 SQL functional checks PASS.
- 8/8 SQL concurrency checks PASS (real independently concurrent psql/Postgres sessions).
- 579/579 inherited Node tests PASS, zero failures.
- SQL schema guard static inspection PASS. No hosted SQL/credential, customer or production changes.
- The first exploratory run 43741658866 had functional SQL PASS but a **test script exit-code assumption** treated a legitimate PostgreSQL rejection exit=1 as if it must equal exit=3. Corrected script to require exactly one zero and one nonzero return code PLUS explicit insufficient-stock error; final run 43741773162 is green. This was a test harness error, not an inventory oversell.

**Optional operator-facing n8n QA Laboratory**
- Workflow URL: https://ngoctien20.app.n8n.cloud/workflow/BAOYcw4U9VCkSMdX
- Workflow ID BAOYcw4U9VCkSMdX.
- Personal project, folder 90_QA - DIAGNOSTICS.
- INACTIVE, MANUAL TRIGGER, 3 nodes, no credentials, no Google Sheets/Datatables/HTTP/Meta/Zalo/Supabase nodes.
- Input Set node scenario defaults ALL (8 test cases), editable to one scenario. Code returns redacted mock results only.
- Executed via n8n test tool with pinned manual trigger; execution 3861 success. **Eight output scenarios**, all status PASS; every item writes=0 and providerMessages=0. The mock n8n lab is **not the PostgreSQL integration**, only a convenient user UI test to exercise proposed rules.

## 4. HOSTED SECURITY GATES — ALL STILL CLOSED

| Gate | Live status |
|---|---|
| Local backup created + TOC read successfully | VERIFIED operator screenshots |
| FULL isolated restore of actual backup to PG17 + accepted rollback | DEFERRED / BLOCKED |
| Four Product/Order owner/store attestations | NOT VERIFIED |
| Canonical hosted Store/Membership schema and old tenant policy removal | BLOCKED |
| Store-aware Product V2 hosted and secure grants | BLOCKED |
| Signed real JWT acceptance A/B same tenant + C cross tenant + revoked member | BLOCKED |
| Atomic multi-line cart, subscription expiry, partial fulfil and payment | NOT IMPLEMENTED |
| Inventory accounting reconciliation under business policy + return/refund | PROPOSED ONLY |
| Actual Messenger/Zalo/Website provider integration and customer trial | NOT AUTHORIZED |
| Production/Billing credentials and actual stock/orders | UNTOUCHED |

Neither the synthetic session GUC nor the CI postgres owner are a replacement for Supabase Auth and RLS; no real tenant data was used.

## 5. QA acceptance for the owner — immediately executable

**Option A:** Open the n8n lab URL, run with scenario=ALL, review 8 PASS items; optionally change one scenario and re-run. No effect on real stock/order.

**Option B:** Open GitHub Actions run 43741773162 and choose Re-run jobs -> Re-run all jobs. This reruns actual PostgreSQL transaction and concurrency tests in a disposable cloud CI service, not in Supabase. Re-run needs GitHub repo privileges. The workflow_dispatch button may be hidden while workflow lives only on a Draft branch, so DO NOT merge to production just for a test button.

**Do not run SQL file 01 against Supabase or local restore DB.** It intentionally contains CREATE/INSERT and must remain within precisely guarded throwaway GitHub CI.

**Owner decision still required before real Order policy:** choose REQUEST_ONLY vs RESERVE_ON_MERCHANT_ACCEPTANCE vs earlier customer reservation; define cancellation, expiry, partial fulfilment, returns and paid/refund accounting. This test branch does not authorize or change those policies.

## 6. Rollback and next

Source rollback: close/revert PR #108. GitHub disposable Postgres container is automatically removed. New INACTIVE n8n QA workflow can remain in QA folder or be archived after separate approval; no existing n8n live workflow changed. No Supabase hosted rollback necessary.

**Next secure milestone:** V14.4.7 — Merchant-Acceptance Policy Decision × Local QA Operator Guide / Store JWT Release Gate. Once owner signs the business policy, restoration and row-owner proof, prepare narrowly scoped hosted migration with actual JWT acceptance and stock/order integration; do not conflate this with current testable isolated CI.

**Verdict:** TEST_READY — REAL DISPOSABLE PG17 + MANUAL N8N MOCK QA. HOSTED STAGING MIGRATION and COMMERCIAL USE BLOCKED.
