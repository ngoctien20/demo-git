# TIEN404 AI — V18.3.6C

**Live Schema Compatibility Audit × Legacy Row Inventory × Trusted Store Authority Mapping Review**

- Status: `VERIFIED READ-ONLY AUDIT / MULTI-STORE ADMISSION BLOCKED`
- Environment inspected: Supabase staging `tien404-staging` (PostgreSQL 17.11), n8n Cloud
- Audit date: 2026-11-18 JST
- Checkpoint: `V18.3.6C-LIVE-AUDIT-20261118`
- Scope: metadata, aggregate row counts, RLS/policies/grants, function ACL/definitions, migration inventory, workflow versions and DataTable schemas.
- Explicit exclusions: no DDL/DML, no row-level PII reads, no Auth session/token reads, no Storage writes, no workflow execution, no provider sends, no credential access or production changes.

## Decision

The live staging schema is **not compatible yet** with a canonical same-tenant multi-Store Commerce Core.

1. `public` Commerce is tenant-scoped: the six core tables have `tenant_id`, no `store_id`; canonical `stores` and `store_memberships` do not exist.
2. The current tenant-level RLS policies are permissive and there are zero restrictive policies. A new permissive Store policy would OR with the existing tenant policy and would not establish same-tenant Store isolation.
3. `tien404_r1_qa` has two synthetic Store/Bot scopes, but they map to two distinct Auth Tenants (one Store per Tenant), not two Stores in one Tenant. Both bots are `dry_run` / `synthetic_qa`.
4. `tien404_v175_qa` contains eight private QA tables but zero rows. Supabase Storage has zero buckets and zero objects.
5. n8n Commerce DataTables are tenant-scoped (14 of 16 have `tenantId`; none has `storeId` or `storeKey`). Commerce Core is sandbox/read-only. Messenger still has active legacy Google Sheets order writer tools and a configured send node.

## Artifacts

- `LIVE_SCHEMA_COMPATIBILITY_AUDIT.md` — schema, RLS, migration and security findings.
- `LEGACY_ROW_INVENTORY.md` — aggregate-only inventory; no PII.
- `TRUSTED_STORE_AUTHORITY_MAPPING_REVIEW.md` — mapping evidence and canonical authority prerequisites.
- `N8N_COMPATIBILITY.md` — active workflow and DataTable compatibility.
- `READ_ONLY_AUDIT.sql` — repeatable SELECT-only SQL. It does not read Auth sessions, customer contact fields, order details, tokens, or secrets.

## Safety and decision

- No staging migration, backfill, row mutation, RPC invocation, workflow execution, webhook or provider send was performed.
- No production system was changed.
- Keep V18.3.6B PR #412 Draft; this audit PR is also Draft and documentation-only.
- Do not promote the R1 mapping to canonical authority.
- Do not route Messenger writes to Commerce Core until Store authority, migration, writer compatibility and independent Auth A/B tests pass.
- Real Auth A/B, owner-approved mapping and live provider permission remain BLOCKED.
