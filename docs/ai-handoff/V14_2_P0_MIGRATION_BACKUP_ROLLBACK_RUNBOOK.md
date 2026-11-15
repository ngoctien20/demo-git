# TIEN404 AI V14.2 — P0 Store RLS / Knowledge Backend release gates

Status: STAGING PREPARED, NOT EXECUTED — 15/11/2026 JST.
Project: Supabase tien404-staging, ref ifxlvrhyjhbzbrkdsida.
Baseline: Draft PR #86. Owner approved preparation only, backfill contingent on per-row ownership verification, hosted JWT QA contingent on authorized sessions; staging schema/RLS changes remain subject to verified backup and approved rollback plan.

## Verified live baseline
- PostgreSQL 17, active project. Migration history through 20261114170717. No V14.1/V14.2 migration applied.
- No public.stores, public.store_memberships or app_private.shop_knowledge_releases/items. SIX core Commerce tables have no store_id and use tenant-only permissive SELECT RLS.
- Products 2 rows, Orders 2 rows, Customers/Order Items/Conversations/Messages 0 rows. Counts are not a backup.
- Two independent QA tenants: qa-staging-shop-a-20261110 and qa-staging-shop-b-20261110; synthetic store candidates qa-store-a and qa-store-b from tien404_r1_qa.tenant_identity_map. These candidates each map to one authenticated tenant, but shop_bots identity_status=synthetic_qa and enabled_mode=dry_run. Not owner-confirmed.
- Each QA tenant has ONE matching Commerce product and order row. Product SKUs QA-A001 / QA-B001; source of orders manual. Do not publish record IDs or customer data in GitHub.
- Tenant A has 1 active membership, B has 2. Two tenants cannot establish same-tenant two-store isolation.
- Supabase SECURITY DEFINER RPCs include anon-executable qa_shop_b_zalo_claim, authenticated-executable qa_owner_pairing and save_merchant_product. Require separate execution-path review.
- One connected Render account tab displays Shop A owner session. Not a verified JWT API QA test. Two separately authorized JWTs were not accessible to the assistant.

## Gate 0 — restorable backup BLOCKED
The currently connected Supabase tools can read migrations and query SQL but offer no backup listing, export or restore operation. No verified backup artifact or restore drill has been established. Database row counts, Git branches and migration history do not count as backup.

Prior to ANY DDL, data backfill or RLS replacement, obtain:
1. Evidence of project plan and current Supabase Database > Backups entry (backup timestamp, backup identifier and retention), strictly predating migration. On Free projects, perform owner-managed Supabase CLI db dump with authorized credentials; no database password reset without separate permission.
2. Verify backup recovery by restoring to an isolated instance, not over active staging. New branch/clone creating cost needs separate budget approval.
3. Compare restored schema, row counts, constraints, RLS policies, migration history and integrity. Record private evidence location, RTO, RPO, primary approver and timestamp.
4. Owner expressly accepts this rollback plan after review; until then execution gate remains CLOSED.
Official docs: https://supabase.com/docs/guides/platform/backups

## Gate 1 — four-row store ownership verification BLOCKED
- Create a private release mapping ledger for each of two Products and two Orders. Keys: table, row ID, original tenant, approved canonical store UUID, owner confirmation, independent reviewer and source evidence.
- The synthetic QA store keys are candidates ONLY, never a reason to issue UPDATE. No automatic tenant-to-store assignment.
- Verify row-level signatures and referential integrity. Any missing or inconsistent mapping => STOP.
- No actual backfill performed; all four entries remain unapproved for store mapping.

## Gate 2 — canonical schema expansion PROPOSED
- After owner acceptance and recovery proof, create a fresh versioned migration using official Supabase CLI. Existing PROPOSAL_ONLY_STORE_RLS_DO_NOT_RUN.sql intentionally raises an exception before any DDL and MUST NOT be run.
- Establish canonical Stores and Store Memberships from trusted backend data; no client-controlled store role.
- Nullable store_id on products, customers, orders, order_items, conversations, messages with no defaults or guessed mapping. Audit tool/agent writes before requiring NOT NULL.
- Add tenant+store FKs between order items and their orders/products, messages and conversations, etc.
- Replace unique products(tenant_id, sku) with store-aware SKU uniqueness only after full compatibility and migration review.
- Add private versioned Knowledge schema and staff review / merchant approval evidence. Existing tenant_agent_configs stores knowledge_version per tenant+channel and needs a store-aware contract.
- No credential or production changes.

## Gate 3 — atomic policy replacement PROPOSED
- Existing SELECT policies are PERMISSIVE and tenant-only. New store policy alongside old tenant policy broadens access through OR; never do this.
- Replace all SIX old tenant-only SELECT policies atomically, alongside any affected views and RPCs, with tenant+store scoped policy requiring active tenant/store membership.
- Review existing SECURITY DEFINER write paths including save_merchant_product. For sanctioned writes require store-scoped WITH CHECK and composite FK safeguards.
- Run policy lint + own-store and foreign-store JWT tests before opening any hosted routes. Keep existing published n8n untouched.
- Revert uncommitted transaction on any mismatch.

## Gate 4 — hosted QA with real user JWT BLOCKED
- Use at least two authorized, different Store A/B user sessions from Supabase Auth. Server must validate each JWT. Never use service-role SQL as acceptance proof.
- To prove SAME TENANT store isolation, create a separate authorized pair of stores within one tenant with independently authorized users and non-sensitive fixture records. Current A/B tenants are different and alone insufficient.
- Positive reads require seeded canonical-store fixture, not an empty table; negative reads must return zero.
- Test unauthenticated, expired, unassigned staff, cross-store, policy OR bypass, composite foreign keys, revocations and metadata tampering.
- No JWT, API key or customer data pasted into ChatGPT, public GitHub or CI logs. Credentials managed via approved secure session only.
- Test reads first; write/negative mutation tests require separately approved synthetic fixture handling and rollback.

## Gate 5 — rollback (future, not yet rehearsed)
1. Save exact prior RLS definitions, migration version, account for every public API path, establish tested restore point.
2. On failure BEFORE customer traffic, abort RLS transaction, verify old policies restored, disable new adapter route.
3. Once any new write happens, DO NOT simply drop store_id columns or blindly restore old tenant-wide policies; freeze writers and preserve evidence.
4. If data corrupted, use owner-approved isolated restore/PITR with measured data loss and reconciliation of orders, messages, inventory and audit records.
5. Re-run hosted JWT access controls, webhook regressions, order invariants. Obtain independent QA acceptance before any rollout.

Current release status: MIGRATION_EXECUTION=BLOCKED; BACKFILL=BLOCKED; HOSTED_RLS_ACCEPTANCE=BLOCKED. Read-only audit, offline development and Draft PR work permitted.
