# TIEN404 V19.0-B7-S3 — Real Owner A/B Store Admission Procedure

**Date:** 2026-11-19 JST  
**Classification:** PROPOSED — NOT EXECUTED. No Owner A/B real JWT test, no customer/order read, no production release.

## 1. Gates before any real Owner A/B session UAT

1. Complete and approve V18.3.6D Store Authority PR #417 (canonical Store + Store Memberships, Store IDs, composite keys, restrictive RLS); current real staging is still tenant-only and does not satisfy these prerequisites.
2. Approve which two independent QA owner accounts may be used and the exact target Tenant A/Stores A and B; require true self-Store access and wrong-Store denial both ways. **Never put owner JWTs, access tokens, email, phone or user IDs into PRs, ChatGPT, CI logs or evidence reports.**
3. Preserve DB schema/version and read-only test snapshots. Ensure all test records are synthetic and no real customer's private Orders/Inventory is inspected.
4. Obtain scoped human approval for any database migration, test fixture write, role change, Access policy, credential rotation or production webhook. This S3 PR grants none.
5. Use a trusted server-side JWT verifier (signature from Supabase JWKS, issuer, audience, expiry and session validity); revalidate user via Supabase Auth \`getUser()\` when appropriate. Never trust raw \`request.jwt.claim.sub\` supplied by clients as a custom SQL setting.
6. Do not elevate with \`service_role\`, \`postgres\` or a \`SECURITY DEFINER\` RPC to fake proof of ordinary authenticated RLS behavior.

## 2. Required evidence matrix (10 cases)

| Test | Expected result |
|---|---|
| OWNER_A_SELF_STORE_POSITIVE | Authenticated Owner A may read only approved synthetic QA Store A data |
| OWNER_A_TO_B_NEGATIVE | Owner A cannot access Store B data in the same Tenant |
| OWNER_B_SELF_STORE_POSITIVE | Authenticated Owner B may read only approved Store B data |
| OWNER_B_TO_A_NEGATIVE | Owner B cannot access Store A data |
| SAME_TENANT_TWO_STORES | Store identifiers remain distinct although Tenant matches |
| REVOKED_OWNER_DENIED | Removed Store membership denies all scoped reads |
| EXPIRED_OWNER_DENIED | Expired membership/session denies scoped reads |
| STAFF_PRICING_WRITE_DENIED | Staff cannot edit price through authorized Store command |
| LEGACY_NULL_STORE_DENIED | Unmapped legacy rows are quarantined |
| PROVIDER_INSTALLATION_MISMATCH_DENIED | Bot installation bound to Store A cannot access Store B |

No PASS can be recorded from a synthetic SQL \`SET ROLE\` or a forged \`request.jwt.claim.sub\`. Every row requires independently reviewed test context and precise expected/observed response, with tokens omitted.

## 3. Sanitized evidence receipt schema (not an auth token)

For each case, record \`case_id\`, \`expected\`, \`actual\`, \`test_timestamp_utc\`, \`environment\`, \`approved_test_lease_ref\`, \`frontend/backend commit\`, \`policy version\`, \`reviewer_ref\`, \`redacted_trace_ref\`, \`authorization_method\` and \`result\`. Do not embed session secrets, raw JWTs, owner identities, customer PII or full response bodies.

The receipt is evidence for human review, NOT a cryptographic verifier. S3's assessment function always returns \`BLOCKED\` even if all receipt flags say PASS. Only an independently signed security acceptance and direct real authenticated tests can advance a release gate.

## 4. Current real Edge Function

Supabase has one listed active function, \`tien404-r1-owner-preflight\` v2, with \`verify_jwt=true\`. Source inspection shows Auth \`getUser()\` and reads of \`tenants\` and \`tenant_memberships\`; no Store membership validation or Store ID contract. This function may be reused as a trusted *Tenant* preflight reference after review, but never as standalone proof of Store A/B authority.

## 5. What S3 actually verified

- Real Supabase public six Commerce tables lack \`store_id\`; their SELECT RLS rules are Tenant-scoped PERMISSIVE, so the Store positive/negative tests cannot yet be run in the intended canonical contract.
- V1 \`public.save_merchant_product\` is \`SECURITY DEFINER\` owned by \`postgres\`, with explicit Tenant permissions, no Store scope. This does not by itself establish an unauthorized data-access vulnerability.
- B7-S2 disposable candidate \`b7s2.synthetic_auth_uid()\` reads a forgeable GUC as test-only actor. S3's adversarial test demonstrates a raw SQL client can spoof that synthetic claim and reach the optimistic-lock branch **without a JWT**; there were zero data changes. This is proof that copying the fixture to real Supabase would be unsafe, not proof of a flaw in Supabase's real \`auth.uid()\`.

## 6. Admission result

**REAL_AUTH_A_B: BLOCKED**, **CANONICAL_STORE_RLS: BLOCKED**, **LIVE_V2_RPC: NO-GO**, **LIVE_ZALO_WEBHOOK: NO-GO**, **PRODUCTION: NO-GO**.
