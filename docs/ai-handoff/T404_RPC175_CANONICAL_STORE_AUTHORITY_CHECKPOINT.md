# TIEN404 AI — RPC17.5 Canonical Store Authority × Real Supabase Auth A/B UAT Preparation

2026-11-17 JST · SOURCE-ONLY · CI 388/388 PASS · NO DB WRITES · HOSTED NO-GO

## Inheritance
- Parent RPC17.4 Draft PR #338 exact baseline `8ca86074849b0779c348fd6cac899344108f47b3`.
- RPC17.4 GitHub CI 357/357 PASS (run #44084921841), source-only, real JWT Store A/B UAT not accepted.
- RPC16 Access DENY ALL, inactive public Worker, private empty R2 unchanged.

## Real Supabase read-only audit
- `ifxlvrhyjhbzbrkdsida` ACTIVE_HEALTHY. `public.tenants`, `tenant_memberships`, `products`, `orders`: RLS + FORCE RLS enabled.
- `public.products` read policy uses active tenant membership. `public.orders` read uses owner/manager tenant membership. No Store-specific predicate.
- `public.products/orders/customers/conversations/messages/order_items` currently have tenant_id but no Store ID.
- No canonical Store membership tables found in inspected non-system schemas. `tien404_r1_qa.tenant_identity_map` is a QA bot/store/tenant map, not a user ownership credential. `tien404_v175_qa.order_ownership` is order/customer-level QA, not canonical Store authority.
- Aggregate only: 3 auth user records, 2 distinct users with session rows, 3 active Tenant memberships, 1 Tenant with >=2 active users. No JWT or user personal information copied.
- Current Store A/B within same Tenant would not be demonstrably isolated from these public RLS policies without additional verified Store authority and row-level Store scoping.

## New source and design
- `qa/v152-rpc175/canonical-store-authority.mjs`: pure offline evaluator for session, tenant, store and membership version consistency; positive fixture still can_read/write/deploy/send/upload false.
- `qa/v152-rpc175/canonical-store-authority.test.mjs`: negative tests for cross-Tenant/Store, revoked authority, stale ownership, mismatched session, forged metadata, legacy ambiguity, and hard No-Host.
- `T404_RPC175_CANONICAL_STORE_AUTHORITY_DESIGN_REVIEW.md`: additive migration proposal (not executable SQL), required composite tenant/store keys, strict RLS and UAT/rollback constraints.
- No migration, no SQL write, no changes to Cloudflare or n8n; GitHub CI source-only.

## Owner approval needed later
A separately approved disposable Store QA authority schema with pre-migration backup, owner proof and independent operator, explicit Finance/security/rollback acceptance; verified real Store A/B Supabase Auth sessions (out of chat), read-only cross-store RLS negative UAT and no-send hosted gate, then consider scanner/DO. Never infer Store ownership from QA mapping, Tenant membership alone or self-declared metadata.

## Independent CI proof
- GitHub Actions RPC17.5 run #44086143949 on commit `994ffc7df92717b7298346b01850f7e5f0df5f06`: SUCCESS, 388/388 PASS, zero failures across 12 Node source suites (31 RPC17.5 plus 357 inherited). No Workerd hosted test or real JWT session UAT was performed.
- Existing separate RPC10 workflow remains failing; this must be audited independently.

## QA & rollback
- CI status must be read from exact PR head before declaring PASS.
- Close Draft PR to roll back source. No hosted rollback needed because zero hosted writes.
- Existing independent RPC10 workflow failures remain unresolved.

CHECKPOINT: RPC175_PR341 · CI_388_388_PASS · TENANT_RLS_ONLY_OBSERVED · REAL_STORE_AB_NO_GO · HOSTED_NO_GO
