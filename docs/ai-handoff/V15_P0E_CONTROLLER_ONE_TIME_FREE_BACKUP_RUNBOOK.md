# TIEN404 AI V15 Sales Lite P0-E — Private Controller Approval × One-Time Free Backup

Date: 16/11/2026 JST
Status: SOURCE ONLY / NO HOSTED DATA EXPORT / NO APPROVED BACKUP / NO RESTORE.

## 1. Objective and scope
Prepare a controlled one-time logical backup of Supabase STAGING project ifxlvrhyjhbzbrkdsida (Free, PG17.11), reusing PR #135's independent controller/security approval model and PR #132's synthetic dump/restore rehearsal. Do not duplicate those systems or merge any Draft PR.

The command to proceed with this named P0-E milestone is not consent to export all Auth, Tenant, Products and Orders from a project that serves multiple merchants. Verify whole-project data-controller and independent security reviewer authority privately. Approval of one Shop's Messenger or Zalo Page does not grant whole-project database-export permission.

No credential reading, hosted backup, paid infrastructure, GRANT/RLS/RPC edit, migration, customer data export, provider send or real Order write is authorized here.

## 2. Verified source and live status
- Supabase organization plan: Free. Project ACTIVE_HEALTHY; 3 Auth users, 2 Tenants, 3 active memberships, 2 Products, 2 Orders. No canonical public.stores, store_memberships or Store columns on core entities.
- PR #132 HEAD 70494f279f8efca5b1ac62004c3fca0186d454a0: CI SUCCESS, synthetic PG17 pg_dump/pg_restore and checksum; NOT hosted recovery proof.
- PR #135 HEAD 6ef086202a524b0c595fda3f03ae89a10fe73676: CI SUCCESS, two synthetic Ed25519 approvers and backup request document; NOT true human signature or approval.
- PR #136 HEAD 5cc67aabf0ead335b1ceab413fd32b295a11da16: CI SUCCESS, disposable Store RLS expand and rollback.
- PR #139 HEAD b16009db3d9af38d51399a531ba4253f5338c51a: CI SUCCESS, source-only private evidence review.
- No actual hosted backup, real private vault or authorized restore evidence has been produced.

## 3. Critical CLI coverage caveat
Supabase Free backup guidance: https://supabase.com/docs/guides/platform/backups
CLI documentation: https://supabase.com/docs/reference/cli/supabase-db-dump
Self-hosted recovery: https://supabase.com/docs/guides/self-hosting/restore-from-platform

Supabase db dump default excludes application DATA and custom ROLES unless explicitly requested; CLI defaults also omit Supabase-managed auth/storage schema. Three files named roles.sql, schema.sql and data.sql do NOT alone certify Auth users/sessions, Storage object bytes or complete database recovery. CLI and restore documentation can describe different scopes; check actual outputs and test real restore in separately approved isolation. Also assess extensions, RLS, functions, migrations, Edge Functions, n8n workflows, provider credentials and Cloudflare resources.

## 4. Implemented in this Draft
- qa/v15-sales-lite-p0e/backup-coverage-gate.cjs: 13 category backup scope checklist using private SEC tickets. All outcomes remain BLOCKED without independent real verification.
- qa/v15-sales-lite-p0e/verify-local-sql-artifacts.cjs: strictly local SHA256 verifier for roles.sql/schema.sql/data.sql. Requires absolute POSIX private directory (0700), regular non-symlink single-linked nonempty files (0600), strict SHA256 manifest, no network/upload/SQL execution. An integrity match NEVER certifies completeness, origin, restore or actual authorization. Intentionally not compatible with Windows ACL without separate review.
- qa/v15-sales-lite-p0e/*.test.cjs: synthetic checks for fake approvals, missing Auth/Storage coverage, tampered files, unsafe permissions, symlinks and path traversal; all tests local.
- GitHub CI: unit/negative regression only, no staging API, backup, provider send or credential injection.

## 5. Private operator runbook — DO NOT EXECUTE before separate approval
A. Privately establish WHOLE-PROJECT CONTROLLER authority and INDEPENDENT SECURITY REVIEWER identity, with approvals tied to project ref, exact operation, purpose, data protection, expiry and no added USD expense. Shop-level owner consent alone is insufficient.

B. Independently verify a private encrypted offsite storage destination, key custody, privacy policy, 7-day retention PROPOSED (not approved) and scope for sensitive Auth/Orders data. No public GitHub, public Storage bucket, bot logs, ChatGPT uploads or unencrypted cloud-sync directories.

C. Operator validates Supabase CLI version and help, linked project ID, source read-only permissions, Docker, network and target. Never paste DB URLs, access tokens or passwords into a PR/log/chat. No execution in GitHub Actions. Check actual command options in the installed CLI; reference Supabase self-hosted docs for separate roles, schema, data-only dumps, and explicitly assess managed schema exclusions.

D. Only with separate one-time export approval may operator create a private isolated workspace and export roles.sql, schema.sql and data.sql. Test actual coverage of Auth and Storage, do not infer completeness. Immediately encrypt the archive under approved custodian rules. Record an immutable private manifest of source, timestamp, exact scope and independently held SHA256 digests.

E. For local integrity verification after private export: run on an authorized POSIX machine:
  node qa/v15-sales-lite-p0e/verify-local-sql-artifacts.cjs --manifest /private/backup/manifest.json
  Manifest contract: TIEN404_V15_P0E_LOCAL_INTEGRITY_V1; project: ifxlvrhyjhbzbrkdsida; artifacts contains exactly roles.sql, schema.sql, data.sql each with lowercase sha256 (64 hex digits).
  Maximum status: LOCAL_INTEGRITY_ONLY_NOT_RESTORE_CERTIFICATION, NOT an actual backup certification.
  Do not put sensitive manifest or original backup files in repository, ChatGPT or public logs.

F. RESTORE requires its OWN approval and isolated target, outbound Cron/webhooks/notifications disabled, no unapproved spend, and independent check of Auth/Store RLS, FK, data/row counts, migrations and Storage coverage. Never restore over hosted staging. Export approval does not authorize restore, migration, GRANT, RLS, sending, billing or real Orders.

## 6. Private authorization receipt fields — all unverified
project: ifxlvrhyjhbzbrkdsida
operation: ONE_TIME_STAGING_LOGICAL_EXPORT
whole_project_controller: NOT VERIFIED
independent_security_reviewer: NOT VERIFIED
private_encrypted_vault: NOT VERIFIED
backup_operator_read_scope: NOT VERIFIED
retention: SEVEN_DAYS_PROPOSED
incremental_cost_ceiling: USD 0
native_merchant_consent: NOT VERIFIED
actual_backup_created: FALSE
backup_checksum_independently_verified: FALSE
isolated_real_restore_approved: FALSE
isolated_real_restore_passed: FALSE
hosted_store_migration_approved: FALSE
overall: BLOCKED / NO-GO

A typed ticket, model answer, or synthetic signature is not a human signed authorization.

## 7. Rollback, acceptance, next step
Current changes are GitHub source only. Close this Draft child PR to roll them back; parent PRs and Supabase/n8n/Meta/Zalo production remain unchanged.

A future real export requires a fresh, explicit single-operation user authorization after the controller/reviewer/custodian are verified. If that gate cannot be met, the correct result is BLOCKED, not "backup certified". Reuse PR #135's detailed request; do not generate another parallel backup implementation.

Next: privately verify controller and security reviewer, encrypted vault, operator scope; submit a narrow request for one-time staging export. A later isolated real restore, backed-up Store migration, and a small shop pilot each require independent approval.
