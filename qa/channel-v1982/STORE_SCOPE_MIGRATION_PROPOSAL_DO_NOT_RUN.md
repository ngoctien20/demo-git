# TIEN404 V19.8.2 — Store Scope Migration Proposal (DO NOT EXECUTE)

**Status:** PROPOSED / NOT APPLIED. **This is a Markdown design preview, not a migration script.**
Target: Supabase staging `ifxlvrhyjhbzbrkdsida`. No database changes are authorized by this document.
Created from 2026-11-19 read-only schema, RLS policy and index inspection.

## 1. Baseline (VERIFIED)
- Current QA Shop A tenant slug: `qa-staging-shop-a-20261110` (one active owner membership).
- QA Shop B tenant slug: `qa-staging-shop-b-20261110` (two active owner memberships).
- **These are TWO TENANTS, not Store A and Store B within a shared tenant.** They cannot prove same-tenant isolation.
- Public tables `products`, `customers`, `orders`, `order_items`, `conversations`, `messages` have `tenant_id`, no `store_id`.
- `tenant_agent_configs` is tenant/channel scoped; store/channel uniqueness and writer compatibility must be redesigned separately.
- Public RLS SELECT policies are tenant-wide (products: any active tenant membership; orders/messages/conversations: owner/manager tenant membership).
- Products have UNIQUE(`tenant_id`,`sku`); the same SKU at two Stores under one Tenant is not currently supported.
- Order items link to both products and orders; messages link to conversations. Every chain must enforce tenant **and** store match.

## 2. Release flags and dependencies
Before ANY schema change: confirmed schema backup + restore test, approved maintenance window, writer caller inventory and rollback owner.
Keep `ZALO_AUTO_REPLY_ENABLED=false`, `COMMERCE_STORE_SCOPED_READ_ENABLED=false`, `ORDER_WRITE_ENABLED=false`, `PROVIDER_SEND_ENABLED=false`.
Existing n8n Zalo V19.7I receipt-only webhook continues untouched. Never bind Bot ID based on user-supplied message text or deeplink alone.

## 3. Proposed migration sequence

### Phase E1 — Canonical stores and memberships (disposable staging only)
Proposed SQL structure below is **illustrative**, requires full index/FK/RLS/grant review before any execution:

```sql
-- PREVIEW, DO NOT RUN. Names and referential constraints require review.
create table public.stores (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  slug text not null,
  display_name text not null,
  lifecycle text not null default 'disabled'
    check (lifecycle in ('disabled','staging','active','paused')),
  created_at timestamptz not null default now(),
  unique (tenant_id,id), unique (tenant_id,slug)
);

create table public.store_memberships (
  tenant_id uuid not null,
  store_id uuid not null,
  user_id uuid not null references auth.users(id),
  role text not null check (role in ('owner','manager','staff')),
  active boolean not null default false,
  approved_at timestamptz,
  primary key (tenant_id,store_id,user_id),
  foreign key (tenant_id,store_id)
    references public.stores(tenant_id,id),
  foreign key (tenant_id,user_id)
    references public.tenant_memberships(tenant_id,user_id)
);

alter table public.stores enable row level security;
alter table public.store_memberships enable row level security;
revoke all on public.stores, public.store_memberships from anon, authenticated;
-- Explicit READ grants and safe policies only after Owner A/B JWT testing.
-- All INSERT/UPDATE/DELETE privileges must remain server-approved, NOT tenant self-assigned.
```

Do not assume a `tenant_memberships` row proves Store ownership. Store membership must require explicit owner-verified provisioning from a trusted server-side action. Avoid a recursive RLS policy on the membership table.

### Phase E2 — Separate provider installation registry
Proposed protected `app_private.channel_installations` (not exposed to PostgREST) fields:
`installation_id uuid`, `channel` (separate `zalo_bot` and `zalo_oa`), `external_bot_ref`, `tenant_id`, `store_id`, `lifecycle`, `owner_verified_at`, `verified_by`, `credential_ref` (reference only), `revoked_at`.

- Server obtains Bot identity from provider + verified credential binding.
- Owner A/B signs in as a real merchant, chooses canonical Store and authorizes installation.
- Review unique active installation constraints, transfer/revocation policy and tenant/store FK.
- NEVER store bot token, secrets, API keys or JWT in a public table or in a Git artifact.

### Phase E3 — Add nullable store scope in an EXPAND phase
```sql
-- PREVIEW ONLY. Existing rows will be NULL and MUST NOT be treated as readable in new Store read paths.
alter table public.products      add column store_id uuid;
alter table public.customers     add column store_id uuid;
alter table public.orders        add column store_id uuid;
alter table public.order_items   add column store_id uuid;
alter table public.conversations add column store_id uuid;
alter table public.messages      add column store_id uuid;
-- tenant_agent_configs: separate redesign; do not silently break existing key.
```

