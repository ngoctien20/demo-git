# Agent Factory V1 — QA evidence

**Real Supabase:** migration applied, 5/5 private tables RLS; anon/authenticated denied schema usage and functions; 5/5 live SQL negative controls PASS (spending, production, acceptance, lease, stale revision). Positive QA_FAIL→fix loop reaches revision 10/fix_rounds 1/events 5/spend 0, rolled back.

**Real n8n:** manual 4-node workflow `7hwH3kW6GtNwpgDk` validated, executions 2512 and 2513 SUCCESS, n8n Data Table row count=1 after replay. No LLM or external customer data.

**GitHub:** on-demand and push-triggered offline CI `.github/workflows/agent-factory-control-plane-qa.yml` completed SUCCESS (run 43111848173). This is a STATIC/UNIT test, not a live LLM test. https://github.com/ngoctien20/demo-git/actions/runs/43111848173

**Gaps:** No real LLM/Agent invocation, no connected n8n→Supabase task persistence, no concurrent dual-connection locking test, no independent signed GitHub evidence in DB, no end-to-end autonomous task cycle. SQL input constraints are not proof that agent-reported evidence is true. Do not declare production readiness.

Full details: `ops/devteam/qa/CONTROL_PLANE_V1_QA_20261112.md`.
