# TIEN404 AI — DEV TEAM MULTI-AGENT V1 (staging)

**Status:** 7 n8n Agent drafts created. All are NOT published and missing model + credential. They have no GitHub/Linear writing tools. Draft creation incurs no LLM execution; enabling model/runtime can incur separate usage charges, not ChatGPT Work credits.

## Agents (n8n Personal project WW82YsCCaAxGC9dp)

| Agent | ID | Role |
|---|---|---|
| CTO Coordinator | HbTA0yKnJSoVAhJE | Task intake, routing and state gates |
| Planner & Architect | qvZaHTWorHnedQGu | Scope, task breakdown, acceptance |
| Engineer | QAvg1lczAAwo2iWN | Patch on staging feature branch, draft PR |
| Independent QA | cVrtLOENAUSGhEfL | Independent expected/actual and CI evidence |
| Security Reviewer | SZrYOLXZt2MdcTDc | Auth/RLS/secrets/idempotency review |
| Fixer & Updater | eS9AnXb0YyVXEQCG | Bounded fixes after QA/Review FAIL |
| Reporter & Checkpoint | fBMSHvTJu7mkVyai | Checkpoints, task backlog and human report |

Coordinator has six child agents attached with maxChildren=2. Run authorization and model setup are still absent.

## Source of truth

GitHub: https://github.com/ngoctien20/demo-git . Read the existing PR #1–#19, particularly PR #5 Data Platform, PR #6 CTO V5, and V11 drafts before changing code. Use the actual HEAD SHA, not a remembered old one.

Linear: https://linear.app/ngoctien20/project/tien404-ai-455b6a09e0fb . Orchestration task NGO-15: https://linear.app/ngoctien20/issue/NGO-15 .

Supabase staging ifxlvrhyjhbzbrkdsida; Render staging srv-dbphtas9v7es73bursrg; n8n Cloud https://ngoctien20.app.n8n.cloud . AI_SALES_DEMO, Messenger LIVE, real Orders, payment and credentials are OUT OF SCOPE.

## Workflow / handoff protocol

NEW -> SPEC_READY (Planner) -> IN_PROGRESS (Engineer) -> READY_QA -> QA_PASS or QA_FAIL (QA) -> REVIEW_PASS or REVIEW_FAIL (Security Reviewer) -> DONE (Reporter).

QA_FAIL or REVIEW_FAIL -> Fixer -> READY_QA -> new independent QA and Review. Maximum 2 fix rounds; after that BLOCKED and notify owner.

Every job carries task_id, issue URL, event_id, revision, assigned owner, branch, base SHA, candidate SHA, QA run URL, Review URL, evidence, fix_rounds, remaining budget, and checkpoint URL. Any new commit invalidates earlier QA/Review approvals. DONE requires QA PASS and Review PASS on the SAME commit, green CI, successful checkpoint update and draft PR. Only a deterministic workflow with durable atomic task-locks can apply state; do NOT trust Agent text as execution evidence.

The pure Python reference state machine at ops/devteam/state_machine.py enforces basic transition, SHA, idempotency, fix-round and budget gates; tests are at ops/devteam/tests. It does NOT run a queue, model, GitHub changes, notifications, or n8n. A future orchestrator must provide atomic CAS, per-task writer lease, durable event IDs, cost accounting and clear human approvals.

## Tools and release gates

- Planner/QA/Reviewer are read-only by default. QA and Reviewer must NOT modify their reviewed patch.
- Engineer/Fixer can write only task-scoped staging branches through least-privilege credentials and open Draft PR; NO merge or production deployment.
- Reporter updates PROJECT_STATUS, TASK_BACKLOG, CHANGELOG, QA_REPORT and NEXT_ACTIONS only after comparing source SHA, current checkpoint and actual evidence.
- STOP for real customer data, publish, payment, credentials, production, cost increase, security issue, missing test, stale branch, repeated failure, expired budget. Ask the owner.
- Hard caps required: max 2 concurrent tasks, 2 fix rounds, per-task/day/month cost caps. Initial authorized spend = USD 0. Without explicit funding and model credential, remain DRAFT.

## What is already done, and what is NOT

DONE: seven draft Agent definitions created in n8n, Coordinator linked to children, Linear NGO-15, this governance contract, deterministic QA reference and unit tests.

NOT DONE: model connection, provider credential, actual multi-agent invocations, GitHub/Linear action tools for Agents, live workflow automation, reliable queue/locking, reports sent via Gmail, paid runtime approval, production readiness.

## Next implementation (separate approvals)

1. Choose provider/model with real credential and explicit capped budget. Do not invent API keys or assume free usage.
2. Attach read-only GitHub and Linear tools. Verify agent preview without side effects.
3. Build n8n orchestration workflow with persistent queue and atomic lock. Test idempotency and failover before activation.
4. Add scoped write action tools with approval gates for staging PRs only.
5. Demonstrate one full cycle on a synthetic issue (QA_FAIL -> Fix -> QA_PASS -> security PASS -> report), and a budget/attempt BLOCKED case.
6. Configure owner-selected report destination; do not send emails or publish without permission.
