# TIEN404 V13.5 — VERIFIED SYSTEM INVENTORY

**Read-only audit date:** 2026-11-15 JST. A successful mock, deployment or active n8n status is **not** proof of live E2E.

| Resource | Current evidence | Product treatment |
|---|---|---|
| GitHub production gh-pages | HEAD `ff2daf970e8209399a28b2d0cade8a33b9fa71c6`; PR #74 real Render Auth redirect MERGED | ACTIVE; do not restore demo login |
| PR #75 | OPEN DRAFT QA for PR74, obsolete demo-login browser fixtures unresolved | P0 regression follow-up, not merge-ready |
| PR #73 | OPEN DRAFT HEAD `c68743bfa54848c43b77be4ff26890b83e790869`; account-only source, not on Render | BASE for V13.5 customer simplification |
| PR #72/#71/#70 | OPEN DRAFT stacked Sales Lite Portal/three packages/multichannel contracts | CONSOLIDATE; do not separately publish a competing customer portal |
| PR #69/#68/#67 | OPEN DRAFT secure-preview, Studio/merchant QA, menu | Shared Core + FUTURE Studio; preserve |
| PR #66 | OPEN DRAFT order request, Owner notification and paid revenue staging isolated | Business logic CANDIDATE; hosted integration not approved |
| PR #76 | OPEN DRAFT Zalo Rich Text/numbered controls no-send | Future technical QA; approved 3-message preflight returned 404, **0 messages sent**; do not retry live |
| Render Auth | `tien404-auth-staging`, deployment `b14501a0` LIVE on branch `work/supabase-auth-staging-v1`, autoDeploy off | ACTIVE existing Supabase Auth; #73 NOT deployed |
| Render Data | `tien404-data-staging`, deployment `ab940a95` LIVE, FastAPI read-only, autoDeploy off | ACTIVE but signed hosted Shop A/B E2E incomplete |
| Cloudflare Pages | `tien404-ai-git-staging`, production branch gh-pages, Preview CUSTOM only v133, preview Access wildcard configured | Keep settings; new V13.5 branch NOT auto-deployed |
| Supabase staging | ACTIVE_HEALTHY PostgreSQL 17; public tenants (2), memberships (3), orders (2), customers (0), products (2), RLS true | Existing schema; no commercial Subscription/Staff source confirmed in inspected schemas |
| Supabase security | Advisor WARN: public SECURITY DEFINER `qa_shop_b_zalo_claim` executable by anon | P0 review: no privilege alteration without caller inventory/approval |
| n8n inventory | 82 workflows found, 19 active, 63 inactive (at audit) | Dependency map needed. Active != production commerce |
| n8n Zalo | Ingress yIJk8LvJoLF40Z62, router sIPs6egzIwOY1GNv, shadow OgDZNSAvKEvhnAvn active | ACTIVE lab/staging, do not publish or rewire |
| n8n Messenger | TIEN404_MESSENGER_TEST Z7FdV7uDvApfbURQ active, demo tools v6PBwcqSapVzACMW etc. | Existing Messenger DEMO, not shared tenant-safe Commerce |
| n8n Commerce | Tenant Resolver 5Eeh8hbpsoNhuiVo and Commerce sandbox tools currently active, some QA inactive | INTEGRATION CANDIDATES, no live writes by V13.5 |
| Tester | QA Tester staff/tables exist; separate from commercial Staff | KEEP isolated QA, no implicit platform privilege |
| AI Studio | Historical modules, Bot Factory, Menu Designer, Prompt QA | **FUTURE — PRESERVED**; no delete or further build in V13.5 |

**Unknown/not verified:** current hosted paid subscription source, production-grade platform staff registry, protected Admin API, real Browser Shop A/B login & revocation, n8n whole-workflow dependency DAG, Zalo OA commercial permissions. Missing evidence is not proof of absence.
