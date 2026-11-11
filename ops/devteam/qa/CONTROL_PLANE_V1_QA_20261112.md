# TIEN404 Control Plane V1 — Evidence checkpoint (2026-11-12 JST)

## Live Supabase staging observations
- Project `ifxlvrhyjhbzbrkdsida`; migration `tien404_factory_control_plane_v1` returned success.
- `factory_private` has exactly 5 tables (agents, config, tasks, events, agent_runs); RLS enabled on 5/5; no grants for browser roles. Registered 4 existing Agent IDs (CTO, Developer, QA, Reviewer). The synthetic test tasks were rolled back; **three actual on-demand backlog tasks** were then intentionally enqueued in state NEW with zero budget and no lease. Initial global budget $0.
- Independent SQL privileges probe: `authenticated` cannot USAGE schema or EXECUTE `factory_private.enqueue`/`advance`; `anon` also has no schema grant.
- Positive **REAL SQL** transaction: enqueue → claim CTO → SPEC_READY → claim Developer → IN_PROGRESS → READY_QA → claim QA → QA_FAIL → claim Developer → repair IN_PROGRESS. Observation: `revision=10`, `fix_rounds=1`, `events=5`, `spent_cents=0`. Entire transaction rolled back.
- Negative **REAL SQL** transaction: budget overspend, forbidden production write, missing acceptance, wrong lease owner, stale revision all rejected. **5/5 negative gates passed**, then ROLLBACK.
- Proof covers SQL state machine transitions and role claims with *temporary, transaction-scoped readiness toggles*. **No LLM calls**; not proof of two concurrent database clients racing or actual model runtime.

## Live n8n staging observations
- Reused 7 existing draft Agents from PR #20; all unpublished and missing model+credential.
- Created personal-project folder `05_TIEN404_DEV_FACTORY - STAGING` (id `X9wrsU5J3OpCcVqs`) and isolated inbox Data Table `TIEN404_DEV_FACTORY_INBOX_STAGING` (id `uYNb4OcurJEqAlVA`).
- New manual-only workflow `7hwH3kW6GtNwpgDk`, inactive. SDK validation: `valid=true`, 4 nodes, no credentials.
- Independent workflow executions `2512`, `2513`: both `success`. The table had exactly **1 row after rerun**, proving requestId upsert idempotence for this sample. Row is synthetic QA, `bridgeStatus=AWAITING_SECURE_BRIDGE`, costBudgetCents=0.
- Workflow does **NOT** automatically call CTO, Developer or QA and does **NOT** write to Supabase. This is a staged intake buffer, not the finished agent factory.

## Source and isolated CI
- GitHub source branch `ops/agent-factory-control-plane-v1-20261112` based on draft PR #20.
- `ops/devteam/sql/control_plane_v1.sql` is the exact migration applied to staging.
- `ops/devteam/tests/test_control_plane_schema.py` provides offline/static safety checks. These supplement, but do not replace, direct SQL evidence.
- A GitHub Action runs offline QA on push or manual dispatch. Record its actual run URL and result only after it finishes.
- No production branch merge, agent publish, real order writes, email send, new paid services or credentials occurred.

## Important limitations
- Existing PR #20 state-machine contract uses independent Security Reviewer before DONE; CTO/Developer/QA are the initial prioritized workers, not the whole release path.
- Current SQL DONE gate accepts evidence URLs/flags supplied by the privileged runner without independently opening GitHub APIs. Keep the runner OFF until server-side evidence verification is implemented.
- Any actual AI model use could incur separate charges even when ChatGPT Work credits are depleted.
