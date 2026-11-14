# TIEN404 V8.1 — prioritized backlog

| Priority | Work | Status | Acceptance |
|---|---|---|---|
| P0 | Auth forged recovery negative browser regression | IMPLEMENTED_NOT_VERIFIED | CI Chromium PASS on commit 5e65c5a |
| P0 | Reconcile current staging branch and Render deploy | IN_PROGRESS | deployed SHA matches approved tested SHA |
| P0 | Real Auth login/session/logout/recovery | BLOCKED | authorized real staging browser E2E |
| P0 | Shop A vs Shop B RLS negative tests | BLOCKED | independent staging identities and JWT-context evidence |
| P0 | Supabase leaked password protection | BLOCKED | review plan support and enable only with approved config change |
| P1 | Merchant Dashboard tenant-scoped write API | NOT_STARTED | server auth, RLS, audit, negative tests, rollback |
| P1 | Commerce inventory/idempotency transaction E2E | NOT_STARTED | isolated data and no production side effects |
| P1 | Bot Registry and Training Lab | NOT_STARTED | versioned bot tests with no customer publish |
| P1 | Super Admin | NOT_STARTED | server-side admin authorization and audit |
| P2 | Pilot onboarding, quota, monitoring, rollback | NOT_STARTED | documented and rehearsed staging pilot |

Constraints: keep AI_SALES_DEMO separate from TIEN404 Commerce. No production merge, no live Messenger, no real orders, no secret changes, no new paid services.
