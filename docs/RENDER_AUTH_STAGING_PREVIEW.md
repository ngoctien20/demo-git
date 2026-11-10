# TIEN404 Auth — Render staging deployment checkpoint

Date: 2026-11-10 JST. **Public preview only. Not production.**

## Render resources
- Workspace: My Workspace (`tea-dbphgh0n74is73dvsnng`)
- New service: `tien404-auth-staging` (`srv-dbpj4irm8hqs73e2h2rg`), **Static Site**
- Preview: https://tien404-auth-staging.onrender.com/login.html
- Account route: https://tien404-auth-staging.onrender.com/account.html
- Dashboard: https://dashboard.render.com/static/srv-dbpj4irm8hqs73e2h2rg
- Repo: `ngoctien20/demo-git`, branch `work/supabase-auth-staging-v1`
- Build: `node scripts/build-auth-preview.mjs`, publish directory `auth-preview-dist`
- Auto-deploy: **OFF** (manual release; preserves safe draft branch workflow)
- Initial deploy `dep-dbpj4j3m8hqs73e2h3g0` reported **live** from Render API. This is deployment metadata, not a complete browser E2E test.
- Render Static Sites are free to deploy, but shared workspace bandwidth and build-minute quotas apply; check https://render.com/docs/free before heavy traffic.
- Existing `tien404-data-staging` web service and GitHub Pages `gh-pages` were not changed.

## Supabase Auth
- Project `tien404-staging` already has a verified Auth user and active `owner` membership for TIEN404 QA Shop A.
- Its Site URL is currently GitHub Pages; existing allowed redirects include exact GitHub Pages `login.html` and `account.html`.
- **User action required:** add both *Render staging URLs* in Supabase Authentication → URL Configuration → Redirect URLs:
  - `https://tien404-auth-staging.onrender.com/login.html`
  - `https://tien404-auth-staging.onrender.com/account.html`
- Keep Site URL unchanged until production migration is deliberately approved. Password login does not require redirect allowlist, but email recovery redirects do.
- Render preview build intentionally disables the **Forgot password** button until Render login URL is allowlisted. Source PR keeps recovery code. After allowlist verification, remove this preview-specific disabled attribute, run QA, then manually redeploy.
- No Supabase credential/service_role, real customer data, Auth user, migration, tenant grants or Orders modified.

## Verification and tests
- GitHub Actions static Auth and navigation checks passed before first deployment, including allowlisted file build and isolated tenant-scoping unit tests.
- Remaining: (1) verify HTTP response and browser hydration of deployed preview, (2) user-controlled password login (do not share password), (3) Shop A-only membership rendering, (4) failed password/no session/expired session, (5) logout, (6) Android dark mode and keyboard, (7) email recovery after redirect allowlist, (8) second test-user cross-tenant isolation.
- Render deploy status `live` does not prove login works; browser tool could not access the new Render hostname in this session.
- Do not merge PR #7 into `gh-pages` without staged E2E and security signoff.

## Rollback
- Delete/suspend only the newly created Render Static Site using Render Dashboard if no longer needed. Do not alter `tien404-data-staging`.
- No automatic deployments; future branch changes need deliberate `trigger_deploy`.

## 2026-11-11 00:38 JST · Bản đang phục vụ
Render xác nhận LIVE `dep-dbpjiv1srm7s73aur350` tại `7d0c5754`. Đã kiểm Cloud Browser sau deploy. [QA, rollback và cổng recovery](SUPABASE_AUTH_V2_CHECKPOINT.md).


## 2026-11-11 05:48 JST · Login loading timeout hotfix

- Reported symptom: login appears to load or sign in indefinitely on mobile. Cause **not conclusively reproduced on the user's browser**.
- Source finding: import of Supabase ESM via one CDN and multiple Auth/database awaits previously lacked explicit timeout and useful retry UI.
- Feature branch fix: `assets/auth-client.js` now tries pinned jsDelivr and esm.sh ESM with bounded import; `assets/auth-runtime.mjs` enforces bounded operations; `assets/auth-bootstrap.js` displays slow/failure when main module never starts; login/account have error + safe retry states.
- Built preview allowlist includes both new assets; auth credentials remain server/browser-held, **no service-role token**.
- Tests: GitHub Actions https://github.com/ngoctien20/demo-git/actions/runs/42898728070 **SUCCESS** (syntax, unit timeout guards, artifact safety, simulated mobile Chromium). Navigation https://github.com/ngoctien20/demo-git/actions/runs/42898728163 **SUCCESS**.
- Deployed: Render `dep-dbpo69u1egvs7390iv80` at commit `404b63b10d78b969704e660ff938b4489b7bcf2d`, confirmed **LIVE** by Render.
- Browser endpoint to verify: https://tien404-auth-staging.onrender.com/login.html?v=authfix11
- **Not yet verified:** real password sign-in on user's phone and a real Supabase authenticated session. User should retry and report the *nonsecret error message* or successful Shop A view. Static site logs did not expose relevant request traces.
- Published n8n and GitHub Pages production were **not changed**.
- Control Hub checklist status / execution evidence is in `docs/CONTROL_HUB_CHECKLIST_20261111.md`.
