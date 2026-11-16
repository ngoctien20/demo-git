# TIEN404 — V15 SALES LITE P0 · HOSTED STORE OWNERSHIP & REAL COMMERCE INTEGRATION
**Date:** 2026-11-16 JST · **Status:** IMPLEMENTED source-only / DISPOSABLE PG17 QA candidate · **Production:** NO-GO

## Goal / authorized scope
Continue from Sales Lite consolidation Draft PR #128 exact HEAD `1099f8c7589544c93a03d4afe03545c266c00170`. The first product serves 1–3 small Vietnamese shops, with one pilot channel and only basic catalog, quote, order-request draft, verified owner notification, pause/handoff, small merchant UI. Enterprise Dashboard, premium model selector, advanced Bot Studio and complex automations are explicitly DEFERRED.

**Allowed**: GitHub Draft source, read-only hosted audit, isolated PostgreSQL17 synthetic QA. **Not authorized**: hosted Supabase schema/GRANT/RLS/RPC changes, data backfill, production n8n, provider messages, credentials, paid model changes, real order/stock write, merge.

## Read-only VERIFIED observations (Supabase staging)
Project `ifxlvrhyjhbzbrkdsida`: 3 auth users, 2 Tenants, 3 active Tenant memberships, 2 Products, 2 Orders, 0 Order Items, 0 Customers, 0 Conversations/Messages.
- No `public.stores` / `public.store_memberships`.
- No `store_id` in public Products, Orders, Customers, OrderItems, Conversations, Messages or TenantAgentConfigs.
- Existing core SELECT policies reference tenant_memberships+auth.uid(), NOT store membership.
- Products has UNIQUE(tenant_id,sku); Orders and Products have tenant-level composite foreign keys but NO store-level composite FKs.
- Legacy Products (2) and Orders (2) cannot be automatically attributed to a fabricated default Store. Require independent owner proof and migration plan.
- RLS enabled on core tables is **not same-Tenant Store A/B RLS evidence**.
- Security Advisor warns `public.qa_shop_b_zalo_claim` is anon-executable SECURITY DEFINER (not a proven exploit), and `public.qa_owner_pairing`, `public.save_merchant_product` are authenticated-executable DEFINER RPCs; independent review needed.
- No migrations, GRANT, RLS, RPC, Auth membership, provider or customer writes performed.

## n8n VERIFIED constraints
- Published Messenger `Z7FdV7uDvApfbURQ` (27 nodes, active) still offers legacy AI_SALES_DEMO create/manage/update/order tools and Google Sheets. DEMO credentials/Orders/Products are **strictly separate** from rentable Commerce; never repoint them silently.
- Published Commerce Shop Onboarding `splyaeQtV719OuAu` (13 nodes) uses Data Tables with inactive tenant provisioning; not verified canonical Supabase Store.
- Commerce Agent Sandbox `iyfGUiEsZlNTBWOR` inactive (14 nodes), tools still sandbox.
- V15 signed QA trust gate accepts only synthetic signed fixtures and **explicitly forbids claiming real provider signature or merchant owner authentication**.

## Implemented in this Draft
- `qa/v15-sales-lite-p0/pg17-store-rls-isolation.sql`: self-contained fake Auth/JWT claim and Store A/B under same Tenant, C under different Tenant; exact composite Store FKs; restrictive per-Store RLS with permissive legacy tenant policy retained to expose risks; negative tests for wrong-store read, unauthorized INSERT/UPDATE, forged client store, revoked membership, anon, cross-store Order Item, and duplicate replay ID. All UUIDs and prices are synthetic. **Never run against Supabase hosted; this file is disposable-test SQL, not a hosted migration**.
- `.github/workflows/v15-p0-disposable-pg17-no-send.yml`: uses ephemeral `postgres:17` service and two GitHub CI jobs. CI has no Supabase secrets, merchant data, n8n, provider or paid model calls.
- Reuses existing guarded NON-EXECUTABLE migration sketch `docs/ai-handoff/V15_09_CANONICAL_STORE_EXPAND_REVIEW_ONLY.sql`, security contract and pilot release gate from #128; no new production migration promoted.

