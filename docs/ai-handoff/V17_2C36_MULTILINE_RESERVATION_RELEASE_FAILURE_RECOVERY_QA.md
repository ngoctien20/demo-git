# TIEN404 AI — V17.2C.36 Multi-Line Order Transaction × Inventory Reservation/Release × Failure-Recovery QA

**Date:** 2026-11-18 JST. **Parent:** Draft PR #392, P1 #402/#403, user-selected Option A (no Supabase Pro upgrade, branch, payment or live data changes).
**Source checkpoint:** V17.2C.35 `bfe77549e7e26f7233c8c088f7049cecf340e94e`. **Code tested at SHA:** `415d3ecb1b400deca8fdcbdc325ee49a9ac61e7b`.
**Decision:** isolated candidate TESTED PASS, real Commerce writer / production multi-Store **NO-GO**.

## 1. What was verified before implementation
- Draft PR #392 OPEN DRAFT and existing PostgreSQL 17 test workflow `.github/workflows/v172c15-ephemeral-postgres-qa.yml` still runs the earlier RLS, private consent, V17.2C.32 migration preview and V17.2C.35 atomic single-SKU drill.
- Connected Supabase `tien404-staging` still has zero development branches; no remote DDL/DML was used.
- V17.2C.35 simulated immediate on-hand decrement in a single-SKU commit, whereas the legacy AI SALES DEMO pending order did not immediately deduct on-hand stock. A new **reservation candidate** must therefore explicitly model physical stock vs held stock. This is a candidate business contract, **not** an approved change to DEMO behavior.

## 2. IMPLEMENTED — GitHub Draft PR source only
- `qa/v172c-rpc-closure/v172c36-multiline-reservation-ci-only.sql` defines a separate **synthetic ephemeral-only** schema `tien404_v172c36_multiline_qa`, requiring Postgres database + existing V17.2C.35 CI fixture before it creates anything.
- `qa/v172c-rpc-closure/v172c36-multiline-private-fixtures-ci-only.sql`: independent synthetic Store A/B/C, multiple SKUs, unit prices, provider events, seller actors and confirmation/transition fixtures. No customer PII, real account identifiers, real tokens, production orders or credentials.
- `qa/v172c-rpc-closure/v172c36-multiline-reservation-release-ci-drill.sh`: localhost-only GitHub Actions/PostgreSQL 17 test shell; fails closed unless `PGHOST=127.0.0.1`, `PGPORT=5432`, `PGDATABASE=postgres`, `PGUSER=postgres`; tests private function grants, multi-SKU transaction, state transitions, replay, concurrency, rollback and final inventory invariant.
- Existing `.github/workflows/v172c15-ephemeral-postgres-qa.yml` extended with step `Multi-SKU Stock Reservation, Confirm/Cancel/Expiry & Failure Recovery QA (ephemeral only)` after prior V17.2C.35 regression.
- No public, anon or authenticated `USAGE`/function `EXECUTE` granted in synthetic schema; functions `SECURITY INVOKER` and invoked only by CI administrative PostgreSQL runner. No n8n workflow changed or executed.

## 3. Candidate business semantics and transaction invariants
- Each Store has separate `inventory(tenant_ref,store_ref,sku,price_vnd,on_hand,reserved)`; constraints enforce `0 <= reserved <= on_hand`. **Available = on_hand - reserved**.
- `reserve_synthetic_multiline(opaque_intent_ref)`: server-only synthetic private intent and Store/actor/installation/consent checks; restrict lane `commerce_v2_candidate_no_send`, require 2-20 unique SKU lines, valid quantities, price/version snapshot and exact VND total; lock product rows in deterministic SKU order with `FOR UPDATE`. Atomically increase `reserved`, insert order header, insert all order items. Does NOT lower physical `on_hand`.
- `transition_synthetic_order(opaque_action_ref)`: private action and owner Store checks, lock order `FOR UPDATE`, require current `reserved` state. For `confirm`: decrement both `reserved` and `on_hand`; for `cancel` or `expire`: decrement `reserved` only. Expiry transition is **triggered by an explicit authorized call**; there is no automatic scheduler or cleanup worker in this stage. Confirm after TTL expiry denied.
- Order terminal state is immutable in this candidate: `confirmed`, `cancelled`, `expired` have no additional transition path. Confirmation is not payment settlement. Returns `TRANSITIONED_SYNTHETIC_CI_ONLY` only for CI fixtures.
- Reservation idempotency enforced via unique `(tenant_ref,store_ref,channel,provider_event_ref)` plus transaction-scoped advisory lock. Same intent replay returns `DUPLICATE_RESERVATION_NO_WRITE`, different intent using same scoped event denied. Transition idempotency uses unique actionRef and unique order receipt; same action retry is no-op after verifying current Store/actor permissions.
- Injected errors after first stock reserve, order header, first item, first transition stock adjustment or after status change must roll back **the entire database transaction**, including all line-level allocations.
- Final ledger invariant: for every Store + SKU, `inventory.reserved` equals sum of `order_items.quantity` for Orders still in `status='reserved'`. Every Order has >=2 items and sum of line totals equals exact Order VND total. Order items cannot cross Store or tenant through composite FK.

