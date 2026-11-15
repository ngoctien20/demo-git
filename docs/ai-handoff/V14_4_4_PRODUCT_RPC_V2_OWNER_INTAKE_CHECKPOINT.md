# TIEN404 AI — V14.4.4 Store-Aware Product RPC V2 × Ownership Intake QA

**Checkpoint date:** 16 November 2026 JST
**Project:** TIEN404 AI, Supabase tien404-staging ref ifxlvrhyjhbzbrkdsida
**Release:** EXPERIMENTAL / DRAFT / OFFLINE SOURCE+CI ONLY / NO SEND / NO HOSTED DB WRITE
**Parent:** V14.4.3 Draft PR #105 HEAD 0749f487fccd1a2c7dbf24c3928235964127f9e1
**Current branch:** work/v1444-store-product-v2-owner-intake-20261116
**Store/Knowledge PR #86 and Messenger Replay PR #95 remain separate Draft lineages.**
**Restore gate:** pg_dump archive exists and TOC is readable, but NO full isolated restore verified; user previously deferred test; hosted schema changes remain BLOCKED.

## 1. VERIFIED READ-ONLY BASELINE

Actual Supabase staging read-only audit during V14.4.4:
- PostgreSQL 17.11 (last verified V14.4.3), public.products=2, public.orders=2.
- No public.stores or public.store_memberships; six tenant-wide permissive SELECT policies still remain.
- public.save_merchant_product is still one postgres-owned SECURITY DEFINER. Its current contract authenticates via auth.uid() + active tenant owner/manager, uses (tenant_id,sku), inserts/updates products and an audit row, and has no canonical Store assignment.
- Current products UNIQUE(tenant_id,sku) blocks the future feature of identical SKU in two Stores of one tenant.
- V14.4.3 owner evidence: 2 tenant groups, each one Product and one Order, one group has two owner memberships, the other one. No real Store ownership proven.

These constraints mean **the old RPC must not be repurposed as a multi-store writer**. New V2 must be staged separately with a tested compatibility plan for existing UI, n8n, and API clients.

## 2. IMPLEMENTED — Safe offline Store-aware Product V2 contract

File: qa/store-product-v1444/product-v2-offline.cjs.

- Constructor only accepts mode=OFFLINE_SYNTHETIC_QA and synthetic role/Store registry adapters. **No Supabase credentials, SQL connection or network operations.**
- Every create/update/read re-verifies synthetic Auth and independently resolves active owner/manager **canonical Store Membership** on the SERVER side, not client role/tenant/user claims.
- Requires active Tenant, Store, Subscription, active Store membership, edit permission and exact Store scope.
- Composite product identity: (tenant_id,store_id,sku), so two Stores in one tenant may legitimately use the same SKU with independent price/stock. This is a **contract only**, not a hosted index change.
- Price value must be VND safe integer 0..1,000,000,000,000 (numeric 0 is explicitly valid); never infer malformed currency strings as 0. Name/SKU validated.
- CREATE requires explicitly specified non-negative integer initial_stock, expectedRevision=null. No implicit stock defaults.
- UPDATE requires expectedRevision>=1 and initialStock=null; optimistically checks current revision and bumps it, preventing stale overwrite. Stock cannot be updated by the metadata-edit contract.
- Scoped idempotency key and SHA-256 digest reject same key with changed payload; retries are read-only returns of prior synthetic result and re-check authorization.
- Unknown/unauthorized Store, revoked Auth/subscription, spoofed fields, invalid currency, duplicate create and stale version are denied. Maximum in-memory fixture sessions bounded.
- In-memory simulated product writes only: output always hostedWrites=0, canPublishRpc=false, canChangeRls=false; no messages or customer writes.
- **Not atomic durable PostgreSQL idempotency, not production Auth or a released RPC.** Hosted design must use a transaction, unique constraint + advisory/row lock or conflict-safe idempotency ledger, stable signed session and database-enforced Store membership.

## 3. PROPOSED — Store-aware SQL function V2, NOT an executable migration

