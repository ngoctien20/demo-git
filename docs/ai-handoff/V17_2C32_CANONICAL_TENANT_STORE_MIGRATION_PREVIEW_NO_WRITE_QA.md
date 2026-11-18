# TIEN404 AI — V17.2C.32 Canonical Tenant/Store Authority Design × Orders Migration Preview × No-Write Compatibility QA

Date: 2026-11-18 JST. Continue from V17.2C.31 read-only audit, P1 Issue #402. User-selected Option A: Supabase Free, no paid branch, no hosted mutation, no customer data writes. Existing PR #392 remains DRAFT.

## 1. VERIFIED live baseline (metadata SELECT, not customer/order rows)
- Supabase staging ref `ifxlvrhyjhbzbrkdsida`: `public.orders`, `order_items`, `products`, `customers` all include `tenant_id` but no `store_id`; `tenant_memberships` is scoped by `tenant_id,user_id` only.
- `public.orders` has (id,tenant_id,customer_id,status,total_vnd,order_source,created_at,updated_at); tenant consistency via composite FK `(tenant_id,customer_id)`; `order_items` uses `(tenant_id,order_id)` and `(tenant_id,product_id)` FKs.
- `public.products`: currently `UNIQUE (tenant_id,sku)`; this does **not** support identical SKU codes independently maintained in two Stores of one tenant.
- Existing authenticated SELECT policies `orders_manager_read` and `order_items_manager_read` authorize active tenant owners/managers, without Store filter; authenticated direct Orders/Items writes denied by table grants.
- RPCs `merchant_paid_orders_daily` and `merchant_revenue_v3` report by tenant, not Store, so reporting contract must also migrate.
- No row-level production data was queried and no DDL or DML was executed on connected Supabase.

## 2. PROPOSED canonical domain model (requires separate architecture approval)
- **Tenant** = billing/subscription/customer organization, stable tenant_id. **Store** = independently authorized business location/shop, stable UUID store_id under a tenant. Existing two-tenant QA isolation remains valid; same-tenant multi-Store use is blocked until release gates pass.
- `stores (tenant_id,store_id,active)`: compound key to prevent cross-tenant Store association.
- `store_memberships (tenant_id,store_id,user_id,role,active)`: trusted server-assigned owner/manager/viewer roles, requires separately active `tenant_memberships`. No implicit tenant owner override of all Stores without an explicitly approved global-admin contract.
- `orders`, `order_items`, `products`, `customers` gain nullable `store_id` during expand. No default, no inferred backfill. Store ID is derived from trusted server/channel binding, never from arbitrary channel message, browser form, or LLM.
- Composite foreign keys `(tenant_id,store_id,order_id)` for order items, `(tenant_id,store_id,product_id)`, and `(tenant_id,store_id,customer_id)` for orders prevent cross-Store joins once Store IDs are populated.
- Store-specific SKU uniqueness `UNIQUE(tenant_id,store_id,sku)` is a **later contract phase**, not applied now: existing `UNIQUE(tenant_id,sku)` must remain until a verified data compatibility/rollback plan is approved.
- Tenant-level aggregated reporting and merchant-wide overviews must be separately authorized; default Store dashboards and orders read only exact Store. Inventory, pricing, customer consent and notifications need matching Store scope.
- Channel binding is a protected server table keyed by verified tenant/store/channel/bot integration identity with provenance. Messenger, Zalo, Web cannot nominate another Store through untrusted payload.

## 3. Implemented in Draft PR — ONLY ephemeral SQL preview
Files:
1. `qa/v172c-rpc-closure/v172c32-ephemeral-current-commerce-baseline.sql` reproduces essential current tenant-only schema, grants, composite tenant FKs, and synthetic A/B/C actors on GitHub ephemeral Postgres 17; **not a production schema export**.
2. `qa/v172c-rpc-closure/v172c32-store-authority-expansion-preview_NOT_EXECUTED.sql` is a SQL candidate scoped **only to `tien404_v172c32_preview` schema**, guarded against missing fixture, adds Stores / Store Memberships, nullable Store IDs, compound FKs, replaces old permissive tenant SELECT policies atomically with Store-scoped RLS, and preserves authenticated write denial.
3. `qa/v172c-rpc-closure/v172c32-no-write-store-migration-preview-drill.sh` refuses any remote/non-local or non-postgres database, proves cross-Store baseline, runs isolated candidate, checks no auto-backfill and permission boundaries, manually maps a few synthetic row IDs from **explicit synthetic fixture provenance only**, verifies RLS/FKs, and tests revocation + legacy SKU constraint.
4. Existing `.github/workflows/v172c15-ephemeral-postgres-qa.yml` extended with `Tenant-to-Store migration preview and compatibility QA (ephemeral only; NOT hosted)` step. No Supabase branch, subscription, credential, Auth, actual Orders or n8n altered.

