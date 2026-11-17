# TIEN404 CBOT-UAT08A — Strict RPC7 receipt parser fix (NO HOSTED WRITE)

**2026-11-17 JST | Source-only CI remediation; private M0 recovery remains NO-GO.**

## Exact parent / finding

- Parent [CBOT-UAT08 PR #230](https://github.com/ngoctien20/demo-git/pull/230) pinned HEAD `66e8fa8c6ca774bd8b626448443ff1a0b07f3007`, preserved unchanged.
- Actual GitHub Actions [43886424836](https://github.com/ngoctien20/demo-git/actions/runs/43886424836) and [43886413198](https://github.com/ngoctien20/demo-git/actions/runs/43886413198): source regressions and exact pinned RPC7 preflight/dirty-check succeeded; the positive **synthetic** local archive fixture returned `CBOT08_SAFE_RECEIPT_FIELD_COUNT=8`, `CBOT08_RESULT=BLOCKED`, `CBOT08_REASON=RPC7_READ_ONLY_RECEIPT_NOT_CONFIRMED`.
- Original pinned RPC7 PowerShell emits ten allowlisted summary keys including `m0Approved=false` and `m1Authorized=false`. The CBOT08 wrapper used `^[A-Za-z]+$` on the key, silently excluding those two required numeric-bearing names. **This is a parsing defect, not proof of a damaged real backup or successful real restore.**

## Minimal safe fix

- Replace only the identifier format with `^[A-Za-z][A-Za-z0-9]*$` and retain the exact `$allowed` whitelist (no arbitrary keys).
- Keep **all three** mandatory approval checks: `receiptSavedLocally=true`, `m0Approved=false`, `m1Authorized=false`.
- Extend existing test suite with one focused regression checking digit-bearing allowlisted keys and refusal of injected names. CI continues to run exact pinned RPC7 source against fake local archive (5 Application, 0 Auth, 0 Storage) and corrupted fake archive.

## Governance

- **NO** real `TIEN404_V142_PRE_RLS.backup` read, copied, uploaded or restored. No `pg_dump`, `pg_restore -d`, live token, Supabase DDL/DML/RLS, Auth/Storage export, Cloudflare or Meta/Zalo/n8n action.
- Historical H11R local 5/5 Application, 0/3 Auth and 0/2 Storage remains **PARTIAL APPLICATION ARCHIVE — OWNER ACCEPTED WITH LIMITATIONS**, not a complete, current, independently witnessed restore.
- Independent Controller, Security Reviewer, DB and Backup Operator approval is still required before any real M0 scope/full restore, Store migration or Auth JWT UAT.
- Source rollback: close this child Draft PR. Parent PR #230 and all hosted resources remain untouched.

**Checkpoints:** `RPC7_ORIGINAL_PINNED · RECEIPT_NUMERIC_KEY_FIX_SOURCE_ONLY · REAL_ARCHIVE_UNTOUCHED · M0_NO_GO · STORE_AB_NO_GO`.

## Native Windows 2022 independent acceptance (2026-11-17 JST)

- The original CBOT-UAT08 operator launcher was previously CI-tested only with PowerShell on Ubuntu; this child adds a separate `windows-2022` job to the existing workflow, without touching the parent PR.
- Runner checks out pinned RPC7 PR198 source at `4f7bef71f54ee17b88449026b90803ccf9743e30` and executes `qa/cbot-uat08/windows-native-m0-fake-fixture-qa.ps1` with a native Windows `.cmd` local `pg_restore --list` mock. It never reads or opens any real user archive.
- Real native Windows job verifies matching exact SHA and clean checkout, rejects deliberately wrong SHA and untracked source, then accepts a synthetic 5 Application / 0 Auth / 0 Storage local TOC only as `LOCAL_ARCHIVE_INSPECTED_NOT_CERTIFIED`, keeping `M0_ACCEPTED=false` and `HOSTED_MIGRATION_AUTHORIZED=false`.
- Windows fake-run stores exactly one private-only receipt beneath the disposable CI `LOCALAPPDATA` path and emits allowlisted test markers only, without displaying archive paths. Native Windows job has **no database connection, no real pg_restore, no Merchant records, no token and no network provider send**. Original Ubuntu job separately tests a corrupted fake archive with actual local PostgreSQL `pg_restore --list`.
- **Exact source HEAD CI checked before this documentation amendment:** [GitHub Actions 44086832937](https://github.com/ngoctien20/demo-git/actions/runs/44086832937), **2/2 jobs SUCCESS** on Windows 2022 and Ubuntu 24.04, with inherited 355/355 Ubuntu Node checks and native Windows fake fixture checks. Verify any later documentation-only HEAD CI independently.

### Scope / remaining independent gates

Native runner compatibility for the source-only scanner is now TESTED. This is **not** a signed `TIEN404_V142_PRE_RLS.backup` inspection, a verified current M0 full-service archive, an Auth/Storage restore, a customer-data recovery or a go-ahead for hosted Store isolation. The historical H11R application-only archive remains owner-accepted with limitations (5/5 Application, 0/3 Auth, 0/2 Storage). Independent Backup Operator and Security Reviewer still must accept a current backup and witnessed off-host restore before the separately approved M1/M2+M4 migration. No external authorization is inferred from CI.

**Rollback:** revert this child Draft's native test script, additional workflow job and checkpoint text, or close PR #339. No hosted state was modified.
