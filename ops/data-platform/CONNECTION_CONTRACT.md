# TIEN404 Data Platform V1 connection contract

**Current status:** CODE-READY STAGING, NOT CONNECTED TO LIVE PROVIDERS.

## Browser → backend
- Host backend on separate approved staging origin, e.g. `api-staging` domain, with HTTPS, exact allowed origin, no wildcard.
- Client signs in with **Supabase Auth** and sends its user JWT in `Authorization: Bearer ...` to `GET /api/v1/tenants` and scoped GET routes.
- Backend independently verifies token with Supabase `/auth/v1/user` before each request; member role is fetched by same user JWT. Supabase RLS remains authoritative; backend checks again to fail closed.
- Never send Supabase `service_role` to browser or this read-only gateway. Source and observed_at are included for successful rows; secrets are not returned.

## Backend → PostgreSQL
- `schema.staging.sql` only after human-approved migration to staging. Data API grants SELECT to authenticated plus row security. All write operations remain restricted.
- Monetary amounts are integers in VND. Do not trust AI-generated totals, stock availability or manually-supplied tenant IDs as authority.
- Audit and messaging history have retention / minimization work pending; no customer data is loaded as part of this PR.

## n8n → backend
- AI_SALES_DEMO's existing personal Sheets and workflow credentials stay untouched.
- Future production Commerce must verify Messenger/Zalo/webhook signature at a trusted gateway, resolve channel → tenant server-side, check entitlement, and write via an **idempotent database transaction**; the demo webhook is not a production order endpoint.
- No n8n production webhooks, credentials, sheets, or workflow connections are changed by this branch.

## Operational gate
- Create/confirm Supabase org + staging project, Render workspace + staging deployment, domain, costs, secret manager, Auth tenant strategy, RLS E2E, restore test, approval before any production binding.