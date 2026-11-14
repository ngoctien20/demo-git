# TIEN404 AI — V12.3 checkpoint (2026-11-14 JST)

**Status:** `IMPLEMENTED + TESTED` (private QA schema / access / constraints); `BLOCKED` (real two-client contention and live integration).  
**Environment:** Supabase `tien404-staging` only, `ifxlvrhyjhbzbrkdsida`, PostgreSQL 17.11. Draft PR #41, not merged.

## 1. VERIFIED

- Owner approved V12.3 private Shop B QA session database migration, after preflight/recovery checkpoint.
- Prior schema `tien404_dialogue_private` did not exist.
- Prior Shop A / Shop B QA: 2 orders + 2 outbox rows each. Shop A F01 159000/stock3; Shop B F01 199000/stock5.
- Existing QA Orders, Products, Owner binding, n8n V1/Shadow and Cloudflare Zalo gateway remained outside migration scope.
- **Backup limitation**: scope-level preflight checkpoint and safe rollback SQL documented, but connector does not prove an actual physical full-project backup or a restore rehearsal. Do not treat this as full Supabase backup verification.

## 2. IMPLEMENTED

- Applied Supabase migration `20261114144917_v12_3_shop_b_private_session_qa`, result `success:true`.
- Schema `tien404_dialogue_private`:
  - `shop_b_sessions` (private state, tenant/store/bot hard constraints, expected_total/confirmation hash, revision and expiry).
  - `shop_b_receipts` (unique `scope_key,event_hash` for replay protection).
  - Indexes on expiry / observed timestamps; primary keys and foreign key.
  - RLS enabled on both; **zero client policies** and no schema/table privileges for `anon`, `authenticated`, or `service_role`.
- No backend grant, RPC, subscription, Zalo secret, n8n workflow or customer Orders touched.
- Exact applied SQL, rollback and preflight files committed in GitHub:
  - `V12_3_SHOP_B_PRIVATE_SESSIONS_APPLY.sql`
  - `V12_3_SHOP_B_SESSION_EMPTY_SCHEMA_ROLLBACK.sql`
  - `V12_3_PRE_MIGRATION_RECOVERY_CHECKPOINT.md`

## 3. TESTED

**PASS**: remote schema/migration readback, 2 new tables, RLS, policy count=0, grant denied. Actual SQL attempts via `SET LOCAL ROLE anon` and `SET LOCAL ROLE authenticated` each returned expected PostgreSQL `42501 permission denied`.

**PASS**: transaction created a synthetic Shop B session & receipt, duplicate session and receipt insert both added zero rows, cross-tenant insert failed CHECK, incomplete confirmation state failed CHECK, and `ROLLBACK` returned both tables to 0 rows.

**PASS**: concurrency fixture created in private staging table and cleaned to 0 rows.  
**INCONCLUSIVE**: a connector-level `Promise.all` two-call `FOR UPDATE` attempt did not demonstrate lock contention. Second SQL call reported only **0.001233 seconds** wait; no claim of independent overlapping Postgres sessions. A separate two-connection QA plan is required.

**Previously PASS**: GitHub 116/116 unit tests on isolated conversation/session/PG-mock code (run `43604057431`); these are not database concurrency evidence.

## 4. BLOCKED

- True two-connection row locking and duplicate receipt race QA.
- Trusted server-to-database executor and derived Zalo owner binding; no Postgres credential available in current n8n Personal for this staging project. Do not grant broad `service_role` / `authenticated` access.
- Real-time readback integration, transactional sandbox order commit, and auto-reply; require separate safety gates / specific approval.
- Physical full database backup/PITR status not visible via current tools.

## 5. RISKS

- No direct server executor granted to private schema yet; the new schema is intentionally unusable by clients.
- Contention over a row not yet proven; do not infer exactly-once delivery solely from unique constraints.
- Current V1/Shadow read-only preview used a catalog snapshot with time lease; it must not create orders after snapshot expiry.

## 6. APPROVAL REQUIRED

This approval covered **only** the V12.3 private staging session DDL & QA. Before expanding scope, obtain an explicit authorization for:
- Least-privilege dedicated backend database connection/credential setup.
- Attaching authenticated PostgreSQL adapter to Owner webhook and persistent session writes.
- Any sandbox Orders changes from Zalo confirmation, outbound send or production changes.

## 7. CHECKPOINT REFERENCES

- Supabase migration: `20261114144917_v12_3_shop_b_private_session_qa`.
- Zalo V1 published: `yIJk8LvJoLF40Z62` version `08f22ee1-cf5a-4459-bd33-bf80ac67af0e`.
- Shadow published: `OgDZNSAvKEvhnAvn` version `f00ba506-c52a-4340-9a0c-809fd9c6ea9a`.
- Zalo send must remain disabled (`ZALO_SEND_ENABLED=false`). No order automation activated.
- GitHub: Draft PR #41, branch `work/v12-shop-b-dialogue-staging-20261114`.
- Detailed: `V12_3_SUPABASE_SESSION_QA_REPORT.md`, `V12_3_TWO_SESSION_LOCK_QA.md`.

## 8. NEXT ACTIONS

1. Prove independent physical PostgreSQL sessions with lock waiter and conflicting receipt inserts, collect backend PID and wait duration.
2. Verify full backup/PITR state in Supabase dashboard before allowing further substantive schema changes.
3. Build private, authenticated backend resolver and least privilege connection contract; no token sharing in chat.
4. Connect read-only Zalo Owner chat session only after locking tests; keep send and Order writes disabled.
5. Request separate owner sign-off for sandbox commit and outbound auto-reply tests.

**Rollback:** use `V12_3_SHOP_B_SESSION_EMPTY_SCHEMA_ROLLBACK.sql` only after verifying schema contains no data and only objects created in this migration; do not use CASCADE, do not delete customer Orders.
