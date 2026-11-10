# TIEN404 AI — Repository agent instructions (V5)

This is the authoritative operating contract for coding agents working in this repository. Read this file and \`docs/AI_CTO_MASTER_PROMPT_V5.md\` before making changes.

## Product goal
Build a reliable, simple Vietnamese AI SaaS for small shops. A visitor should quickly understand the product, try safe AI consultation, and contact the team. Owners eventually manage tenants, subscriptions, permissions, approved bots and channels using a secure platform.

## Existing surfaces (do not rebuild)
- Public GitHub Pages: \`https://ngoctien20.github.io/demo-git/\`, deployed from \`gh-pages\`.
- Website consultant n8n: \`wgkkmT7q4lm4HyuA\`, linked from public floating widget. Marketing consultation only; no order, payment, lead or customer data write tools.
- AI_SALES_DEMO main agent: \`v6PBwcqSapVzACMW\`; related Google Sheets Orders/Products and credentials are **legacy demo only**.
- Live Messenger test: \`Z7FdV7uDvApfbURQ\`; exercise caution: dependent workflows can send messages or write orders/tickets.
- Multi-tenant Commerce: sandbox workflows, separated from legacy AI_SALES_DEMO. Never reuse demo Google Sheets, order workflows, credentials or tenant data.
- Control Hub: \`https://tien404-control-hub.fairflounder1.chatgpt.site\`, existing hosted app; not the same as a GitHub staging prototype.
- Super Admin: PR #2, branch \`ops/super-admin-v4-staging-20261110\`; isolated FastAPI/SQLite security reference and stage-only UI, **not** connected to Sites/D1 production.
- Tenant Data Platform: PR #5, branch \`ops/tenant-data-platform-v1-staging-20261110\`; Supabase/PostgreSQL/RLS staging and existing Render service; see docs/PROJECT_STATUS_V5.md for verified limits.
- Related work: PR #1 Control Hub audit, PR #3 CTO Messenger fixtures, PR #4 earlier website V4.1 navigation. Avoid duplicate proposals and old-branch merges.

## Source-of-truth and freshness
- GitHub repository and current branch contents are authoritative for code; inspect before editing.
- n8n connector is authoritative for live workflow node graphs and execution statuses; distinguish draft from published. Read n8n user preferences **before** any n8n write.
- A README, PR description or an old passing test is evidence of a previous state, not proof of current production health.
- For every finding, record the source, UTC timestamp/commit or execution ID, confidence, impact and release status.
- Never infer an unverified live API/token, successful deployment, payment integration or successful user journey.

## Autonomous work policy
1. Understand existing code and dependencies first; preserve working behavior. Make a minimal patch, not an unapproved rewrite.
2. Classify every action: READ_ONLY; ISOLATED_STAGE; REVERSIBLE_PUBLIC; PRODUCTION_SENSITIVE. Use a feature branch + PR for changes and require explicit owner approval for PRODUCTION_SENSITIVE actions.
3. Read-only audits, new tests, documentation, mock data, staging-only code and draft PRs can be performed autonomously.
4. Production-sensitive: real customer writes, sending Messenger/Zalo messages, orders/stock/revenue changes, live bot publish/unpublish, credentials, payments, plans/entitlements, authenticated Sites/Control Hub changes, merges/deployments with unknown impact. Require targeted validation and explicit approval.
5. Do not paste secrets into public repo, browser JS, docs, logs, issues or prompts. Never commit local database/SQLite backup; use secure backend secret stores.
6. Do not deploy standalone Super Admin on public GitHub Pages, or claim that a staging UI is a functioning production admin.
7. No pretend success: verify returned commit SHA, diff, CI results, runtime version and preferably real browser E2E; differentiate code review from real-device QA.
8. When CI fails, isolate and fix on the same branch, preserving successful work; document unresolved blockers.
9. Leave a checkpoint: what changed, links, passing/failing tests, risks, rollback and owner approvals needed.
10. Never silently erase, replace or overwrite other branches or parallel agent work. Re-fetch before update and use exact file SHA.

## AI access surfaces
- Public marketing AI is shared across marketing tabs using `assets/website-chat-loader.js`, but NEVER on account/authenticated pages; code is branch-only until QA.
- Merchant dashboard Copilot requires real login, server-derived tenant scope, RBAC/RLS and read-only tools first.
- Buyer order support requires a tenant-scoped verified buyer identity and order ownership; do not treat order code alone as authorization.
- Follow `docs/ASSISTANT_ACCESS_ARCHITECTURE_V5.md` before adding any order-status integration.

## Required checks
- \`node scripts/check-site-navigation.mjs\`
- \`node scripts/check-project-integrity.mjs\`
- GitHub Actions for PR branch; then mobile/desktop visual+interaction QA for any widget change.
- n8n regression is only safe in **isolated read-only/mock** test workflows; no live Messenger send/order create/update during ordinary QA.
- Super Admin local stage QA: \`cd ops/super-admin && python -m pytest -q tests\` on its own staging branch; do not assume that branch exists in the current checkout.

## Release format
Report: Changed / Verified / Not verified / Blockers / Rollback / Next owner decision. Never say 'production fixed' unless tested there. Every new workflow must have a single owner, source of truth and idempotency strategy.

## Current priorities
P0: widget Android dark-mode input/send/mobile E2E; keep page scroll usable; stage/public parity.
P0: website AI marketing truthfulness, rate-limits and no real data; confirm webhook end-to-end.
P0: legacy Orders/Products isolation, no cross-tenant secrets, live Messenger mutation safety.
P1: Super Admin Sites/D1 source/auth inspection; staged UI audit; tenant identity bridge with PR #5.
P1: Commerce isolated QA and knowledge governance; no direct conversion to production.
P1: unified website navigation and simplified conversion flow.
P2: observability, release management, customer onboarding, approved billing provider decisions.

See \`docs/PROJECT_STATUS_V5.md\` for the dated snapshot and \`docs/RELEASE_GATES_V5.md\` for release criteria.
