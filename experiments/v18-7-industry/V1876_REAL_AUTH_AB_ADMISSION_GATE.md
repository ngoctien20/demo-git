# TIEN404 V18.7.6 — Canonical Store Authority and Real Auth A/B Admission Gate
Date: 2026-11-19 JST | CANDIDATE QA ONLY | REAL AUTH: BLOCKED | PRODUCTION NO-GO

## Verified baseline (read-only)
- Existing Industry Profiles PR #422 head 69602816e73f10a3764c3db59250feffb9c438d0: 78/78 synthetic offline tests; Draft, no live integration.
- Canonical Store Authority PR #420: disposable PG17 restrictive RLS model. It has NOT been applied to live Supabase staging.
- Supabase staging public.tenant_memberships is tenant-scoped; public.products/orders have tenant_id but no verified store_id, and no canonical public.stores/store_memberships in the inspected schemas.
- Messenger workflow Z7FdV7uDvApfbURQ active Published; Commerce AI Core iyfGUiEsZlNTBWOR active with differing draft and published versions. Neither modified.

## New isolated implementation
- src/qa-signed-admission.cjs tests a signed receipt CONTRACT with only a disposable synthetic HMAC key injected at test runtime.
- Claims: explicit synthetic-only mode, test issuer/audience, test principal, tenant/store/installation/channel, version pins, read-only scopes, bounded iat/exp, receipt_id and nonce.
- Verification: SHA256 HMAC timing-safe compare, strict claim shape, expiry <=120s, local replay check, membership, provider installation, version/permission allowlist.
- Same-tenant Store A/C belongs to Tenant A but uses different memberships and provider mappings. Tenant B/Store B is isolated.
- Output is immutable and explicitly canReadRealData=false, realAuthVerified=false, storeRlsVerified=false, canWrite=false, canSend=false, productionReady=false.
- No external HTTP, n8n, Meta, Zalo, Supabase, real JWT, data mutations, messages or user tokens. This module MUST NOT be reused as actual authentication.

## Real Auth A/B required admission steps (not yet performed)
1. Owner approval of a protected, private staging UAT. Avoid posting real token/session IDs or account personal data.
2. Security review and owner-approved migration of canonical Store Authority from PR #420 with backup, compatibility and rollback evidence; do not create a parallel Store table.
3. Verify real Supabase Auth Owner A/B sessions; verify active Store memberships not only tenant_memberships; include two stores under one tenant and a separate tenant.
4. Independently verify Store-level Postgres RLS with actual JWT-constrained contexts. Test A cannot read C at same tenant, and B cannot read A.
5. Verify Page/OA/Widget installation by provider-authentic webhook or authenticated widget, then server-issued short-lived signed authority. Do not accept unsigned model/client store claims.
6. Use durable transactional replay/idempotency in hosted environment; the QA Set implementation is not suitable for multiple Workers/n8n instances.
7. Load approved industry/profile/knowledge/config versions, gated by subscription and tool policies; only then use a dedicated STORE-AWARE read-only catalog.
8. Before allowing any real data access, record independent security QA; no provider send or order write without separate explicit approval.

## Classification
- VERIFIED: Supabase schema blocker and existing candidate PRs.
- IMPLEMENTED: signed synthetic receipt checker with negative tests.
- TESTED: CI results only after the exact final PR HEAD finishes successfully.
- PROPOSED: real JWT verifier, durable receipt, canonical Store/RLS, private read-only Commerce adapter.
- BLOCKED: real Auth A/B admission, real customer data, live providers, release.

Rollback: close Draft PR, no database or workflow change.