## 4. TESTED CI evidence — code HEAD `089bcea426d4e0ae9ec72a3b5bf8f08caaa9496d`
- Ephemeral PostgreSQL 17 QA run **[44236176760](https://github.com/ngoctien20/demo-git/actions/runs/44236176760) SUCCESS**, including new migration-preview step.
- Protected Consent / Source-Only QA **[44236175707](https://github.com/ngoctien20/demo-git/actions/runs/44236175707) SUCCESS**.
- RPC Privilege Source-Only QA **[44236175681](https://github.com/ngoctien20/demo-git/actions/runs/44236175681) SUCCESS**.
- Baseline demonstration: both synthetic tenant 1 actors could read synthetic A/B/legacy orders under the tenant-only SELECT policy.
- With candidate Store RLS and no backfill, all four synthetic legacy Orders were **hidden**; after explicitly binding only known synthetic rows, A reads A, B reads B, C reads C, and the unmapped legacy order stays invisible.
- Compound FKs reject mismatched Store order→product and order→customer references; clients cannot directly mutate Orders or grant Store membership; Store or Tenant revocation denies immediately.
- Existing tenant-level SKU uniqueness remains and deliberately rejects same SKU repeated across Stores: **known compatibility gap not silently repaired**.
- These are local PostgreSQL tests with emulated signed-claim context, **not** real Supabase JWT/GoTrue or actual Commerce Orders tests.

## 5. Migration and release plan — PROPOSED, not applied
**Phase 0: admission/freeze** — choose canonical 1 Tenant:many Stores model explicitly; inventory all dependencies, channel/bot mappings, client routes, n8n service-role writes, current customer consent. Freeze same-tenant multi-Store onboarding pending resolution; store metadata/counters only, no customer/export leakage. Backup/recovery permission and evidence mandatory.

**Phase 1: EXPAND only** — after separate approval and validated restore on approved isolated environment, add Stores, trusted membership, nullable Store columns, composite keys and indexes. No Store backfill by tenant inference. Verify zero additional public grants. Legacy tenancy remains single-Store enforced while old RLS exists.

**Phase 2: PROVENANCE MAPPING** — for every old order/product/customer/item, record an authorized source mapping from immutable external channel/shop identity, signed owner consent or manually reviewed operator evidence. Unmapped/ambiguous rows stay quarantined and are not exposed to new Store-scoped clients. Never set missing Store to a default value automatically.

**Phase 3: TEST AND ATOMIC READ CUTOVER** — test session-current Auth A/B, tenant+Store SELECT policies, cross-Store FK, revocations, direct/privileged write flows, revenue RPCs, notification outbox and all channels against isolated fixture; atomically remove old permissive tenant policies when adding new Store policies. Merely ADDING a new permissive Store policy while old tenant policy remains would not close BOLA. New policy would hide unverified Store=NULL rows; plan explicit customer-facing compatibility route with independent authorization before applying cutover.

**Phase 4: CONTRACT** — only after all rows mapped and cross-channel negative QA passes, enforce Store NOT NULL on relevant new data, adapt SKU unique key to Store scope with reviewed duplicate resolution, replace tenant-level report behavior and deprecate old APIs. Update migration history via approved CLI workflow, not manual untracked SQL on remote.

**Rollback constraints:** restore against approved isolated baseline and/or roll back feature gate only where same-tenant Store A/B has never been opened; restoring the permissive tenant RLS once multiple Store owners are onboarded may reopen cross-Store reads, so requires security approval. Do not blindly DROP Store columns or recombine Stores if new scoped rows exist.

## 6. Risk and status matrix
- VERIFIED: live catalog of key columns/FKs/uniqueness, tenant-only RLS and protected direct-write privileges from V17.2C.31. No source of true Store ownership for old rows was established.
- IMPLEMENTED: isolated source-only SQL preview + compatibility drill + workflow step in Draft.
- TESTED: 3/3 GitHub CI PASS on code commit above, including actual isolated Postgres DDL/RLS behavior.
- PROPOSED: 1 Tenant:many Stores multi-Store architecture, phased migration, API/notification/report changes.
- BLOCKED: production schema migration, real session/consent, legacy Store provenance, privileged writer audit, independent reviewer, backup restore/approved hosting.
- NO-GO: Supabase data/schema changes, hosted real JWT Store A/B, production Messenger/Zalo/Commerce promotion.

Source references: https://supabase.com/docs/guides/database/postgres/row-level-security ; https://supabase.com/docs/guides/deployment/database-migrations .
