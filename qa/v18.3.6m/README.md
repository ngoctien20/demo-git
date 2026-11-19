# TIEN404 AI — V18.3.6M

**Disposable Auth Session DELETE Lock Rehearsal × Privileged SQL Grant Inventory × Crypto Verifier Compatibility Assessment**

**Classification:** `OFFLINE / DISPOSABLE PG17 / SECURITY CANDIDATE`  
**Date:** 2026-11-19 JST  
**Parent:** V18.3.6L Draft PR #444, HEAD `d7e8080ee699b38d9952f96358fbc0a57e3b28a0`, GitHub Actions #44501805804 SUCCESS (245/245).

## Deliverables

1. `01_DISPOSABLE_AUTH_DELETE_LOCK.sql`: creates **synthetic** `qa_m_auth.sessions` (not Supabase-owned `auth.sessions`), Store/tenant membership, scoped catalog and unique nonce ledger in a disposable PostgreSQL 17.12 database. A narrow read-only SECDEF function takes row locks in order **session → membership → catalog → nonce**. A session DELETE uses a conflicting PostgreSQL row lock and must serialize with the read.
2. `02_DISPOSABLE_PGTAP_AUTH_RLS.sql`: 53 PostgreSQL 17 assertions for private EXECUTE-only roles, table grants, session presence/deletion/expiry, same-Tenant A/B isolation, cross-Tenant rejection, membership revision, no nonce burn on rejection and pgcrypto HMAC compatibility.
3. Independent CI connections test DELETE-first, READ-first, same-JTI concurrency and bounded lock-timeout fail-closed behavior.
4. `crypto-privilege-compatibility.mjs` and `test-crypto-grant-compatibility.mjs`: 29 offline checks for ephemeral Node Ed25519 verification, wrong signatures and KMS design limitations, HMAC vector, public SECDEF-grant risk interpretation and **non-approval** of changes.
5. `LIVE_STAGING_PRIVILEGE_METADATA_AUDIT.md`, `AUTH_DELETE_LOCK_RACE_MATRIX.md`, `CRYPTO_VERIFIER_COMPATIBILITY.md` and checkpoint.

## Safety limitations

- **No real `auth.sessions` row values** read or used, no Supabase Auth API, no user JWT or actual owner/store IDs. The test's fake auth schema is `qa_m_auth`, not `auth`.
- Supabase staging receives only metadata-count and extension queries, no DDL/DML or grant mutation.
- The disposable SECDEF function intentionally **does not validate Ed25519 signatures**. A compromised EXECUTE-only gateway can forge input IDs. It is solely a PostgreSQL locking and privilege **rehearsal**, not a production authorization system.
- No PostgreSQL extension installation in Supabase. pgcrypto is installed there; pgsodium and pgjwt were only observed as available, not installed. Do not assume a Postgres SQL Ed25519 verifier is supported.
- Same-Postgres DELETE ordering can be proven for synthetic local SQL transactions only; actual Supabase Auth sign-out, session policies, role grants, background cleanup and production RLS remain **BLOCKED**.
- Real Canonical Store schema, real same-Tenant Owner A/B, owner/provider grants, human reviewer and production key custody remain unverified.

## Admission
`DISPOSABLE_PG17_LOCK_QA`: TESTED only after CI.  
`PUBLIC_SECURITY_DEFINER_GRANT_AUDIT`: OPEN FOR HUMAN REVIEW.  
`PRODUCTION_SQL_CRYPTO_VERIFIER`: BLOCKED.  
`REAL_AUTH_AB / STAGING_MIGRATION / WRITERS / PROVIDER_SEND / RELEASE`: NO-GO.

Rollback: close unmerged Draft PR; disposable container destroyed by CI; no linked-system change to reverse.
