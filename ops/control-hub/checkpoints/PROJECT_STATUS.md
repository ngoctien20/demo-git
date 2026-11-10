# TIEN404 CONTROL HUB — PROJECT_STATUS

Checkpoint generated: **2026-11-10T09:26:33Z** (UTC). Scope: **independent read-only audits**, not an update of the hosted Control Hub code.

## System inventory — verified via connectors
- Control Hub source/runtime: **UNVERIFIED** in this environment; `chatgpt.site` Site project not mounted, authorized browser not available. Do not claim authentication, D1 persistence or UI ready.
- GitHub website repo: `ngoctien20/demo-git`; latest gh-pages audited commit `7bf9c660e70a65295e80b0fba8c241590d6aa0bf` (2026-11-10), Pages deploy succeeded and browser QA **108/108 PASS** on that commit.
- n8n inventory: **29** workflows (16 active, 13 inactive) as returned by n8n connector. These are private backend metrics, not yet connected to Control Hub dashboard.
- n8n execution history: **1453** recorded (1432 success, 21 errors), including manual tests; not a production-only SLO.
- Four AI SALES workflows have published version different from current draft: Create Order, Manage Order, Update Order, Revenue Report. Do not publish without review.
- Revenue Report last observed execution is a *manual* error, not evidence of a production outage. See private QA evidence.

## Source and limitations
- n8n: authenticated connector read-only queries at this checkpoint.
- GitHub: authenticated GitHub app queries.
- Control Hub public URL: **HTTP 401 AUTH_REQUIRED**, verified from independent GitHub Actions runner on 2026-11-10T09:28:43Z; this does NOT establish whether an authorized session works.
- Control Hub app and D1: **not accessible** to this runtime; no changes attempted.
- A separate read-only monitoring harness was staged and tested successfully: GitHub Actions run `42791015031`, 6/6 tests passed; site HTTP 401, TIEN404 AI HTTP 200, GitHub API reachable. Its outputs are artifacts, not data automatically displayed in Control Hub.

## Safety gate
No production workflow modified, no Sites deployment performed, no tokens exported, no database rows changed. Release readiness: **NOT VERIFIED**.

## Current follow-up — monitor hardening
- Existing PR #1 still draft; staging branch `ops/control-hub-audit-v2-20261110` is the sole change target.
- Existing probe incorrectly lost `Location` on HTTP 302; corrected in staging. GitHub Actions run for this patch must pass before claiming deployed probe works.
- Public-source probe schema v2 adds GitHub `gh_pages_head`, `last_successful_deploy`, `release_alignment` and `freshness` with backward-compatible prior keys.
- Control Hub actual Sites code, authorized login, D1, backup and rollback remain **NOT VERIFIED**; no UI/backend change in live Site.

- GitHub-hosted monitoring regression 14/14 PASS: run `42793920660` (`b72de8e4`); public Site 401, website 200, GitHub Actions reachable, commit alignment SAME_COMMIT. This is not proof of authenticated Site functionality.