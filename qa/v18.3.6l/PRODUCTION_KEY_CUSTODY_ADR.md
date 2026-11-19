# TIEN404 AI — V18.3.6L ADR-02: Production Signing-Key Custody

**Status:** DESIGN CANDIDATE / UNDEPLOYED. No real KMS, HSM, key creation or credential access.  
**Date:** 2026-11-19 JST.

## Separate the cryptographic trust domains

| Trust domain | Keys / current situation | Proposed custody | Forbidden |
|---|---|---|---|
| Supabase Auth access-token signature | Managed by Supabase Auth; signing key mode may be legacy HMAC or current signing keys | Application pins exact Supabase issuer/audience/allowed algorithms, validates trusted JWKS with controlled caching/rotation. **Verify only**; never request the Auth private signing key | Copy Auth secret, `service_role` or `SUPABASE_SECRET_KEY` into ChatGPT/n8n/client repo |
| TIEN404 Ed25519 short-lived private authority | G–K CI-generated ephemeral keys only | Dedicated private issuer service, ideally nonexportable Ed25519 key in a **verified compatible** managed KMS/HSM; separate role from gateway; issuance audit with purpose, Store and non-PII hash | Reuse Supabase Auth signing key, deploy ephemeral CI keys or permit arbitrary `alg` |
| TIEN404 protected catalog RPC authentication | K QA uses an **explicitly public synthetic HMAC key** inside disposable PostgreSQL | **Two candidate designs** below. Select only after privileged SQL reviewer, supported crypto and key custody audit | Copy `repeat('K',64)` QA fixture to production, expose SQL shared secret, generic service-role SQL proxy |
| Reviewer evidence attestation | Synthetic ephemeral key in H | Independently owned reviewer signing key, separate from deployer/issuer/gateway | Self-sign approval and call it independent human audit |

## RPC verification options

### R1 — Preferred to research: asymmetric verification with PUBLIC key only at the DB boundary

A dedicated private issuer signs a short-lived transaction-scoped proof, and the database verifies the signature via an independently reviewed, supported Ed25519 verifier, with pinned `kid`, `typ`, `iss`, `aud`, operation, Store/subject/session fingerprint, resource, nonce and expiry. The DB holds **public verification material only**. This avoids sharing a long-lived symmetric signing secret with PostgreSQL.

**BLOCKED:** Confirm a supported, maintained, restricted cryptographic verifier for Supabase-hosted PostgreSQL 17 and its algorithm, privileges, upgrade and supply-chain safety. PostgreSQL `pgcrypto` HMAC is **not** native proof that Ed25519 verification is available. Do not install extensions or change PostgreSQL settings without approval.

### R2 — Alternative, higher-risk: protected DB-bound HMAC

If asymmetric verification is unavailable or too expensive, use independent per-environment HMAC secrets under tightly restricted DB-side custody, with NO PUBLIC select or dynamic SQL exposure. The protected backend signs exact operation claims after real Auth/session verification; only the dedicated private RPC verifies. DB verification necessarily accesses the shared secret. Therefore this **cannot** simultaneously be a nonexportable HSM secret unavailable to PostgreSQL: reconcile the trust model explicitly.

**BLOCKED:** Controlled provisioning, audit of function owners/default EXECUTE grants, secret rotation on both sides, dual control, backup/export exposure, logging, breach recovery and no generic `service_role` table access remain unproved. K only tests a static fixture.

## Key lifecycle and separation

`CANDIDATE → ACTIVE → VERIFY_ONLY → REVOKED` is a conceptual key lifecycle; only an authorized independent release gate may transition states. No test fixture may transition to RELEASED.

Required: environment and Tenant scope isolation as appropriate, pinned issuer/audience/kid/algorithm, independent issuer operator and reviewer, policy-enforced key use, multi-party production approval, no plaintext key export, hardware/key-service compatibility verification, rate limiting, redacted per-sign audit, short TTL, nonce replay protection, rotation rehearsal, emergency revocation (remove kid from trust), and restore test. Key compromise invalidates trust; do NOT silently reactivate a compromised key for rollback.

Clock skew, JWT issuer JWKS caching/rotation, and Supabase Auth legacy-vs-new-key mode must be inspected with the **current project configuration**, without accessing or displaying private keys. See:
- https://supabase.com/docs/guides/auth/signing-keys
- https://supabase.com/docs/guides/auth/jwts
- https://supabase.com/docs/guides/security/production-checklist
- https://www.rfc-editor.org/rfc/rfc8725

## Security decision

Current production signing keys: `NOT_CREATED`. K's HMAC secret: `SYNTHETIC_PUBLIC_FIXTURE`. Live signer deployment: `BLOCKED`. Custody review: `PROPOSED`, not VERIFIED. No change to production key lifecycle or billing.
