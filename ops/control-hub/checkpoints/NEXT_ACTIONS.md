# TIEN404 CONTROL HUB — NEXT_ACTIONS

1. Read this status/backlog and compare SHA/current provider state before any change. Do NOT recreate artifacts already present.
2. Open existing Sites Control Hub workspace (historical source path `/workspace/sites/tien404-control/` observed in a previous Work session, not mounted here) in ChatGPT Work; verify deployment auth and D1 version, confirm no unsaved V2 changes.
3. Fetch the latest read-only monitor artifact; HTTP status is **401 AUTH_REQUIRED** at 2026-11-10 09:28 UTC. Verify authorized Sites route/session: a 401/403 for an anonymous request alone is not a service outage.
4. Review standalone monitoring code in staging PR; approve merge only if source, run permissions and cost are acceptable. Daily schedule runs only after merging workflow to repo default branch.
5. Inspect Site routes, permissions, D1 schema and authentication server-side. Design small patch, take Site+D1 checkpoint, test staging before changing existing deploy.
6. Implement read-only backend adapters with short-lived sessions, server-side GitHub/n8n connectors and per-value source/updatedAt; no browser token.
7. Resolve Revenue Report manual invalid-total scenario in separate QA only; do not publish real order workflow or alter Orders/Products without approval.
8. Run authorized E2E browser/keyboard/mobile tests and test backup restore in staging. Track P0/P1 before production release.

Never mark a deployment successful solely from GitHub Actions while Sites and n8n have unverified dependencies. Never backfill UNKNOWN with synthetic numbers.

## New stage gate (staging, prior to any Sites edit)
9. Confirm updated PR monitor returns correctly differentiated `AUTH_REQUIRED`, `RATE_LIMITED`, `SERVICE_ERROR`, `STALE`, `SAME_COMMIT` and `DEPLOY_BEHIND_BRANCH`. 14 regression tests are now verified by GitHub Actions run `42793920660`; do not merge without owner approval and authenticated Sites review.
10. Review `CONTROL_HUB_INTEGRATION_CONTRACT.md` and `AUTH_TEST_MATRIX.md` against the **actual** Sites runtime; apply minimal in-place patches only after source/D1 backups and authorization are verified.
11. Preserve the signed-off PR branch as checkpoint; do not add private n8n inventory or execution data to the public repository.
\n## 2026-11-10 — Resume Super Admin V4 safely\n1. Review stacked staging PR branch and independent CI run before any merge.\n2. Re-open the existing Sites Control Hub project in authorized ChatGPT Work; inspect current framework, auth, D1 tables and backup first.\n3. Port ONLY the tested policy modules and API contract into the existing backend after review; do not directly deploy the Python/SQLite reference.\n4. Do not reuse AI_SALES_DEMO Orders/Products/credentials for Commerce or publish any n8n workflow without owner approval.\n5. Keep P0 financial/auth and tenant isolation barriers ahead of UI polish.\n