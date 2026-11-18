# V18.3.6G — Real Auth A/B Private Admission Preflight

**Verdict on verified current staging:** BLOCKED. This document is a private UAT entry checklist, not an authorization to access actual Orders or inspect Auth sessions.

## Verified baseline, read-only

- Supabase staging PostgreSQL 17.11.
- Canonical `public.stores` + `public.store_memberships`: **0/2 tables**.
- `store_id` across six Commerce tables: **0/6 columns**.
- Public restrictive Store policies: **0**, expected at least six with proven safe command coverage.
- Active Tenant memberships: **3** (tenant-level only).
- Public Commerce: **2 Products + 2 Orders** (aggregate-only inspection, no row PII).
- Previous R1 private QA Store/Bot map: 2 Store scopes mapped to 2 distinct Auth Tenants, not two Stores in one Tenant.
- Real Owner A and Owner B independently verified session proof: **NOT AVAILABLE** in this QA.
- Independent human reviewer approval: **NOT AVAILABLE**.
- Signed issuer real key/adapter and durable nonce storage: **NOT DEPLOYED**.

**Result:** `assessPrivateAuthABReadiness` must return `BLOCKED`. It NEVER returns `ADMITTED` or `REAL_AUTH_VERIFIED`, even when given a synthetically complete metadata package.

## Admission prerequisites (ALL mandatory)

1. Owner-approved staging migration of canonical `stores` / `store_memberships`, Store-scoped Commerce columns, restrictive Store policies and composite FKs. Back up and verify PITR/restore first; independently review migration.
2. Two distinct real Store Owners under **the same Tenant**, each with independently consented, active, unrevoked Store membership and separate Auth session. Do not recycle one owner for two browser tabs and call it independent.
3. Owner permissions must be verified **privately server-side** using Supabase Auth signature, issuer, audience, JWT expiry, subject, live session state and canonical DB Store membership. Use actual authorized client session in its browser; never paste JWT, refresh token, cookies, raw user IDs, session IDs or customer PII into chat, GitHub issues, n8n or screenshots.
4. Owner A must read only safe synthetic/non-PII Catalog fixture A; Owner B only Catalog fixture B. Perform A→B and B→A negative tests for **same Tenant**; cross-Tenant, no identity, expired, revoked and forged Store/installation paths must be denied.
5. Run private signed authority issuer and verifier behind trusted backend. Confirm actual crypto keys, kid/audience, short TTL, nonce durability, session fingerprint and membership revocation acceptance; no exposed service-role API.
6. Independent security reviewer signs scope, code SHA, specific completed negative cases, evidence hash, timestamp/expiry and rollback path. The reviewer must be different from implementer/operator.
7. Keep only redacted hashes and case-level PASS/DENY statuses in the QA ledger. Do not store direct customer details or Auth identifiers in PR.
8. No Orders/Stock/Customer reads or writes, no provider sends, no staging DDL, no credential changes, no production writer unless **separately approved** after this read-only gate.

## Redacted UAT evidence structure (private only)

- Case ID and reviewed code SHA.
- Owner A/B opaque distinct principal hashes (keyed/pseudonymized), Store A/B opaque Store hashes, same Tenant scope hash.
- Privately signed owner consent proof hash, membership evidence hash, verified session evidence hash.
- Session validator version, authority issuer version, key kid **public identifier** (not key material).
- Binary A→A/B→B and A→B/B→A decisions; exact negative expected output.
- Independent reviewer identity/approval reference stored privately, approval expiry and revocation instructions.
- Any ambiguity or missing proof → `BLOCKED`, no live access.

## Real preflight outcome versus offline tests

- Offline signed-receipt tests with ephemeral CI keys demonstrate cryptographic algorithm and logic only.
- A fully populated synthetic readiness object can return `EVIDENCE_PACKAGE_READY_FOR_PRIVATE_REVIEW`, **never approved/verified/admitted**.
- Real Auth A/B proof cannot be inferred from the PG17 mock claim, Owner pairing status, two distinct browsers, Cloudflare Access check alone, or two Stores in different Tenants.
- This phase does **not** require the user to send credentials/tokens or create real new accounts; it inventories prerequisites.

## Current blockers

`CANONICAL_SCHEMA_MISSING`, `REAL_INDEPENDENT_OWNER_AB_UNVERIFIED`, `PROTECTED_ISSUER_NOT_DEPLOYED`, `DURABLE_NONCE_NOT_DEPLOYED`, `HUMAN_SECURITY_APPROVAL_MISSING`, `STAGING_BACKUP_MIGRATION_APPROVAL_MISSING`.

## Final gates

`G_SIGNED_AUTHORITY_OFFLINE`: may pass CI.  
`G_REAL_AUTH_AB`: BLOCKED.  
`G_PRODUCTION_SERVICE_ROLE`: BLOCKED.  
`G_STAGING_DDL / LEGACY_BACKFILL / REAL_PROVIDER_SEND / RELEASE`: NO-GO.
