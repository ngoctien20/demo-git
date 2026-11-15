# TIEN404 AI V14.2 — PostgreSQL Password Reset Impact Audit

Date: 2026-11-15 JST
Supabase project: `tien404-staging` (project ref `ifxlvrhyjhbzbrkdsida`)
GitHub: Draft PR #86, staging branch `work/v142-store-rls-onboarding-staging`
Status: **READ-ONLY AUDIT / RESET NOT AUTHORIZED / BACKUP NOT VERIFIED**

## Decision
**DO NOT reset the database `postgres` password yet.** No automatic backup is available under the Free plan shown in the user's Supabase Database > Backups screen, and the legacy password is not known. We still need to confirm whether Render's staging service uses a PostgreSQL connection string/password.

## Evidence — VERIFIED
1. Supabase project metadata is ACTIVE_HEALTHY / PostgreSQL 17.11. No database/schema/RLS write was attempted during this audit.
2. The screenshot of the Supabase "Connect" dialog shows a **Session Pooler** at port 5432 with `[YOUR-PASSWORD]` placeholder. This is not an actual credential. Connection UI does not disclose the existing password.
3. The n8n connector lists **9 credentials**; none has a PostgreSQL credential type. The credential types observed are HTTP header/bearer auth, Gmail OAuth, Google Sheets OAuth, crypto and Telegram; **credential values were never requested**.
4. Inspected published/current nodes of representative workflows: Zalo Ingress `yIJk8LvJoLF40Z62`, private router `sIPs6egzIwOY1GNv`, Messenger Test `Z7FdV7uDvApfbURQ`, Commerce Tenant Resolver `5Eeh8hbpsoNhuiVo`, Commerce Shop Onboarding `splyaeQtV719OuAu`, AI_SALES_DEMO Main Agent `v6PBwcqSapVzACMW`, TIEN404 V14.2 QA `FIE7nl2vgLXQI7mT`, Render bridge QA `E3He3Kr602j2B0wC`, R1 Supabase adapter QA `JsRXB0B9wGkWByW9`, Website Demo AI `wgkkmT7q4lm4HyuA`. These show n8n Data Table, Google Sheets, code, workflow calls, and/or HTTP nodes; no n8n native PostgreSQL node/credential in this sample. This is not a proof that all external HTTP backends are free of database-password dependencies.
5. Read-only PostgreSQL `pg_stat_activity` aggregate showed PostgREST, Supabase pooler/admin, monitoring/background sessions. No clearly identified third-party direct PostgreSQL connection in the single sampled instant. **Not proof of absence** of transient, pooled or idle external applications.
6. Cloudflare connected account Hyperdrive configs GET returned **0** items. The Cloudflare Pages project list request did not succeed, so Page-level secret binding usage remains **not verified**.
7. GitHub default-branch code search for common connection-variable strings returned no matches; GitHub code indexing coverage and other branches/services are not verified.
8. Render integration has **no workspace selected**. It lists exactly one available workspace named `My Workspace`, but service-list tool explicitly requires the user to CONFIRM the workspace before further inspection. **NO Render service configuration has been inspected**.
9. Owner previously authorized conditional preparation of migration, mapping after per-row ownership proof, and two authorized hosted JWT QA sessions. The owner **has not approved credential reset**. PR #86 remains Draft.

## Password-change impact analysis
- Native PostgreSQL connections authenticated with the current `postgres` password (e.g. `DATABASE_URL`, `POSTGRES_URL`, `PGPASSWORD`, session-pooler URLs): **AT RISK**. New/reconnected sessions can fail after the reset until client configs are updated.
- Supabase Auth login via GitHub/other OAuth, public Data API/PostgREST with publishable keys/user JWT, RLS and `supabase-js` **do not normally use the application's old `postgres` login password**. These are not expected to require a client password update solely due to a postgres-role reset; hosted availability must still be retested.
- n8n direct PostgreSQL credential exposure: **NOT FOUND in inspected connector metadata**, not a guarantee for external services reachable from HTTP nodes.
- Render staging direct DB connection: **UNKNOWN** until authorized workspace is confirmed and environment-variable **NAMES ONLY** (never values) + service dependencies inspected.
- Cloudflare Hyperdrive: **NOT CONFIGURED in checked account**. Other Workers/Pages bindings remain unconfirmed.

