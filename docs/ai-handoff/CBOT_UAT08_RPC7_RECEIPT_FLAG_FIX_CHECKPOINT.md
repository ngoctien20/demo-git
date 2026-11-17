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
