# TIEN404 AI — V13.6M.1 Messenger Rich UI Integration Candidate

**Date:** 2026-11-15 JST. **Status:** EXPERIMENTAL / DRAFT / NO SEND / NO PRODUCTION.  
**Base source:** Draft PR #87, HEAD `249633661108feb9062ccfd27ab4b5ea7c9889c2`.  
**New branch:** `work/v136m1-messenger-rich-integration-candidate-staging-20261115`.  
**Current n8n QA:** [TIEN404_MESSENGER_RICH_UI_CANDIDATE_V13_6M1_NO_SEND](https://ngoctien20.app.n8n.cloud/workflow/X0MwwQ7LRUqfOVjM), ID `X0MwwQ7LRUqfOVjM`; folder `90_QA - DIAGNOSTICS` in Personal project `WW82YsCCaAxGC9dp`. Workflow is **Inactive**. **It is not a full physical 27-node copy**: it is a bounded, deliberately disconnected *shadow integration harness* with synthetic inputs and no external trigger, rather than a clone carrying live credentials and Send API nodes.

## 1 — Audit snapshot VERIFIED

**Production-adjacent Messenger DEMO (read-only):**
- `TIEN404_MESSENGER_TEST` ID `Z7FdV7uDvApfbURQ`, **Active** at version `d5c96b6b-d790-4270-8b0f-d0ebdd8bbd92`, 27 nodes.
- Meta webhook GET/POST, HMAC verify, echo/filter, event dedupe and Text Send API already work. The SEND node `Send Messenger Reply - CONFIGURE TOKEN` remains enabled in the original; **untouched**.
- `Extract Messenger Text` maps generic Postback into greeting, without routing `postback.payload` / `message.quick_reply.payload`. Products come from **DEMO Google Sheets** and order tools are DEMO.
- This cannot safely serve multiple real shops without a server-verified Page→Tenant→Store mapping and Commerce catalogue.

**Supabase staging metadata (read-only):**
- `public.products` currently contains `id uuid`, `tenant_id uuid`, `sku text`, `name text`, `price_vnd bigint`, `stock_on_hand integer`, `is_active boolean`, timestamps. **No `store_id` or `image_url`** in this table.
- `public.tenant_memberships` is tenant-scoped; there is no confirmed per-store catalog binding in these tables. Do not claim cross-store safety for two shops sharing a tenant.
- Therefore V13.6M.1 **cannot yet perform an authorized live read of shop-specific catalogue**. It uses a strict port and *synthetic data* to test the real column contract. To connect to live staging, server must prove that tenant maps to exactly one store (or a new approved store-level schema/RLS), and supply an audited read-only store catalog port.

**Meta documentation:**
- Official Messenger Quick Start: <https://developers.facebook.com/docs/messenger-platform/getting-started/quick-start>
- Official Meta Postman API collection: <https://www.postman.com/meta/messenger-platform-api/overview>
- Generic Template: <https://www.postman.com/meta/messenger-platform-api/request/yiyp7vp/generic-template> (Meta examples)
- Persistent Menu requires a separate Messenger Profile API mutation and Page permission, **not** a `/messages` response. No profile mutation here.
- Text/Quick Replies/Generic Carousel and Page-level Menu action semantics are different; parse only verified Meta payloads, never take arbitrary text as trusted action or send outside applicable messaging policy.

## 2 — IMPLEMENTED

1. `qa/messenger-rich-v136m1/integration.cjs` adds a **pure, dependency-injected integration** from raw Meta webhook HMAC to trusted Page→Tenant→Store binding, shop status/entitlement, signed Postback or Quick Reply, replay guard, verified catalog and Meta Rich UI payload **preview**.
2. `qa/messenger-rich-v136m/adapter.cjs` preserves previous 53 scenarios but allows image-free product card proposals (real `products` has no image). It never invents image URLs.
3. `mapCatalogRecord` maps exactly the verified Supabase columns, accepts safe integer or decimal text `bigint`, rejects prices like `159.000đ` and cross-tenant rows. Fails closed when missing proof `ONE_STORE_PER_TENANT_VERIFIED` or non-read-only catalog.
4. `processCandidate` verifies raw HMAC `x-hub-signature-256`, Page ID + sender PSID, event time window, shop enabled + subscription, HMAC-signed button payload, and replay guard. Outputs remain `previewOnly=true`, `sendEnabled=false`, `allowedOrderWrites=false`.
5. Menu's Page-level postbacks are allowed only for read-only catalog browse / staff inquiry; tracking orders requires user login. Requests for human handoff are *proposals only* — no Messenger send, staff notification or conversation writes.
6. `qa/messenger-rich-v136m1/integration.test.cjs`: positive/negative coverage of cross-shop, spoofed Page/PSID, money, missing store proof, replay, revoked shop, expired subscription, forged callback and no-send.
7. `.github/workflows/v136m1-messenger-integration-qa.yml`: source & inherited 53 adapter tests plus Chromium no-network preview. No credentials, no Meta API calls.

**n8n isolated integration shadow (created, inactive):**
- Workflow ID `X0MwwQ7LRUqfOVjM`, 5 nodes:
  1. `Manual QA Only - NO WEBHOOK`
  2. `Synthetic Shop A Catalog Only`
  3. `Fail Closed Synthetic Tenant Gate`
  4. `Prepare Offline Rich UI Proposal`
  5. `Terminal No Send Assertion`
- No webhook/public endpoint, HTTP Request, OpenAI, Data Table write, API secret or assigned credential. **It cannot send messages even if manually executed.**
- Workflow SDK schema validated `valid=true`, `nodeCount=5`.
- QA execution `3834` initially failed because n8n Set `jsonOutput` required JSON text; corrected the **new isolated QA workflow only** after validating node config.
- QA execution `3835` returned `status=success`; read-only reinspection confirms `active=false`, `activeVersionId=null`, 5 nodes and zero credentials. No new Published version.

## 3 — QA criteria and remaining gates

**GitHub Actions TESTED:** [run 43708442661](https://github.com/ngoctien20/demo-git/actions/runs/43708442661), source commit `b424c224c7214335eed28c01b83bc6f7c01a962e`: 2/2 jobs **SUCCESS**. `candidate-source-and-regression` reports **94/94 PASS (53 V13.6M + 41 V13.6M.1), 0 FAIL**; static no-network/no credential assertions PASS. `inherited-rich-ui-chromium` reports **5/5 viewports × 4 modules PASS**, zero external/mutating requests and zero sends. [Legacy PR #87 suite 43708442706](https://github.com/ngoctien20/demo-git/actions/runs/43708442706) ran alongside (separately), not needed to substantiate new source tests. These are synthetic offline tests only, not real Meta delivery.
**n8n test:** execution `3835` status SUCCESS using pinned *manual trigger only*; Set and Code nodes executed internally. Because input is synthetic, it does NOT verify a real shop, Page, sender, message delivery, Meta UI or Supabase catalog read.

**P0 gaps:**
- Real trusted Page→Tenant→Store resolver and evidence of store-level isolation, including two shops under the same tenant.
- Product source: current table has tenant scope but not store. Real image URLs absent; image-free generic cards require a subsequent Meta rendering test before send.
- Authoritative staff and subscription entitlements, bot pause and channel permission registry.
- Persistent event idempotency keyed by Page/PSID/event and durable outbox after verified order; no replay state write was authorized.
- Binding Meta App/Page permissions, 24-hour window and up-to-date Meta policies.
- Separate approval for any new live Messenger send, Messenger Profile menu publish, credential use, published workflow modification, production, DB/RLS alteration and subscription/payment change.

## 4 — Rollback

- GitHub: close or revert new stacked Draft PR only. PR #87 and gh-pages remain unchanged.
- n8n: leave `X0MwwQ7LRUqfOVjM` **Inactive**, or archive isolated QA workflow under a future explicit cleanup approval. Its creation never replaced original `Z7FdV7uDvApfbURQ`.
- No database restore, real order reversal, customer refund, credential rotation or provider message recall required.

## 5 — Next proposed sequence

1. Stage an independent **trusted server Page→Shop resolver** using already verified existing customer/shop registries. Do not use DEMO Sheets for Commerce.
2. Create an authoritative read-only catalog API with *store-scoped* permission or signed one-store-per-tenant proof, then connect it through a secure port; run same-tenant two-store negative tests.
3. Build actual disconnected webhook parser/router clone only after signature raw-body sourcing and idempotency storage are verified; QA with synthetic signed webhook.
4. QA one bounded Meta message (Carousel/Quick Replies) only when separate approval grants live sending, recipient, window and permissions. Do not publish or integrate into Core Bot until QA and approval.