## Recommended free-safe path
1. Obtain user's explicit confirmation to inspect Render's `My Workspace` (READ-ONLY).
2. Inspect service list and service/environment **variable names/dependency configuration only**. Search for `DATABASE_URL`, `POSTGRES_URL`, `SUPABASE_DB_URL`, `PGHOST`, `PGPASSWORD`, direct `db.*.supabase.co` or pooler host references without accessing values.
3. Verify which services use the Supabase Data API/publishable JWT rather than direct Postgres; document affected connections and prepare a rollback/reconnect playbook.
4. Check the owner's existing password manager/local safe vault for the **old** database password. The shown `[YOUR-PASSWORD]` placeholder cannot be used to connect.
5. If no retained password exists, present a **separate, explicit reset approval** after dependency audit. Generate a strong new password through password manager; perform a supervised staging-only reset, then promptly update impacted clients in secure configuration without exposing passwords to GitHub/ChatGPT. Validate health and reconnections.
6. Create an owner-controlled physical/logical backup via official Supabase CLI `db dump` using Session Pooler on a compatible network. Take role, schema and data dumps; avoid printing connection strings or uploading secrets; encrypt backup at rest and store privately.
7. Test an isolated restore and checksum/table/policy comparisons. Restore tests may require another isolated instance or local Docker, not current staging; any new cloud costs require approval.
8. Only after **VERIFIED backup + restore rehearsal + owner-accepted rollback plan** revisit Store/RLS migration gate. No change to published workflows, payment, credentials, production, customer data or Zalo sends without their own approval.

Supabase documentation:
- https://supabase.com/docs/guides/platform/backups
- https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore
- https://supabase.com/docs/guides/database/connecting-to-postgres

## QA / checkpoint
- Audit was read-only; no database password reset, no credential values read, no migration/backfill, no Supabase RLS changes or provider sends.
- All 313/313 prior V14.2 Node CI and n8n 16/16 synthetic QA evidence remain previous checkpoint results, **not rerun as part of this audit**.
- Current assessment: `RESET=BLOCKED_NEEDS_SEPARATE_APPROVAL`, `RENDER_IMPACT=NOT_VERIFIED_WORKSPACE_CONFIRMATION_REQUIRED`, `BACKUP=NOT_VERIFIED`, `STORE_RLS_MIGRATION=BLOCKED`.


## Confirmed Render My Workspace — authorized READ-ONLY audit, 2026-11-15 JST

Owner explicitly confirmed workspace **My Workspace** for a read-only dependency review. No Render setting, environment variable, credential, deployment or production route was modified.

### Live Render resources — VERIFIED
- Exactly two services found with includePreviews enabled:
  - `tien404-auth-staging` — Render static_site, GitHub branch `work/supabase-auth-staging-v1`, autoDeploy=no, latest LIVE deploy SHA `b14501a0ebf04d991302cb32b5d548a68d6b39bd` (Nov 14).
  - `tien404-data-staging` — Render web_service, Python/FastAPI free plan, Singapore, GitHub branch `ops/tenant-data-platform-v1-staging-20261110`, autoDeploy=no, latest LIVE deploy SHA `ab940a95dae8afdff426bc6ac71693833d5348ce` (Nov 12).
- Render PostgreSQL instance listing returned **No Postgres instances found**; this excludes Render-managed Postgres on this workspace, but not external Supabase DB clients.
- Live deployment metadata and associated build/deploy events report success. This does NOT prove every route or background process is healthy.

### Analysis from exact deployed commit sources — VERIFIED
- Data service build starts `uvicorn app.main:app`; deployed `ops/data-platform/app/main.py` reads **code-declared** names:
  `TIEN404_SUPABASE_URL`, `TIEN404_SUPABASE_PUBLISHABLE_KEY`, `TIEN404_APP_ORIGIN`, `TIEN404_DATA_MODE`, `TIEN404_N8N_STAGING_SECRET`.
