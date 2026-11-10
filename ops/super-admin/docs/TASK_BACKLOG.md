# TIEN404 AI V4 — TASK_BACKLOG

Status meanings: `TESTED_STAGING` = isolated code and tests only, not deployed. `BLOCKED` = cannot proceed without source/approval. `DESIGN` = specification only.

| Priority | ID | Task | Status | Done when |
|---|---|---|---|---|
| P0 | SA-001 | Audit existing Sites auth, RBAC and D1 schema; backup | BLOCKED | Authenticated source access, DB backup, rollback verified |
| P0 | SA-002 | Password+TOTP, session/CSRF, role and tenant security kernel | TESTED_STAGING | Port to existing Sites backend; pass E2E + independent security review |
| P0 | SA-003 | No sharing AI_SALES_DEMO Products/Orders/credentials | DESIGN + n8n isolation verified | All tenant connectors use independent keys and isolated tables |
| P0 | SA-004 | Secret vault, key rotation, per-tenant credentials | DESIGN | KMS/secret manager and provider-specific end-to-end tests |
| P0 | SA-005 | Real payment verifier + idempotency and refund/reversal handling | TESTED_STAGING (fake HMAC only) | Official provider sandbox tested and approved |
| P1 | SA-006 | Subscription lifecycle / trial / grace / suspension | TESTED_STAGING | Port into durable backend, schedule reconcile + notifications |
| P1 | SA-007 | Tenant entitlement gateway + shared workflow protection | TESTED_STAGING (signed fixture) | Bind to officially verified channel and live n8n ingress |
| P1 | SA-008 | Admin Customer / Plan / Tenant API with audit | TESTED_STAGING | Integrate into existing Control Hub after auth source audit |
| P1 | SA-009 | Admin dashboard with real n8n/GitHub usage metrics | BLOCKED | Secure server adapters, timestamped sources, unknown states |
| P2 | SA-010 | Messenger connection / WhatsApp? **Not approved** | DESIGN | Messenger only initially, official permissions/tenant ownership verified |
| P2 | SA-011 | One-click bot setup + release readiness | DESIGN | Approved template registry, QA dry-run, human activation |
| P2 | SA-012 | Versioned knowledge approval + public read | TESTED_STAGING | Real RAG index, version rollback, sales bot evaluation |
| P2 | SA-013 | UI/UX integration in existing Control Hub | BLOCKED | Authenticated responsive QA, no replacement hub |
| P3 | SA-014 | LINE / Zalo / Telegram adapter production integrations | DESIGN | Platform docs, auth, webhook signature, official review, QA |
| P3 | SA-015 | Conversion analytics and model cost attribution | DESIGN | Real consented business events, privacy retention |

Release gate: no known unresolved P0/P1 from *production end-to-end* testing; local tests alone do not meet that gate.