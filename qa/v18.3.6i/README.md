# TIEN404 AI — V18.3.6I

**Protected Issuer–Nonce Binding Contract × Session Revocation Race QA × Production Authority Admission Review**

**Status:** `QA CANDIDATE / DISPOSABLE PostgreSQL 17 ONLY / NO LIVE AUTH / NO PRODUCTION ADMISSION`  
**Parent:** V18.3.6H Draft PR #435, HEAD `d3eb5684420b7deb611652c121b52b9f49e946f3`.  
**Date:** 2026-11-18 JST.

## Implemented

1. `protected-issuer-nonce-binding.mjs`: wraps V18.3.6G Ed25519 signed authority verifier in a **private server-owned** nonce callback. The callback is invoked only after signature, issuer/audience, scope, session and membership checks. It derives SHA256 of signed token and HMAC-scoped Tenant/Store/subject/session/revision digests; passes the values to a restricted atomic DB operation. Only the exact string `ACCEPTED` can allow an offline read-only receipt; no real data operation or provider send.
2. `test-protected-binding.mjs`: 24 synthetic tests including wrong Store, altered signature, wrong capability, stale session/member, DB outage, replay and two simultaneous redemption calls.
3. `01_PG17_ATOMIC_BINDING.sql`: isolated PostgreSQL 17.12 schema with synthetic session/membership state, private one-use ledger and locked two-stage database revalidation. Session row and membership row are locked with `SELECT ... FOR UPDATE` before nonce insert; the owner-only SECURITY DEFINER function has an EXECUTE grant only to a NOLOGIN test executor.
4. `02_PGTAP_BINDING.sql`: 42 PostgreSQL pgTAP assertions covering privileged grants, claim/Store binding, negative matching, revocation, membership revision change, no nonce burn on denial.
5. Dedicated GitHub Actions runs G 93 + H 47 tests + I 24 unit tests and 42 PG17 assertions. It then runs two-session concurrent races: session revocation first, membership revocation first, two simultaneous identical JTI admissions, admission-first/revocation-second ordering, and DB restart replay persistence.
6. `ISSUER_NONCE_BINDING_CONTRACT.md`, `SESSION_REVOCATION_RACE_TRUTH_TABLE.md`, `PRODUCTION_AUTHORITY_ADMISSION_REVIEW.md` and final QA checkpoint.

## Critical security boundary

The Node verifier and PostgreSQL RPC are **not connected to a hosted database in this PR**. They are separately tested implementations of an explicit private adapter contract. The SQL routine trusts its EXECUTE-only caller to pass authenticated claim digests **after** Ed25519 verification; if an attacker can call the SQL function or impersonate the privileged caller, digest parameters are forgeable and Store isolation is broken. No Supabase service-role key should be used as an exposed generic gateway.

The test session-state table is synthetic, **not `auth.sessions`** and not evidence of real Supabase sign-out or revocation. A real Auth session may be revoked externally while a local registry is stale. Production cannot claim strict cross-service linearizability without a signed, current and authoritative session check at the final operation boundary.

This candidate verifies nonce admission only. **A later Commerce read, order write, stock change or provider send in a separate transaction is NOT protected by the earlier row locks**. No such operation is implemented here.

## Scope and limits

- Read-only capabilities `CATALOG_READ` / `ORDER_READ` only.
- Ephemeral Ed25519 test key and mock Auth sessions only.
- No production signing key, hosted nonce connection, Supabase staging DDL/DML, real owner or customer records, token access, real installation, provider sends, notification/outbox or Commerce writes.
- No independent human reviewer has approved release.
- QA branch and Draft PR only. Do not merge as staging migration or production admission.

## Admission status

`OFFLINE_SIGNED_BINDING`: CANDIDATE until CI passes.  
`PG17_SESSION_MEMBERSHIP_REVOKE_RACE`: CANDIDATE until CI passes.  
`REAL_SUPABASE_AUTH_AB`: BLOCKED.  
`PRODUCTION_PRIVILEGED_GATEWAY`: BLOCKED.  
`INDEPENDENT_HUMAN_SECURITY_APPROVAL`: BLOCKED.  
`STAGING_DDL / PRODUCTION_WRITER / PROVIDER_SEND / RELEASE`: NO-GO.

Reference: [PostgreSQL 17 row locks](https://www.postgresql.org/docs/17/explicit-locking.html) and [Supabase Sessions](https://supabase.com/docs/guides/auth/sessions).
