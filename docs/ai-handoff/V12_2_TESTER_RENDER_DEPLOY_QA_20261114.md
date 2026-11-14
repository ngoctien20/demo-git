# TIEN404 AI V12.2 — Tester Portal Render Staging deployment & QA checkpoint

Date: 2026-11-14 (JST)
Status: DEPLOYED (Render LIVE); HOSTED HTTP/browser E2E unverified; tester access remains closed.

## Verified target
- GitHub repository: `ngoctien20/demo-git`
- Render workspace: `My Workspace`
- Render service: `tien404-auth-staging` (`srv-dbpj4irm8hqs73e2h2rg`)
- Render production-branch setting for THIS STAGING SERVICE: `work/supabase-auth-staging-v1`
- `autoDeploy=no`, publish path `auth-preview-dist`, build `node scripts/build-auth-preview.mjs`
- No changes to GitHub Pages production, customer Orders, or existing Messenger/Zalo/Telegram production workflows.

## Deployment
- Manually triggered after workspace confirmation from owner.
- Live deploy ID: `dep-dbs4h2ei0phs73c3im8g`
- Deployed commit: `749886cc1c92ef71796bab46490b6febeb51fd16`
- Render get_deploy: status `live`, finished `2026-11-14T11:40:00.875261Z`.
- Render events: `build_ended` succeeded, `deploy_ended` succeeded.
- Render build log: `Built staging-only Auth preview: 31 allowlisted assets plus index/404/robots.`; `No data exports, .env, production Orders, dashboards or administrator application.`
- Prior live deploy: `dep-dbs448ui0phs73c2ikg0`, commit `5f121a6c0c402dc5bde679ef48e4db0725040643`, now deactivated.
- Pre-change source rollback branch: `checkpoint/render-auth-staging-pre-guided-tester-v12-2-20261114`.

## QA evidence
- GitHub Actions `43590129694` for guided Tester Portal: SUCCESS, including JS syntax, Auth/RLS contract source tests, strict preview packaging and isolated anonymous Chromium at 390 / 768 / 1440 px. These are source/isolated browser tests, not a signed-in live-user E2E.
- Supabase staging readback after deploy: tester_staff=0; tester_access=0; tester_assignments=0; tester_runs=0; ready_modules=1 (synthetic Sheets only).
- n8n Messenger workflow `Z7FdV7uDvApfbURQ` still active, published version `d5c96b6b-d790-4270-8b0f-d0ebdd8bbd92`; no workflow mutation performed.
- HTTPS direct page checks through model web fetch failed with `not accessible`. Connected Browser read was denied by a browser security-context check. Render request logs did not provide usable request-level records. **Do not claim a verified HTTP 200 or true authenticated UI E2E**.
- Hosted GitHub Actions HTTPS smoke workflow was updated on feature branch at `e63092912ba7064e75087a4aa5ceb2f506f4060d` to check the deployed guides. Its completed result was not verified through available connector tools in this session; treat hosted smoke as PENDING.

## Remaining release gates
1. Verify served HTTPS routes (`tester.html`, `tester-admin.html`, `login.html`, `assets/tester-guides.mjs`) including forbidden private asset paths.
2. Explicit owner identity review and tester Super Admin bootstrap (separate from Merchant Owner); then real signed-in and unauthorized browser tests.
3. Approval/grant/revoke/expiry and cross-module RLS E2E.
4. Verify real Messenger Page, Zalo OA or sandbox bot, Telegram QA recipient and safety flags before enabling external buttons.
5. Email invites, image upload with private Storage RLS, QA fixture import and automated grading remain BLOCKED.

## Rollback
If newly deployed frontend regresses, use Render's prior successful deployment `dep-dbs448ui0phs73c2ikg0` or revert the guided Tester commits on the staging branch, followed by a manual deploy. Do not change production. No schema migration or live notification send to roll back.

## Tracking
Main guided portal PR: #37 merged; guide-only source modifications now on staging.
This checkpoint is intentionally on a separate ops documentation branch, not part of the deployed commit.
