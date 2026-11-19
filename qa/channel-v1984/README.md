# TIEN404 V19.8.4 — Protected Store-Scoped Catalog Reader Candidate

**Status: CANDIDATE, isolated QA only. NOT a deployable Commerce API.**

## Verified prerequisites (19 Nov 2026 JST)
- V19.7I receives a real authenticated Zalo webhook, but intentionally strips customer text and identity; it **cannot** currently call a Commerce reader or reply.
- The current Commerce Supabase staging schemas do not yet have canonical `store_id` columns on Products/Orders/Conversations.
- The n8n Shop A/B Bot registry uses synthetic identities; no authenticated real provider Installation→Store ownership binding is yet approved.
- V19.8.3 established SQL policy and composite FK behavior with a disposable PostgreSQL 17 container and mock claims.

## Contents and execution
- `ephemeral-catalog-reader-schema.sql`: creates a **temporary fixture** `qa1984.catalog_snapshots`, with tenant+Store+SKU uniqueness, FK to the authorized Store product, RLS on `qa1983.can_read_store`, and a `SECURITY INVOKER` SQL lookup.
- `ephemeral-catalog-reader-acceptance.sql`: positive/negative cases under fictional Owner A/B role sessions, missing/revoked Store membership, foreign Store, stale/future snapshot, invalid price/stock/revision/origin, mismatched source, zero stock, snapshot write denied, anonymous read denied.
- `catalog-preview-contract.mjs` and `.test.mjs`: offline-only Vietnamese formatting of a single validated catalog row, with fail-closed response and no ordering/provider side effects.
- GitHub Actions `tien404-v1984-catalog-reader-qa.yml`: Node 22 and PostgreSQL 17 with localhost service, **no Supabase connection and no Zalo sends**.

## Candidate response contract (NOT a live HTTP route)
Input may only be prepared by a trusted server behind verified Store authority; do not accept a browser or chat message as authorization.

Expected safe data from hypothetical hosted catalog adapter: canonical `tenant_id`, `store_id`, exact `sku`, integer `price_vnd`, integer `stock_on_hand`, `verified_at`, `currency=VND`, `source_revision`. Returns only this Store's allowed row; missing, stale, inconsistent, foreign or unauthorized rows return **no catalog data**.

Preview renderer status is `OFFLINE_PREVIEW`, `INSUFFICIENT_STOCK`, or `DENY`. All outcomes **always** set `canReadHosted=false`, `canSend=false`, `canWrite=false`, `orderCommitted=false`, `stockReserved=false`. A successful preview never constitutes a quote, reservation, confirmation or provider message.

## Security boundary not yet crossed
- `auth.uid()` in `qa1983` is derived from a manually set SQL session variable. It **is not cryptographic Supabase Auth**.
- `p_tenant`, `p_store`, and `p_sku` in the SQL fixture can be supplied by the caller. PostgreSQL RLS enforces an account's Store membership in the fixture, but a single user with multiple Store memberships is **not yet restricted to the specific Bot installation's Store**. Real server-owned Bot binding is an additional mandatory gate.
- The `verified_at` timestamp and `source_revision` are **synthetic fixture fields**; proving freshness/authority from a real Commerce catalog, including price/stock update atomicity and stock reservations, is pending.
- No real service-role privileges are exercised in an RLS client test. A service-role read would bypass relevant RLS restrictions and does not prove authorization.
- Policies on protected Store catalog tables must never coexist with broad tenant-only permissive policies. Verify existing SQL writers, grants and RLS before rollout.
- Only fake QA stock/prices are used: Store A `F01=159000 VND / 5`, Store B `F01=189000 VND / 9`. These are NOT actual shop inventory.

## Real acceptance gates
1. Review and approve non-executable Store migration plan V19.8.2, backup/rollback and legacy writer cutover.
2. Establish canonical Zalo Bot installation↔Store identity and user-owner authorization from the trusted backend.
3. Apply to an **approved disposable hosted staging** database. Verify real signed Owner A/B Supabase Auth sessions with same-tenant two-Store fixture and an external Data API read (no service-role).
4. Verify catalog source of truth, atomic price/stock version and conflict behavior for the actual Store.
5. Implement a private read adapter, deny arbitrary `store_id` from user input, use low-privilege credentials, enforce timeout, replay and rate limiting.
6. QA a preview reply **without sending** and get separate explicit approval before any Zalo Send API, order mutation or revenue alert.

## Rollback
Close Draft PR #459 or revert new QA files. PostgreSQL containers are short-lived. Real Supabase, n8n Published workflows and Zalo credentials are untouched by this release.

Checkpoint: `TIEN404-V19.8.4-PROTECTED-CATALOG-READER-EPHEMERAL-CANDIDATE-NO-LIVE`.