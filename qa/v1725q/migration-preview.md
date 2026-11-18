# V17.25Q — Store Scope Migration Preview (NOT EXECUTABLE)

**NO DDL / NO DML / NO BACKFILL / NO POLICY CHANGE / NO HOSTED MIGRATION.**

## 1. Current database evidence

Read-only staging inspection on PostgreSQL 17.11:
- `public.stores`: absent.
- `public.store_memberships`: absent.
- Store ID columns across current public schema: 0.
- Current relevant business tables: `products`, `orders`, `order_items`, `customers`, `conversations`, `messages`, `tenant_memberships`.
- RLS is enabled on all inspected relevant tables.
- Existing relevant SELECT policies reference `tenant_memberships` and `tenant_id`, not Store membership.
- Existing relevant `authenticated` grants are SELECT only. No new write grant is proposed here.
- Current deployed Products and Orders routes remain tenant-only.

Existing data counts from table metadata were small (Products 2, Orders 2; no customer/order-item/conversation/message rows reported in the inspected snapshot). Counts are not ownership proof. No row values or identifiers are copied into this preview.

## 2. Target data model

### `public.stores`
- `id uuid primary key`
- `tenant_id uuid not null references public.tenants(id)`
- `slug text not null`, `name text not null`
- `status text not null check status in ('active','paused','archived')`
- `created_at`, `updated_at`
- `unique (tenant_id, id)`, `unique (tenant_id, slug)`

### `public.store_memberships`
- `tenant_id uuid not null`
- `store_id uuid not null`
- `user_id uuid not null`
- `role text not null check role in ('owner','manager','staff')`
- `active boolean not null default true`
- `created_at`
- `primary key (tenant_id, store_id, user_id)`
- Composite FK `(tenant_id, store_id) -> stores(tenant_id, id)`.
- Composite FK `(tenant_id, user_id) -> tenant_memberships(tenant_id, user_id)`.
- Explicitly require active Tenant membership on every authorization decision. No implicit Store inheritance from Tenant Owner.

### Business table additions
Add `store_id` to:
- `products`
- `customers`
- `orders`
- `order_items`
- `conversations`
- `messages`

For child records, enforce same Store and Tenant with composite constraints:
- `products`: unique `(tenant_id, store_id, id)`; unique SKU `(tenant_id, store_id, sku)`.
- `customers`: unique `(tenant_id, store_id, id)`.
- `orders`: unique `(tenant_id, store_id, id)`; add `created_by_user_id` only if staff own-order read-back is approved.
- `order_items`: FK `(tenant_id, store_id, order_id) -> orders`; FK `(tenant_id, store_id, product_id) -> products`.
- `conversations`: unique `(tenant_id, store_id, id)`.
- `messages`: FK `(tenant_id, store_id, conversation_id) -> conversations`.
- Add index `store_memberships(user_id, tenant_id, store_id) WHERE active`, plus resource indexes beginning with `(tenant_id, store_id, ...)`.

Keep `tenant_memberships` tenant-level. Keep provider secrets, verified channel installation mappings, idempotency records and audit payloads in `app_private`; do not expose them through the Data API.

## 3. RLS and grants design

- Enable RLS on `stores`, `store_memberships` and every exposed business table.
- Explicitly grant only the required table privileges to `authenticated`; do not grant `anon`. Existing business tables currently have SELECT-only grants.
- `store_memberships` SELECT policy: `TO authenticated`, own `user_id = (select auth.uid())`, active membership. No direct client INSERT/UPDATE/DELETE in this phase.
- `stores` SELECT and business resource policies require the same actor to have an active Tenant membership and active Store membership matching both `tenant_id` and `store_id`.
- Effective role is least privilege between tenant role and store role. Owner/Manager/Staff actions follow the API contract.
- Use separate policies per command; `UPDATE` requires both `USING` and `WITH CHECK`.
- Use `(select auth.uid())`; never authorize from user-editable `user_metadata`.
- Avoid `SECURITY DEFINER` functions in exposed `public`. If a private privileged function is later proven necessary, isolate it in an unexposed schema, pin `search_path = ''`, schema-qualify every object and explicitly revoke default EXECUTE grants.
- Supabase Data API exposure is distinct from RLS. Changelog says new public tables are no longer auto-exposed by default from 30 Oct 2026; explicitly verify schema exposure and grants before enabling any client access.

### Atomic RLS cutover warning

PostgreSQL permissive policies combine with OR. The current tenant-only policies cannot remain permissive alongside new Store policies: doing so would preserve tenant-wide access. The eventual migration must replace/remove legacy tenant-wide policies in the same controlled transaction that activates Store-scoped policies, after mapping and tests are complete. Do not add a new Store policy and assume it narrows an existing policy.

## 4. Legacy row mapping — no default Store

Existing records contain `tenant_id` but no `store_id`. Do not assign every legacy row to:
- the first Store,
- the tenant Owner's currently selected Store,
- the only Store that happens to exist at migration time,
- a Store inferred from product names, phone numbers, channel sender IDs or message text.

Before any backfill, generate a private aggregate preview per table:
`total / verified_mappable / ambiguous / unmapped / orphaned / duplicate`.
Mapping evidence must identify the original Store from authoritative business records and receive owner confirmation plus independent review. Rows without verified Store ownership remain unmapped and inaccessible to Store-scoped clients until resolved. Never delete or silently move them.

## 5. Ordered rollout gates

1. **M0 recovery:** owner-approved backup scope, current backup, independent isolated restore/readback, checksums, Auth/Storage scope and reviewer. Current status NO-GO.
2. **Identity provenance:** independently verify the two original Owner identities and their intended Store memberships. No JWT supplied to GitHub.
3. **Disposable PostgreSQL 17:** reuse the existing P0D/P0N synthetic test lineage; test composite FK, role intersection, RLS SELECT/INSERT/UPDATE/DELETE truth tables and permissive-OR regression.
4. **Mapping preview:** aggregate only; no backfill until every mapping is evidence-backed and approved.
5. **Staging migration:** separate explicit approval after M0; additive schema, backfill, validate constraints, then atomic policy/grant cutover with rollback snapshot.
6. **Hosted Auth A/B:** real short-lived sessions in separate browsers; 31-case protected read-only suite; no customer writes or provider sends.
7. **API v2 release:** enable Store-aware routes only after origin protection and RLS proof; block v1 Products and Orders first.
8. **Production:** separate approval after regression, recovery, provider and billing gates.

## 6. Rollback

Before schema cutover, close/revert the source-only PR. After a future approved staging migration, rollback must restore the pre-migration snapshot and exact policy/grant state; do not attempt to reconstruct Store IDs by guessing. No rollback is needed for V17.25Q because it performs no hosted changes.
