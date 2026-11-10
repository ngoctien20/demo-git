# TIEN404 — Data Platform V1 — TASK_BACKLOG

## P0 / launch blockers
- [ ] Confirm Supabase organization and cost; create STAGING project, not production.
- [ ] Confirm Render workspace and cost; deploy HTTPS staging only.
- [ ] Compare existing Super Admin custom-user SQLite identities with Supabase Auth UUID model; select identity authority + migration plan and review for session/tenant privilege escalation.
- [ ] Run real two-user / two-tenant RLS test; validate that authentication, memberships, products, orders, and private schema never expose cross-tenant data.
- [ ] Backup, checksum and restore Supabase staging snapshot in isolated instance before real data.

## P1 / functional data backend
- [x] Define normalized tenants, memberships, products, customers, orders, items, conversations and private metadata schema.
- [x] Create safe, read-only Supabase-authenticated FastAPI gateway and local tests.
- [ ] Create a formal database migration via supported CLI and apply only after approval.
- [ ] Implement rate limiting + tenant-scoped observability before going online.
- [ ] Implement transactional create/update/cancel order and stock ledger with idempotency, full monetary QA, no trust in AI totals.
- [ ] Wire n8n Commerce product workflows to tenant gateway via verified platform channel and signed internal service identity; leave AI_SALES_DEMO separate.

## P2 / product
- [ ] Staging customer dashboard preview (avoid demo localStorage as production auth).
- [ ] Storage bucket RLS / media upload / data retention and deletion jobs.
- [ ] PostHog instrumentation without leaking PII.
- [ ] Load tests, alerting, disaster recovery, deploy review.