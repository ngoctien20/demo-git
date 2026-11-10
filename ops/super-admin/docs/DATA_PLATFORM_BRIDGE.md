# Super Admin V4 → SaaS Data Platform V1 bridge (proposed; NO LIVE WIRING)

This review-only integration note belongs to PR #2's existing `ops/super-admin` source. The tenant-aware data platform is staged separately under `ops/data-platform`.

**Critical identity gap:** Super Admin staging uses SQLite, custom `users.id`/`tenants.id` and its own TOTP sessions. Supabase requires `auth.users.id` UUID and PostgreSQL `tenants.id` UUID. Do not silently swap IDs, bypass login or merge these two authority systems without a migration plan.

Safe sequence:
1. Preserve current Super Admin login, MFA, CSRF, tenant entitlements and audit implementation for staging regression tests.
2. Create separate Supabase staging project and test first with synthetic Auth users and tenant data; do not import actual Orders/Products from AI_SALES_DEMO.
3. Introduce a reviewed mapping `{legacy_admin_tenant_id, supabase_tenant_uuid}` in a **private** admin backend, not in frontend metadata. Explicitly decide which identity provider becomes authoritative before any shared session/RBAC change.
4. Current Data Gateway validates user JWT through Supabase Auth and retrieves scoped PostgREST rows with RLS; it does not accept Super Admin cookies. Until a safe identity bridge exists, treat them as separate staging services.
5. Render deployment and Sites Control Hub changes stay blocked until workspace, cost, auth design, data retention and backup/restore signoff. Do not expose API keys to `gh-pages`.
6. Production Commerce order creation needs transactional stock management and idempotency; keep read-only until accepted tests and separate write approval.

Never label the read-only gateway a live production integration or existing Sites source modification.