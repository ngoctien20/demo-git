# TIEN404 RPC17.8C — Verified checkpoint (2026-11-17 JST)

Parent: RPC17.8B Draft PR #362, HEAD `1c49fcde4b8aece2ddf0f0a3722c342e146e9787` (537/537 source QA + disposable PostgreSQL restore).
Classification: VERIFIED READ-ONLY OWNER SQL AUDIT; IMPLEMENTED NO-HOST SOURCE GATES; REAL BACKUP AND JWT A/B BLOCKED.

## Verified actual Supabase
- Project `ifxlvrhyjhbzbrkdsida` ACTIVE_HEALTHY. No Supabase dev branches read at start.
- `public.qa_owner_pairing`: SECURITY DEFINER, empty search_path, authenticated EXECUTE, active Tenant Owner + synthetic QA/dry-run guards.
- `public.qa_shop_b_zalo_claim`: SECURITY DEFINER, empty search_path, anon EXECUTE, private Vault header gate, synthetic QA Store B only; SQL itself does **not** validate native Zalo provider signature. No direct exploit tested.
- Underlying private challenge/claim functions have expiry/replay checks and lack direct anon/authenticated execute grants in observed ACL inspection.
- No private Vault contents or customer data read; no SQL functions invoked. Security Advisor has RLS-no-policy INFO for private schemas (not proof of breach).
- No connector-provided staging database snapshot/isolated restore acceptance found. RPC17.8B disposable PG17 backup success is not staging recovery evidence.
- No canonical public Store A/B membership or independent merchant authority admitted; real JWT A/B UAT remains NO-GO.

## Implemented source-only
- `qa/v152-rpc178c/owner-contract-audit.mjs` + negative tests: checks known SQL security guard and grant drift; never admits live owner or provider signatures based on QA pairing.
- `qa/v152-rpc178c/staging-recovery-gate.mjs` + negative tests: rejects synthetic CI restore, absent actual signed recovery and backup, scope/DDL and identity proof.
- `.github/workflows/v152-rpc178c-owner-backup-nohost.yml`: RPC17.8C source tests + inherited RPC13–RPC17.8B source regression; NO database migration/deployment.

## Explicit no-go
- No staging backup/restore evidence, no approved exact migration, no verified real provider signature+Store Owner, no real independently validated Supabase JWT A/B sessions.
- No writes to Supabase, auth, Cloudflare, n8n, Zalo/Messenger or merchant/customer systems. Never change Access Allow/credentials/finance.
- Existing unrelated RPC10 workflow failures remain separately open.

## Verified CI evidence
- RPC17.8C Actions run #44097723464 at source SHA `d391ac1391350be54d8146822adc698b479f850c`: SUCCESS, **577/577 Node tests PASS**, 0 failures (40 new RPC17.8C negatives + 537 inherited source regression suites). Tests are synthetic/offline; no real Supabase backup restore, native Zalo signature UAT or genuine JWT sessions were verified.
- Initial CI detected null-input exception in owner SQL auditor; fixed to fail closed before this accepted run.
- Unrelated RPC10 six-surface workflow FAILURE continues outside RPC17.8C.

## Rollback & QA
- Close or revert Draft PR to undo source-only files. No live rollback needed.
- Read exact CI run on final SHA before claiming PASS.

CHECKPOINT: RPC178C_PR366 · CI_577_577_PASS · OWNER_PAIRING_SQL_AUDITED · ZALO_NATIVE_SIGNATURE_NOT_PROVEN · SUPABASE_STAGING_RESTORE_NOT_PROVEN · MIGRATION_NO_GO · REAL_JWT_AB_NO_GO
