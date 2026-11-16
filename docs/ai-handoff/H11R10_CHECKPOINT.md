# TIEN404 H11R.10 — Trusted RPC Cutover Readiness × Recovery Consent Gate × Store Migration Compatibility
**2026-11-16 JST · SOURCE/DISPOSABLE ONLY · NO HOSTED MUTATION · NO-GO**

## Inherited checkpoint
Parent PR #195 (OPEN DRAFT), head 89db784069b57ba9f7a1d95c8832b7d4366885bd.
Inherited H11R.9 disposable PG17 run #43843470689: two successful jobs.
No PR merge, live code, Supabase DDL, Auth export or provider send is authorized.

## Direct read-only evidence in H11R.10
- Supabase hosted project ifxlvrhyjhbzbrkdsida: no public.stores or public.store_memberships; no store_id in public.products/orders/order_items/customers/messages/conversations/tenant_agent_configs; existing RLS and FORCE RLS enabled in the nine inspected public tables.
- Existing products UNIQUE (tenant_id,sku). Existing order_items FKs use (tenant_id,order_id) and (tenant_id,product_id), NOT Store. Existing data (2 Products / 2 Orders) must not be silently placed into invented Stores.
- n8n Published/active Zalo V1 yIJk8LvJoLF40Z62 version 8ca4a6f6-ab3f-42f1-8637-d4f5db790a3e executes V2 Shadow OgDZNSAvKEvhnAvn version f00ba506-c52a-4340-9a0c-809fd9c6ea9a; published graphs match draft; V2 has enabled HTTP POST to public RPC qa_shop_b_zalo_claim.
- The existing hosted public RPC is SECURITY DEFINER and anon-executable; do NOT REVOKE or disable the published n8n graph without per-function independently authorized replacement/canary/rollback.
- Cloudflare read-only inventory for one connected account showed 23 Worker script metadata entries, including TIEN404 gateway/Zalo staging. Scripts/routes/source contents, Pages, external clients and all other accounts have NOT been exhaustively attested. Do not infer zero hidden caller.
- H11R.8/9 locally restored archive V14.2 is a selected-schema archive omitting auth.users TABLE DATA. Independent human authorization for exporting Auth, encrypted offsite copy and complete verified recovery are absent.

## Verified caller coverage classification
| Domain | Status | Why |
|---|---|---|
| N8N_DRAFT_PUBLISHED_CALL_GRAPH | VERIFIED IN NAMED V1/V2 PATH ONLY | Graph and enabled POST only; not every workflow, endpoint, or external client |
| CLOUDFLARE_WORKERS_ROUTES_AND_PAGES | PARTIAL INVENTORY ONLY | 23 Worker names in one account; not code/route/Pages/full account inventory |
| SUPABASE_EDGE_FUNCTION_DEPENDENCIES | NOT VERIFIED | No complete Edge/function caller inventory |
| POSTGREST_REAL_REQUEST_OBSERVATION | NOT VERIFIED | No independently validated real signed provider trace or full sampling window |
| EXTERNAL_OPERATOR_MANUAL_SCRIPTS | NOT VERIFIED | No independent operator/script inventory |
| THIRD_PARTY_API_CLIENTS | NOT VERIFIED | No external-client independent signoff |

## Cutover release gate — REVIEW ONLY
1. Collect signed PRIVATE caller evidence from all six domains (actual inspected records, TTL/nonce/trust anchors and independent signatures). No raw tokens, customer IDs, private request headers or PII in a PR.
2. Verify source provider webhook signature and exact recipient mapping, rate-limits, replay durability and trusted channel-to-Store resolution.
3. Implement a separately privileged/private replacement with exact authorization checks; test two-step pairing on hosted in an individually approved canary only.
4. Establish an executable rollback DRILL on a private environment, monitor real request outcomes and preserve old caller path during safe transition.
5. Controller + Independent Security Reviewer + Channel Operator + DB Operator independently authorize the exact RPC signature and single operation, with expiry and private receipts.
6. Only AFTER these gates: separately request hosted RPC privilege change. This document is NOT an approval token.

## Recovery consent gate
- Local checksum + limited restore prove selected application components only. Missing Auth membership recovery and complete role/ACL, Storage external configurations. No consistent platform disaster-recovery certification.
- Controller identity/legal Tenant scope, independent Reviewer, Backup Operator, encryption/key custody, lawful basis, retention/erasure, one-time operation signed approval, offsite integrity, and independent isolated complete restore remain NOT VERIFIED.
- NEVER export auth.users, decoded secrets, tokens, PII or backup bytes in source CI or public GitHub. This document is NOT SIGNED and NOT AUTHORIZED.

## Legacy → canonical Store expand–verify–contract
1. EXPAND (review only): Add nullable store_id and canonical stores/store_memberships to isolated candidate schema, respecting existing composite Tenant FKs and RLS. Initially all legacy rows remain UNASSIGNED.
2. VERIFY (private): Independently establish Owner/Store claim per legacy row and per real provider channel, collect signed mapping and complete snapshot; reject missing, conflicting or guessed ownership. Validate row counts, IDs, prices, order totals, orphan FK=0, cross-Store denial and rollback proof.
3. CONTRACT (separate approval): The existing UNIQUE(tenant_id,sku) will block same-SKU in two Stores of the SAME Tenant. Any change to UNIQUE(tenant_id,store_id,sku) must be coupled with every legacy writer/read/search and SKU resolver migration; NEVER drop old uniqueness on hosted as a source-only action.
4. Composite FK (tenant_id,store_id,order_id) and (tenant_id,store_id,product_id) must protect Order Items after mapping. NULL store_id permits composite MATCH SIMPLE FK to skip Store linkage until validated; fail closed for all new writes and defer NOT NULL until attribution complete.
5. Hosted products/orders/auth/Stock/Order Outbox remain unchanged. This is only a disposable PG17 regression, not a migration plan approved for execution.

## New H11R.10 sources and tests
- qa/h11r10/approval-gates.cjs: ALL outputs permanently deny real actions; all-green self-report yields only REQUIRES_INDEPENDENT_EXTERNAL_APPROVAL.
- qa/h11r10/approval-gates.test.cjs: negative and falsified-green metadata tests.
- qa/h11r10/pg17-store-migration-compatibility.sql: inherited H11R.9 PG17 suite plus isolated legacy contract, nullable expand, missing map rejection, gated synthetic mapping, old uniqueness incompatibility, candidate Store SKU isolation, cross-Store composite FK, ROLLBACK. A synthetic_verified=true flag does NOT stand in for an actual legal/merchant signature.
- .github/workflows/h11r10-disposable-compat-no-hosted-write.yml: PostgreSQL17 disposable CI and source-only NO-GO static guard, zero Supabase/n8n credentials.

**Checkpoint status: H11R10_CANDIDATE_UNTIL_EXACT_SHA_CI_PASS; HOSTED_RPC_REVOKE=NO-GO; AUTH_EXPORT=NOT AUTHORIZED; STORE_MIGRATION=NO-GO; PRODUCTION=NO-GO.**
