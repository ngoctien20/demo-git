# TIEN404 AI — Supabase staging postgres password reset dependency audit (READ-ONLY)

**Ngày:** 15/11/2026 JST. **Phạm vi:** `tien404-staging`, Supabase ref `ifxlvrhyjhbzbrkdsida`; xác minh ảnh chụp Supabase Database Settings của Owner. Không reset password, không thay đổi credential, Secrets Store, workflow, database hoặc production.

## 1. VERIFIED — PostgreSQL sessions snapshot

`pg_stat_activity` on `postgres` lists only one connection each (at snapshot): `authenticator/PostgREST 14.18`, `pgbouncer`, `postgres/mgmt-api` (own read-only inspection), `supabase_admin`, `supabase_admin/postgres_exporter`, `supabase_storage_admin/Supabase Storage API 1.94.2`. No visible direct PostgreSQL session with application name n8n/TIEN404/Render during snapshot. This is **not** evidence that an on-demand backend is absent.

## 2. VERIFIED — n8n and Supabase use

- n8n: 79 workflows (19 active), 9 credential metadata records. **0 PostgreSQL/Supabase dedicated credential types**, 0 PostgreSQL nodes among the 19 active definitions inspected.
- Zalo V1 `yIJk8LvJoLF40Z62` active published version `8ca4a6f6-ab3f-42f1-8637-d4f5db790a3e`; Shadow `OgDZNSAvKEvhnAvn` active version `f00ba506-c52a-4340-9a0c-809fd9c6ea9a`. Shadow's `Submit pending claim for Shop B` uses an HTTP Supabase REST endpoint (separate from `postgres` login credentials); V1 route no direct PG node.
- Other active Messenger/Commerce/AI_SALES_DEMO workflows inspected; no direct PG node or database password connection strings found in workflow definition.
- Supabase has one ACTIVE Edge Function `tien404-r1-owner-preflight` (version 1). Read-only source detection confirms `createClient` + `SUPABASE_URL`, not direct `postgresql://` connection.
- Supabase 0 development branches. Private QA schema `tien404_dialogue_private` exists, is unrelated to a current live database credential in n8n; no dedicated Shop B database login was previously provisioned.

## 3. VERIFIED — Cloudflare / GitHub

- Cloudflare Workers listed 16 scripts, including only one TIEN404 Zalo staging gateway `tien404-zalo-outbound-v1-staging`. Its bindings are gateway/Zalo credentials and D1 Replay DB; **no `DATABASE_URL`, `PGHOST` or equivalent PG binding**. No secret values inspected/exported.
- Cloudflare Pages `tien404-ai-git-staging` and `tien404-ai-staging` currently contain no explicitly named env variables in their Pages production/preview configs.
- GitHub `gh-pages` static project tree: no direct postgres config found in `assets/site-config.js`; PR #41 branch contains an inactive Shop B PostgreSQL repository adapter used for testing, not a deployed runtime connection.
- Read-only source `qa/shop_owned/supabase/functions/tien404-r1-owner-preflight/index.ts` uses Supabase JS API and JWT, not a hardcoded PostgreSQL password.
- `qa/shop_owned/test_postgres_bridge.py` uses a disposable CI PostgreSQL database, not the staging Supabase password.

## 4. BLOCKED — Render staging

Render connector lists exactly one workspace `My Workspace`, ID `tea-dbphgh0n74is73dvsnng`, but **no workspace selected**; connector explicitly requires the user to confirm which workspace before reading service configs. Therefore Render `tien404-auth-staging.onrender.com` environment **NOT AUDITED**: it may use `DATABASE_URL` / Supabase pooled `postgres` password or only API keys. Do not claim reset safety until Render binding **names only** and relevant service dependencies are reviewed.

## 5. Official Supabase password rotation guidance (verified 2026-11)

- Supabase `postgres` role password is changed under Database Settings. Supabase-managed services are automatically updated; third-party apps with stored credentials require manual updates. Source: https://supabase.com/docs/guides/database/postgres/roles
- Session pooler uses `postgres.ifxlvrhyjhbzbrkdsida` at port 5432, unlike direct login `postgres`. Source: https://supabase.com/docs/guides/database/connecting-to-postgres
- Shared pooler may temporarily reject the newly reset password due to credential cache; wait/retry after a short time and do not reset repeatedly. Source: https://supabase.com/kb/troubleshooting/supavisor-error-password-authentication-failed-after-password-rotation
- Free plan has no daily automatic backup. After a safe password reset, create encrypted manual logical backup and verify restore on isolated PG17 **before any schema/role/credential migration**. Source: https://supabase.com/docs/guides/platform/backups

## 6. Proposed sequence — NO ACTION TAKEN

1. User confirms Render workspace `My Workspace` for read-only inspection; audit service `tien404-auth-staging` env variable **names/type only**, dependencies and deployment state. Do NOT expose secret values.
2. User independently approves the database password reset, after dependency-risk report and quiet window (no other deployment/QA writes).
3. User generates a new high-entropy database password in a local password manager and resets through Supabase Database Settings, entering the new password **ONLY inside Supabase UI**. Never paste it into ChatGPT, GitHub, project files, or screenshots. Avoid any unapproved production password rotations.
4. Verify new connection through Supabase **Session pooler**: user `postgres.ifxlvrhyjhbzbrkdsida`, port `5432`, host copied from Supabase Connect, SSL `require`; short shared-pooler cache interval is possible.
5. Re-test Render and all identified dependent clients, update **only** those that demonstrably use old `postgres` password after separate approval. Stop and roll forward via another controlled rotation if necessary; old password unavailable, so do not claim instant rollback.
6. Create local encrypted full logical backup via the prepared `qa/zalo/v124-manual-encrypted-backup.sh` or pgAdmin Custom + offline encryption. Verify `pg_restore -l` then an actual restore rehearsal on independent PG17.
7. Only after backup verified: provision a **NEW separate least-privilege Shop B role/password**, HMAC secret in backend secret manager, RLS and two-connection QA. No Zalo auto-replies, Orders writes, production changes.

**Assessment:** Direct n8n/Cloudflare/Supabase Edge breakage risk appears LOW for a `postgres` password rotation; Render risk UNKNOWN. Do not reset yet. No credential or database change has been made.
