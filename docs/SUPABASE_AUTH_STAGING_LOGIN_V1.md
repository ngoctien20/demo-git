# TIEN404 AI — Supabase Auth Login V1 (Staging only)

Snapshot: 2026-11-10 JST.

## Live provider evidence
- Supabase project `tien404-staging` (ref `ifxlvrhyjhbzbrkdsida`) exists, status **ACTIVE_HEALTHY**, region ap-southeast-1.
- Applied migration: `20261110133819_tien404_staging_tenant_read_only_v1`. Eight public tenant-scoped tables and three private tables are present, all RLS-enabled.
- At audit: **0 Auth users and 0 tenant memberships**; two staging tenants. No real user can be authenticated until a valid staging Auth account is provisioned.
- Permissions: `authenticated` has SELECT grants on memberships, tenants and orders; `anon` does **not** have SELECT on memberships. RLS membership `memberships_self_read` restricts rows to `auth.uid()` and `active`; tenant RLS requires active membership. No RLS policy bypass was added.
- Security advisor emits informational `rls_enabled_no_policy` for three `app_private` tables intentionally inaccessible from clients. Review as part of release audit.
- Render plugin is installed and a workspace exists, but the workspace must be explicitly selected/confirmed before inspecting or changing Render services. No Render service or deployment was modified.

## Implemented on branch
- `login.html` now uses email/password auth via `auth.signInWithPassword`; the old arbitrary-email demo login handler is removed from this page.
- `account.html` starts with protected content hidden, verifies identity with Supabase `auth.getUser()`, queries RLS-protected `tenant_memberships` then the corresponding tenant names, and allows sign-out.
- `assets/auth-client.js` pins `@supabase/supabase-js@2.119.0`, uses PKCE and browser session persistence.
- `assets/auth-config.js` holds **only the publishable Supabase key**, which is explicitly designed for public clients. Never use service_role/secret, DB admin keys, Render secrets or n8n tokens in frontend.
- `assets/auth.css` provides mobile and dark-mode text contrast, with explicit visible form fields.
- `scripts/check-supabase-auth-staging.mjs` and GitHub Actions run non-mutating static QA.
- Existing public `gh-pages` login, demo dashboard, Super Admin and n8n are left unchanged until approved.

## Not complete / release blockers
1. No Auth test accounts or tenant memberships. Provision an **approved staging-only test user** with valid email verification; do NOT use customer data.
2. Check Supabase Auth Settings: email provider, confirmation, allowed redirect URLs (including exact login/account URLs) and Site URL. Plugin connector doesn't expose these settings in this session; not verified.
3. Decide whether to enable registration or invitation workflow. **Public registration intentionally disabled** to prevent uncontrolled account/tenant creation.
4. Run real browser login success, invalid password, unverified email, sign-out, session expiry, multi-tab, mobile dark-mode, rate limit and password recovery tests.
5. Test with two staging users in two different tenants: deny cross-tenant memberships and orders; verify no role metadata from user-editable JWT fields.
6. Verify data API exposures and backend identity mapping before enabling any real business data or merchant AI.
7. Confirm Render workspace and review whether a staging backend already exists; no new service/cost without approval.
8. Decide how to integrate with Super Admin PR #2 (FastAPI/SQLite custom IDs) and Data Platform PR #5 (Supabase Auth UUID). Do NOT assume they are already using a single identity provider.
9. Add a server-side session and short-lived scoped gateway before enabling sensitive merchant actions, emails, customer PII or order lookup.

## Rollback
Close draft PR before merge or revert its commits. No provider schema, Auth users, credentials or production data were modified. No real production website redeploy was triggered.

## Useful provider docs
- Supabase Auth password sign-in: https://supabase.com/docs/guides/auth/passwords
- Supabase redirect URL allowlist: https://supabase.com/docs/guides/auth/redirect-urls
- Supabase session verification: https://supabase.com/docs/reference/javascript/auth-getuser
