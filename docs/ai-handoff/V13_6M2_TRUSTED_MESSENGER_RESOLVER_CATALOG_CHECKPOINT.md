# TIEN404 AI V13.6M.2 — Trusted Messenger Shop Resolver & Catalog Integration

**Checkpoint:** 2026-11-15 JST  
**Stage:** EXPERIMENTAL / DRAFT / OFFLINE / NO SEND / NOT RELEASED.  
**Parent:** Draft PR #88 (Messenger V13.6M.1), HEAD `193e25f7ae48ec7f1b70cfbdcc3ea624aa19206e`.  
**Current branch:** `work/v136m2-trusted-messenger-store-resolver-staging-20261115`.  
**Scope approved:** Design, safe Draft staging code, offline QA and readiness checks only. **No approval to apply Store/RLS/ACL schema or backfill; no Messenger live sends or publishing.**

## 1. Actual system audit — VERIFIED

- n8n `TIEN404_MESSENGER_TEST`, workflow `Z7FdV7uDvApfbURQ` still **Active** at `d5c96b6b-d790-4270-8b0f-d0ebdd8bbd92`; 27 nodes. Uses single demo Page + Google Sheets DEMO; AI tool workflow can create/update demo orders. **Do not attach Commerce tenant data to this workflow.**
- n8n Commerce Tenant Resolver `5Eeh8hbpsoNhuiVo` Active, 6 nodes, backed by Data Tables; it does **not provide approved, proven store-level resolution** for Messenger multi-shop.
- n8n `X0MwwQ7LRUqfOVjM` remains **Inactive**, 5 manual/synthetic nodes, no credentials and no send.
- n8n Commerce Channels Data Table `TIEN404_COMMERCE_CHANNELS` has `accountId`, `channelType`, `tenantId` but no canonical `storeId`; staging Merchant Channels table has `page_id`, `store_id` for notification routing but no authoritative tenant/owner authorization. Neither is a safe inbound Page→Store authority as-is.
- Live Supabase staging `ifxlvrhyjhbzbrkdsida`: **2 tenants, 2 products, zero Messenger tenant_agent_configs, zero Messenger channel_secrets rows**. No canonical `public.stores` / `public.store_memberships` or `public.products.store_id`. Products have tenant-only `products_member_read` policy; RLS and FORCE RLS currently enabled. Tenant-only policy cannot isolate two stores inside one tenant.
- V14.2 Store/RLS Draft PR #86 proposes canonical `public.stores`, `public.store_memberships`, and store-scoped `products`. Its migration is **NOT APPLIED**; backup and ownership/backfill approval gates remain unresolved. **Do not duplicate or bypass that migration plan.**
- No existing production/staging private Messenger Page binding registry confirmed. A separate audited `app_private.messenger_page_bindings` is proposed here. This is mapping metadata only, NOT an access-token store.

## 2. Implemented only in new Draft branch

- `qa/messenger-rich-v136m2/trusted-repository.cjs`
  - Has no network calls, credentials, Graph Send API, database writes or runtime dependency on Supabase SDK.
  - Uses a server-injected restricted read-only SQL driver, with static parameterized `SELECT` queries only. No direct browser-provided page/tenant/store selectors or external app secrets.
  - Probes canonical store schema, store_memberships, private Page mapping and product store_id before resolving anything; requires FORCE RLS for store/product/membership. **Real staging fails this gate.**
  - Private lookup: exact Page ID→single active, owner-approved, inbound-enabled tenant+store mapping, joining canonical store and requiring an active owner/manager membership. Duplicate, revoked or unapproved bindings fail closed.
  - Public shop slug/allowlisted HTTPS origins obtained from an injected trusted private config, never from Messenger payload or AI-generated text.
  - Shop status, pause and subscription must be backed by separately verified authoritative backend; absent/expired entitlement fails closed. **No subscription table is claimed to exist today.**
  - Product catalog read: `SELECT` by BOTH tenant_id + store_id, active store and active products, maximum 100 rows, exact integer VND, stock validated, no invented images/prices.
  - Offline replay guard explicitly DRY_RUN, no database write. Does not replace a durable idempotency/outbox engine needed for live operation.
  - Returns `STORE_RLS_VERIFIED` / `repositoryScope=SERVER_STORE_BOUND` only after approved schema gates, restricted port and output validation. The name is a **contract assertion in synthetic QA**, not proof that today's real hosted RLS passed.