- Its configured reads call Supabase Auth and PostgREST with `httpx` over HTTPS, forwarding the caller's JWT and public/publishable project key. No `psycopg`, `DATABASE_URL`, pooler DSN or raw SQL PostgreSQL connection is referenced in this deployed `main.py`.
- The source repository also contains `commerce_transactions.py`, a PostgreSQL-transaction implementation, BUT it requires an injected `commerce_connect` adapter. Deployed entrypoint at line 230 calls `app=create_app()` with the default `commerce_connect=None`. Therefore the transactional PostgreSQL path is **not wired in the inspected deployed service**.
- Static Auth service deployed build `scripts/build-auth-preview.mjs` produces an allowlisted frontend-only artifact. Inspected deployed frontend `assets/auth-client.js`, `assets/auth-config.js`, `assets/merchant-portal.js`, `assets/merchant-product.mjs`, `assets/auth-runtime.mjs`, `assets/site-config.js`: no direct PostgreSQL URI, pooler host or PGHOST/DATABASE_URL/PGPASSWORD references in these files.
- Crucial limitation: connected Render tools return service/deploy metadata, but do **not expose the actual stored Environment variable name list**. Source-code-declared names are NOT proof of values/names configured in the Render dashboard. Do not say the environment variables have been verified, and do not request or reveal secret values.

### Revised risk / decision
- **Render direct PostgreSQL password dependency: LOW based on the inspected deployed entrypoints**; residual uncertainty remains until the actual Render Environment **KEY NAMES ONLY** and out-of-band client dependencies are verified.
- OAuth logins and Supabase Data API via publishable key + JWT typically do not use the `postgres` login password in client code. This does NOT prove reset cannot impact another uninspected third-party DB client.
- **Decision: DO NOT RESET DATABASE PASSWORD YET**. Confirm actual Render environment KEY names via a redacted screenshot or permitted name-only metadata mechanism; separately authorize any password reset after dependency and reconnection plan acceptance.
- Staging backup is still NOT verified. Source-code QA and repository checkpoint are not a backup/restore drill. V14.2 database migration, backfill and RLS remain BLOCKED.
- No credentials or environment values were queried or returned to the assistant. No Render deployment, database changes, customer messages or RLS operations were performed.

QA status: AUDIT_READ_ONLY=VERIFIED; RENDER_SERVICES=2; RENDER_MANAGED_POSTGRES=0; CODE_DECLARED_ENV_NAMES=VERIFIED; RENDER_STORED_ENV_KEY_NAMES=NOT_AVAILABLE_VIA_CONNECTOR; RESET_APPROVED=NO; VERIFIED_BACKUP=NO.


## Render Environment key-name evidence — user screenshot 2026-11-15 JST

User supplied a screenshot of Render **My Workspace → tien404-data-staging → Environment**. The screen shows exactly **five environment entries**, with all VALUE cells masked. The visible keys are:
- `TIEN404_APP_ORIGIN` (fully visible)
- `TIEN404_DATA_MODE` (fully visible)
- `TIEN404_N8N_STAGING_SEC...` (truncated in UI; matching `TIEN404_N8N_STAGING_SECRET` source-code reference, not independently observed in full)
- `TIEN404_SUPABASE_PUBLIS...` (truncated in UI; matching `TIEN404_SUPABASE_PUBLISHABLE_KEY` source-code reference, not independently observed in full)
- `TIEN404_SUPABASE_URL` (fully visible)

No `DATABASE_URL`, `POSTGRES_URL`, `PGHOST`, `PGPASSWORD`, or `SUPABASE_DB_URL` is shown among those five keys. This directly resolves the former Render stored-key-name visibility blocker **for the inspected web service**. It does NOT prove absence of secrets elsewhere (other apps, runtime jobs, separate credential stores, or credentials embedded in source code).

The source code for the Render LIVE deployed FastAPI commit `ab940a95dae8afdff426bc6ac71693833d5348ce` reads exactly these five environment variable names and uses Supabase Auth/PostgREST via HTTPS; the optional `commerce_connect` SQL transaction adapter is not passed to `create_app()`. The separate Auth static site LIVE commit `b14501a0ebf04d991302cb32b5d548a68d6b39bd` does not use direct PostgreSQL connections in the inspected frontend/build files. Render lists no Render-hosted PostgreSQL instance.

### Updated decision
- `RENDER_STORED_ENV_KEY_NAMES=VERIFIED_FROM_USER_SCREENSHOT` (two truncated keys corroborated by source; values NOT read).
- `RENDER_DIRECT_POSTGRES_PASSWORD_DEPENDENCY=NOT_FOUND_IN_INSPECTED_DEPLOYED_RUNTIME`.
- `DATABASE_PASSWORD_RESET_RISK_TO_INSPECTED_RENDER_SERVICES=LOW` (not zero; external clients unknown).
- `RESET_APPROVAL=NOT_GRANTED`; `RESET_PERFORMED=NO`.
- `RESTORABLE_BACKUP=NOT_VERIFIED`; `RESTORE_DRILL=NOT_VERIFIED`; `STORE_RLS_MIGRATION=BLOCKED`.

