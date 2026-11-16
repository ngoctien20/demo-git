# TIEN404 AI — V15.0-09 Hosted Store Security & Commercial Integration Readiness
Date: 16/11/2026 JST | Scope: Hosted READ ONLY + source-only QA + guarded SQL review | Release: NO-GO

## Verified hosted baseline (Supabase)
- Project: tien404-staging / ifxlvrhyjhbzbrkdsida / PostgreSQL 17.11 / ACTIVE_HEALTHY.
- Aggregate: 3 auth users, 2 Tenants, 3 active tenant memberships, 2 Products, 2 Orders, 0 orphan Product/Order Tenant references.
- Nine core public tables have RLS plus FORCE RLS. Existing Product, Customer, Order, OrderItem, Conversation, Message and Bot Config records are Tenant-scoped; none has store_id. There is NO canonical public.stores or public.store_memberships.
- Authenticated business-table SELECT currently uses Tenant membership. No equivalent Store-level RLS verified. Anon SELECT on inspected business tables is false. The service_role can bypass RLS and must not be used by untrusted clients.
- Products currently UNIQUE(tenant_id,sku): two Stores under one Tenant cannot independently use the same SKU without controlled policy/constraint and query migration.
- QA identity map rows = 2, maps to 2 actual Tenants; QA owner_bindings rows = 2, confirmed rows = 0. Do not treat QA text store keys as trusted canonical ownership.
- Private order_idempotency is Tenant-scoped, and channel_secrets not Store-scoped. Review all dependent Outbox, Channel Binding, and Bot Profile tables and callers before changing.
- Existing 2 Products and 2 Orders lack a verified Store owner. DO NOT auto-assign them to a newly fabricated default Store.

## Verified privileged RPC security surface
- public.qa_shop_b_zalo_claim: SECURITY DEFINER, postgres owner, EXECUTE allowed to anon. It uses Vault-backed header secret checks for synthetic pairing; no exploit proven, yet public exposure and rate limits need independent review.
- public.qa_owner_pairing and public.save_merchant_product: SECURITY DEFINER executable by authenticated; each references auth.uid and tenant_memberships but NOT store_memberships. They do not prove per-Store authorization.
- Supabase Advisor also warns leaked-password protection disabled. Do not change hosted security settings without owner approval.
- Evidence: https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable

## Verified n8n no-change boundary
- Published Messenger Z7FdV7uDvApfbURQ, version d5c96b6b-d790-4270-8b0f-d0ebdd8bbd92 (27 nodes), still uses legacy DEMO order tools.
- Published Zalo Private Router sIPs6egzIwOY1GNv, version 8d91d23c-cd87-462f-a112-9cca2340bec8 (6 nodes), unwired to customer live.
- Published AI SALES Main v6PBwcqSapVzACMW, version c0f04eb1-9e2b-4b42-bf70-0ce12d5b0c30 (8 nodes), legacy DEMO-only.
- No workflow, provider send, real Order/Stock, Supabase schema or customer row changed.

## Proposed architecture
Reuse existing Tenant and Tenant Membership tables. Create canonical child Store with explicit Store Membership; do not duplicate the Tenant framework or promote QA map fixtures. Four-row mandatory ownership chain:
1. auth.users identifies user.
2. tenant_memberships confirms active user/tenant association.
3. stores confirms canonical Store belongs to Tenant.
4. store_memberships confirms explicit active user authorization for that Store.
A fifth independent proof validates merchant consent and verified provider channel binding; G2.3 Zalo is not complete.
All authoritative Product, Price, Order, Customer, Conversation, Message, Bot Config, Idempotency and Outbox lookups must scope to server-derived (tenant_id,store_id).
Keep existing cross-Tenant FKs; add composite Tenant+Store child FKs on approved migration. Move SKU unique from Tenant+SKU to Tenant+Store+SKU only when callers and backfill are ready.
RLS: enforce restrictive Store filter with existing tenant policies. Never add a permissive OR policy that leaks across shops. Null Store data must not appear as authorized. Owner role in one Store must not imply owner of all Stores. Service-role access must be controlled separately since it bypasses normal RLS.

## New source artifacts
- docs/ai-handoff/V15_09_HOSTED_READ_ONLY_PREFLIGHT.sql: metadata SELECT only, no PII values.
- docs/ai-handoff/V15_09_CANONICAL_STORE_EXPAND_REVIEW_ONLY.sql: explicit RAISE EXCEPTION guard plus ROLLBACK; not an executable hosted migration. Demonstrates Store, Store Membership, seven nullable store_id fields, composite FKs.
- qa/v1509-hosted-store/store-security-contract.cjs + .test.cjs: offline A/B (same Tenant) vs C (different Tenant), owner/role/consent, subscription/revocation/replay negative matrix, zero hosted reads/writes and zero sends.
- qa/v1509-hosted-store/sql-review-contract.test.cjs: verifies review-only SQL guard and SELECT-only preflight.
- .github/workflows/v1509-hosted-store-security-no-send.yml: zero-credential CI. Check exact HEAD run before claiming success.

## Commercial integration contract
Verified Provider ingress and replay → server-only Channel Binding → canonical Tenant/Store resolver → Store membership/Subscription check → Store Bot Profile → trusted Catalog/Price/Stock → shared AI Sales Core → provider response adapter.
Order Request remains DRAFT until user confirms, price and stock are re-read from authoritative Store, idempotency scoped by Tenant+Store+provider event, Order pending and Outbox written atomically through explicitly authorized backend, owner notification only to independently verified correct owner. Neither current Messenger DEMO tools nor synthetic Zalo fixtures can be treated as the hosted Commerce writer.

## Gates and milestones
G0 BLOCKED: independent A/B/C Owner proof, G2.3 real merchant consent, mapping all existing rows, private backup/restore rehearsal, written rollback and migration approval.
G1 PROPOSED: produce an actual migration from guarded design after authorizations; staged expand, explicitly approved backfill, composite FK verification, SKU uniqueness migration and coordinated RLS cutover. New Store rows MUST NOT go live while tenant-wide RLS permits cross-Store reads.
G2 BLOCKED: authenticated JWT tests for Shop A ↔ B same Tenant, Shop C separate Tenant, anon access, revoked/paused/expired Store, cross-channel spoofing, service-role bypass, read+write, FK checks, idempotency and memory isolation. Synthetic PASS never stands in for hosted proof.
G3 BLOCKED: native Meta/Zalo proof, Owner G2.3, durable replay, controlled staging read-only Catalog integration, owner UI UAT, real latency and costs; production approval only after all gates.
PR #124 is a separate V14.8 candidate; do not merge it implicitly with the V14.8 branch inherited by V15.

## Safety / rollback / reporting
No Supabase migrations, grants, auth, credential, RPC, RLS or data changes. No n8n Published workflow or Cloudflare changes. No billable model call, provider send, or Order write.
Close/revert this child Draft PR for source rollback; parent PR #125, #123, #122 and #121 stay intact. Any future hosted rollback must be backed by tested restoration, never a blind DROP.
Mark: VERIFIED read-only; IMPLEMENTED source-only; TESTED offline only after successful current-head CI; HOSTED RLS NOT TESTED; COMMERCIAL RELEASE NO-GO.
