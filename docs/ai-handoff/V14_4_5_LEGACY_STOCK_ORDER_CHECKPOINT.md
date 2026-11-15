# TIEN404 AI V14.4.5 — Legacy Product Writer Compatibility × Stock & Order Safety Audit

**Date:** 16/11/2026 JST
**State:** EXPERIMENTAL — DRAFT — SOURCE-ONLY — NO SEND — NO HOSTED WRITES
**Branch:** work/v1445-legacy-writer-stock-order-audit-20261116
**Base:** V14.4.4 PR #106 HEAD 1a57f06caf82d866168cd5311023072c4402cfa7
**Dependencies:** PR #86 Store/Knowledge and #95 Messenger Replay remain independent Drafts, NOT merged
**Recovery:** The existing local backup can be listed but an actual isolated restore has not passed; restore was deferred, not waived.

## 1. VERIFIED live Supabase staging audit

- Project tien404-staging ifxlvrhyjhbzbrkdsida on PostgreSQL 17.11.
- Products = 2, Orders = 2; no canonical public.stores or public.store_memberships; all 6 legacy permissive tenant-level SELECT policies remain.
- public.save_merchant_product is SECURITY DEFINER and authenticated-executable. Actual seven-argument signature: p_tenant UUID, p_sku TEXT, p_name TEXT, p_price BIGINT, p_active BOOLEAN, p_initial_stock INTEGER, p_expected_updated_at TIMESTAMPTZ; returns TIMESTAMPTZ. It uses tenant+SKU, not tenant+Store+SKU. No canonical Store Membership verification.
- Products schema has price_vnd BIGINT, stock_on_hand INTEGER, UNIQUE(tenant_id,sku), price check 0..1e12, stock >=0.
- Orders statuses supported at SQL layer: pending, confirmed, paid, cancelled, refunded. total_vnd is BIGINT 0..1e15.
- Order Items validates quantity 1..10000 and unit_price_vnd 0..1e12; FK links (tenant_id,order_id) and (tenant_id,product_id), not Store-inclusive composite FK.
- No user-defined triggers on products/orders/order_items found in read-only catalog audit. This does not prove that external writers or privileged RPCs cannot change stock.

## 2. VERIFIED n8n read-only workflow snapshot

| Workflow | ID | Draft version | Published version | Storage |
|---|---|---|---|---|
| Create Order Tool AI_SALES_DEMO | KrSn4DNR9ALX5ng4 | af9ee686-2a9f-483e-9622-6e449500ac5e | 4740251a-cd01-4f7f-b8e1-e300a8393151 | Google Sheets |
| AI SALES Manage Order | fDB9dvs1qPPVt9Sp | 2e8786fd-e5c5-410f-9d6c-655653c32278 | 137d5689-40c5-4147-9bbc-b22809ad5908 | Google Sheets |
| AI SALES Update Order | BkAi6TVUKAjCnI7v | 3bd7043f-78e7-4a1c-93e5-2bc9d60ac767 | 93cf227a-ab8a-42c6-9185-7ec44f7aeb00 | Google Sheets |
| AI SALES Revenue Report | U2DJsxzSYPH5hRop | e4e16b90-1c66-48b9-a9e0-9d8fb6dbc6df | 978b5a8d-d47b-4783-b27e-96fbc96d5262 | Google Sheets / Gmail |
| Commerce V3 Business Core Sandbox | Y0WLykMtNAldbgL0 | 3d8b7f89-2058-4a2a-8919-e5ff92c3c484 | same | n8n Data Tables |
| Commerce Cart Preview | igPOsSbEgd4NgtRA | eff32e20-a6d0-4975-88b8-107eae752b4b | same | n8n Data Tables |

**Observed risks and limits:**
1. The first four workflows have a material Draft/Published version mismatch. Never claim QA of Editor code verifies Published code. Revenue Draft validates invalid paid totals more strictly than the published source; the Published path needs independent testing before any changes.
2. Demo Create Order reads Products and Orders, validates order, appends a pending Google Sheets row; no Product stock update node. The read-before-append duplicate check is NOT proven atomic across concurrent executions. Pending is not proven to reserve or deduct stock.
3. Demo Manage Order has preview/apply and expected_total validation for changes plus a readback step; stale concurrent row updates and store scope are not independently proven.
4. Commerce V3 and Cart Preview use n8n Data Tables as synthetic business/catalog snapshots. They do NOT prove hosted Supabase Store Auth/RLS or a durable stock ledger.
5. Source of truth and data segregation between Sheets DEMO, Data Tables sandbox and Supabase Commerce are not interchangeable. No new writer can be auto-routed across environments.