- `qa/messenger-rich-v136m1/integration.cjs`: tightened to demand `repositoryScope=SERVER_STORE_BOUND` for STORE_RLS_VERIFIED proof. Legacy ONE_STORE_PER_TENANT_VERIFIED accepted for pre-existing **offline** fixtures only, never a live-authorization shortcut.
- `qa/messenger-rich-v136m2/trusted-repository.test.cjs`: scripted positive and negative tests, including Page A and Page B **within the same tenant but with different stores**, tenant crossing, revoked/unverified owner/page, malformed Page, forged Meta payload, unsafe price, disabled shop, expired entitlement, absence of store schema, and no Messenger send.
- `qa/messenger-rich-v136m2/PROPOSAL_ONLY_PAGE_BINDING_DO_NOT_RUN.sql`: review-only sketch with an unconditional `RAISE EXCEPTION` before any DDL. **Not a migration, NEVER RUN this as a migration.** Align actual versioned migration with V14.2 only after separate approval.
- `.github/workflows/v136m2-trusted-messenger-resolver-qa.yml`: 3 Node test suites (53+41+48 expected), mobile Chromium × 4 UI modules, static prohibition on credentials/network transport and inert SQL.

## 3. Security architecture

```text
Meta webhook raw body + X-Hub-Signature-256 [existing live verifier; not modified]
        ↓
Meta signature verified before database lookup  [candidate offline]
        ↓
app_private.messenger_page_bindings [PROPOSED, private, UNIQUE(page_id)]
        + public.stores [V14.2 PROPOSED]
        + public.store_memberships + tenant_memberships [V14.2 PROPOSED]
        ↓
Trusted server-issued Page / Tenant / Store / Sender context
        ↓
Authoritative shop status + entitlement + public URL allowlist [BACKEND NOT CONNECTED]
        ↓
Scoped public.products by (tenant_id,store_id) [STORE SCHEMA NOT DEPLOYED]
        ↓
V13.6M.1 signed Postback/Quick Reply → Carousel or safe answer PREVIEW ONLY
        ↓
NO_SEND / no order mutation / no Messenger Profile menu publish
```

**Critical warning:** Supabase service_role/secret keys BYPASS RLS. The future Bot backend must use a restricted server role or an independently authorized, parameterized private read interface plus hosted negative tests; **do not call a service-role SELECT by itself "RLS tested"**. The Meta signed webhook is not a Supabase user JWT.

## 4. QA proof and blockers

**TESTED source commit `b75d9d91e23755ec46866dbc682936edbcf44ddc`:**
- [V13.6M.2 restricted repository & Chromium run 43710223892](https://github.com/ngoctien20/demo-git/actions/runs/43710223892): **142/142 Node tests PASS, 0 FAIL** (53 original Rich UI, 41 V13.6M.1, 48 new SQL/Store resolver tests); static no-network/no token/blocked SQL proof PASS; **5/5 viewport × 4 modules** Chromium preview PASS, zero sends/mutations/external requests. Both jobs SUCCESS.
- [V13.6M.2 high-level interface contract run 43710223860](https://github.com/ngoctien20/demo-git/actions/runs/43710223860): **116/116 Node tests PASS** (53+41+22 independent resolver tests), no network, no sends, default-deny PASS. Job SUCCESS.
- [Inherited V13.6M.1 run 43710223865](https://github.com/ngoctien20/demo-git/actions/runs/43710223865): both source and Chromium regression jobs SUCCESS.
- Important: `trusted-resolver.cjs` (abstract repository API, 22 tests) and `trusted-repository.cjs` (parameterized SQL server-port contract, 48 tests) are **two complementary source-only layers**, not yet composed with a real database connection or Page binding. Do not describe either as a production resolver. This remains **EXPERIMENTAL**, not RELEASED.
- These tests use fictional tenant/store/product and HMAC fixtures. They do not prove hosted Shop A/B store RLS, Meta message delivery or active owner-approved Page mapping.
**Hosted:** BLOCKED. No `public.stores`, store memberships, product store_id or Page binding registry; no approved backup restore evidence. The code must not be wired to Messenger Published, n8n credential, Supabase HTTP endpoint, Render, Cloudflare or a customer.

**Explicit additional approvals required before live staging read:**
1. Verified restorable backup and accepted rollback plan for V14.2; approve canonical store schema, verify owner assignment of 2 Products + 2 Orders, then independently approve RLS change and hosted signed Shop A/B QA.
2. Separate approval to create private Messenger Page→Store binding, validate actual Fanpage ownership, one-to-one mapping, explicit consent and audit, restricted read role and security review. No `channel_secrets` reuse.
3. Authoritative shop feature/subscription/pause backend and public site origin verification (not imaginary success flags).
4. New opt-in approval for Messenger provider send, Page token use, Meta App permission and messaging-window verification. No Meta sends now.

## 5. Rollback and checkpoint

- Revert/close stacked new Draft PR. Parent PR #88 unchanged.
- No database, credential, customer, payment, Meta, Cloudflare, Render, production or Published n8n rollback needed because no such writes occurred.
- Old n8n QA shadow `X0MwwQ7LRUqfOVjM` remains Inactive and unchanged.

## 6. Next engineering milestone

After V14.2 schema release gate is approved and verified, install the **read-only backend Page binding repository** behind a private server, test real Shop A/B with distinct Messenger Pages and same-tenant two-store negative cases, and connect the preview renderer to a separate *Inactive* n8n integration workflow. Only then evaluate a tightly bounded live Rich UI pilot.
