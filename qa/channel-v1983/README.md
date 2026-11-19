# TIEN404 V19.8.3 — Disposable PostgreSQL Store RLS Acceptance

**Status: TESTED in ephemeral PostgreSQL 17; REAL SUPABASE JWT still BLOCKED.**

## CI evidence
- GitHub Actions run #44517558016: SUCCESS.
- Source: qa/channel-v1983/ephemeral-postgres-schema.sql
- Assertions: qa/channel-v1983/ephemeral-postgres-acceptance.sql
- Runner: .github/workflows/tien404-v1983-ephemeral-postgres-rls.yml
- Job creates and destroys local PostgreSQL 17 container; no Supabase service, keys or database URL.

## What was genuinely exercised
- One fictional tenant contains Store A and Store B with independent memberships.
- Mock authenticated PostgreSQL role sees exactly its Store's products, orders, order_items, conversations and messages.
- Same SKU F01 at both Stores has different synthetic price and stock.
- Tenant-wide member without Store grant, revoked Store membership and unknown/missing mock identity cannot read protected rows.
- Allowed Store A product insert passes; cross-Store insert and reassignment are blocked by PostgreSQL RLS.
- Composite Store+Tenant foreign keys prevent cross-Store order/product and message/conversation linkage.
- Anonymous role has no SELECT privilege.
- A temporary, deliberately overly broad tenant-only permissive SELECT policy makes Store B visible to Owner A. The test then drops this policy and proves Store B becomes hidden again. This negative control demonstrates why additive permissive RLS migration is unsafe.

## Explicit limitations
**Auth is mocked.** auth.uid() resolves a session variable manually set by the SQL test. There is NO cryptographic verification of a Supabase JWT, no real merchant Owner A/B session, no PostgREST test, and no real Bot Installation→Store attestation.
The SQL files are an isolated fixture, NOT a database migration to apply to Supabase.
Success proves PostgreSQL row-policy and FK behavior for this fixture only. Production protection, current live Supabase RLS and authorized Commerce reader remain unverified.

## Next admission gates
1. Review the non-executable migration proposal in qa/channel-v1982/STORE_SCOPE_MIGRATION_PROPOSAL_DO_NOT_RUN.md.
2. Inventory and freeze legacy writers; verify every row's Store provenance before backfill.
3. Obtain separate approval and real Owner A/B authenticated sessions for a disposable hosted UAT environment.
4. Exercise real signed Supabase sessions and the scoped read adapter without service-role bypass.
5. Link real Zalo Bot to a canonical Store via server-only identity and approved owner consent.
6. Keep provider Send, Order Write and Revenue Notifications disabled until separate approval.

## Rollback and safety
Close Draft PR #459 or revert this QA directory. No data was changed on Supabase staging, n8n, Zalo Bot or other production systems. GitHub container is destroyed at end of CI.

Checkpoint: V19.8.3_EPHEMERAL_POSTGRES_17_RLS_PASS_REAL_OWNER_JWT_PENDING.