## 3. IMPLEMENTED source-only compatibility and safety contracts

**qa/legacy-safety-v1445/writer-compatibility.cjs**
- Frozen evidence manifest for the 6 observed workflows, including exact current Draft/Published version IDs and required node names.
- Drift checks fail closed. Separates Google Sheets DEMO from n8n Data Tables sandbox.
- Legacy Product RPC recorded as tenant+SKU, no Store scope. Classification restricts legacy calls to DEMO, denies any client-supplied store/tenant/role/stock override. Even green classification cannot dispatch a real RPC.
- Product V2 bridge requires real authenticated Store membership, same-tenant QA, Published caller parity and independent restore/ownership proof. Always returns MIGRATION_NOT_AUTHORIZED.

**qa/legacy-safety-v1445/order-stock-safety.cjs**
- Pure offline preview on mock server-owned tenant+Store catalog. Requires current priceVersion, stockVersion, expiration and active SKU.
- VND integer bounds and BigInt quantity multiplication; reject malformed price/stock, unknown/duplicate SKU, insufficient stock snapshot, cross-Store access, stale snapshot and expected_total mismatch.
- Customer-confirmed preview still performs ZERO order writes, zero reservations, zero stock deduction and zero owner notifications. An atomic database commit is separately required.
- Pending + zero delta may be inspected. All real confirm/reserve/deduct/release stock events remain blocked until a separately approved durable inventory ledger and idempotent order transaction exist.
- Paid-only offline revenue classification rejects duplicate order IDs, invalid VND total, cross-Store data and overflow. Pending/confirmed/cancelled/refunded totals excluded by this proposed QA contract, not declared authoritative accounting policy.
- No API, HTTP server, credential access, database or live notification.

**QA assets:** writer-compatibility.test.cjs, order-stock-safety.test.cjs, GitHub Actions v1445-legacy-stock-order-qa.yml with 52 new tests, 527 inherited tests and disposable PostgreSQL 17 Store RLS regression. Record final execution and numbers ONLY after verified CI.

## 4. Integration compatibility matrix

| Path | Actual storage | Existing behavior | Store V2 readiness |
|---|---|---|---|
| Legacy merchant Product RPC | Supabase | Tenant+SKU; no Store | BLOCKED |
| AI SALES Demo Create Order | Sheets | Pending after read-before-append | BLOCKED for multi-Store |
| AI SALES Demo Manage/Update | Sheets | Pending edit + validation + readback | BLOCKED for multi-Store |
| AI SALES Revenue Report | Sheets/Gmail | Paid-only; draft/published mismatch | BLOCKED for migration |
| Commerce V3 Business | n8n Data Tables | Simulated pricing, status, store rules | OFFLINE ONLY |
| Commerce Cart | n8n Data Tables | Preview only | OFFLINE ONLY |
| Supabase Orders + Order Items | PostgreSQL | Tenant FK without Store | BLOCKED |
| Product RPC V2 from V14.4.4 | Memory-only QA | Store-aware VND, CAS, scoped idempotency | NOT HOSTED |

## 5. RELEASE GATES, rollback and next

**P0 Restore:** actual local archive restored to isolated PG17, schema/data integrity checked and owner signs post-commit rollback. Still DEFERRED and NOT VERIFIED.

**P0 Identity and ownership:** verify all 4 existing rows individually with real merchant evidence and independent QA; approve canonical Store membership and RLS in a separately gated migration. No inference from tenant/group alone.

**P0 Migration compatibility:** move SKU uniqueness and all Order Item FKs to Store-inclusive scope, remove 6 old permissive tenant SELECT policies atomically, review privileged Product RPC; actual hosted JWT A/B same tenant, C different tenant, staff revoked tests. No changes to current workflow or client without independent approval.

**P0 Stock/Order:** decide when to reserve/deduct stock, what a paid/refunded transition means, how to handle cancellation and partial fulfilment, and whether Order Request is only advisory. Use an atomic Order/Inventory ledger with row locks and idempotency; never use a Sheets read-before-append as Commerce atomic guarantee.

**P1 Revenue:** verified paid/refunded rules, correct VND numeric handling, no double-count across Store, and draft/published parity. Reporting and notification connectors must not send during QA.

**Rollback this PR:** revert/close source-only Draft. No hosted resource, n8n Published workflow, customer row, RLS policy, credential, billing or real message modified. No hosted rollback needed.

**Next proposed version:** V14.4.6 Atomic Order Request & Inventory Ledger Design Gate — offline first, with owner policy options on order confirmation/reservation, disposable PostgreSQL race tests and future separate hosted approval.