An eventual audited native function (proposed name, not yet created): \`app_private.save_merchant_product_v2\` or a reviewed public façade subject to Data API exposure and grant policy. Avoid overloaded function names in exposed API. SQL contract must:
1. Validate real Supabase auth.uid(), a non-anonymous authorized user and active tenant membership AND active Store membership for the exact (tenant_id,store_id). Both roles must be maintained in server-owned tables. Never accept user_metadata, browser-supplied role or bot key as authority.
2. Check active Subscription and Store mode; enforce a server-owned active entitlement, and default deny if unavailable.
3. Validate proper price_vnd integer, SKU, name, active status, expected revision and exact stock mode.
4. Distinguish separate operations: CREATE sets initial_stock only; UPDATE changes name/price/is_active, preserving stock. Stock adjustment must go through an independently authorized ledger/stock service.
5. Execute in ONE transaction with primary/unique keys (tenant_id,store_id,sku), an idempotency registry scoped to authorized principal+store+request and atomic revision/updated_at compare-and-swap; conflict must never cause cross-store updates.
6. For UPDATE, validate USING+WITH CHECK RLS, or if a restricted DEFINER is explicitly necessary, independently validate all identity/Store predicates inside the function. Do not use a broad postgres-owned bypass without safeguards and audited EXECUTE grants.
7. Write immutable audit events including actor, tenant, store, operation and request ID; sanitize logs; do not emit customer PII.
8. Preserve old \`save_merchant_product\` for existing single-store QA clients until a measured read/write compatibility and rollback plan. Do NOT silently swap callers or rename database objects.
9. After approved migration, test two Stores with SAME tenant/SKU and different price+stock, duplicate request replay across processes, expired/revoked user sessions, optimistic concurrency, subscription expiry, and old tenant-only policy removal. Test actual user JWT; service_role is not an acceptance surrogate.

## 4. IMPLEMENTED — Private Owner Evidence Intake QA simulation

File: qa/store-product-v1444/owner-intake-offline.cjs.

- Reuses existing V14.4.3 \`reviewPrivateEvidence\` validator; does not rebuild private ledger validation.
- Stages 2 Product + 2 Order private claims in bounded 15-minute in-memory sessions. No file/db/network write, no raw evidence export or record/tenant/store UUID in status.
- Stage is performed by an independently verified synthetic QA intake operator authorized in BOTH tenants. Merchant per tenant must match exact Store grant; two separate merchants must confirm. A third independent QA reviewer, different from operator/merchants, must have review authorization for BOTH tenants.
- Prevents missing/malformed evidence, duplicate claims, role spoofing, expired/revoked sessions, cross-tenant merchant reuse, wrong Store, self-approval and unknown reviewer decision.
- Upon mock positive review returns only \`PRIVATE_QA_REVIEW_COMPLETED_NOT_HOSTED_VERIFIED\`; **realOwnerApprovals=0, actualOwnerSignatureVerified=false, independentHostedReadbackVerified=false, canBackfill=false**.
- Raw row IDs, merchant IDs and evidence remain only in private temporary process memory until TTL; production requires a separate encrypted restricted storage, signature verification and retention policy. Never upload real evidence to GitHub, CI, chat screenshots or hosted logs.

## 5. TESTING — STRICT DISTINCTION

New tests:
- qa/store-product-v1444/product-v2-offline.test.cjs: 37 cases on Store/tenant isolation, price VND, integer stock, stale revision and duplicate idempotency.
- qa/store-product-v1444/owner-intake-offline.test.cjs: 31 cases on two merchant confirmations, independent QA, role and Store scope, snapshot rejection, TTL and redaction.
- CI workflow: .github/workflows/v1444-store-product-owner-intake-qa.yml. Runs new 68 tests, inherited 457 Node regressions (V14.4.3 back through Messenger), and disposable PostgreSQL 17 Store RLS fixture from V14.4.1. No live JWT, no authenticated Supabase writes, no Meta/Zalo sends. Add exact CI run number after verification.

**No claims of hosted Store/RLS, real Auth/approval, actual price/stock updates or 4-row backfill PASS.**

## 6. P0 release gates & rollback

| Gate | Status |
|---|---|
| M0 real archive restored to isolated PostgreSQL 17 and rollback owner signed | BLOCKED |
| M1 canonical Stores/Memberships/Knowledge DB design approved | BLOCKED |
| M2 actual four legacy Product/Order rows independently owner-mapped | BLOCKED |
| M3 schema/store-aware SKU constraints and all active writers compatibility | BLOCKED |
| M4 replace permissive tenant policies atomically, audit RPC/GRANT and stock | BLOCKED |
| M5 signed Auth JWT same-tenant Store A/B hosted QA plus cross-tenant and revoked | BLOCKED |
| Real Messenger/Widget provider permission and send | NOT AUTHORIZED |
| V14.4.4 offline contract and private workflow | IMPLEMENTED / QA pending final CI |

**Rollback:** close/revert only this Draft PR. No hosted rollback required because there are NO Supabase SQL migrations, RLS/GRANT changes, customer or order writes, workflow publishes, paid resources, credential changes or production deployments in this task.

**Next safe version:** independently review a **migration compatibility matrix** for legacy Product writer, Store V2, inventory and Order writer API contracts, and prepare separate approved migration SQL and JWT/write negative suites AFTER recovery and owner mapping gates. Do not perform hosted changes without separate user approval.
