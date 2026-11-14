# TIEN404 AI V12.3 — AI-assisted QA Studio, Release Checkpoint

**Checkpoint:** 2026-11-15 (Asia/Tokyo)
**Environment:** STAGING FIRST. GitHub `ngoctien20/demo-git`, Render `tien404-auth-staging`, Supabase `tien404-staging`.
**Status:** IMPLEMENTED / DEPLOYED / TESTED (automated and DB RLS). Real human tester acceptance: PENDING.
**Never infer live AI SALES/Messenger passed from this release.**

## Purpose

Experienced testers can use other AI tools to review **synthetic** commerce logic without wasting time clicking all 15+ existing Sheets cases and without giving external AI credentials or exposing live workflows.

## Scope shipped

1. `assets/tester-qa-pack.mjs`: eight deterministic **risk-first** checks referencing existing READY Sheets cases. Independent hard-coded expected outcomes, with test IDs and P0/P1 priority. Local execution only — no network, LLM, orders or inventory mutation.
2. `assets/tester-ai-studio.mjs`: one clear screen with three stages:
   - Run eight synthetic risk checks and inspect mismatches.
   - Copy a structured Vietnamese prompt and result pack to any external AI tool (ChatGPT/Claude/Gemini etc.), or open the prompt for manual copying when clipboard fails.
   - Paste a brief human-curated summary with priority P0/P1/P2, verdict, privacy confirmation. Writes **one** self-reported record via existing Supabase authenticated tester RLS. Requires exact insert run_id and readback; no automatic AI PASS.
3. `tester.html` and `assets/tester-portal.js`: QA Studio is the primary experience after the brief project introduction. Existing three friendly examples are in a collapsible details element, all detailed case/guide/history pages retained in advanced menu. Old Tester Admin unchanged.
4. CSS scoped to `.tp-friends`, mobile-first, does not alter Tester Admin.
5. Strict Render allowlist adds only two new public JS modules, not SQL fixtures, tokens, CSV, raw project docs or source test data.
6. One additive `sheets` report case `SHEET-AI-REVIEW-001`, readiness `ready`. Registered through `qa/tester_portal/V12_3_AI_REVIEW_SHEETS_CASE_STAGING.sql` using `ON CONFLICT DO NOTHING`. No new RLS rule or broader tenant access granted.

## DB audit evidence

- Before: new report case 0. DDL dry-run under BEGIN/ROLLBACK: created in transaction. Actual staging insert returned `new_qa_review_cases=1`.
- Approved + assigned Tester simulated (authenticated role and real Auth UID, SQL transaction **ROLLED BACK**): read case and insert `needs_review` report succeeded.
- Unapproved synthetic UID: visible new case=0, visible reports=0.
- Persisted readback after rollback: Sheets READY cases=16, report case=1, **0 actual QA Studio reports**, total existing tester reports=2 (not altered), approved testers=1, active Sheets assignments=1.
- 132 AI SALES historical candidate cases remain separate; no promotion or bot endpoint opened.

## QA + Deploy

- PR #50 merged, app source/runtime commit: `9790d20e003d6f72272282405a4bbb75e8be4dc2`.
- Render static deploy `dep-dbs82b6c6qcc738eseh0`, status **LIVE**, completed 2026-11-14 15:41:40Z (2026-11-15 00:41:40 JST).
- Predeploy GH Actions `43611295910` SUCCESS:
  - 45 source/security/functional tests passed
  - 24 strict preview build tests passed
  - Local Chromium with mocked authenticated Tester: 3 legacy quick scenarios, 8 new risk checks, prompt preview, one AI-assisted human report, advanced legacy workflows; no remote traffic.
  - Existing Account/Merchant session stability tests and anonymous default-deny passed.
- Postdeploy QA-only PR #51 merged, Actions `43611881053` SUCCESS:
  - **17 public HTTPS routes/assets HTTP 200**, including `tester-qa-pack.mjs`, `tester-ai-studio.mjs`, unchanged Admin.
  - **5 private paths HTTP 404**, including new private SQL fixture and `.env`.
  - Browser simulated clipboard copy of synthetic reviewer prompt; secret-bearing notes rejected without adding a report; valid notes accepted and read back.
  - No actual users, Supabase Auth credentials or customer records were shared with CI.
- QA-only source merged after deploy, no application runtime change or unnecessary second Render deploy.

## Boundary and limitations

- **Other AI is never called automatically**. Tester copies the synthetic prompt to an AI they already use, then manually reviews and pastes useful observations. No LLM access token, provider integration, execution cost or external network request.
- Local calculator is not the TIEN404 AI SALES Agent. Its PASS is **not** evidence that live Messenger, Zalo, AI SALES Commerce or real order creation works.
- User-provided AI output is untrusted. UI uses `textContent`, no HTML rendering. Common credential patterns are blocked client-side but user must still manually check and redact notes. Supabase RLS is the final server-side authorization.
- The reviewer cannot mark a report `APPROVED` in Admin or auto-promote cases; all reports are `self_reported=true`.
- Real account interactive UAT, multi-device review of copied prompt, and signed-in human submitting one report still await user confirmation.
- A future **live read-only AI SALES QA adapter** requires isolated tenant routing, JWT verification, write-tool kill switches, cost/rate limits and separate approval.

## Links

- Auth: https://tien404-auth-staging.onrender.com/login.html
- Tester QA Studio: https://tien404-auth-staging.onrender.com/tester.html
- Tester Admin: https://tien404-auth-staging.onrender.com/tester-admin.html

## Rollback and gates

- Previous source backup branch: `checkpoint/v12-3-before-ai-assisted-tester-20261115`.
- Previous Render deploy `dep-dbs6sojbc2fs73ao4sbg` (app commit `865b08180c6da307d9f728e78cb2842c548211a9`).
- Rollback UI: restore previous static Render deploy; never restore by deleting unrelated tester accounts, roles or QA reports.
- SQL rollback of the new additive case requires separate approval after checking dependent tester reports; do not delete it automatically.
- No modifications to production `gh-pages`, n8n Published workflows, Orders, credentials, billing, security policies or live notifications.

## Recommended next gate

1. Owner asks an approved expert Tester to submit one real AI-assisted report and verifies it in Admin.
2. Gather quality feedback: does priority suite identify actual uncovered cases, is structured prompt portable across AI tools, are evidence requirements clear?
3. Only if separately authorized, design/read-only AI SALES QA proxy for actual model/agent comparison. Until then keep every live channel locked.
