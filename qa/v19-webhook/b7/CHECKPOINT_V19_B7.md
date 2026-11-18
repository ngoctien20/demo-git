# TIEN404 AI — V19.0-B7 Checkpoint

**Date:** 2026-11-18 JST
**Project:** V19.0-B7 — Approved Private Hosted Canary × Protected D1 Binding Verification × Store Authority Closure.
**Truthful status:** APPROVAL_PREPARED / LOCAL_PROTECTED_D1_TESTED / PG17_DISPOSABLE_RLS_TESTED / HOSTED_CANARY_BLOCKED / REAL_STORE_AUTH_BLOCKED / PRODUCTION_NO_GO.

## 1. Verified baseline before work

- B6 PR #432 OPEN DRAFT; head f74f151df71516d4cdb7825ba6c68fc1cfa60038.
- B2-B6 chain #419 → #423 → #428 → #430 → #432 remains unmerged; no code rewrite of prior tested work.
- B2 deployed source blob 11affa7658b46ae7c411eed7877d7ccdce61bbad, unchanged.
- Cloudflare V17.23U existing QA Worker deployment 8a43101c-39fa-40a0-a022-2528e54b2102, version 1d2666ac-3b4d-4fd2-9cba-0f05b65dd195, workers.dev/previews disabled.
- Existing Cloudflare disposable D1 contains old B3/B4 tables; B5/B6/B7 hosted tables absent before and after B7; no hosted D1 writes.
- Supabase staging four public Commerce tables orders/products/customers/conversations have tenant_id but lack store_id.
- Supabase orders/products/customers/conversations/order_items/messages have tenant-wide PERMISSIVE read policies and no Store restrictive policy in the audited metadata.
- public.save_merchant_product is SECURITY DEFINER callable by authenticated, still tenant-only (no store_id). No change made.

## 2. IMPLEMENTED (GitHub QA branch only)

- protected-private-canary.mjs: strict synthetic signed private-caller permit (HMAC test key), issuer/audience/operator/D1 binding scope and 30-second replay/expiry, constant-time HMAC comparison, atomic local D1 nonce claim. Every return denies real Access/JWT, provider, Commerce, Store ownership and sending. Default Worker fetch 423.
- sql/001_local_private_canary_only.sql: disposable-only nonce uniqueness/receipt table. No real customer data.
- tests/local-private-canary-worker.mjs: *nondeployable* Miniflare harness. Local route accepts only strict fixture header/mode. Never publish this harness.
- tests/protected-private-canary.test.mjs: valid/invalid caller fields, missing auth, spoofed Store, D1 failure, concurrency, replay and no external authority claims.
- tests/pg17_store_rls_rehearsal.sql: GitHub Actions PostgreSQL17 service creates ephemeral b7_fixture tables/roles, tests V18.3.6D PERMISSIVE + RESTRICTIVE policy algebra, Store A/B/dual, Tenant Owner without Store membership, suspended/revoked/expired/NULL legacy.
- CI workflow with all B2-B6 regressions and immutable snapshot guard.
- Private hosted H01-H16 approval matrix and actual Supabase Store closure P0 evidence, referencing existing PR #417.

## 3. TESTED

- First B7 CI run #44296188379 SUCCESS at commit 04d8f0e5ec8ea17264e90afa4cb036c3f8efc1b7.
- B7 Node.js Miniflare/workerd D1: 21 tests PASS.
- PostgreSQL17 disposable RLS SQL: 15 assertions PASS (not counted in Node/Python count).
- B6-B2 regressions: 237 tests PASS.
- Total: **258 Node/Python tests + 15 SQL assertions** with zero failures in this run.
- GitHub Actions service PostgreSQL17 is synthetic role testing, NOT live Supabase Auth/JWT/Store RLS evidence.
- Miniflare local D1 Binding is NOT Cloudflare-hosted Worker Binding.
- Final PR head CI to be checked separately after docs/PR creation.

## 4. PROPOSED and BLOCKED

The phase title includes "Approved" but actual scoped hosted change approval is missing. No exact NEW hosted Worker, verified operator identity, caller Worker/service binding, D1 target, test window, resource budget or rollback authorization was specified. Hence the hosted canary was NOT deployed, and acceptance H01-H16 is not fulfilled.

Store Authority P0 blockers:
- Missing canonical stores/store_memberships and store_id on six Commerce tables;
- No signed Owner A/B real Auth session evidence or cross-Store RLS UAT;
- Old permissive tenant policies not yet narrowed by restrictive Store boundary;
- public.save_merchant_product SECURITY DEFINER tenant-only writer not cut over;
- Store SKU uniqueness D-02 and legacy ownership mapping undecided;
- No merchant-approved live provider installation→Store proof.

Durable real event processing, live Zalo webhook, encrypted customer payload key/retention governance, provider send and payment remain out of scope.

## 5. Changes and rollback

- GitHub Draft PR source/test/docs only.
- No Cloudflare Worker creation/deployment, route, workers.dev, Access/WAF, D1 migration/rows, service credential or provider webhook.
- No Supabase DDL/data writes, role changes, JWT reads, n8n workflow activation, Commerce orders/inventory writes or user messages.
- No new paid cloud resource was provisioned; GitHub CI service resource usage occurred; no exact bill claim.
- To rollback: close/revert B7 Draft PR. No hosted rollback necessary.
- If future hosted canary is explicitly approved, require before-state snapshot, monitoring, exact target/budget, operator binding, separate rollback authority and no public route.

## 6. Next gate

- Obtain **explicit target-scoped owner approval** for an isolated PRIVATE hosted Service Binding/D1 worker UAT, not just a phase title.
- Independently review PR #417 migration/writer cutover and run approved disposable full-schema PostgreSQL17 backfill and FK/RLS rehearsal.
- Obtain validated Owner A/B Auth tests and live provider installation ownership evidence, without transmitting raw tokens.
- Only after these gates: a separately authorized read-only protected commerce pilot, still no production writer.

**Checkpoint:** V19_B7_LOCAL_CANARY_21_PASS_PG17_RLS_15_PASS_B2_B6_237_PASS__HOSTED_BLOCKED__REAL_STORE_BLOCKED__PROD_NO_GO.
