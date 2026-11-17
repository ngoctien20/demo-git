# TIEN404 V18.0-P0C — Canonical Store Authority Contract

**Status:** PROPOSED / SOURCE-ONLY / NEVER DEPLOYED. Version `store-contract-v18.0-p0c-1`.
**Parent:** RPC17.8B Draft #362; integrated checkpoint #368.

## Trusted resolution
The server must bind `tenant_id UUID` + `store_id UUID` from authenticated, privately registered provider installation or web session; never trust message text, PSID, Zalo UID, customer-supplied order number, or editable JWT `user_metadata`.
A privileged call requires evidence: `tenant_id, store_id, actor_kind, actor_proof_ref, installation_id, operation, resource_id, event_id_hash, authority_version, trace_id`. It must compare current, revocable Store membership to this proof and reject unrecognized stores.

The channel ingress must independently authenticate Meta/Zalo provider-native provenance *before* invoking n8n or RPC. Shared-secret request header alone does not prove Zalo origin. Cross-channel identity linking needs independent permission/consent and single-use consumed OTP; opaque provider actor HMACs must be scoped to exact installation/Store.

## Required composite keys and foreign keys (DESIGN ONLY)

| Resource | Canonical scope and invariant |
|---|---|
| stores | PK (tenant_id, store_id); disabled store denies writes/sends |
| store_memberships | PK (tenant_id, store_id, user_id), role and active status, server checked |
| products | UNIQUE (tenant_id, store_id, sku); (tenant_id,store_id,product_id) FK/unique |
| orders | (tenant_id,store_id,order_id); customer and order source same Store |
| order_items | both order and product composite FKs must match tenant+store |
| customers | (tenant_id,store_id,customer_id), separate channel ownership proof |
| conversations/messages | (tenant_id,store_id,conversation/message id), provider install scope |
| channel_installations | provider installation -> exact tenant+store; status+authority version |
| channel_identity_links | tenant+store+both principals + consumed, TTL, revocation, audit |
| notification_outbox | tenant+store+event+recipient policy+idempotency, no cross-store sends |

**Current blockers verified 2026-11-18:** `public.products/orders/order_items/customers/conversations/messages/tenant_memberships` all have `tenant_id` but no `store_id`; RLS currently checks tenant membership. `public.products UNIQUE(tenant_id,sku)` is incompatible with two stores reusing SKU within one tenant, and order item FKs only include tenant. `save_merchant_product` is tenant-scoped, not Store-scoped. Treat RP-07 and RP-08 as real open gaps; do not re-label as successful tests.

## Migration preflight, NOT migration permission

1. Inventory published caller graph and current schema/RLS/constraints, provenance/fingerprint and all affected code.
2. Rehearse same-tenant Store A and B plus different-tenant C using **disposable** PostgreSQL17 and fake JWT/RLS with proper `USING` and `WITH CHECK`.
3. Draft additive, nullable Store columns; ownership-derived backfill ONLY when independently verified. Unknown owner rows quarantine, never silently assign to default Store.
4. Before any hosted migration: require separate owner approval, exact migration/rollback plan, **real current database backup plus independently verified restore**. This proof is deferred only for disposable/source-only QA today.
5. After approval: canary, partial cutover, composite FK and unique swap, Store-aware RPC and n8n tool authorization, real hosted Supabase Auth A/B negative QA, provider-native signed no-send and cross-channel consent UAT.

## Evidence boundary
GitHub Actions CI under `qa/v180-p0c/` reproduces three deployed top-level RPC function bodies but replaces two fixed QA tenant UUID constants with synthetic values and uses **synthetic** auth/Vault/R1 QA dependencies. Thus a CI PASS proves bounded PostgreSQL procedure behavior, not real provider signature, Supabase JWT, hosted recovery or Store A/B isolation.

**Decision:** Continue isolated QA, block hosted migration, grants, real provider sends, real customer data and production release.
