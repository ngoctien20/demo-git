# V18.3.6C — Verified QA Checkpoint

**Checkpoint:** `V18.3.6C-LIVE-AUDIT-20261118`  
**Date:** 2026-11-18 JST  
**Status:** `READ-ONLY AUDIT VERIFIED / CANONICAL STORE AUTHORITY BLOCKED / NO-GO FOR MIGRATION`

## Evidence

- Supabase staging project: `ifxlvrhyjhbzbrkdsida`
- PostgreSQL: `17.11`
- Canonical Store tables: 0
- Store columns on six public Commerce tables: 0
- Public tables with RLS: 20/20
- Public policies: 31 permissive, 0 restrictive
- Active tenant memberships: 3 across 2 QA tenants
- Supabase migration history: 21 migrations; latest observed V17.5e2b private Auth/customer-binding intake
- R1 Store/Bot map: 2 scopes → 2 distinct Auth Tenants, maximum one Store scope per Auth Tenant
- R1 bots: both `dry_run` / `synthetic_qa`
- R1 owner bindings: 2 paired; outbox: 4 HELD; sandbox orders: 4 pending_sandbox
- V17.5 QA: 8 tables, 0 rows
- Supabase Storage: 0 buckets, 0 objects
- n8n Commerce DataTables: 16 total, 14 tenant-scoped, 0 Store ID/Store Key columns
- Commerce Core: sandbox-only; resolver rejects active/live tenant+channel as `live_connector_not_implemented`; `canWrite=false`, `canSend=false`
- Messenger: active legacy Google Sheets order create/update/manage tools and configured Messenger send node remain separate from its QA_CORE read-only Commerce Core branch.
- Zalo Bot: active staging protected ingress and shared-core shadow; no OA send in inspected path.

## Security and performance findings

- Supabase Security Advisor: 1 anon-executable SECURITY DEFINER RPC (`qa_shop_b_zalo_claim`), 2 authenticated-executable SECURITY DEFINER RPCs (`qa_owner_pairing`, `save_merchant_product`), leaked-password protection disabled.
- 23 RLS-no-policy INFO findings are in private schemas with no anon/authenticated schema USAGE or direct table grants.
- Performance Advisor: 19 unindexed FK findings and 9 unused-index findings; no index change performed.

## Read-only script verification

The exact `qa/v18.3.6c/READ_ONLY_AUDIT.sql` committed to this branch was submitted to the connected Supabase staging project. The multi-statement SELECT-only script completed without SQL error; the final result returned all 21 applied migration version/name records. Earlier component queries separately verified the summary values above.

## GitHub

- Draft PR #414: [V18.3.6C live schema audit](https://github.com/ngoctien20/demo-git/pull/414)
- Head commit before this checkpoint file: `25d4e29b12f1ef48444f5b969115cc1317f91c69`
- Documentation-only Jekyll CI: run `44269609634`, job `134682623019`, SUCCESS.
- V18.3.6B Draft PR #412 remains open and unmerged; its latest full PG17 replay run `44263635539` passed.

## Decision

- `LIVE_SCHEMA_COMPATIBILITY_AUDIT`: VERIFIED.
- `AGGREGATE_LEGACY_ROW_INVENTORY`: VERIFIED; ownership mapping remains unapproved.
- `R1_QA_STORE_IDENTITY_MAP`: VERIFIED as synthetic QA only; not same-tenant Store A/B.
- `CANONICAL_STORE_AUTHORITY`: BLOCKED.
- `REAL_AUTH_A_B`: BLOCKED / NOT RUN.
- `PROVIDER_PERMISSION` and `MEDIA_STORE_MAPPING`: BLOCKED.
- `STAGING_DDL`, `BACKFILL`, `PRODUCTION_WRITERS`, `PROVIDER_SEND`, `RELEASE`: NO-GO.

No DDL/DML, row-level PII read, Auth session/token read, RPC invocation, workflow execution, provider send, credential change or production mutation was performed. PR #414 is Draft; do not merge it as a migration or release authorization.
