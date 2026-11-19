# TIEN404 V19.0-B7-S4 — Trusted Owner A/B Auth Evidence Procedure

**Date:** 2026-11-19 JST
**Status:** READ-ONLY AUTH CONTRACT VERIFIED, **REAL SAME-TENANT OWNER A/B STORE UAT NOT ADMITTED**.

## 1. What is actually verified

Supabase project tien404-staging has one active listed Edge Function \`tien404-r1-owner-preflight\` v2 with \`verify_jwt=true\`. The inspected source calls Supabase Auth \`getUser()\` and reads \`public.tenants\` plus \`public.tenant_memberships\`. It has no \`store_id\` validation or \`public.store_memberships\` lookup. This proves **existing Tenant-level verification logic is present**, not that a real Owner A/B Store boundary has passed.

The current live schema has no \`public.stores\` or \`public.store_memberships\`; all six Commerce tables lack \`store_id\`. Read-only inspection found RLS and FORCE RLS enabled on all six but zero restrictive Store policies.

**Important:** The R1 "Shop A/B" QA mapping described in canonical PR #417 associates synthetic scopes with **two distinct Auth Tenants**; it is NOT the required scenario of two Stores in the **same** Tenant. Do not present previous R1 A/B evidence as same-Tenant cross-Store proof.

## 2. Two separate admission stages

### Stage AUTH-A — independent identity preflight, BEFORE Store migration

- Operator and owner approve the two QA account roles, precise staging Tenant and session test window, with no raw email/user ID/JWT printed to GitHub, AI, chat messages or logs.
- Obtain two independently authenticated owner sessions in an operator-controlled trusted test browser; verify signed bearer JWT via Supabase Auth's verified SDK/server path, then revalidate user with \`getUser()\`. Never trust identity from request body, local storage claims, \`user_metadata\` or a manually set \`request.jwt.claim.sub\` database setting.
- Confirm the two authenticated subjects are **distinct**, both have eligible **same-Tenant** membership (not two different Tenants), and each is an explicitly approved synthetic QA actor. Record only sanitized test case outcomes and approved evidence references.
- Session claims and membership changes are **not performed by S4**. If these accounts do not exist, creating them or changing membership is a separate scoped write requiring user approval.

### Stage AUTH-B — real Store-scoped admission, AFTER approved additive Store schema

- Follow PR #417 as canonical authority for \`stores\`, \`store_memberships\`, six Commerce \`store_id\` columns, private provider registry, composite foreign keys and restrictive Store RLS.
- Provision two **distinct** Stores A and B under the **same** QA Tenant and grant **explicit** Store Owner memberships via audited, separately approved test operations.
- Run true signed-session positive and negative tests: Owner A sees only A; Owner B sees only B, including wrong-Store denial in both directions; Tenant Owner with no Store membership sees no Commerce rows; revoked/expired actor denies; Staff cannot change price; NULL legacy rows invisible; install A cannot request Store B.
- Both API responses and readback must be checked; an UPDATE returning zero rows is not a successful authorization test. Test with synthetic QA products/orders only, never real customer data.
- No \`service_role\`/postgres bypass to simulate a normal authenticated user's RLS. A successful \`SECURITY DEFINER\` call is not evidence that ordinary user RLS is correct.

## 3. Ten-case matrix (from B7-S3, not yet run live)

| Case | Expected truth |
|---|---|
| OWNER_A_SELF_STORE_POSITIVE | PASS only after signed QA Owner A reads allowed Store A fixture |
| OWNER_A_TO_B_NEGATIVE | DENY Store B for Owner A |
| OWNER_B_SELF_STORE_POSITIVE | PASS only after signed QA Owner B reads allowed Store B fixture |
| OWNER_B_TO_A_NEGATIVE | DENY Store A for Owner B |
| SAME_TENANT_TWO_STORES | Verify same Tenant, different Stores, distinct owners |
| REVOKED_OWNER_DENIED | Revoked Store membership denied |
| EXPIRED_OWNER_DENIED | Expired Store membership/session denied |
| STAFF_PRICING_WRITE_DENIED | Staff cannot modify price/stock through a Store command |
| LEGACY_NULL_STORE_DENIED | No unverified Store assignment from legacy row |
| PROVIDER_INSTALLATION_MISMATCH_DENIED | Installation Store A cannot act on Store B |

## 4. Sanitized acceptance record

Each test receipt should contain test ID, time, environment, exact code/policy version, expected/observed status, independent reviewer reference, signed approval ticket reference and redact-only trace identifier. Never store bearer/refresh JWTs, cookies, raw Auth user IDs, phone numbers, customer data, channel tokens, owner emails, Bot secrets or raw SQL response payloads.

S4's JavaScript readiness checker **always** sets \`realOwnerABVerified=false\` and \`stagingDDLAllowed=false\` even with forged PASS flags. It is a planning/diagnostic tool and cannot replace cryptographic verification or owner authorization.

## 5. Present decision

\`AUTH_A_REAL_SIGNED_OWNER_PAIR: NOT TESTED\`  
\`AUTH_B_REAL_STORE_A_B_RLS: BLOCKED_SCHEMA_NOT_PRESENT\`  
\`STORE_ADMISSION: NO-GO\`  
\`LIVE_V2_RPC: NO-GO\`  
\`REAL_ZALO_ORDER_WRITE: NO-GO\`

See the \`REAL_OWNER_AB_ADMISSION_PROCEDURE.md\` in B7-S3 for the detailed negative test matrix.
