# TIEN404 AI — Current project status (V5)

**Snapshot:** 2026-11-10 JST. **Evidence:** live n8n connector and GitHub API in the same session. This is a point-in-time audit, not ongoing live health.

## Executive status
- Public website: GitHub Pages on \`gh-pages\`; simplified six-link menu and floating AI widget code exists. Some visual Android dark-mode chat defects were reported and repeatedly patched; **no verified real-device E2E proof of resolution**. Public site could not be fetched from the browser tool in this session.
- n8n Cloud: **29 workflows**, **16 Active**. Active ≠ production ready. Current workflow topology and error history require reviews.
- Historical executions: **19 error/crashed records since 2026-11-09T00:00:00Z** returned by connector (not necessarily unresolved, and not the daily count for every workflow). See Error Registry.
- Website AI: \`wgkkmT7q4lm4HyuA\` active; intent knowledge router V4.3 appears in previous implementation, published. No real conversation memory or live product-price knowledge confirmed. Chat CTA code exists; end-to-end browser send not verified.
- Legacy AI SALES: \`v6PBwcqSapVzACMW\` active and separate; Create Order \`KrSn4DNR9ALX5ng4\`, Manage Order \`fDB9dvs1qPPVt9Sp\`, Address \`BkAi6TVUKAjCnI7v\` write Google Sheets in their published tool paths; do not use in routine regression.
- Messenger test: \`Z7FdV7uDvApfbURQ\` active with live channel and potentially mutating order/ticket dependencies. Still legacy tool coupling; not a multi-tenant Commerce core.
- Commerce sandbox: active Catalog Query \`oOOXicKXGkBskKqh\`, Cart Preview \`igPOsSbEgd4NgtRA\`, Tenant Resolver \`5Eeh8hbpsoNhuiVo\`, Business Core \`Y0WLykMtNAldbgL0\` and Rules Lab \`VBEns4KfWEz9AFgM\`; Commerce AI agent \`iyfGUiEsZlNTBWOR\` inactive. Historical sandbox test suites 17/17 + 22/22 + 25/25 are not live launch proof.
- Super Admin: draft PR #2, branch \`ops/super-admin-v4-staging-20261110\`; isolated FastAPI/SQLite/MFA/RBAC staging UI+API; stage QA succeeded in prior CI. **Not integrated** into hosted Control Hub Sites/D1 or production.
- Tenant Data Platform: draft PR #5, branch \`ops/tenant-data-platform-v1-staging-20261110\`; Supabase/PostgreSQL/RLS schema plus mock-read API staging design. **No Supabase project, DB migration, Render service or live Auth integration**.
- Control Hub: existing hosted \`tien404-control-hub.fairflounder1.chatgpt.site\`; source and D1 bindings were not verified through this connector. PR #1 is read-only audit source, not the deployed Sites source.
- PR #3 CTO documentation and Messenger offline fixture QA; PR #4 earlier website navigation work is behind current live gh-pages, assess cherry-pick/close after review instead of blindly merging.

## Tenancy and data boundaries
| Domain | Source | Allowed data flow | Prohibited |
|---|---|---|---|
| Website consultant | n8n isolated workflow | Approved public product info and fake/demo conversations | Client Orders/Products, credentials, payment or lead-write claims |
| AI_SALES_DEMO | Legacy demo Google Sheets | Demo order tools with explicit authorization only | Cross-tenant Commerce / product systems |
| Messenger | Existing Meta connection and legacy test tools | Carefully controlled staging/live channel handling | Nonconsensual sends, shared tenant data access |
| Commerce | Tenant-scoped sandbox | Mock QA, multi-tenant resolver/catalog/cart | Production writes before verified RLS/ingress |
| Super Admin | Isolated staging FastAPI + SQLite | Test users, test plans, test entitlements | Public admin console or Sites production writes |
| Data Platform | Supabase RLS blueprint | Mock data and isolated tests | Assume live Supabase/Auth/Render |

## Priority and release gates
| Priority | Action | Owner/surface | Gate |
|---|---|---|---|
| P0 | Prove Android chat input/send/dark mode and page scroll E2E | Website | Real browser tests, regression |
| P0 | Verify widget webhook quota, privacy, session fallback | Website AI | Isolated test and production read-only check |
| P0 | Investigate Revenue Report historical invalid paid total and live Messenger errors | Legacy / Messenger | Read-only investigation, no automatic message/order writes |
| P1 | Separate Messenger from legacy Orders tools using approved migration path | Messenger / Commerce | Owner approval, isolated QA and rollback |
| P1 | Control Hub source/D1 auth audit, Super Admin integration contract | Control Hub / Super Admin | Authorized access, backup and stage only |
| P1 | Verify Supabase RLS two-tenant Auth isolation before real migration | Data Platform | Provisioning approval, provider QA |
| P1 | Align PR #4 with existing gh-pages nav without reintroducing old menu | Website | Diff and CI |
| P2 | Add Customer Dashboard/Lead/Plans only after real backend and policy approval | SaaS product | Backend-ready and legal/privacy checks |

## Change ledger in this initiative
- Autonomous CTO V5 branch \`ops/cto-autonomous-v5-20261110\` holds governance prompt, registry, QA guards and release criteria. It does not deploy production by itself.
- Last checkpoint remains in GitHub; re-read source before acting from this file.

**Do not report completion based on PR creation, localhost/mock tests, or CI alone.**
