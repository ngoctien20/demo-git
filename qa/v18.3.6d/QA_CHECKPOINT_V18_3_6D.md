# V18.3.6D — QA Checkpoint

**Checkpoint:** `V18.3.6D-CANONICAL-STORE-DESIGN-20261118`  
**Date:** 2026-11-18 JST  
**Status:** `DESIGN CANDIDATE / NO DDL / NO BACKFILL / NO RELEASE`

## Parent and baseline

- Parent audit: V18.3.6C, Draft PR #414.
- Parent branch: `qa/v1836c-live-schema-audit-20261118`.
- Supabase staging project ref: `ifxlvrhyjhbzbrkdsida`.
- Last verified database version: PostgreSQL 17.11.
- Live canonical Store tables: 0.
- `store_id` columns across six Commerce tables: 0.
- Public RLS baseline: 20/20 public tables RLS-enabled; 31 permissive policies; zero restrictive policies.
- Current six Commerce table policies are SELECT-only; products allows active tenant members, other five business-data tables allow active tenant owner/manager.
- Existing `products_tenant_id_sku_key`: `UNIQUE (tenant_id, sku)`.
- Existing `public.save_merchant_product` is a SECURITY DEFINER RPC executable by authenticated and is not Store-aware; it is a writer gate before any Store NOT VALID check.
- R1 synthetic Store/Bot mapping: two scopes to two different Auth Tenants, not same-Tenant Store A/B.
- n8n Commerce DataTables: 16 total; 14 tenant-scoped; zero Store ID/Store Key columns.
- Messenger retains active legacy Google Sheets order writer tools; Commerce Core is sandbox/read-only.

## Design decisions

- Tenant Owner does not implicitly read all Store Commerce rows; explicit Store membership is required.
- Store Owner, Manager and Staff have distinct Store-scoped permissions.
- Store channel authority comes from verified provider installation, not a user/customer-supplied Store ID.
- All six Commerce tables require Tenant+Store ownership and composite child FKs.
- Restrictive Store boundary composes with existing permissive policies; command-specific permissive grants are still required.
- Physical DELETE remains denied; controlled operations handle lifecycle.
- Legacy NULL Store rows remain quarantined/invisible; no auto mapping.
- SKU uniqueness is a business decision: recommended Store-local `UNIQUE NULLS NOT DISTINCT (tenant_id, store_id, sku)`, but the current Tenant-global unique constraint is not changed.
- Service-role/BYPASSRLS writer path is separate from authenticated RLS and requires a trusted adapter.

## Files in this checkpoint

1. `README.md`
2. `CANONICAL_STORE_AUTHORITY_DESIGN.md`
3. `TENANT_STORE_MEMBERSHIP_CONTRACT.md`
4. `RESTRICTIVE_RLS_TRUTH_TABLE.md`
5. `LEGACY_MAPPING_MANIFEST_SPEC.md`
6. `LEGACY_MAPPING_MANIFEST_TEMPLATE.csv` (header only)
7. `MIGRATION_AND_ROLLBACK_PLAN.md`
8. `OPEN_DESIGN_DECISIONS.md`
9. `QA_CHECKPOINT_V18_3_6D.md`

## QA result

- GitHub changed paths are confined to `qa/v18.3.6d/`.
- Static content inspection: no unresolved sentinel placeholders; Markdown code fences balanced; manifest CSV contains only a header; no live row identifiers or PII included.
- PostgreSQL 17 policy semantics checked against official PostgreSQL 17 and current Supabase RLS documentation.
- No DDL/DML, migration, RPC invocation, row-level PII read, Auth session/token read, workflow execution, credential access, provider send or production action.
- No schema test was run because this checkpoint is design-only and no schema was changed.
- GitHub Actions / commit status for this D checkpoint: no status checks reported. Do not claim CI PASS.

## Admission

- `CANONICAL_STORE_AUTHORITY_DESIGN`: PROPOSED.
- `TENANT_STORE_MEMBERSHIP_CONTRACT`: PROPOSED.
- `RESTRICTIVE_RLS_TRUTH_TABLE`: PROPOSED; requires PG17 disposable test implementation.
- `LEGACY_MAPPING_MANIFEST_SPEC`: PROPOSED; no real manifest rows created.
- `STAGING_DDL`: BLOCKED pending explicit approval and backup/PITR evidence.
- `REAL_AUTH_A_B`: BLOCKED / NOT RUN.
- `LEGACY_BACKFILL`: BLOCKED.
- `PRODUCTION_WRITERS`, `PROVIDER_SEND`, `RELEASE`: NO-GO.

## GitHub

- Draft PR #417: https://github.com/ngoctien20/demo-git/pull/417
- Parent Draft PR #414: https://github.com/ngoctien20/demo-git/pull/414
- Base branch: `qa/v1836c-live-schema-audit-20261118`
- Do not merge this design PR as a migration or release authorization.
