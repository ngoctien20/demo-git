# TIEN404 CONTROL HUB — NEXT_ACTIONS

1. Read this status/backlog and compare SHA/current provider state before any change. Do NOT recreate artifacts already present.
2. Open existing Sites Control Hub workspace (historical source path `/workspace/sites/tien404-control/` observed in a previous Work session, not mounted here) in ChatGPT Work; verify deployment auth and D1 version, confirm no unsaved V2 changes.
3. Fetch the latest read-only monitor artifact; verify Control Hub HTTP status. A 401/403 means AUTH_REQUIRED, not service offline.
4. Review standalone monitoring code in staging PR; approve merge only if source, run permissions and cost are acceptable. Daily schedule runs only after merging workflow to repo default branch.
5. Inspect Site routes, permissions, D1 schema and authentication server-side. Design small patch, take Site+D1 checkpoint, test staging before changing existing deploy.
6. Implement read-only backend adapters with short-lived sessions, server-side GitHub/n8n connectors and per-value source/updatedAt; no browser token.
7. Resolve Revenue Report manual invalid-total scenario in separate QA only; do not publish real order workflow or alter Orders/Products without approval.
8. Run authorized E2E browser/keyboard/mobile tests and test backup restore in staging. Track P0/P1 before production release.

Never mark a deployment successful solely from GitHub Actions while Sites and n8n have unverified dependencies. Never backfill UNKNOWN with synthetic numbers.