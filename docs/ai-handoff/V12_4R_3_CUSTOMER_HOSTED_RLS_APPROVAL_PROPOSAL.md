# V12.4R.3 — Customer Catalog hosted RLS, permission proposal (NOT APPLIED)

**Approval gate P0.** This document is a design and controlled migration sketch, not a migration submitted to Supabase. It MUST NOT be run before explicit owner approval, backup and verification of the exact deployment identity.

## What was actually verified
- Hosted `public.products` has `tenant_id` (UUID) but **no `store_id`**. `public.products` cannot satisfy Customer Core's tenant+store+bot+SKU contract by itself.
- Public products RLS is enabled and forced; authenticated role has SELECT constrained by active membership, anon has no SELECT.
- Hosted QA fixture `tien404_r1_qa.catalog` has `tenant_key/store_key/bot_key/sku` primary key, positive price and nonnegative stock, and matching `shop_bots` binding.
- `tien404_r1_qa` schema and catalog are intentionally not granted to `anon`, `authenticated` or `service_role`. RLS enabled; no customer SELECT policy yet.
- No `tien404_customer_*_ro` or `core_qa_*` roles currently exist in hosted Supabase. Therefore Customer Core hosted catalog access is **BLOCKED**, not functional.
- Separate read-only SQL checks of two approved merchant QA identities showed 1 own product, 0 other-tenant products; unknown UID saw 0 and anon lacked SELECT. These are **role-claim simulations**, NOT login/JWT or actual Customer backend E2E.
- Existing Owner PR #41 owns owner sessions and Shop B owner data. This proposal does not touch those.

## Candidate temporary two-shop role/RLS strategy (FOR REVIEW ONLY)
A short-lived proof for Shop A/B uses distinct NOLOGIN restricted roles. It is NOT yet a SaaS-scale role allocation strategy. Never make the role a client-accessible JWT role or pass the client-supplied tenant/store directly into SQL `SET ROLE`.

```sql
-- NOT APPLIED. DO NOT RUN UNTIL EXPLICIT APPROVAL.
-- Preconditions: backup schema/policies/grants; verify two QA bot bindings; define server-side
-- protected Customer ingress->trusted role map and one backend connection identity.
CREATE ROLE tien404_customer_qa_a_ro NOLOGIN NOINHERIT NOBYPASSRLS;
CREATE ROLE tien404_customer_qa_b_ro NOLOGIN NOINHERIT NOBYPASSRLS;
GRANT USAGE ON SCHEMA tien404_r1_qa TO tien404_customer_qa_a_ro,tien404_customer_qa_b_ro;
GRANT SELECT (tenant_key,store_key,bot_key,sku,product_name,price_vnd,stock)
 ON tien404_r1_qa.catalog TO tien404_customer_qa_a_ro,tien404_customer_qa_b_ro;
GRANT SELECT (tenant_key,store_key,bot_key,enabled_mode,identity_status)
 ON tien404_r1_qa.shop_bots TO tien404_customer_qa_a_ro,tien404_customer_qa_b_ro;
-- No SELECT on shop_bots.credential_ref or catalog_source_ref.
CREATE POLICY customer_qa_a_catalog_read ON tien404_r1_qa.catalog FOR SELECT TO tien404_customer_qa_a_ro
 USING (tenant_key='qa-tenant-a' AND store_key='qa-store-a' AND bot_key='qa-bot-a');
CREATE POLICY customer_qa_b_catalog_read ON tien404_r1_qa.catalog FOR SELECT TO tien404_customer_qa_b_ro
 USING (tenant_key='qa-tenant-b' AND store_key='qa-store-b' AND bot_key='qa-bot-b');
CREATE POLICY customer_qa_a_bot_read ON tien404_r1_qa.shop_bots FOR SELECT TO tien404_customer_qa_a_ro
 USING (tenant_key='qa-tenant-a' AND store_key='qa-store-a' AND bot_key='qa-bot-a'
        AND enabled_mode='dry_run' AND identity_status='synthetic_qa');
CREATE POLICY customer_qa_b_bot_read ON tien404_r1_qa.shop_bots FOR SELECT TO tien404_customer_qa_b_ro
 USING (tenant_key='qa-tenant-b' AND store_key='qa-store-b' AND bot_key='qa-bot-b'
        AND enabled_mode='dry_run' AND identity_status='synthetic_qa');
-- STOP: no backend credential, membership or SET ROLE permission has been granted.
-- Backend identity and role switching require explicit separate approval.
```

## Security contract
1. Provider authentication + trusted registry derives tenant/store/bot on server. An untrusted customer message, public UUID or header must never choose database role or change scope.
2. The trusted backend maps a verified context to the **exact** eligible database role. A dedicated server connection must use that role *before* all data reads.
3. Candidate `hosted-catalog-guard.cjs` checks `current_user`, `rolbypassrls=false`, `rolsuper=false`, `row_security_active` on both catalog and bot registry, no SELECT privilege for `credential_ref`, no catalog INSERT/UPDATE/DELETE and exact request/response scope. It is currently **opt-in** and NOT exported into core index/hosted channel.
4. No `service_role` bypass, no `SECURITY DEFINER`, no browser credential, no public schema exposure, no generic grant on `shop_bots`.
5. The QA data fields are sparse (no real catalog freshness source beyond statement time, no wholesale/MOQ/size/color/unit/status). Do not invent these values.
6. No order, payment, stock mutation or channel send. Model budget remains BLOCKED.

## Acceptance criteria before granting roles
- Back up `pg_roles` presence, `pg_policies`, RLS, `pg_class.relacl`, column privileges, constraints and Q&A dataset.
- Resolve how the backend holds an authenticated, least-privilege PostgreSQL identity without a shared client-facing database user; explicitly approve credential creation and role membership.
- Execute approved DDL only on Supabase staging (never production), review advisory findings, and verify actual cross-shop RLS using connected server-only identities (not merely SQL `SET ROLE` emulation).
- Verify unknown/revoked binding, two shops with shared SKU F01, permission to read **only** own catalog and no secret columns, and no writes; verify real data change freshness and connection pool transaction-scoping.
- Audit with PR #41 owner workstream; no merge between branches.
- For future SaaS scalability prefer a server-attested tenant context bound to a durable role/mapping table; do not use untrusted `current_setting('app.tenant_id')` claims from client alone.

## Rollback plan (after a future approved application)
- Disable Customer backend and revoke backend role memberships first; ensure no in-flight connections.
- Drop the four SELECT policies and revoke column grants/schema usage from the two candidate roles.
- Drop roles **only** after confirming no dependent objects or other approved use.
- Restore schema grants/policies from pre-change checkpoint if drift appears. No rollback required today because **nothing was applied**.

Current status: PROPOSED/BLOCKED. Only source-side opt-in candidate and isolated PostgreSQL QA may proceed without approval.