Next action: operator may separately authorize a staging-only PostgreSQL password rotation after reviewing any out-of-band integrations and a reconnection/rollback plan. Never expose the password in chat, screenshots, or GitHub; owner must manage secrets privately. Rotation does not itself satisfy the backup/restore gate.


## Owner approval — staging PostgreSQL password reset

Owner reply: "được phê duyệt" in immediate context of a separate approval request for resetting the `postgres` database role password of Supabase `tien404-staging`.

- **APPROVED:** Password rotation for `postgres` on staging project `ifxlvrhyjhbzbrkdsida` ONLY.
- **NOT APPROVED:** Resetting Supabase Auth user passwords, Render/n8n credentials, Supabase API keys, RLS changes, migrations, customer data edits, sending real messages, costs, or production configuration.
- **IMPLEMENTATION BLOCKED BY TOOLING:** Available Supabase connector has no dedicated reset-password operation; connected Browser in Chat supports only read operations. Do not use generic `execute_sql` to set a secret: could leak into tool logs and cannot securely deliver the new password to the owner.
- **SAFE OWNER ACTION:** Navigate to Supabase Dashboard → tien404-staging → Database → Settings → Reset Database Password. Generate/store new password in private password manager, do not paste into ChatGPT, GitHub, workflow logs or screenshots. No password value stored in this checkpoint.
- **Official docs (2026-11-15):** https://supabase.com/docs/guides/database/postgres/roles — Supabase-managed PostgREST, PgBouncer and internal services automatically update to latest password; external direct username/password connections need manual update.
- **POST-RESET QA (PENDING):** Verify project ACTIVE_HEALTHY, Supabase Auth and REST API, Render Auth/data staging status, n8n ingress metadata, and owner-run CLI database backup via Session Pooler; monitor any credential failures. Never invent test evidence.
- **ROLLBACK:** Old password is unknown so cannot restore it; if needed rotate to another privately known strong password and repair external clients after separately identifying affected integrations. Full database restore is NOT a password rollback.
- **STATUS:** APPROVED_NOT_EXECUTED. Need user to perform reset in Supabase UI and confirm **without sharing the password** before claiming rotation complete. DB backup and V14.2 Store/RLS migration remain BLOCKED pending restore-test gates.


## Operator-reported password reset and pgAdmin reconnection

Date: 2026-11-15 JST. User explicitly reports that the password reset has been completed and provides a screenshot of pgAdmin 4 with server `tien404_AI_BACKUP` expanded and PostgreSQL `Login/Group Roles` populated. This is evidence of **a working pgAdmin database session**, but a screenshot is not an audit trail proving a fresh authentication handshake with the new password. Never record or request the password.

After the user's report, Supabase connector read-only checks:
- Supabase project `ifxlvrhyjhbzbrkdsida` status: `ACTIVE_HEALTHY`.
- `current_database()` = `postgres`, PostgreSQL version 17.11.
- `public.products` rows = 2, `public.orders` rows = 2.
- `public.stores` still absent, indicating Store RLS migration not applied.

Status: `PASSWORD_RESET=USER_REPORTED`, `PGADMIN_SESSION_CONNECTED=SCREENSHOT_VERIFIED`, `SUPABASE_CONNECTOR_HEALTH=VERIFIED`, `BACKUP_CREATED=NO_EVIDENCE`, `RESTORE_TESTED=NO`, `STORE_RLS_MIGRATION=BLOCKED`.

**Next operator-only action:** In pgAdmin, expand Databases, right-click postgres → Backup. Choose Custom format to private local directory, capture all intended project schemas and data. pgAdmin uses pg_dump and may be restricted by Supabase-owned internal schemas; inspect process log and TOC before accepting any backup. Record a successful process completion and separately rehearse an isolated restore. Never restore to connected staging database. Supabase CLI `db dump` is the provider-guided preferred alternative for managed schema filtering.

No credential reading/writing, production deployment, SQL migration, RLS or data mutation performed by this assistant.
