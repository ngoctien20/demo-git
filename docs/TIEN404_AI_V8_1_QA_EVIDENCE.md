# TIEN404 V8.1 — QA evidence

## Auth staging
- Historical Auth CI run 42913004312: success, includes isolated Chromium synthetic transport; does not authenticate with Supabase.
- New negative browser test commit `5e65c5a4bc63ee618de4260f1289921af6496d92`: attempts submitting a manually unhidden password-update form without Supabase PASSWORD_RECOVERY event. Expected status: `Phiên khôi phục không hợp lệ`. Status: IMPLEMENTED_NOT_VERIFIED pending CI.
- Real staging email/password, refresh, logout, recovery and two-tenant E2E: BLOCKED pending approved isolated staging credentials and verified callback allowlist.

## Database
- Read-only inspection: eight public tables have RLS enabled, one SELECT policy each, no browser write policies. No real tenant negative test performed.

## Commerce
- Historical sandbox execution metadata: 1473, 1474, 1479 all SUCCESS; not fresh transaction E2E.

## Release gate
Do not deploy branch until CI is green and HEAD is reconciled with concurrent work. No production promotion.
