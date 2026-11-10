# TIEN404 SaaS Data Platform V1 — staging foundation

**Status: NOT DEPLOYED / NO SUPABASE PROJECT CONNECTED / NO PRODUCTION ORDERS.**

This is an additive, read-only data gateway and RLS-first PostgreSQL blueprint intended to complement the **existing** `ops/super-admin` security kernel on PR #2. It is not an alternative Super Admin, and it does not replace Sites Control Hub or AI_SALES_DEMO.

## Scope

- `schema.staging.sql`: review-only schema blueprint (not yet applied), tenant-scoped tables and composite foreign keys to prevent cross-tenant order-item references, read-only RLS policies, private schema for secret references and idempotency records.
- `app/main.py`: FastAPI server, strict staging mode, server-side Supabase Auth validation (`/auth/v1/user`), member lookup and RLS-filtered read-only products/order summaries. JWT is forwarded as the user; **no service_role / database admin key**. No write endpoints exist.
- `tests/`: isolated mock-provider security and API tests, no external calls, no shared DEMO Sheets or n8n workflow writes.
- CI: GitHub Actions staging checks. This does not deploy to Render automatically.

## Staging test

```bash
python -m pip install -r ops/data-platform/requirements-test.txt
python -m pytest -q ops/data-platform/tests
```

## Integration after explicit project/workspace confirmation

1. User chooses Supabase **organization** and Render **workspace**; obtain and approve any quoted nonzero project/service cost.
2. Create isolated Supabase **staging** project (Asia region as appropriate), confirm status. Do not create production project yet.
3. Take a DB checkpoint and create a formal migration using supported Supabase CLI; review/adapt `schema.staging.sql`, then apply to staging only.
4. Run Supabase advisors and **real RLS test with two Auth users and two tenants**; verify cross-tenant reads forbidden and writes fail closed.
5. Configure Render staging backend with exact `TIEN404_SUPABASE_URL`, `TIEN404_SUPABASE_PUBLISHABLE_KEY`, `TIEN404_APP_ORIGIN` in server environment. Never use a service-role secret or commit credentials.
6. Authenticate via Supabase Auth in a **separate staging client**. Only then wire the tenant product/order preview. Do not repoint existing Sites Control Hub or user-facing website until the auth migration plan is approved.
7. Keep actual order creation and stock debiting **DISABLED** until a transactional, idempotent database write design and payment/stock QA pass. n8n integration requires server-side per-channel authorization, verified tenant identity, and a signed internal gateway. Do not forward browser bearer tokens into n8n.

## Design choices

- The existing Super Admin staging kernel uses SQLite and custom user IDs while the proposed Supabase schema uses Auth UUIDs: they are **not yet the same identity system**. No automatic migration is assumed.
- The existing `AI_SALES_DEMO` order tools and Google Sheets **must remain isolated**; Commerce production gets its own data store and credentials.
- `GET /health` deliberately says `UNKNOWN` or `CONFIGURED_NOT_VERIFIED`, not `OK`, until real external checks pass.
- The gateway is **read-only**. This is intentional to prevent accidental production order mutations and inventory loss.
- Supabase SQL is a design artifact, not proof of tables existing or data being saved. The database does not exist yet through the connector.

## Data model

| Schema | Table | Meaning |
|---|---|---|
| public | tenants | Shop/organization master |
| public | tenant_memberships | Auth user belongs to a shop, one of owner/manager/staff |
| public | products | Shop-only catalog, integer VND prices, nonnegative stock |
| public | customers | Private customer records, consent timestamp |
| public | orders | Order header, integer VND totals, tenant/customer composite FK |
| public | order_items | Quantity, snapshot unit price, generated line total, cross-tenant FKs |
| public | conversations/messages | Tenant-scoped, minimized chat archive |
| app_private | channel_secrets | Opaque vault refs; **never actual tokens** |
| app_private | order_idempotency | Future dedup records for transactional writes |
| app_private | audit_events | Future append-only audit, **no frontend grants** |

No production readiness claim until live Auth, RLS, persistence, backup/restore, end-to-end browser tests and tenant isolation checks are verified.