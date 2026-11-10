# TIEN404 AI V5 — Autonomous execution plan and ownership

**Principle:** build on existing repository and workflows; no parallel replacement applications. Use \`AGENTS.md\` and the CTO master prompt on every work package.

## Priority queue

### P0 — Public product and safety
1. **Website widget end-to-end QA**: Android dark-mode text, native and custom composer consistency, send/reply, keyboard resizing, page scroll, minimize/open, screen reader, mobile and desktop browsers. Current repo has code but no verified device QA. **Acceptance:** stable operation on real Android and representative desktop, screenshots + test log + rollback. Don't claim solved from CSS changes alone.
2. **Website AI response accuracy and quotas**: verify public FAQ, integration statuses, link CTA and safe fallback. Avoid unsupported price/quota claims and real Orders/Products integration. **Acceptance:** safe test scenarios pass with actual execution IDs; error-free isolated test; webhook integration observed.
3. **Messenger/Revenue/Legacy errors**: investigate error registry via read-only data, safe trace filtering. **Acceptance:** each incident classified open/historical; root cause and any proposed patch in staging.

### P1 — Controlled platform development
4. **Super Admin PR #2**: inspect actual Control Hub Sites auth and D1 source, map its roles/migrations against isolated stage core. **Acceptance:** signed integration plan, migration rollback, no secret browser code. UI existing stage is not a deployed admin.
5. **Data Platform PR #5**: approve provider/workspace and cost before any new Supabase/Render setup. Stage RLS two-tenant isolation, auth token validation, required cross-role access tests. **Acceptance:** independent negative RLS tests, ownership joins, no use of legacy demo data.
6. **Commerce QA**: keep catalog/cart/tenant resolver/business core mock test suites; prioritize tenant isolation, stock/idempotency; AI agent sandbox remains inactive until approved.
7. **Website IA**: main nav six links, no duplicate onboarding/industry menu items. Preserve specialist examples as deeper links; reduce repeated warnings and unneeded mock routes. **Acceptance:** \`node scripts/check-site-navigation.mjs\` + real browser UX.

### P2 — Scale when stages are ready
8. Customer dashboard with real tenant auth and role checks; don't confuse old browser simulation with working SaaS.
9. Pricing + payment after legal/commercial approval, signed provider webhooks and refund/consent handling.
10. Approved versioned knowledge base + QA rubric + safe deployment gates; never auto-promote internal test bot to commercial template.

## Staging / live decision matrix
| Workstream | Source | Implementation branch | Activation |
|---|---|---|---|
| Website | GitHub Pages / \`gh-pages\` | feature branch PR | require visual + link and widget tests |
| Legacy AI SALES | n8n demo + Sheets | isolated draft/test | do not write real rows without specific approval |
| Messenger | Meta test / n8n | isolated mock first | owner-approved channel sends only |
| Commerce | n8n isolated tools | Commerce QA branch/controlled draft | no live commerce tenant until RLS/ingress done |
| Super Admin | PR #2 FastAPI staging | existing PR #2 | Site/D1 inspection and migration required |
| Data Platform | PR #5 Supabase blueprint | existing PR #5 | no live provision without workspace/cost approval |
| Control Hub | hosted Sites instance, not a GitHub Pages mock | source-authorized environment | preserve auth/session; staged integration only |

## Mandatory handoff
Each task must end with: owner, scope, code SHA(s), draft/published IDs, evidence, unverified items, rollback, explicit approval required, and a checkpoint update. When API/plugin is unavailable, state the blocker rather than creating a fake success screenshot.

## Current parallel-work warning
PR #2, #3, #4 and #5 have divergent branches; never merge/cherry-pick wholesale. Compare changes with current \`gh-pages\` and keep unique responsibilities. CTO V5 branch adds governance, registry and static QA only.
