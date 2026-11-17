# TIEN404 RPC10-G0.3 — Published Commerce Store Scope Readiness

Date: 2026-11-17 JST. Lifecycle: DRAFT / SOURCE-ONLY / NO-SEND / NO-HOSTED-WRITE.

## Directly verified from connected n8n (read-only metadata)

| Published workflow | ID | version | Code Tenant | Code Store | Data read Store |
|---|---|---|---|---|---|
| Commerce Tenant Resolver | 5Eeh8hbpsoNhuiVo | a99c7350-7aea-446d-bdc5-4b10f52c3ad1 | yes | no | no |
| Commerce Catalog | oOOXicKXGkBskKqh | e0f1e345-8e6c-40cb-8e6a-d7ad2eb92696 | yes | no | no |
| Commerce Cart | igPOsSbEgd4NgtRA | eff32e20-a6d0-4975-88b8-107eae752b4b | yes | no | no |
| V3 Business Core Sandbox | Y0WLykMtNAldbgL0 | 3d8b7f89-2058-4a2a-8919-e5ff92c3c484 | yes | no | no |

Published legacy Messenger Z7FdV7uDvApfbURQ version d5c96b6b-d790-4270-8b0f-d0ebdd8bbd92 has Google Sheets DEMO product tool and HTTP Send Messenger Reply. It cannot be used as actual hosted Supabase Store Commerce authorization evidence.

Eight n8n Commerce Data Table schemas inspected without reading rows: CHANNELS, TENANTS, PRODUCTS, ORDERS, AUDIT, V3_STORE_RULES_SANDBOX, V3_PRICE_RULES_SANDBOX, V3_NOTIFICATION_OUTBOX_SANDBOX. All have tenantId but no storeId. This is a design/integration gap, not evidence of a proven customer-data leak.

## IMPLEMENTED source-only in Draft PR #247

- qa/v152-rpc10/g03-published-caller-sanitized.json: 5 exact Published versions + 8 sanitized table schema observations.
- qa/v152-rpc10/g03-published-caller-readiness.cjs: pure offline, fail-closed Store cutover inspector. Invalid, stale, missing or spoofed registry/caller reports deny readiness. Even a self-claimed all-green packet cannot permit hosted actions.
- qa/v152-rpc10/g03-published-caller-readiness.test.cjs: 38 negative/contract tests independently executed in V8; 38 PASS / 0 fail. This is not a Node22 CI result.
- .github/workflows/v152-rpc10-six-surface-nohost.yml: added Node G0.3 and no-hosted-I/O static step. Exact-head CI must be verified before marking this change GitHub-CI TESTED.

## Integration handoff — PROPOSED only

1. Verify provider-native signatures and actual Page/OA installation authority in server-owned ingress before considering a Store claim.
2. Resolve verified channel installation + version to canonical Supabase tenant UUID, Store UUID and Bot Profile version through a private server-owned registry. Never use client-provided IDs, AI-generated Store guesses or unverified n8n aliases as authority.
3. On every Catalog, Cart, Pricing, Inventory, Order and readback request verify active Store membership, role, source version and approved Store-scoped SKU/price/stock context. Scope all writes and composite foreign keys by Tenant AND Store.
4. Keep n8n DEMO Google Sheets, n8n Data Tables and Supabase hosted data distinct until an explicitly reviewed migration/caller-compatibility plan exists.
5. Test same-Tenant Shop A vs Shop B denial, mismatch/revocation/replay, Store-to-Tenant FK, real JWT Auth/Owner/Manager permissions and independent rollback before any release.
6. Reuse V17.1 Draft PR #243 for native ingress QA, V17 CBOT Draft #248 for cross-channel/vision/order read-only contracts, and RPC12 Draft #244 for original merchant Owner evidence; do not duplicate or merge code paths blindly.

## Owner decision: skip local-machine backup work

The owner explicitly requested to DEFER the actual local-machine backup step and to continue work. This is recorded separately on RPC12 Draft PR #244. The prior H11R limited archive acceptance remains; no repeated local backup, credential or restore tasks are required for source-only progress. However, CURRENT_M0_RECOVERY remains UNDECIDED / BLOCKED for hosted DDL/RLS migration: skipping this task is not a recovery release waiver. Do not backfill real Stores, apply M1/M2M4/M3 hosted DDL, change RPC permissions, publish n8n, send providers or create paid resources without separate phase-specific authorization.

QA evidence so far: 38 independent V8 source tests PASS (not real Store/JWT), old RPC10 PG17 six-surface and concurrent tests PASS on earlier exact SHA; current new HEAD CI is pending independent verification.

Rollback: close Draft PR; no hosted operational rollback because source-only.

Checkpoint: RPC10_G03_FIVE_PUBLISHED_CALLERS_EIGHT_TABLES_TENANT_ONLY_AUDITED__38_V8_PASS__HOSTED_CUTOVER_BLOCKED.