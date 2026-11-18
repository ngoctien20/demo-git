# TIEN404 AI — V18.3.6J

**Transaction-Bound Read-Only Authority × Privileged RPC Isolation QA × External Auth Revocation Consistency Review**

**Classification:** DISPOSABLE PG17 QA CANDIDATE, NOT A DEPLOYED AUTHORITY GATEWAY.
**Base:** Draft PR #438 V18.3.6I, commit `d8536cac0426752436b33ce0959593b7d603ff07`.
**Date:** 2026-11-18 JST.

## Deliverables
- `01_PG17_TRANSACTION_READ.sql`: additive fixture-only PostgreSQL 17 implementation of a private SECURITY DEFINER read-only catalog RPC with exact Tenant/Store/resource lookup, session freshness and same-transaction session+membership locking plus nonce consumption. It reuses I's atomic nonce function.
- `02_PGTAP_READ_RPC.sql`: 50 real PostgreSQL pgTAP cases for grant isolation, read-only catalogue response, Store A/B denial, invalid capability, expiry, revocation, replay, membership revision and **external Auth signal lag detection**.
- Dedicated GitHub Actions workflow runs 164 predecessor offline tests, builds postgres:17.12 + pgTAP in a container with `--network none`, verifies J's 50 cases and four actual two-session transaction races: session revoked first, membership revoked first, read-first transaction, and two reads using the same nonce.
- `EXTERNAL_AUTH_REVOCATION_REVIEW.md`: critical P0 consistency gap, current contract and future requirements.
- `PRIVILEGED_RPC_ISOLATION_REVIEW.md`: exact role/function/SQL permissions, argument-forgery threat and read transaction boundaries.
- `QA_CHECKPOINT_V18_3_6J.md`: checkpoint and CI evidence.

## Security boundaries
- All data are synthetic; no actual Supabase `auth.sessions`, signed Owner A/B session, customer record, Commerce data or real provider installation is accessed.
- `SECURITY DEFINER` procedure is created in private `qa_i_private` schema, owned by a NOLOGIN synthetic owner. NOLOGIN gateway role receives EXECUTE on one read-only function, **no table SELECT/UPDATE/INSERT/DELETE**. Untrusted actors have no private schema USAGE/EXECUTE.
- The RPC assumes its gateway caller has already validated signed Ed25519 authority. It DOES NOT validate Ed25519 and **hash parameters are forgeable by a compromised executor**. This remains a P0 production blocker.
- A local session timestamp no older than 60 seconds is **not** proof of immediate Supabase Auth revocation consistency. The test intentionally proves an external Auth sign-out event that has not propagated can still leave local authorizations valid. This is expected to **BLOCK production**.
- This read-only RPC returns only synthetic catalogue code and price; no Orders/PII/stock mutation/provider message.
- This implementation does **not** authorize post-transaction data access or any production write.
- All changes isolated to `qa/v18.3.6j` and dedicated CI workflow. Draft PR, no merge/deploy/DB migration.

## Production admission decision
`PG17_TRANSACTIONAL_READ_CANDIDATE`: pending CI.
`REAL_SUPABASE_SESSION_REVOCATION_CONSISTENCY`: BLOCKED.
`CRYPTO_VERIFIED_LIVE_RPC_CALLER`: BLOCKED.
`CANONICAL_STORE_SCHEMA_STAGING`: BLOCKED.
`INDEPENDENT_HUMAN_SECURITY_REVIEW`: BLOCKED.
`PRODUCTION_GATEWAY/ORDER_WRITE/PROVIDER_SEND/RELEASE`: NO-GO.