## P0-B Commerce integration additions — SOURCE-ONLY / DISPOSABLE
- `qa/v15-sales-lite-p0/commerce-preview-bridge.cjs` composes the **existing** V15 P256 signed synthetic context and strict legacy fixture reader. It is a thin integration seam, not another AI Agent or separate source of price.
- `commerce-preview-bridge.test.cjs` checks Shop-specific QA price, absent SKU, insufficient stock, mismatched `expected_total_vnd`, forged Store/client confirmation, invalid VND/quantity and zero provider/hosted/Orders/notifications.
- Extended PG17 disposable QA includes a synthetic atomic transaction saving `Order + Order Item + provider-qualified Replay Key + Owner Outbox (pending)` together, duplicate event conflict and composite FK denial of wrong-Store owner notification; stock is not deducted.
- **No actual pending Order, Outbox or stock is written to Supabase hosted**. The QA outbox has no provider sender or verified owner recipient; this is a transaction-design test only.
- Real webhook signature, Meta/Zalo send permissions, merchant owner proof, authenticated hosted JWT/RLS, true Order writer and delivery are NOT tested by these fixture cases.

## Approval / implementation gates (P0→P1)
### Gate P0-A — Private owner attribution — BLOCKED
Independent `auth.users → tenant_memberships → canonical stores → store_memberships` evidence for a real owned Shop; explicit provider account ownership and consent proof. Because canonical stores do not exist, create/store mapping must be reviewed before it can be certified. Existing 2 Products/2 Orders need provenance, original source and explicit assignment decisions. Never dump personal data to a public PR.

### Gate P0-B — Backup & recovery — BLOCKED
Private backup/export with verified restore into disposable environment; transaction boundaries, tested rollback, migration dependency graph, idempotency and channel secrets inventory. No blind DROP/DELETE.

### Gate P0-C — Owner-approved staged migration — REQUIRES SEPARATE PERMISSION
Propose expand → independently authorized backfill → composite FK/uniqueness → coordinated restrictive RLS cutover. Review all dependent app_private tables, channel bindings and RPCs. Never add permissive policies that retain same-Tenant access. Legacy NULL store_id must remain unaddressable by pilot APIs.
**Do not apply anything hosted without separate specific approval of migration, Auth/GRANT/RLS/RPC and affected data.**

### Gate P0-D — Authenticated hosted security QA — BLOCKED
Real JWT/RLS positive and negative assertions for Shop A/B same Tenant and Shop C cross Tenant, anon, revoked Store/role, suspicious provider binding, service-role bypass, SELECT/INSERT/UPDATE/FK/order-replay. The disposable PostgreSQL test does NOT pass this gate.

### Gate P1-A — Read-only Commerce Product bridge — BLOCKED
Backend-verified channel proof → Store identity → signed scope → authorized exact SKU price/stock read from authoritative Commerce source (not DEMO Google Sheets, not V14.7 fake catalog). No LLM-derived price, no client Store override.

### Gate P1-B — Order request & owner notification — BLOCKED
Initial DRAFT proposal and customer confirmation, fresh authoritative price+stock, expected_total strict, atomic idempotent Order pending + Outbox within one scoped transaction. Separate notification engine sends only to verified owner after save commit, with explicit provider permission and isolated staged test. Stock deduction only under approved business rules. Live send/Orders writes require new approval.

### Gate P1-C — Merchant pilot — BLOCKED
Private owner UAT, real page/bot consent and signed ingress, latency (p50/p95), usage cap/cost, pause bot and human handoff, privacy check. Only 1–3 small shops, progressive rollout under explicit approval.

## Test interpretation
A disposable PG17 PASS is **TESTED SQL isolation design**, NOT **VERIFIED hosted tenant-Store RLS**. A successful n8n synthetic execution or GitHub CI never counts as customer delivery.
No production changes in this phase. Rollback: close this child Draft PR, retain #128 and all predecessor source/Published unchanged.

## Next action
After exact-HEAD CI success, finish private ownership evidence intake and backup/restore plan; request owner approval for an itemized staging DB change. Continue preparing read-only real Commerce adapter contracts without calling real DB or provider.
