# TIEN404 V15.0-09C — PRIVATE RECOVERY EVIDENCE & REHEARSAL SOP
Date: 2026-11-16 JST | Classification: PRIVATE RECOVERY PLAN / NOT HOSTED BACKUP CERTIFIED

## Verified plan and tool availability
- Supabase organization pjdoiuhtwrhzkzlhelvr is on plan free / tier_free.
- Official Supabase docs: scheduled daily backups are documented for Pro, Team and Enterprise. For free tier, Supabase recommends regular manual exports with Supabase CLI db dump and off-site backups. https://supabase.com/docs/guides/platform/backups
- Supabase plugin lists migrations and branches, but does not expose a backup list/restore verification action in this session. 14 migration history entries and 0 Supabase development branches were enumerated; **neither constitutes proof of any recoverable backup**.
- No hosted logical or physical backup file was read, exported, downloaded, created, or restored during this task.
- Database backups may not include Storage object bytes. Verify Storage separately if applicable; backup metadata alone does not prove recovery.
- Cannot truthfully claim a real Supabase RPO/RTO or snapshot age without recovery trial.

## Recovery Level 0 — Safety and approvals (BLOCKED)
- Merchant/owner and security reviewer identify which staging project and which data may be backed up.
- Authorize read-only logical backup using least-privileged backup connection and approved isolated environment. Avoid sharing DB password, service_role JWT or credentials in Chat/GitHub.
- Confirm destination: private encrypted vault/off-site storage with access log, retention, access owner, encryption key custody. No public GitHub artifacts or CI uploads.
- Approve backup content/scope and whether it covers auth roles, schema, extensions, RLS, tenant membership, external provider mapping, Storage object files and business data. Do not assume the same procedure covers all.
- Establish explicit target RPO/RTO after measurement; no invented availability/cost guarantees.

## Recovery Level 1 — Isolated SIMULATED proof (implemented, ephemeral CI)
- GitHub Actions launches disposable PostgreSQL 17 container with synthetic Tenant A/B and Store A/B/C.
- Reuses V15.0-09B mock (UNSIGNED) auth.uid() claim RLS fixture.
- pg_dump produces a custom-format *synthetic* snapshot; pg_restore loads an *independent disposable* database in the same ephemeral container.
- Verifies SHA-256 exact file integrity; 2 Tenants/3 Stores/4 Store Members/3 Products/2 Orders/0 OrderItems; unique Store SKU; FORCE RLS, restrictive Store policy, composite FK and A→B negative read.
- Deletes synthetic dump at end and never uploads archive or real customer/merchant records.
- This demonstrates an example mechanism only. **It does not prove real hosted backup availability or restore competence for Supabase-specific Auth, Storage, Realtime, extensions or privileged roles**.

## Recovery Level 2 — Real hosted staging BACKUP (requires separate approval)
- Privately verify a valid authorized backup mechanism for the Free-tier project; note no guaranteed scheduled daily backup.
- Use officially documented CLI/logical export or authorized Management API; never trigger backup from a public CI workflow.
- Copy to a controlled encrypted location, record file size and cryptographic digest privately, backup timestamp, exporter identity, source version, DB migration list and reconciliation.
- Capture required table counts and referential integrity metrics **without exporting rows to public logs**.
- Confirm how external dependencies (n8n Google Sheets DEMO, Telegram/Zalo bindings, Cloudflare KV/D1 and Storage) are recovered separately.
- Do NOT mutate Hosted Supabase credentials, migration history or real data.

## Recovery Level 3 — Actual RESTORE REHEARSAL (requires separate approval)
- Restore ONLY to a newly approved isolated DB/project with separate access and known costs.
- Validate schema, RLS/FORCE RLS, policies, GRANT/EXECUTE, tenant/store identities, secure Auth, roles, object storage pointers, idempotency/outbox and regression queries.
- Run Shop A vs B (same Tenant), C (different Tenant) JWT-negative tests with dedicated synthetic Auth sessions; never impersonate merchant.
- Compare source snapshot to restored snapshot using protected checksums & aggregate counts, not raw PII in logs.
- Prove RPO/RTO against approved objective, simulate revoke and restore, capture signed rollback readiness.
- Reject any resume of live send/Order workflows without separate merchant approval.

## Private Recovery Receipt Required Fields (all presently UNVERIFIED for hosted)
- project_ref_hash, environment, backup_type, source_db_version, migration_head
- snapshot_time, restore_target, restore_time, objective_RPO, observed_RPO, objective_RTO, observed_RTO
- digest_verified, schema_match, data_counts_match, RLS_RESTRICTIVE_verified
- role_and_grant_reviewed, Auth_session_reviewed, Storage_coverage_reviewed, Outbox_replay_verified
- encryption_at_rest, private_destination_evidence, access_reviewer, custodian, retention_expiry
- owner_signed, security_reviewer_signed, rollback_rehearsal_passed
- hosted_backup_verified=false, hosted_restore_verified=false, approve_migration=false

## Rollback / Release
Closing the 09C GitHub Draft PR reverts only source changes. No hosted rollback is needed because no Supabase changes were made.
An actual hosted migration must have its own independently tested restore and rollback strategy. Never DROP live Store objects or auto-backfill unassigned legacy Products/Orders.
G0 and G2.3 remain BLOCKED. Future Owner certification, Staging Signed JWT/RLS, migration and real sends require independent authorization.
