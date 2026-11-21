# TIEN404 AI V13.4 — Public Login Demo Removal → Real Supabase Auth Staging

Date: 2026-11-15 JST. Release state: EXPERIMENTAL / DRAFT PR; NOT RELEASED.

## Owner request and observed source

The screenshot shows Cloudflare Pages public site `https://tien404-ai-git-staging.pages.dev/login` with an email-any demo login form. User requested remove that redundant login flow and connect the public website to existing real Supabase Auth login.

Verified GitHub source: `ngoctien20/demo-git` branch `gh-pages` at commit `6bb57e631709cb0be8d3b2b02c299d5915638df8`, file `login.html` had `<form id="saas-auth">` with `demo@example.com`; `assets/saas.js` implements demo-only session and dashboard. This is not real authentication.
Real staging Auth URL already documented in project: `https://tien404-auth-staging.onrender.com/login.html` (Supabase Auth / Render). Do not confuse it with a production authentication service.

Cloudflare Pages project: `tien404-ai-git-staging`, currently points production branch to `gh-pages`. The canonical production deployment was successful and unchanged during this task. NO production branch commit/merge or configuration changes performed.

## Implementation

Branch: `work/v134-public-login-real-auth-route-staging`, based on exact `gh-pages` at SHA `6bb57e6...`.
Draft PR: https://github.com/ngoctien20/demo-git/pull/74 (base: gh-pages; DRAFT only).

Changes:
1. New root `_redirects` (Cloudflare Pages static redirect format) maps both `/login` and `/login.html` to the exact trusted Render staging Auth HTTPS URL using HTTP 302. Cloudflare official docs: https://developers.cloudflare.com/pages/configuration/redirects/.
2. Replaces `login.html` with minimal accessible, scriptless redirect fallback (meta refresh 0 plus real login link, Referrer-Policy via meta), no demo email/password entry or front-end session storage.
3. Adds static security/links QA and Chromium mock-provider navigation test, CI dedicated workflow.

No changes to `gh-pages`, Render, Supabase, billing, credentials, customer records, Zalo, business workflows, existing auth session handling, or user permissions.
Existing public site navigation `href="login.html"` continues to work by redirect on Cloudflare Pages. Other demo routes (`/register`, `/dashboard`, `/checkout`) are intentionally not re-routed under this PR: they require a separate content/QA migration to avoid breaking old demo/testing workflows.

## Verified QA

GitHub Actions run: https://github.com/ngoctien20/demo-git/actions/runs/43681031282.
- `public-login-static`: SUCCESS, 8/8 Node contract tests PASS.
- `public-login-browser`: SUCCESS, Chromium mock target redirects from local `login.html` to exact Render staging HTTPS URL. No actual credentials and no network request to Render (mocked via Playwright), so not an authenticated login E2E test.

Cloudflare API found a new branch preview deployment record for this branch but `latest_stage.name=queued` and `status=idle`. No verified accessible preview URL or HTTP 302 observed at the public Cloudflare route. A real live 302 + Render login + authenticated session acceptance still require staging E2E verification after permitted deployment.

Container DNS also could not access hostnames for live HTTP checks. DO NOT claim the public login is already changed.

## Release gate and rollback

Do NOT merge the Draft PR into gh-pages or otherwise change public production automatically. Before release, obtain explicit production/published branch approval, verify redirect in a protected/test preview and check authenticated Redirect→Render→Supabase login, session, error/recovery link and mobile browsers. Review Cloudflare Access settings (no changes here). If approved, source can be merged then exact 302 and no demo form verified.

Rollback: revert PR #74 commit(s), delete `_redirects` and restore original `login.html`; no database rollback needed. Legacy demo login would reappear if rolled back; it can remain archived only for isolated QA.

## Project architecture clarification

Public marketing "Đăng nhập" = real user Auth service, NOT demo login. Shop account page = view own profile, plan, verified billing, support only. Internal Bot/Order/Customer management = TIEN404 staff console with separate server-verified staff authorization. Account role separation PR #73 is independent and remains Draft.
