# TIEN404 AI — Agent Factory Control Plane V1 (STAGING)

**Status:** REAL private Supabase task store and on-demand n8n staging intake exist. **Agent execution is NOT enabled**; seven pre-existing Agents remain unpublished and lack model/credential. No autonomous code-writing cycle has been completed.

## Reuse rather than duplicate

This branch extends draft Dev Team PR #20 (head `ops/dev-team-multiagent-staging-20261112`) and preserves its `ops/devteam/state_machine.py`, CI, and 7 draft n8n agents. **Do not merge directly to main, gh-pages or production.**

Existing Agent IDs: CTO `HbTA0yKnJSoVAhJE`; Developer `QAvg1lczAAwo2iWN`; Independent QA `cVrtLOENAUSGhEfL`; Reviewer `SZrYOLXZt2MdcTDc`. Reviewer is needed later for the independent release gate; other pre-existing drafts are not deleted.

## Control plane as actually implemented

```text
Manual on-demand request
   │
   ▼
n8n Personal / 05_TIEN404_DEV_FACTORY - STAGING
   └─ Inactive workflow 7hwH3kW6GtNwpgDk
      ├─ Manually triggered synthetic task (no webhook/schedule)
      ├─ Strict cost=0 and staging-only validation
      └─ Upsert inbox Data Table uYNb4OcurJEqAlVA
          status: AWAITING_SECURE_BRIDGE (transport buffer only)
   ╳  SECURE BRIDGE NOT BUILT (no database admin credentials in n8n)
   ▼
Supabase staging / factory_private (the AUTHORITATIVE task state store)
   ├─ agents: existing drafts, all disabled and model_ready=false
   ├─ config: 2 max active, 2 fix rounds, $0 budget
   ├─ tasks: revision CAS + lease agent + timestamps
   ├─ events: durable idempotency keys / revision audit
   └─ agent_runs: provider-execution evidence placeholder
   ╳  LLM MODEL/CREDENTIAL/TOOL GRANTS NOT CONFIGURED
   ▼
CTO → Developer → QA → Reviewer → Reporter
          │       │
          └ QA_FAIL → Developer, max 2 repair rounds
```

**Do not treat the n8n inbox as the authoritative task state**. Only a future secure bridge can promote an inbox row to `factory_private.tasks`; such a promotion must record a reconciliation ID and be idempotent. No synchronization has been attempted. A workflow success only means the inbox write succeeded.

## IDs, isolation and scope

- Supabase staging project: `ifxlvrhyjhbzbrkdsida` (Singapore).
- Migration: `tien404_factory_control_plane_v1` in `ops/devteam/sql/control_plane_v1.sql`.
- n8n Personal project: `WW82YsCCaAxGC9dp`; folder `X9wrsU5J3OpCcVqs`.
- n8n manual workflow: `7hwH3kW6GtNwpgDk`, unpublished/inactive.
- n8n Data Table: `uYNb4OcurJEqAlVA` / `TIEN404_DEV_FACTORY_INBOX_STAGING`.
- No AI_SALES_DEMO, Messenger LIVE, customer Orders/Products, Render production, checkout or payments were touched.

All five `factory_private` tables have RLS enabled, no browser policies and schema/table grants revoked for `anon` and `authenticated`. Functions `enqueue`, `claim`, `advance` are `SECURITY INVOKER` and not callable by browser roles. There is **no public API or webhook** for task state updates.

## Deterministic controls

- **On demand:** no cron/schedule, workflow not published; manual execution only.
- **Cost:** default $0 (integer cents), model calls explicitly refused inside the state transition function; no LLM credentials used.
- **Claim:** atomic Postgres row lock, expected revision, short lease (30–600 sec), only enabled/model-ready agent; all actual drafts remain disabled.
- **State:** explicit CTO→Developer→QA→Reviewer→CTO transition whitelist. One task writer at a time; task revisions checked on every mutation.
- **Release:** DONE requires candidate SHA = QA SHA = review SHA, CI flag, draft PR and GitHub checkpoint URL. **Evidence URLs and flags are not yet independently verified against GitHub API**; therefore this gate is a formal contract, not permission to release.
- **Failure:** QA_FAIL/REVIEW_FAIL → Developer limited to 2 rounds; otherwise must block and escalate.
- **Protection:** all SQL QA tasks are created inside BEGIN/ROLLBACK; no persistent synthetic factory tasks added. n8n inbox holds a single harmless QA record with zero budget.

## Outstanding operational gaps (BLOCKERS)

1. Need owner-approved AI model/provider credential and per-task/day/month budget to make existing drafts runnable. **Do not spend API credits without explicit approval.**
2. Need secure authenticated Render→private Supabase bridge or other narrowly scoped trusted execution path. Never put `service_role` in public clients or workflow source. Add request signature, per-task authorization, distributed replay protection, input size/rate limits and idempotency.
3. Need bind authenticated task intake to CTO; attach read-only GitHub/Linear tools then minimal task-scoped staging PR write tools to Developer; QA must remain independent. Test with an actual live model invocation only after budget approval.
4. Need independently verify GitHub CI/checkpoint evidence and source SHAs rather than trusting agent-written JSON; complete one real full-cycle synthetic task before enabling task auto-progression.
5. Need durable user-selected report channel, lease recovery, error handling, lock race tests under two connections, and backup/restore QA.
6. Supabase Advisor showed unrelated existing warnings (authenticated SECURITY DEFINER function in public and leaked-password protection off). Review separately before customer pilot, without changing merchant behavior during Factory V1.

## QA artifacts

See `ops/devteam/qa/CONTROL_PLANE_V1_QA_20261112.md`. CI: `.github/workflows/agent-factory-control-plane-qa.yml`.

## How to continue

Inspect this branch + PR #20 and current Supabase schema before applying any migration or creating workflows. Do not create duplicate agents, data tables or project. Validate the task's exact HEAD SHA; leave all workflows inactive, PR draft, staging data isolated and $0 budget until approved.
