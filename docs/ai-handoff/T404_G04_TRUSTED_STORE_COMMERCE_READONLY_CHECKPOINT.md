# TIEN404 G0.4 — Trusted Store Resolver × Commerce Read-Only Adapter Candidate

**Date:** 2026-11-17 JST  
**Lifecycle:** CANDIDATE / DRAFT / NO-SEND / NO-HOSTED-WRITE  
**Draft PR:** https://github.com/ngoctien20/demo-git/pull/255  
**Parent:** RPC10 G0.3 PR #247, pinned parent commit \`e25d8e203143e5079f6204ccacdefd44caafe604\`  
**Exact tested G0.4 code commit:** \`de4563dc6a9bb0d45cbd0e95ace48452298ced42\`  
**GitHub Actions:** https://github.com/ngoctien20/demo-git/actions/runs/44006127485

## 1. Source/Integration audit (VERIFIED, read only)

Connected n8n Published workflows:
- Commerce Tenant Resolver \`5Eeh8hbpsoNhuiVo\`, version \`a99c7350-7aea-446d-bdc5-4b10f52c3ad1\`: Tenant-only Code/Data Table read; no Store selector.
- Commerce Catalog \`oOOXicKXGkBskKqh\`, version \`e0f1e345-8e6c-40cb-8e6a-d7ad2eb92696\`: Tenant-only read.
- Commerce Cart \`igPOsSbEgd4NgtRA\`, version \`eff32e20-a6d0-4975-88b8-107eae752b4b\`: Tenant-only read.
- V3 Business Core \`Y0WLykMtNAldbgL0\`, version \`3d8b7f89-2058-4a2a-8919-e5ff92c3c484\`: Tenant-only sandbox business rules.
- Messenger \`Z7FdV7uDvApfbURQ\` is Published and still uses legacy Google Sheets DEMO product lookup and HTTP Send Reply; it must not be treated as proven canonical Supabase Commerce.
- Eight connected Commerce n8n Data Table schemas (Channels, Tenants, Products, Orders, Audit, V3 Store Rules, Price Rules, Notification Outbox) all have \`tenantId\` but no \`storeId\` in current schema.

This is **a source-level coverage gap**, not an observed exploit or proof of an existing cross-Store leak.

## 2. IMPLEMENTED — candidate under \`qa/v152-g04\`

\`trusted-store-commerce-adapter.cjs\` exposes:
- \`createNoSendCommerceAdapter({verifyInbound,readInstallationBinding,authorizeStoreRead,readCatalogSnapshot,clock})\`.
- \`run({rawBody,headers,action,sku,quantity})\`, action restricted to **CATALOG_LOOKUP** and **CART_PREVIEW**. Arbitrary client \`tenantId\`, \`storeId\`, \`priceVnd\`, merchant roles, discount, wholesale or order-write properties are structurally rejected.
- Provider event attestation is an **injected dependency**, not a live provider-signature verifier in this module. Merchant installation mapping must be supplied by an independently controlled server registry.
- Exact canonical Tenant+Store UUIDs, installation account/channel, registry version, bot profile, active/expiry/revocation, merchant authority and subscription gates are checked.
- Catalog readback is valid only when scoped to both Tenant AND Store; every product must match both IDs, have unique SKU/item ID, integer VND and nonnegative inventory.
- Before returning a result, the adapter **rechecks installation and Store policy**, catching revocation/version drift during async catalog reads. A true transactional/JWT/RLS guarantee still requires a future server.
- A small **ephemeral/in-memory replay guard** prevents repeat and concurrent duplicate event handling within one test adapter instance. It is not durable/multi-worker replay protection.
- Catalog-only response contains selected item, availability and verified per-Store retail price. Cart preview contains server-sourced unit price, VND total, SKU/quantity, catalog revision and mandatory customer confirmation/commit repricing flags.
- **Never** calls actual model, provider, host DB, order creation, stock update or credentials. Returns hard \`canPublish:false\`, \`canCreateOrder:false\`, \`hostedWrites:0\`, \`providerSends:0\`, \`actualProviderSignatureVerifiedHere:false\`, \`actualJwtVerifiedHere:false\`.
- Wholesale customer-tier pricing, durable conversation identity, real order creation and notifications remain intentionally **out of scope**. Do not treat the preview as an accepted order.

\`trusted-store-commerce-adapter.test.cjs\`: 76 synthetic UAT/negative cases. Fixtures:
- Shop A and Shop B share Tenant T1 and SKU **A002**; A has fake price **159000 VND / stock 5**, B **259000 VND / stock 2**.
- Shop C in Tenant T2 shares SKU A002 but fake price **309000 VND / stock 8**.
- Test adapters simulate Messenger Page A/B, Zalo OA B, Zalo Bot A and Website C, all with invented test IDs and no real provider secret.
- Cross-Store item, wrong Tenant, mismatched Page, inactive subscription, revoked merchant, duplicate SKU, bad prices, overflow, replay, unsigned event and mid-read revocation all denied.

## 3. TESTED — exact code SHA receipt

GitHub Actions run **#44006127485** on code commit \`de4563dc6a9bb0d45cbd0e95ace48452298ced42\`:
- **G0.4: 76/76 Node22 tests PASS**.
- **Inherited RPC10 G0.1/G0.2/G0.3/source gates: 147/147 Node22 PASS**.
- **Total: 223/223 Node22 PASS; 0 failures.**
- **Both CI jobs SUCCESS.** The separate hosted-release gate verifies refusal and is not a deployment approval.
- Initial run #44006040281 had **75/76 PASS**, failing expected VND total overflow because JS MAX_SAFE_INTEGER alone was not a sufficient Commerce money bound. Fixed in code to check bounded VND preview total (<= 1e12) and reran exact source tests GREEN. This is real QA defect detection and fix, not hidden/relabelled test.

**Explicit NO-GO:** This does not prove real Meta/Zalo webhook signature, independent Page/OA owner, canonical hosted Store registry, private original 2+2 Product/Order ownership, real Supabase Auth JWT/RLS, PostgREST, multi-worker replay, wholesale pricing, uptime/SLO, provider transmission, billable model execution or a real Commerce order.

## 4. Integration team next steps (PROPOSED — separate authorization)

1. Reuse V17.1 native ingress QA PR #243 for provider-specific signed message adapters, and V17 CBOT PR #248 for private cross-channel identity/image retrieval; do not duplicate or blindly merge competing branches.
2. Implement **server-held** \`provider + installationRef\` to \`tenantUuid + storeUuid + botProfileVersion + registryVersion\` only after actual independent merchant ownership and private registry approval. No source authority from client hints, Tenant alias or LLM output.
3. Extend Commerce Catalog/Cart/Business Core read clients and store data tables to carry \`tenantId + storeId\`. Test caller drift/revocation, price policies, SKU uniqueness per Store and protected stock. Do not modify Published before independent change review.
4. Plan real Postgres Store ownership + RLS/FK/privileged RPC changes only after current M0 recovery accepted and original four-row Store Owner attested. JWT Owner A/B/Manager and same-Tenant Store negative tests are later gates.
5. Add a **durable server-side idempotency/replay guard** and verified customer identity before cross-channel order lookups or order writes.

## 5. Backup deferral and release gates

Owner requested to skip the **actual local-machine backup step** for this development iteration. RPC12 PR #244 records \`LOCAL_REAL_BACKUP_TASK=DEFERRED_BY_OWNER\`. Previous limited H11R archive milestone is preserved. This **does NOT** certify full current Auth/Storage/app backup/restore or authorize hosted migrations.

- **G0 real 4-row Owner**: BLOCKED.
- **G0.4 source-only adapter**: IMPLEMENTED and Node22 CI TESTED.
- **G1 disposable PG17 Store FK/RLS**: previously TESTED, not real hosted.
- **G2 current independently accepted restoration**: BLOCKED/DEFERRED step.
- **G3 real JWT UAT and provider signed integration**: NOT RUN.
- **Hosted RLS/DDL/RPC revoke/Published send/order writes**: NO-GO.

**Rollback:** Close child Draft PR #255. No live resource was changed; no hosted DB/credential/provider state to rollback.

**Checkpoint:** \`RPC10_G04_TRUSTED_STORE_COMMERCE_READONLY_CANDIDATE_223_NODE22_PASS__HOSTED_NO_GO\`.
