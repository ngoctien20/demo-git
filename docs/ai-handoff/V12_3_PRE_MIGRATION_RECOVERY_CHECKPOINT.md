# TIEN404 AI V12.3 — Pre-migration recovery checkpoint (Supabase staging)

- **Database**: `tien404-staging` / `ifxlvrhyjhbzbrkdsida`, PostgreSQL 17.11, region `ap-southeast-1`
- **Captured at**: 2026-11-14 14:46:13 UTC (23:46:13 JST).
- **GitHub branch**: `work/v12-shop-b-dialogue-staging-20261114`; draft PR #41.
- **Approved scope**: Only create `tien404_dialogue_private.shop_b_sessions` and `shop_b_receipts`, private role/permission guards and indexes; no edits of existing production, DEMO, Orders, Products, credentials or published workflows.
- **SQL source reviewed**: `docs/ai-handoff/V12_2_SHOP_B_PRIVATE_SESSIONS_REVIEW_ONLY.sql` SHA `a15662debcf6a21563c0fc2b59a3500b5199489e` — original candidate, needs migration header adjusted.
- **Prior schema**: `tien404_dialogue_private` did **not exist** (`to_regnamespace` returned NULL). This guarantees rollback of the new empty scope can restore pre-change state without modifying existing tables.

## Non-PII baseline snapshot

| QA group | Orders | Outbox | F01 price | F01 stock |
|---|---:|---:|---:|---:|
| Shop A | 2 | 2 | 159000 | 3 |
| Shop B | 2 | 2 | 199000 | 5 |

Existing `catalog`, `owner_bindings`, `owner_outbox`, `sandbox_orders`, `shop_bots` all had RLS enabled. Project `ACTIVE_HEALTHY`. Existing migration history includes V12.2 tester requests as latest known before this operation; no private dialogue migration was recorded at checkpoint.

## Backup / recovery classification

**Verified:** precise before-change schema absence; table counts & catalog values; original GitHub SQL source/version; additive-only migration; explicit rollback script. These are a *scoped logical metadata checkpoint*, not a physical snapshot of the full database.

**Not independently verified:** an actual downloadable full Supabase database backup, PITR restore point or a completed full-project restore rehearsal. Supabase connector currently lacks a dedicated backup/restore metadata action; do **not** assert full-backup verification.

**Risk treatment:** This migration must only add a brand-new, isolated schema and two initially empty QA tables. No migration may modify any existing table, function, credential, row or schema. The rollback script is safe only while the new schema belongs exclusively to this change and tables contain zero rows; if not, stop and investigate instead of cascading or deleting data.

## Rollback script

`docs/ai-handoff/V12_3_SHOP_B_SESSION_EMPTY_SCHEMA_ROLLBACK.sql`. Never run without checking ownership and no unexpected rows/objects; does not touch legacy tables.

## QA gates after DDL

1. Supabase readback of schema, columns, keys, indexes, RLS, grants and policies.
2. Unauthorized `anon`/`authenticated` cannot use private schema or tables.
3. The only new tables are empty before/after test; no live sender/order mutation.
4. PostgreSQL unique constraints, transaction rollback and independent concurrent sessions with temporary QA rows; delete/rollback only those explicitly created by the QA session.
5. Same readback of baseline Orders, outbox and F01 after tests.
6. No Shadow publish, no Zalo notification, no `commit_order_qa` call.

**Release classification**: `APPROVED` for additive staging private schema; `NOT APPROVED` for enabling outbound Zalo, actual commerce order writes, granting client roles or production rollout.
