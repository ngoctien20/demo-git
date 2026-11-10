# TIEN404 AI — V8 continuation checkpoint (2026-11-11)

## Scope and provenance
Continued prior Work V7.1/V8 on existing Supabase Auth staging branch; did not restart project or touch production. This checkpoint records only verified GitHub changes, not a claim of completed hosted E2E.

## Auth recovery hardening
- Commit `5ce55c5a7cc4a1d264ad34041a5b9d307cce07e0`: Require both a recovery callback indicator and a Supabase `PASSWORD_RECOVERY` event before enabling the password-update action; clear verification state after successful recovery.
- Commit `0f3be952e8cfdbb2855e6ab02dff24d74baf6290`: Add `tests/auth-recovery-guard.test.mjs` with three source regression assertions.
- Commit `6ee761c3fca6041b0ea18a72220b92d6f99e0328`: Wire this test into Auth staging CI push path filter and Node test runner.
- Read-back verification confirmed source contains event guard, verified state requirement, state reset, and regression test file.
- **No current successful CI result for this commit has been observed at checkpoint creation**; do not mark QA PASS until an actual run completes. The guard is not a substitute for browser E2E with a real recovery email.

## Remaining P0
1. Wait for GitHub Actions CI on `6ee761c`; investigate if no run appears.
2. Validate PKCE recovery event behavior with a disposable authorized staging account, approved callback URLs, and no password disclosure.
3. Test actual Supabase login/refresh/logout on Render Auth staging; last known deployed build predates recovery guard.
4. Test two separate authorized staging identities for Shop A and Shop B, RLS deny checks for SELECT and write paths.
5. Review session timeout and SDK import fallback behavior on Android dark mode.
6. Do not deploy Auth staging until CI and preview artifact QA pass.

## Related previously verified snapshot (must recheck before reuse)
- PR #7 Auth staging; `gh-pages` production separate.
- Render Auth Static Site `srv-dbpj4irm8hqs73e2h2rg`, last previously confirmed LIVE deploy `dep-dbpo69u1egvs7390iv80` at `404b63b`.
- Four Control Hub tasks: only Published inventory of seven n8n workflows was verified; tenant isolation, inventory transaction/idempotency and website/backend E2E remain open.
- Work V8's Dashboard, Bot Registry and Commerce objectives remain unverified until implemented and tested.

## Change safety
- GitHub feature branch changed: YES.
- Render deployment triggered this continuation: NO.
- Supabase database/Auth mutations: NO.
- n8n published workflow changes: NO.
- Production `gh-pages` changed: NO.
- Pilot readiness: NOT READY.
