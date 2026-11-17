# TIEN404 AI — RPC10.1 CI YAML Integrity Recovery
## Six-Surface Store RLS: source QA and disposable PG17 jobs restored

**Date:** 2026-11-17 JST. **State:** IMPLEMENTED (source-only); CI acceptance to be verified against exact HEAD.
**Parent:** [RPC10 PR #247](https://github.com/ngoctien20/demo-git/pull/247), exact HEAD `e25d8e203143e5079f6204ccacdefd44caafe604`.

### Root cause proven by read-only GitHub inspection

GitHub Actions [run 44077329204](https://github.com/ngoctien20/demo-git/actions/runs/44077329204) at inherited RPC13.1 PR #323 exact HEAD `c916332f95c19d4533b5b47f77f190c492cc3d3d` had **failure with 0 jobs**, despite native RPC13/13.1 test runs succeeding. This is an Actions workflow parser/admission error, not a failed database test.

The unchanged inherited `.github/workflows/v152-rpc10-six-surface-nohost.yml` file blob `825ce7daeb388f9132831a3ae4dec16d3bbbd73d` was confirmed identically malformed at RPC10 PR #247 itself, as well as #279/#281/#285/#323:
- the G0.2 Python provenance scan was cut mid `assert re.search` (original line 63);
- an unintended `run: |` appeared inside the Python block;
- the two disposable PG17 jobs were repeated with duplicated YAML keys;
- a fragment `,no_comments,re.I)` appeared outside its intended Python assertion.

### Safe implemented fix

Exactly **one file restored**: `.github/workflows/v152-rpc10-six-surface-nohost.yml`.

Keep the original protective content and exactly three distinct jobs:
1. `rpc10-offline-gate` — G0.1 alias, G0.2 provenance READ-ONLY, G0.3 published caller, baseline NO-GO and source no-I/O lint.
2. `rpc10-disposable-pg17` — non-hosted PostgreSQL 17 six-surface RLS/FK rehearsal and transaction rollback.
3. `rpc10-concurrent-reader-blackout` — non-hosted PostgreSQL 17 lock / COMMIT / ROLLBACK race test.

Remove duplicate chunks; restore G0.2 `assert re.search(r'COMMIT\\s*;\\s*$',no_comments,re.I)` and its existing subsequent checks. Keep synthetic DB target `t404_rpc8_ci`, `T404_RPC8_DISPOSABLE=YES`, no hosted credentials and no production-target migration.

Add `qa/v152-rpc10/workflow-shape-integrity.test.mjs` with positive and tampered negative checks: exactly three jobs, balanced here-doc markers, no duplicated PG17 commands, mandatory NO-GO strings, valid G0.2 SQL assertion, and no detached Python fragment. Run this test inside the same RPC10 offline job. It does not access network or database.

### QA acceptance boundaries

**Source tests pass** only when the repaired GitHub workflow is recognized and Actions creates **all three jobs**. Actual PG17 job SUCCESS is independent evidence of disposable local DB RLS simulation, **not** real Supabase Store A/B Auth, owner JWT, hosted RLS migration, or production readiness.

**Existing issues retained:** V17.03B PR #310 categorizes the four ambiguous 2026-11-10 legacy rows as `QA_LIKELY_NOT_VERIFIED_SYNTHETIC`; RPC13.1 #323 fixes the Windows NTFS JWT file read. Neither permits real Merchant uploads or UAT without original provenance, independent verified authority and recovery approvals.

### Risk / rollback / approvals

Scope: additive Draft child of RPC10 owner branch. No n8n execution/publish, Cloudflare Worker or Access change, Meta Graph call, JWT credential access, Supabase hosted read/write in this change, paid model, Auth/Store RLS or billing changes. GitHub CI might start disposable synthetic PostgreSQL containers, explicitly constrained to test-only data.

Rollback: **close the child Draft PR**; do not reset/revert parent PR #247 or any RPC11/RPC12/RPC13 branch. Merge/rebase propagation to descendants **requires conflict review and independent QA**; no parallel PR is overwritten.

**Release gate:** even fully passing RPC10 CI does not set `canMigrate`, `canBackfill` or `canRelease` true. All hosted Store ownership remains NO-GO until separately approved.