During EXPAND, existing permissive tenant-wide RLS still exposes tenant data to existing callers. **Do not enable multi-Store hosted customer reads** merely because columns now exist. Candidate Store reader must fail closed for `store_id IS NULL`.

### Phase B — Owner-approved row lineage and backfill
- Capture row counts, FKs, unique keys, triggers, RLS policies, server RPC callers and table references.
- Map every existing record to a verified Store via a server-only approved mapping.
- For a tenant with **more than one Store**, do not backfill based on tenant alone; require per-row provenance and order/conversation ancestry.
- For a tenant with exactly one Store, STILL require owner-approved canonical Store verification and frozen writers; never treat `COUNT(stores)=1` alone as permission.
- Derive `order_items.store_id` from **both** referenced Order and Product and require equality; derive `messages.store_id` from referenced Conversation.
- Any mismatch, unassigned row, unknown writer, or duplicate Store/SKU triggers NO-GO and must be reconciled before cutover.
- Preserve a versioned backfill ledger of pre-change values and row counts; do not store customer PII in QA evidence.

### Phase C — Constraint/index and RLS cutover
**ONLY after all Store columns backfilled and all writers upgraded.**

1. Create indexes on (tenant_id,store_id), (tenant_id,store_id,sku), membership lookups and notification idempotency; use an approved lock/index-concurrency plan.
2. Add unique keys (tenant_id,store_id,id) for Parent Products, Orders, Conversations and Customers; enforce composite FKs on children `order_items`, `messages`, `orders.customer_id`, etc.
3. Replace UNIQUE(tenant_id,sku) with reviewed per-Store SKU uniqueness **only after all legacy readers/writers and duplicate conflicts have been tested**. Otherwise Store A/B with same SKU may conflict or be read ambiguously.
4. Validate Store is NOT NULL for all protected hosted rows and that no child references a parent of another Store. Then enforce NOT NULL.
5. **Replace**, do not merely append, existing tenant-only permissive RLS SELECT policies. PostgreSQL permissive policies combine with OR; leaving an old tenant-wide policy would bypass the new Store policy.

Illustrative target `products` SELECT rule (not production-ready until membership policy audit):

```sql
-- PREVIEW ONLY. Atomic replacement required, not an additional permissive policy.
-- drop policy if exists products_member_read on public.products;
create policy products_member_read_store on public.products
for select to authenticated
using (
  store_id is not null and
  exists (
    select 1 from public.store_memberships sm
    join public.tenant_memberships tm
      on tm.tenant_id = sm.tenant_id and tm.user_id = sm.user_id
    where sm.tenant_id = products.tenant_id
      and sm.store_id = products.store_id
      and sm.user_id = (select auth.uid())
      and sm.active = true and tm.active = true
  )
);
-- Likewise replace every tenant-wide SELECT/UPDATE/INSERT/DELETE policy.
-- Re-evaluate referenced membership RLS to avoid recursion and accidental denial.
```

6. Test Owner A, Owner B, combined same-tenant Store A/B, manager role, revoked membership, expired sessions, and authenticated unaffiliated user. Test both API and SQL/RLS. A success via service_role is NOT acceptable RLS evidence.
7. Protected catalog reader must accept only server-bound Store, never `store_id` from conversation text.

### Phase D — Promotion gate
Only after real owner-session A/B proofs, Store-scoped RLS pass, durable idempotency and safe catalog data:
- Enable `COMMERCE_STORE_SCOPED_READ_ENABLED` in private staging behind reviewed release flag.
- Preview AI response **NO SEND**.
- Request separate explicit approval for **one** QA Send API message, then order pending workflow and owner revenue alerts. Do not mix activation scopes.

## 4. Rollback (not equivalent to removing Store restrictions)
- Pre-cutover: keep new flags OFF and legacy runtime unchanged. Revert candidate branch without touching hosted data.
- During migration: STOP writers, restore verified backup or replay rollback ledger in a disposable snapshot; do not delete customer data without owner approval.
- Post-cutover: disabling the new reader is a safe fail-closed rollback. **Never restore old tenant-wide RLS access for a multi-Store tenant**.
- Never drop `store_id` with assigned production records as an automatic rollback. Must review data loss and request separate authorization.

## 5. Evidence requirements
- Exact versioned SQL/commit SHA, migration checksum and source database version.
- Consistent backup, pre/post table counts, FK and null audits, real Owner A/B signed sessions (IDs redacted).
- RLS allow/deny matrix and failed write attempts, stored as metadata only.
- Failed test, missing owner proof or ambiguous Store mapping => **BLOCKED**.

This document is intentionally NOT executable. No Supabase migration has been applied.
