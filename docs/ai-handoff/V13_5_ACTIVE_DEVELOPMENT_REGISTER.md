# TIEN404 V13.5 — ACTIVE DEVELOPMENT REGISTER

**Status and ordering:** P0 safety and customer value before Studio/advanced UX. No completion percentages.

| Priority | Goal | Current blocker / next acceptance |
|---|---|---|
| P0 | One Customer Portal | V13.5 isolated Draft built from PR #73; needs hosted Auth A/B, Order read-only and browser test evidence, not live yet |
| P0 | RLS Shop A/B, revocation | Need two authorized QA signed sessions, cross-shop negative real HTTP and session revocation; test only staging |
| P0 | Public login regression PR #75 | Demo-login fixture references obsolete after merged PR #74; update independent browser QA without restoring fake login |
| P0 | Privileged RPC review | Audit callers/secret comparison `qa_shop_b_zalo_claim`, rollback/approval before SQL revoke |
| P0 | Canonical Subscription source | No production subscription/entitlements source confirmed; keep billing/gói UNKNOWN and reject undocumented grants |
| P0 | Real Customer order handling | Current view READ ONLY; write states require server transaction, expected version, idempotency, notification and audit |
| P0 | Four-level RBAC backend | V13.5 dry-run contract only; needs independent platform role and staff assignment schema, MFA and audit approval |
| P1 | TIEN404 Staff Console | Reuse internal CRM/Bot modules; prevent staff from using merchant owner role as staff proof |
| P1 | Admin Platform + Platform Owner role | Reuse Super Admin scaffolding, add support-scoped access and high-risk release approvals |
| P1 | Unified Sales Core and channels | Review PR #66 order request and #70 channel bridge, preserve n8n Published; no live Zalo sends |
| P1 | Dependency/cleanup | Group 82 workflows; remove duplicate UI navigation after exhaustive code/link scan and owner approval |
| FUTURE | AI Studio / industry templates / Main Bot discovery | Preserve only, do not expand in V13.5 |

**Stop gates:** No production merge, paid service, credential rotation, RLS/ACL change, real Orders write, privileged grant or provider send without explicit approval. Keep staged rollback checkpoints.
