# TIEN404 AI — RPC17.8E Exact Checkpoint

Date: 2026-11-17 JST
Stage: SOURCE IMPLEMENTED · NO WINDOWS LIVE BACKUP EXECUTED · REAL STAGING RESTORE NO-GO.

## Parent & prior live evidence
- Inherited parent RPC17.8D PR #372, HEAD `f7af7e28a441d0e68214d2008f57769b7ee75194` after Owner Free-plan backup screenshot evidence.
- Owner-provided dashboard screenshot verifies `tien404-staging` is **FREE** and provides no scheduled backups.
- Supabase read-only inventory: 46 app tables across `public`, `app_private`, `factory_private`, `tien404_dialogue_private`, `tien404_r1_qa`, `tien404_v175_qa`, with RLS enabled on each.
- No real manual backup archive, restore drill, real Owner A/B JWT or provider-native signature acceptance received. Parent exact staging scoped table metadata SHA `53b0943b3bf5f6f069eeeed379ff1f1ead1e4fb94b4b32faea2e7c85f6fdcc2d`.
- Public canonical Store membership and private `rpc178_qa` schema still not approved for deployment.

## New deliverables
1. `qa/v152-rpc178e/stream-encrypted-app-backup.mjs`: Windows/Linux stream `pg_dump 17 custom binary → age recipient encryption` with NO unencrypted dump written to disk; excludes platform-managed schemas, uses 6 hardcoded app schema allowlist, strict Supabase host/user/port + TLS verify-full, explicit consent for data mode, no overwrites or outputs inside Git repo; encrypted output and redacted SHA manifest. No live staging connectivity in GitHub CI.
2. `qa/v152-rpc178e/verify-encrypted-app-backup.mjs`: SHA-256 + full age decryption stream to memory (discard) with PostgreSQL custom `PGDMP` header check. NO plaintext archive output, database connection or live restore. Return **NOT RESTORED** even on success.
3. `qa/v152-rpc178e/windows-private-backup.ps1`: PowerShell wrapper (default Preflight), masked database password, temporary process environment only, CA/certificate file check, separate privileged `AppDataBackup` consent, explicit Verify mode.
4. Unit tests with mocked pg_dump/age and tamper negative cases. GitHub CI separately checks genuine age encrypt/decrypt on a **synthetic-only** fixture, never authenticates to Supabase, no customer data, no live backup.
5. `docs/ai-handoff/T404_RPC178E_WINDOWS_NO_DOCKER_ENCRYPTED_APP_BACKUP.md`: operator instructions and exact critical limitations.

## Important limits
- Application-scope only: excludes `auth`, `storage`, Supabase platform internals, roles, privileges and storage objects. `pg_dump --no-owner --no-acl` omits real grants. Dependencies may prevent clean standalone restore without Supabase-compatible environment.
- The PostgreSQL stream mode does not create a full Supabase logical backup; source unit/age roundtrip/PGDMP verification cannot establish recovery.
- Real manual export and isolated compatible actual staging restore must be performed by verified private operator, not from ChatGPT or CI.
- No Supabase DDL, real customer files uploaded, operator credentials handled by assistant, Cloudflare Access changes, n8n, Messenger/Zalo sends or new paid resources.
- Rollback: close Draft PR. No hosted resources created or changed.

## QA
- Review exact final GitHub Actions run/HEAD and record measured tests before claiming SUCCESS.
- Existing unrelated RPC10 six-surface workflow remains FAIL outside this checkpoint.

CHECKPOINT: RPC178E_SOURCE_ONLY · WINDOWS_NO_DOCKER_ENCRYPTED_APP_BACKUP_READY_FOR_QA · LIVE_STAGING_BACKUP_NOT_CAPTURED · STAGING_RECOVERY_NO_GO · STORE_JWT_AB_NO_GO · SCHEMA_MIGRATION_NO_GO