## 4. TESTED — CI run with evidence
At **code SHA `415d3ecb1b400deca8fdcbdc325ee49a9ac61e7b`**, all three existing CI workflows ended **SUCCESS**:
- **Ephemeral PostgreSQL 17 [run #44242366102](https://github.com/ngoctien20/demo-git/actions/runs/44242366102)**, including V17.2C.35 and the new V17.2C.36 multi-line reservation/release/failure-recovery step: SUCCESS.
- **Protected Consent / preflight source regression [run #44242366197](https://github.com/ngoctien20/demo-git/actions/runs/44242366197)**: SUCCESS.
- **RPC privilege/source regression [run #44242366095](https://github.com/ngoctien20/demo-git/actions/runs/44242366095)**: SUCCESS.

Specifically validated:
1. Two-SKU Store A/B/C reservations maintain independent Store prices and physical inventory.
2. Reservation does not decrement physical on_hand; confirmation decrements exactly once; cancellation/expiry release reservations without increasing on_hand; expiry requires timeout and late confirmation is denied.
3. Same intent replay idempotent, different cart reusing same Store event denied; concurrent duplicate event has one winner.
4. Distinct events competing for final unit of a SKU, with another SKU in the cart: exactly one reservation succeeds; loser rolls back all partial SKU reserves.
5. Concurrent `confirm` vs `cancel` on same Order: only one terminal result/receipt, no double release or consumption.
6. Injected faults after first reservation, after header, after first order item, after first transition stock adjustment and after status update: no partial ledger changes.
7. Missing Store SKU, forged cross-Store actor, legacy lane, missing consent, stale session, incorrect confirmed total, changed price, unexpected transition, revoked actor: all DENY under synthetic trusted fixtures.
8. Final Store/SKU balance and Order/Items/VND sum invariants PASS; revoking Store A owner leaves Store B/C synthetic orders unaffected.

## 5. BLOCKED / gaps before any release
- The Store/actor/consent/channel flags in tests are **synthetic private fixtures**, not actual signed Meta/Zalo webhook, Auth sessions, two independent customer consents or source-owner authority. No real JWT/Provider UAT.
- This implementation is a **candidate**, with two or more line-items. It does not implement one-line order fallback, split fulfilment, partial cancellation, post-confirm return/refund/restock, exchange, pickup, partial payment, credit/receivables, price tiers/coupons/tax, expiry scheduler or notification dispatch.
- The proposed reservation model differs from the DEMO workflow that persists pending orders without stock decrement; a product/business decision must determine whether reservation occurs at pending, at merchant acceptance or at another state before deployment.
- Store-scoped `public.orders`/inventory and canonical Store memberships **do not exist** in live Supabase Commerce. n8n Published legacy writers still write Google Sheets and lack trusted Store authority; no automatic migration is possible.
- A production writer must use actual private verified channel receipts/actor sessions, Store-to-tenant and order ownership bindings, anti-replay persistence, guarded DB role and an independent security reviewer. Passing ephemeral CI does **not** authorize production.
- Hosted Auth A/B Store isolation, backup/restore, cost admission and independent consent/reviewer remain **NO-GO** under Option A. P1 #402/#403 remain OPEN.

## 6. Status / rollback / next proposal
- **VERIFIED:** checkpoint, protected source baseline, 3/3 GitHub CI success, Supabase branch list 0 at start.
- **IMPLEMENTED:** separate synthetic SQL schema, fixture, transaction functions, shell regression and CI workflow change on Draft PR #392 only.
- **TESTED:** multi-line hold/confirm/cancel/expire/idempotency/failure-recovery on ephemeral Postgres 17 PASS.
- **PROPOSED:** versioned reservation lifecycle contract, state transition audit/outbox, expiration worker and customer-side lifecycle messaging as separate gated candidates.
- **BLOCKED:** production order data, real channel identity, actual Commerce Core Store-scoped schema, hosted independent Auth A/B, live deployment.
- **ROLLBACK:** revert V17.2C.36 source/CI files on Draft branch or close PR; GitHub disposable Postgres is destroyed at workflow end. No hosted runtime rollback needed.
- **NEXT (proposed):** V17.2C.37 — Reservation Lifecycle Policy × Expiry Worker No-Send Preview × Notification Outbox Atomicity QA; maintain synthetic-only gates until new explicit approval.
