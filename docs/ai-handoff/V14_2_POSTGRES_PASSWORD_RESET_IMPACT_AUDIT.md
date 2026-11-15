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
