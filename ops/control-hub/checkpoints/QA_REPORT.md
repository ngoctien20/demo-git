# TIEN404 CONTROL HUB — QA_REPORT

Evidence collected: 2026-11-10T09:26:33Z (UTC).

| System / test | Result | What this actually proves |
|---|---|---|
| GitHub Pages deployment | PASS (GitHub Actions) | gh-pages commit `7bf9c660…` pages build completed with success |
| Website independent browser QA | **108/108 PASS** | Github Actions run `42789167087` on 2026-11-10 09:15–09:17 UTC; website, NOT Control Hub |
| Website Sass/build QA | PASS | GitHub Actions run `42789166836` |
| n8n inventory API | PASS read-only | 29 workflows, 16 Active, 13 Inactive |
| n8n executions API | PASS read-only | 1453 historical executions: 1432 success, 21 error; includes manual QA |
| AI SALES Revenue Report last sample | ERROR (manual) | Execution ID 936, node error `Invalid paid total at Orders row 2 [line 18]`; not proof of production monetary error |
| Control Hub direct HTTPS from independent runner | **401 AUTH_REQUIRED** | Action `42791015031`, 2026-11-10T09:28:43Z. Authorization required; protected UI not tested |
| Control Hub app source inspection | NOT TESTED | Sites workspace not mounted; do not confuse demo-git website with Hub source |
| Control Hub auth/role/DB persistence | NOT TESTED | Requires protected authorized access and Site source |
| Control Hub 320/390/768/1440 browser UI | NOT TESTED | Browser and source not available here |
| Control Hub backup/restore test | NOT TESTED | No verified private restore/backup package |
| Standalone monitor unit tests | **6/6 PASS locally & GitHub runner** | GitHub Action `42791015031` inspected HTTP status and public GitHub API |

Public probe pipeline should attach `health.json` and `health.md` with **source and checked-at timestamp**, but it does not confer access to Control Hub private APIs.

Release readiness: **NOT VERIFIED**. Unknown/error data must not be made to look green.

## Follow-up safety and regression — staged only
- New probe unit suite: **14/14 PASS locally and on GitHub Actions run `42793920660`** (HTTP 302 `Location`, 401/403, 429, 5xx, branch sorting, release commit comparison, freshness, denylist/allowlist, no secret export, API outage).
- GitHub runner evidence: **PASS** — run `42793920660`, commit `b72de8e40d04198200a55b711e11b827eecbef69`. Probe: Control Hub `401 AUTH_REQUIRED`, website `200 REACHABLE`, GitHub API `REACHABLE`, latest Pages deployment SHA aligned with `gh-pages` HEAD (`SAME_COMMIT`). n8n/Sites auth/D1 remain `UNKNOWN/NOT_TESTED`.
- Site auth, D1, desktop/tablet/mobile and server-side adapters: **NOT TESTED**.
\n## 2026-11-10 — Super Admin V4 sandbox test supplement\n- **64/64 local tests PASS** in isolated FastAPI/SQLite test suite; does not mean existing Control Hub passed auth/RBAC tests.\n- No authenticated browser testing or production D1 backup performed.\n- Production readiness **NOT VERIFIED**. See `ops/super-admin/docs/QA_REPORT.md` and security release gates.\n