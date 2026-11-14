# TIEN404 AI V12.2 — Tester Super Admin Staging Bootstrap Checkpoint

Date: 2026-11-14 JST
Environment: Supabase project **tien404-staging** (not production)
Change type: ONE approved database row insert into `public.tien404_tester_staff`.
Authorization: explicit owner approval in the private ChatGPT project conversation.
Privacy: this checkpoint intentionally does not contain an email, Auth User ID, secret, password or token.

## Verified before change
- Target Supabase project ACTIVE_HEALTHY.
- Exactly one existing, verified, previously signed-in Supabase Auth account matched the owner's approved email; exact Auth UUID checked privately.
- Tester staff table had zero rows; no existing Tester Admin was overwritten or promoted.
- Table `tien404_tester_staff` had RLS and own-active-SELECT policy, no client INSERT/UPDATE/DELETE grant.
- Other Tester RLS policies restrict privileged admin/QA operations to separately bootstrapped active staff.

## Implemented
- Inserted one exact approved existing Auth UID as `staff_role='super_admin', active=true`.
- INSERT constrained by exact email+UUID, verified email, prior sign-in, unique email match and empty staff table, with `ON CONFLICT DO NOTHING`.
- DB creation timestamp: 2026-11-14T12:27:12.750349Z.
- No other row, schema, function, RLS policy, Supabase Auth credential, merchant membership, workflow or production configuration changed.

## TESTED — readback and read-only RLS probes
- Separate SQL readback: exactly **one** active tester super_admin in staff; 0 tester access grants.
- Simulated `authenticated` session with approved admin's real Auth UID:
  - own active staff row: 1
  - visible tester modules: 6
  - visible QA cases: 137
  - access and result rows: 0 (no testers/report data yet)
- Simulated `authenticated` session with an unauthorized synthetic UID:
  - visible staff/modules/cases/access/runs: **0** each.
- `authenticated` session with missing user claim:
  - `auth.uid() = null`; visible staff/modules/cases: **0** each.
- GRANT inspection: `anon` cannot SELECT tester_staff; `authenticated` cannot INSERT/UPDATE/DELETE tester_staff.
- All RLS probes ran in read-only transactions and rolled back; no test data written.
- Existing hosted HTTPS QA / deployment from earlier V12.2 checkpoint remains valid; **real interactive signed-in browser E2E has NOT yet been executed**.

## User acceptance instructions
1. Open https://tien404-auth-staging.onrender.com/login.html
2. Sign in using the approved existing Supabase Auth account, with credentials entered privately (never in chat).
3. Navigate to https://tien404-auth-staging.onrender.com/tester-admin.html using the SAME browser/session.
4. Verify staff label `super_admin`, controls `Cấp quyền Tester` and `Phân công bài thử`, 6 module definitions, 0 tester accounts, 0 results.
5. Do not share privileged admin link with invited testers; they use `tester.html` after separate approval.
6. If access denied, log out, sign in as the exact approved account and reload; do not bypass RLS. Report sanitized browser screenshot and status only.

## Remaining gates / safety
- No public self-registration or invitation sending enabled.
- No real tester grant/revoke/expiry or real-session E2E has yet been verified.
- Initial friend onboarding needs an existing confirmed Supabase Auth account; Portal currently expects Auth User ID instead of email. A trusted invite backend would be a separate approved phase.
- Messenger/Zalo/Telegram provider channels remain subject to their own staging readiness; no real sends/orders authorized by this grant.
- Rollback requires separately approved scoped deactivation of the one inserted `tien404_tester_staff` row for the verified UID. Do not delete users or change production.
