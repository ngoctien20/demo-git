# TIEN404 AI — V18.3.6O

**Staging SECDEF Metadata-to-Review Manifest × Disposable GoTrue Auth UAT Plan × Gateway Cryptographic Proof Admissibility Matrix**

**Date:** 2026-11-19 JST  
**Parent:** V18.3.6N Draft PR #451, final HEAD 860d73ddc81c137b293a677f518784d96ec5f985, GitHub Actions #44507690875 SUCCESS (338/338).  
**Status:** METADATA AUDIT VERIFIED / OFFLINE PLAN & NEGATIVE QA CANDIDATE / PRODUCTION NO-GO.

## Files

- **SECDEF_METADATA_MANIFEST.json** — exactly four live staging public SECURITY DEFINER functions: safe metadata identity signatures, SHA256 of *function identity*, owners and effective grants. **Not** function body fingerprints or authorized source inspection.
- **SECDEF_METADATA_REVIEW_MANIFEST.md** — redacted human review request/scope; no actual source, secrets or code inspected. Current effective grants: 1 anon, 2 authenticated, 1 service_role, potentially overlapping; 4 functions owner postgres, search_path configured.
- **READ_ONLY_SECDEF_METADATA.sql** — SELECT-only reproducibility; no auth sessions rows/function source/grant writes. Query itself was run on staging to verify the snapshot.
- **secdef-manifest-review.mjs** — fail-closed schema/identity/ACL drift test. Even all-green yields READY_FOR_PRIVATE_REVIEW_SCOPE_REQUEST, never actual body approval.
- **DISPOSABLE_GOTRUE_AUTH_UAT_PLAN.md** — future GoTrue local stack test plan, version/source pinning, synthetic users, no external egress, 20 local/global/others/logout/refresh/expiry/lock/restart negative scenarios and teardown. **No local stack started or external Auth API run.**
- **gotrue-disposable-plan.mjs** — plan-gate only; even full synthetic evidence cannot authorize resource creation.
- **GATEWAY_CRYPTO_ADMISSIBILITY_MATRIX.md** — 3 conditional (DB public-key proof, DB HMAC, restricted DB caller identity) vs 4 rejected options, 12 hard gates. **No option approved for production.**
- **rpc-proof-admissibility.mjs** — immutable, rejection-first option gate.
- **test-o-security-contracts.mjs** — 79 negative regression tests: metadata drift, local GoTrue isolation and RPC cryptographic boundaries.
- **QA_CHECKPOINT_V18_3_6O.md** — final acceptance and rollback after CI.
- Dedicated GitHub Actions workflow — inherited 338 offline Node tests plus O 79 = **417** planned assertions, no secrets or production connection.

## Connected staging evidence (read-only, 2026-11-19 JST)

- Supabase PG 17.11; public functions 8, SECURITY DEFINER 4 (all owned by postgres).
- Exact names/signatures/hashes in manifest; search_path is configured for all four, value **not** read.
- auth.sessions RLS on. Effective direct SELECT for anon, authenticated and service_role each **false**. Zero session rows accessed.
- Canonical public stores/store_memberships 0; store_id on six Commerce tables 0. No new Store migration.
- SECDEF WARN from Supabase Advisor remain review items, **not confirmed exploits**.
- No Supabase DDL/DML, Auth login/signout, function body, credentials, KMS key, n8n changes, provider send or production operations.

## Governance

This draft PR does not grant permission to see function source code, change existing SQL grants, run GoTrue UAT or create resources. Each requires separate explicit authorization, approved restricted environment, independent reviewer, proof/rollback and operator logs.

**Rollback:** close unmerged Draft PR; no linked environment modifications.  
**Production release:** BLOCKED / NO-GO.
