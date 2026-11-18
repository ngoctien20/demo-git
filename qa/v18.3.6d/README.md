# TIEN404 AI — V18.3.6D

**Canonical Store Authority Design × Tenant/Store Membership Contract × Restrictive RLS Truth Table × Legacy Mapping Manifest**

- Status: `DESIGN CANDIDATE / NO DDL / NO BACKFILL / NO RELEASE`
- Date: 2026-11-18 JST
- Parent checkpoint: `V18.3.6C-LIVE-AUDIT-20261118`
- Parent PR: [#414 — V18.3.6C live schema audit](https://github.com/ngoctien20/demo-git/pull/414)
- Base branch: `qa/v1836c-live-schema-audit-20261118`
- Environment baseline: Supabase staging PostgreSQL 17.11; n8n Cloud read-only workflow inspection

## Objective

Define the canonical authority model for multiple Stores under one Tenant, the role/membership contract, a safe restrictive-RLS composition, and an evidence-based legacy mapping manifest. This is a design and documentation checkpoint only.

## Verified live blockers carried forward

1. `public.stores` and `public.store_memberships` do not exist.
2. The six Commerce tables (`products`, `orders`, `order_items`, `customers`, `conversations`, `messages`) have no `store_id`.
3. All 20 public tables have RLS; 31 public policies are permissive and zero are restrictive.
4. The current eight relevant Commerce/tenant policies are SELECT-only. `products_member_read` allows any active tenant member; the other five business-data read policies allow active tenant owner/manager. There are no current direct Commerce INSERT/UPDATE/DELETE policies for `authenticated`.
5. The live conversations table has `id`, `tenant_id`, `channel`, `external_reference` and `created_at`, but no provider installation ID; the new contract adds `channel_installation_id` so conversation provenance is tied to the verified Store installation.
6. `products_tenant_id_sku_key` enforces `UNIQUE (tenant_id, sku)`. This conflicts with a future Store-local SKU namespace and requires an explicit product decision before changing.
7. R1 QA has two Store/Bot scopes mapped to two different Auth Tenants (one Store scope per Tenant), not two Stores in one Tenant.
8. V18.3.6B is a successful PostgreSQL 17.12 disposable synthetic replay only. Its final audit expects three synthetic Stores, three memberships, six restrictive SELECT policies, ten composite FKs and a non-writable QA role. It does not prove live compatibility or a role-aware write policy model.

## Design decisions proposed

- Tenant membership is organization/control-plane authority; it does not automatically grant Commerce row access to every Store.
- Every person who reads or operates Store data must have an active explicit `store_memberships` row for that Store.
- Tenant Owner can manage Tenant/Store registry and membership administration, but needs explicit membership in each Store to read its customer/order/conversation data.
- Store Owner is scoped to one Store; Manager and Staff are narrower roles.
- Existing legacy rows with `store_id IS NULL` remain unmapped and invisible to normal Store actors.
- A restrictive Store boundary is required in addition to permissive role grants. Existing permissive policies cannot be assumed to be safe on their own.
- `service_role` and other `BYPASSRLS` roles are outside the RLS guarantee and require a separate trusted server-side command boundary.
- No caller-supplied `tenant_id`, `store_id`, provider account ID, or editable user metadata is accepted as authority.

## Files

- `CANONICAL_STORE_AUTHORITY_DESIGN.md`
- `TENANT_STORE_MEMBERSHIP_CONTRACT.md`
- `RESTRICTIVE_RLS_TRUTH_TABLE.md`
- `LEGACY_MAPPING_MANIFEST_SPEC.md`
- `MIGRATION_AND_ROLLBACK_PLAN.md`
- `OPEN_DESIGN_DECISIONS.md`
- `LEGACY_MAPPING_MANIFEST_TEMPLATE.csv` (header only; no real identifiers)

## Safety boundary

No Supabase schema or data was changed. No migration was applied. No real row-level PII, Auth sessions/JWTs, credentials, channel tokens or provider events were read. No n8n workflow was executed, edited, published or deactivated. No provider send or production action occurred.

## Admission decision

`V18.3.6D_DESIGN`: prepared for independent review.  
`CANONICAL_STORE_SCHEMA`: not implemented.  
`RESTRICTIVE_RLS_CUTOVER`: not implemented.  
`LEGACY_BACKFILL`: blocked pending row-level owner approval.  
`REAL_AUTH_A_B`: blocked and not run.  
`STAGING_DDL`, `PRODUCTION_WRITERS`, `PROVIDER_SEND`, `RELEASE`: NO-GO.

Official references:
- [PostgreSQL 17 row security](https://www.postgresql.org/docs/17/ddl-rowsecurity.html)
- [PostgreSQL 17 CREATE POLICY](https://www.postgresql.org/docs/17/sql-createpolicy.html)
- [PostgreSQL 17 constraints](https://www.postgresql.org/docs/17/ddl-constraints.html)
- [Supabase Row Level Security guide](https://supabase.com/docs/guides/database/postgres/row-level-security)
