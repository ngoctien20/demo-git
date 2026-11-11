# TIEN404 Agent Factory — Project status

Checked 2026-11-12 JST. **STAGING ONLY — CONTROL PLANE V1 PARTIAL, NOT AUTONOMOUS.**

- Reused seven pre-existing draft Agents from PR #20; selected CTO `HbTA0yKnJSoVAhJE`, Developer `QAvg1lczAAwo2iWN`, QA `cVrtLOENAUSGhEfL`, with reviewer `SZrYOLXZt2MdcTDc` for release gate. They remain unpublished and have no model/credential.
- Supabase `ifxlvrhyjhbzbrkdsida`: private schema `factory_private`, migration `tien404_factory_control_plane_v1` APPLIED. 5 RLS-protected tables; privileged-only queue functions and lease/CAS/event gates.
- n8n: isolated manual-on-demand inbox workflow `7hwH3kW6GtNwpgDk` INACTIVE; Data Table `uYNb4OcurJEqAlVA` contains one synthetic idempotent QA inbox row. Executions 2512,2513 SUCCESS. It is not yet connected to Supabase.
- 3 real on-demand task records in Supabase `factory_private.tasks` with NEW status and 0 budget: `AF-BRIDGE-20261112`, `AF-MODEL-20261112`, `AF-E2E-20261112`. No agent lease or paid runtime.
- Code: Draft PR #21 https://github.com/ngoctien20/demo-git/pull/21 , stacked on draft PR #20. Nothing merged or deployed to production.
- Independently verified PostgreSQL transaction QA: 5/5 negative security checks PASS and QA_FAIL→Developer repair path PASS; rollback used for synthetic test tasks.
- Not operational: model-enabled agent invocation, secure n8n→Supabase bridge, GitHub/Linear scoped tools, independent evidence validation, automated multi-agent handoff, email reporting or production actions.
- Budget: USD 0. No ChatGPT Work credits or paid LLM API calls consumed by this factory.
