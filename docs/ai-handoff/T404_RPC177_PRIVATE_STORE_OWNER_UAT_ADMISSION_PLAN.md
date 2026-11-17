# TIEN404 RPC17.7 — Private Merchant Ownership × Disposable Supabase UAT Approval Plan

**PROPOSED ONLY. NOT A MIGRATION. No SQL in this document may be applied to staging automatically.**

## Current evidence
- RPC17.6 Draft PR #345 verified 36/36 PostgreSQL RLS assertions and 412/412 Node tests in a disposable GitHub Actions instance. The role/claim source is synthetic, not Supabase Auth.
- Live staging `ifxlvrhyjhbzbrkdsida` was checked by SQL SELECT: no `public.stores`, no `public.store_memberships`, no `public.products.store_id` or `public.orders.store_id`, and no `rpc177_qa` schema. Three users, two users with session rows, but those do not prove real authenticated Store A/B users.
- Exact parent RPC17.6 source HEAD `4873d9814ed27b4ea792e3ae4821000191acb2e1`. Preserve all RPC16–17.6 resource and PR gates.

## Required separate human approvals before any Supabase DDL
1. Merchant Owner independently proves control of both disposable Store A and B (P1/P2 records) via trusted authenticated private intake, not a chat link, screenshot or self-declared JWT payload.
2. Separate Security Reviewer confirms subject/merchant/tenant/Store authority (O1/O2), with different signing/identity key and replay-proof approval ledger.
3. Operator/Finance verifies allowed cost **and** isolation of resources, expiry of consent, rollback identity, and scope. Source-level signed fixtures are NOT a real authority.
4. Confirm prechange snapshot with demonstrated restore and immutable baseline version; provide explicit scope for creation of disposable `rpc177_qa` schema only, never change existing `public.products/orders` or RLS yet.
5. Reconcile earlier `tien404_r1_qa.tenant_identity_map` with owner evidence **without promoting** QA bot mapping to auth evidence; legacy data must not be silently backfilled.
6. Independent operator approves actual migration after all the above. Current project conversation does not contain this authorization.

## Disposable Supabase QA planned scope
- New isolated schema `rpc177_qa` with no Data API exposure and no grants to anon, authenticated, public, or service_role. Only dedicated least-privileged verified test actor can read. Cloudflare/R2/n8n/production untouched.
- Synthetic Store A/B and tenant identities; never copy customer data, real phone numbers or uploaded merchant documents.
- Proposed versioned migration using composite FK tenant+store, RLS+FORCE RLS, both Tenant and Store membership required; use exact `qa/v152-rpc176/sql/disposable-schema.sql` as a design/test reference **not as a Supabase migration**.
- Pre/post SQL assertions: schema created only in approved scope, no unexpected public table or policy modification, no indirect grants, no public Access routes. Explicit revert/restore plan reviewed independently.

## Real Supabase Auth A/B no-send acceptance planned
- Two real, different Supabase Auth accounts with distinct live sessions; verify signature/issuer, expiry, session ID and active state server-side. Never paste JWTs or keys in ChatGPT/GitHub/QA logs.
- Server-sourced canonical Tenant, Store and membership; if missing, STOP and do not fabricate or grant.
- Through authenticated PostgREST **RLS read-only** only: A sees A, not B; B sees B, not A; different Tenant C sees neither; revoked user denied; disabled Store denied; stale authority version denied; forged metadata cannot elevate rights.
- Check phone/address/order/customer values are never returned for another Store. Record only status and redacted hashed test IDs in private evidence store.
- Real Messenger/Zalo sends, public routes, file uploads, OAuth token changes, and production promotion remain forbidden.

## Rollback
1. If QA migration eventually authorized, capture schema-specific inventory and recovery evidence prior to write, record reviewer, operator, cost and approval IDs privately.
2. Do not delete existing Store/Tenant/Commerce data; rollback of disposable resources only by independently approved operator under a verified destroy list; never auto-drop from GitHub Actions.
3. If any UAT authorization, RLS, or evidence integrity check fails, STOP, close Access/no-send gates, revoke disposable actor and perform separately approved rollback.
4. This RPC17.7 change is source-only; rollback is close/revert Draft PR. No staging database rollback necessary.

**RELEASE GATE: REAL JWT A/B UAT NO-GO; HOSTED MERCHANT INTAKE NO-GO.**
