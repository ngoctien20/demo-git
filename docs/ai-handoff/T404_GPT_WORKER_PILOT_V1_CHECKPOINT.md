# TIEN404 — Autonomous Engineering Pilot V1 · GPT Worker checkpoint

**Date:** 2026-11-21. **Status:** TESTED (local + Docker Linux), CI pending on Draft PR. **Base:** `develop` @ `00aff9b7`.
**Branch:** `chore/gpt-worker-develop-tests-20261121`, code commit `ca929666`.

## Flow exercised (one real pass)
Owner request → Claude (plan, P1 selection) → Claude Code (implementation on isolated worktree branch)
→ Codex Worker (1 read-only review call) → Claude triage against probes → fixes → independent QA → push → Draft PR (owner opens; connector lacks PR write).

## Task (P1, safe, independent)
GPT Worker tooling had zero tests and PR #478 targeted `main` with a Jekyll workflow already deleted on `develop`.
Re-targeted tooling to `develop`; added 17 offline tests and CI; fixed 5 verified guard gaps
(dotenv variants, secret content, secret env forwarding, drive-relative paths, check/read race).

## QA evidence
| Check | Result |
|---|---|
| `test_gpt_worker.py` Windows Py3.13 | 17 ran, OK (1 skip: symlink privilege) |
| Same, Linux Docker `--network none` Py3.10 / Py3.12 | 17 ran, OK (symlink test executed; 2 Windows-only skips) |
| Mutation: remove `.env` fix | 3 failures (tests are effective) |
| Dry run on real repo files | Not self-blocked |
| `codex login status` with scrubbed env | `Logged in using ChatGPT` (no model call) |
| `qa_static.py` | 26 pages, 795 links, 0 errors |
| `test_motion_contract`, `test_v4_frontend` | OK |

Codex Worker report: `~/.tien404-ai/gpt-worker-reports/gpt_worker_20261121_110009_908166.md` (local only).
Confirmed 5/8 findings; junction escape and approval-flag claims not reproducible; `C:x.py` stays inside root.

## Open issues
- PRE-EXISTING on `develop`: `tests/test_saas_contract.py` 2 failures (expects `login.html` in nav after V13.4 auth redirect). Not run in PR CI (`quality.yml` triggers on `gh-pages` only). Auth-adjacent; needs owner decision.
- PR #478 (`main`) is superseded and conflicts with `develop`; recommend closing it, not merging.
- GitHub connector returns 403 for PR creation; Draft PRs must be opened by the owner or the app granted Pull requests: write.
- Branch pushes auto-create Cloudflare Pages previews (documented in S2); previews now include `CLAUDE.md`/`tools/` (no secrets).
- All P0 blockers in V20.1-P0-S2 / V19.8.19 remain owner-gated (B-00 backup, Render workspace, real Owner A/B, Zalo bot link).

## Rollback
Close the Draft PR / delete the branch. No hosted, workflow, provider or data state was touched.

## Next
1. Owner opens the Draft PR → verify `gpt-worker-tooling-qa` CI (3.10/3.12).
2. Owner decides on `test_saas_contract` login expectation (fix test vs. restore nav link).
3. Close #478.

**Checkpoint:** `PILOT_V1 | GPT_WORKER_ON_DEVELOP | 17_TESTS_OK_WIN_LINUX | CODEX_REVIEW_TRIAGED_5_OF_8 | CI_PENDING_PR | NO_PROD | NO_SEND | NO_WRITE`.
