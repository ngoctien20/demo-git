# TIEN404 AI V14.4A — P0 Store / Backup / Hosted RLS Evidence Checkpoint
Ngày: 2026-11-15 JST. Môi trường: Supabase tien404-staging (ifxlvrhyjhbzbrkdsida).
Trạng thái: **STAGING PREPARATION / DRAFT / NO DDL, NO BACKFILL, NO RLS CHANGE**.

## Live verified baseline (read-only)
- PostgreSQL Supabase 17.11 ACTIVE_HEALTHY; migration history chốt đến 20261114170717.
- public.stores và public.store_memberships: ABSENT.
- Products, Orders, Customers, Order Items, Conversations, Messages: **không có store_id**.
- Rows count: Products 2, Orders 2, Customers 0, Order Items 0, Conversations 0, Messages 0.
- products_member_read, orders_manager_read, customers_manager_read vẫn cấp SELECT theo tenant_memberships: **same-tenant multi-store isolation NOT VERIFIED**.
- SECDEF advisory: anon EXECUTE qa_shop_b_zalo_claim; authenticated EXECUTE qa_owner_pairing, save_merchant_product. Đây là security review flags, không phải proof of exploitation.
- Latest V14.2.1 source PR #86 head 635e1d8e634556887eb35fd318b892c740177a9e (advanced after this branch was created). GitHub Actions run 43718599637 SUCCESS, 340/340 Node tests and 6/6 browser viewports, ALL OFFLINE. New onboarding-scope-service.cjs already handles scoped draft sessions in OFFLINE_TEST; do not reimplement it.
- Messenger replay PR #95 head ad35baec097a7e8289518ec66ff74b1a19f1b3d3; its disposable PG17 concurrency tests **do not** substitute for Supabase hosted RLS.

## Backup/restore gate
- Owner screenshots in latest V14.2.1 checkpoint verify local Windows `TIEN404_V142_PRE_RLS.backup` on E: (~212 KB), `pg_restore --list` exit 0 with application objects and SHA256 computed. This is **OPERATOR-EVIDENCED INSPECTION**, not a tested restore.
- The backup bytes and checksum value are not accessible in this session for independent reproduction. Actual restore, row integrity and full Supabase disaster recovery remain **NOT_VERIFIED**. Owner previously deferred isolated restore but this V14.4 request prioritizes attempting it safely when a local isolated database becomes available.
- This PR adds `qa/store-rls-v144/TIEN404_V144_Backup_Evidence.ps1`: inspect-only by default; optional restore ONLY to existing empty LOCAL database whose name begins `tien404_restore_v144_`.
- The script enforces 127.0.0.1 destination, excludes --clean/--create, no automatic DROP/CREATE database, outputs SHA256/manifest flags and schema object count only. It has **NOT BEEN EXECUTED** on owner's actual archive or tested on Windows PowerShell here.
- Successful archive manifest inspection is NOT equivalent to successful restore. Even a successful local restore to plain PG17 may lack Supabase-managed roles, extensions, storage, external credentials or Auth service state: perform comparison before judging disaster recovery.

### Owner-private local validation (example only)
1. Locate `pg_restore.exe`, `psql.exe`, and the original backup file on your Windows PC.
2. Run PowerShell (substitute YOUR paths; do not paste secrets):
   ```powershell
   .\TIEN404_V144_Backup_Evidence.ps1 -BackupPath "D:\TIEN404\TIEN404_V142_PRE_RLS.backup" -PgBinDir "C:\Program Files\PostgreSQL\17\bin"
   ```
3. For restore, use ONLY a manually created, isolated, empty PostgreSQL 17 LOCAL database with a disposable name like `tien404_restore_v144_qa01`. After private readiness review, rerun with `-RestoreLocal -RestoreDatabase "tien404_restore_v144_qa01"`. The helper refuses target names outside the disposable prefix.
4. Record sanitized JSON output (SHA256, manifest, restore status, public table count). Do not upload the archive, user JWT or password. A schema-count success alone is still **PARTIAL RESTORE EVIDENCE**; perform constraints/policies/row-count consistency review in local environment.

## Store RLS release gates
- [ ] Verified restoration, schema + row integrity, rollback signoff.
- [ ] Four-row Product/Order mapping with owner and independent review. No guessing from tenant_id.
- [ ] Explicit approval for staging DDL/RLS/backfill; current proposal SQL must stay non-executable.
- [ ] Two users within SAME tenant assigned to distinct stores, plus cross-tenant QA.
- [ ] Real auth JWT hosted positive/negative RLS using publishable key, not service_role.
- [ ] Audit write RPCs and replacement of old tenant-wide permissive OR policies atomically.
- [ ] No store data leaks; no production traffic until signoff.

## Rollback / scope
Current changes add a new file and checkpoint only. Rollback: close Draft V14.4A PR; PR #86 unchanged. No Supabase migration, Render change, n8n publish, Meta send, cost incurrence or customer-record write.

## Next
Once restore evidence and per-record ownership are approved, prepare an executable versioned migration in a separate controlled approval phase, then actual hosted JWT QA. Store Security remains **BLOCKED** until then.
