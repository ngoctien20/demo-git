# TIEN404 AI V12.3 — Supabase staging private session QA

**Date:** 2026-11-14 JST / Supabase `tien404-staging` (`ifxlvrhyjhbzbrkdsida`) PostgreSQL 17.11.  
**Migration:** `20261114144917_v12_3_shop_b_private_session_qa` (remote apply_migration succeeded).  
**Status:** **IMPLEMENTED + SECURITY AND CONSTRAINT TESTED**; **real two-client lock contention NOT PROVEN**; **no runtime connector linked to Zalo**.

## Baseline / recovery

Checkpoint: `docs/ai-handoff/V12_3_PRE_MIGRATION_RECOVERY_CHECKPOINT.md` (Git commit `e0177c19`).
Source migration: `docs/ai-handoff/V12_3_SHOP_B_PRIVATE_SESSIONS_APPLY.sql` (Git commit `9c0b07b8`).
Rollback: `docs/ai-handoff/V12_3_SHOP_B_SESSION_EMPTY_SCHEMA_ROLLBACK.sql` (Git commit `13490ad4`).

Preflight verified `to_regnamespace('tien404_dialogue_private') IS NULL`, project ACTIVE_HEALTHY, 2 orders and 2 outbox rows in each QA shop; Shop A F01 159000/stock 3, Shop B F01 199000/stock 5. Both QA tables were newly created in a private schema and were empty immediately after migration.

**Important limitation:** Full Supabase physical backup/PITR availability or full-project restore were **not independently verified**; there is no backup/restore API exposed by the current Supabase connector. This is a scoped schema/data-count checkpoint plus a safe empty-schema rollback script, not a replacement for a production database backup. Do not expand beyond additive isolated staging without verified full-backup control.

## Verified post-migration

- Schema `tien404_dialogue_private` exists with **exactly two regular tables**: `shop_b_sessions`, `shop_b_receipts`.
- Both have `relrowsecurity=true`, no RLS policies. The schema is **not granted to `anon`, `authenticated` or `service_role`**; Postgres owner role has access.
- Both contain **0 rows** after all tests.
- Session PK `scope_key` requires 64 lower-case hex; tenant/store/bot constrained to `qa-tenant-b/qa-store-b/qa-bot-b`. Receipt PK `(scope_key,event_hash)` requires 64 lower-case hex with FK.
- Existing `tien404_r1_qa.catalog`, `sandbox_orders`, `owner_outbox`, `owner_bindings` were not modified by migration.
- Security Advisor initially listed 16 `rls_enabled_no_policy` INFO findings, and 18 afterward (+2 new private tables). This is intentional deny-by-default on the new tables, **not** a public access finding. Do not add `authenticated` policy to suppress linter without secure authorization design. Guide: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy

## PostgreSQL QA results

| Test | Result | Evidence |
|---|---|---|
| Schema and exact tables present | PASS | `pg_class`, `pg_namespace` readback |
| Both tables RLS enabled | PASS | `relrowsecurity=true` |
| No `anon` schema / table rights | PASS | `has_schema_privilege=false`, `has_table_privilege=false` |
| `anon` direct read | PASS (expected denial) | `SET LOCAL ROLE anon`, Postgres error `42501 permission denied for schema` |
| `authenticated` direct read | PASS (expected denial) | `SET LOCAL ROLE authenticated`, Postgres error `42501` |
| Service role no direct grants | PASS | metadata `schema_usage=false`, `sessions_write=false`; backend role not provisioned |
| Duplicate scope_key | PASS | `INSERT ... ON CONFLICT DO NOTHING` returns zero added rows |
| Duplicate receipt hash | PASS | same scope+event returns zero added rows |
| Wrong tenant/store/bot insert | PASS (expected rejection) | check constraint `23514` handled in SQL test |
| `await_confirmation` with missing code/quote fields | PASS (expected rejection) | CHECK constraint handled in SQL test |
| Transaction rollback | PASS | synthetic inserts undone; session/receipt rows `0/0` |
| Two independent DB connections contested one `FOR UPDATE` lock | **INCONCLUSIVE** | connector-level parallel attempt did not show lock wait: second query `0.001233s`; cannot claim overlapping server sessions |
| Cleanup after concurrency attempt | PASS | only QA fixture `scope_key=repeat('d',64)` removed; session/receipt `0/0` |
| Existing QA Orders/outbox integrity | PASS | Shop B still 2 orders, 2 outbox rows; F01 price 199000, stock 5 |
| Zalo messages or Commerce Orders written | NONE | no sender, no `commit_order_qa` invocation, no new outbound |
| GitHub code regression | PASS | earlier run `43604057431`, prior isolated Node unit tests (116/116), **not actual PostgreSQL two-session evidence** |

## P0/P1 not completed

1. **P0 — Prove concurrency via independent connections** using a trusted QA executor (dedicated staging DB role/socket, *no public grant*) and scripts in `docs/ai-handoff/V12_3_TWO_SESSION_LOCK_QA.md`. Do not connect Zalo Owner chat to the adapter before real contention is verified.
2. **P0 — Build trusted provider+binding resolver**; new `owner` / `accepted` flags in code are internal interfaces and MUST NOT be supplied from client JSON. DB claims and recipient must be re-read per turn.
3. **P0 — Introduce least-privileged backend executor only after security review**. `anon`, `authenticated` and `service_role` currently cannot use the private tables. Do not grant broad private schema access to frontend roles.
4. **P0 — Fresh catalog readback** from existing `tien404_r1_qa.catalog` on every turn, and before order commit. QA 3-hour snapshot is not a valid real-time source after expiration.
5. **P0 — Sandbox order write still gated**: Existing `commit_order_qa` is separate; only connect when authenticated Owner confirmation, dedupe and readback are proven and a distinct write approval exists.
6. **P1 — Zalo sender remains disabled**. No auto-reply, no token changes, no production deployment.

**Rollback:** Only if scope empty and no unexpected objects, run the narrow rollback script; never use `CASCADE` or delete existing data without a separate approval. Current schema is harmless and intentionally inaccessible; retain it while QA is pending.

**Release:** `EXPERIMENTAL`, not a bot release and not production-ready.
