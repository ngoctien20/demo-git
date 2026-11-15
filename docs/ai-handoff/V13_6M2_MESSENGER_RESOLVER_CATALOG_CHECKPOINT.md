# TIEN404 AI V13.6M.2 — Trusted Messenger Shop Resolver & Catalog Integration

**Date:** 2026-11-15 JST. **Lifecycle:** EXPERIMENTAL → CANDIDATE, DRAFT ONLY. **NO LIVE SEND / NO PRODUCTION / NO DB DDL.**

## Scope and baseline
- Approved by owner for staging/Draft: server-derived Fanpage → Tenant → Shop binding, read-only catalog and Shop A/B isolation QA. No DB/RLS/credential/production changes or real messages.
- Stacked parent: V13.6M.1 Draft PR #88, HEAD `193e25f7ae48ec7f1b70cfbdcc3ea624aa19206e`.
- Branch: `work/v136m2-trusted-messenger-store-resolver-staging-20261115`.
- Existing published Messenger `Z7FdV7uDvApfbURQ`: active, 27 nodes, version `d5c96b6b-d790-4270-8b0f-d0ebdd8bbd92`, **read only / unchanged**.
- Existing QA shadow `X0MwwQ7LRUqfOVjM`: inactive, synthetic-only, 5 nodes, **unchanged**.

## VERIFIED READ-ONLY — Supabase staging
Project `ifxlvrhyjhbzbrkdsida` metadata checked via read-only SQL. `public.products` columns are `id`, `tenant_id`, `sku`, `name`, `price_vnd`, `stock_on_hand`, `is_active`, timestamps; **no `store_id` and no verified `image_url`**. No authoritative public Messenger Page→Store ownership registry was verified in inspected tables. Existing tenant-only policy is insufficient for **two stores within the same tenant**. No hosted proof of per-store RLS or authorized customer-session JWT was presented. Therefore real store-specific Catalog remains **BLOCKED**.

## IMPLEMENTED on isolated branch (SOURCE ONLY)
1. `qa/messenger-rich-v136m2/trusted-resolver.cjs`: trusted server repository port. Requires unique verified enabled Page mapping; derives tenant/store from server-owned mapping alone; rejects wrong, missing or duplicate Page; validates store runtime; checks scoped read-only Catalog policy; rejects every product row whose `tenant_id` or `store_id` differs; Dry Run in-memory event replay guard; all outputs preview-only, no sends.
2. `qa/messenger-rich-v136m1/integration.cjs` minimal backward-compatible change: new `STORE_RLS_VERIFIED` catalog proof demands exact `row.store_id === resolved.storeId`. Legacy `ONE_STORE_PER_TENANT_VERIFIED` proof retained exclusively for existing V13.6M.1 scenario; it is **not adequate for multi-store**.
3. `qa/messenger-rich-v136m2/trusted-resolver.test.cjs`: 22 synthetic tests including SAME-TENANT Shop A/B where each Fanpage sees only its own SKU, HMAC, unregistered/duplicate/spoofed Page, store row missing or foreign, paused/expired shop, replay, no-send and price integrity.
4. `.github/workflows/v136m2-messenger-store-catalog-qa.yml`: Node 22 source/test job with no credentials, network transport, provider mutation or database writes.
5. No live Meta Graph call, no actual Supabase catalog read, no n8n graph change, no password or token usage, no merchant data changed.

## Architecture and authorization boundary
`raw Meta POST` → `exact-body HMAC check` → `server Page binding lookup (unique, verified, active)` → `tenant/store ownership (server only)` → `shop status + entitlement` → `signed postback/replay Dry Run` → `store-scoped Catalog capability` → `read-only rows, tenant + store exact` → `Rich UI preview, sendEnabled=false`.

Critical gate: `createTrustedPorts()` defaults to `mode='BLOCKED'`. `SYNTHETIC_QA_ONLY` tests are NOT hosted RLS proof. The reserved `HOSTED_STORE_RLS_VERIFIED` mode requires separately validated real-JWT and same-tenant store RLS evidence from a trusted backend; even then `hostedReady=false` in this code until a separate release gate. The repository here is an interface, **not** a live database connector. Provenance strings in synthetic tests are assertions of the fixture contract, not evidence that a live backend was verified.

**P0 migration dependency:** V14.2 Draft PR #86 owns canonical Store schema/RLS readiness. Keep Store/Knowledge migration, product ownership mapping and replacement of tenant-wide policies out of this PR. Require backup/restore, owner authorization and hosted user-JWT Shop A/B tests before connecting real DB. Do not bind `public.products` tenant-only data to multiple stores.

## QA acceptance
- Offline source and inherited suite: pending GitHub Actions result; only state PASS after checking exact run ID.
- Hosted Supabase real user-JWT Store A/B catalog: **BLOCKED**, no `store_id` and no approved verified RLS evidence.
- Messenger real Meta Page/PSID, actual Carousel/UI delivery, persistent menu: **NOT RUN** (approval required).
- Real persistent replay/outbox: **NOT IMPLEMENTED**, current replay guard is Dry Run in memory only.
- Published workflow / Meta send / DEMO order tools: **UNCHANGED**.

## Rollback and release gates
Rollback is to revert/close only the stacked Draft PR/branch; the previous V13.6M.1 commit remains the safe baseline. No DB backup restore or external message recall is needed because this PR contains source and QA only. Keep the existing inactive QA shadow.

Separate approval and VERIFIED evidence needed before moving beyond offline: (1) hosted staging canonical Store/catalog RLS + user JWT A/B isolation, (2) secure persisted Channel/Page→Tenant→Store registry, (3) durable idempotency/outbox, (4) Meta permissions/policy and authorized bounded live test, (5) explicit promotion approval. **Never merge, publish or deploy from this checkpoint alone.**
