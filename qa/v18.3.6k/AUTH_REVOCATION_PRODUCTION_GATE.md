# V18.3.6K — External Auth Revocation and Signed RPC Admission Review

**Security admission status: BLOCKED / NO-GO.** This is a synthetic threat-model acceptance review, NOT independent human signoff.

## Safety properties actually tested

| Control | Verified location | What it does not prove |
|---|---|---|
| G Ed25519 signature and audience | Node offline | Real Supabase Auth or real key custody |
| H trusted session adapter contract | Synthetic callback | Actual GetUser/session_id data source |
| I token-to-nonce binding | Node offline | Hosted signed DB channel |
| J same-transaction read | Disposable PG17 | Real customer data RLS or Supabase tenancy |
| K fail-closed fresh Auth verdict | Node fixture | Live trusted Auth server, cryptographic remote attestation |
| K private HMAC RPC proof | pgcrypto disposable | Production secret access control and key rotation |
| K legacy EXECUTE grants revoked | PG17 disposable | Actual deployed RPC exposure |
| K Node→PG HMAC bridge | Synthetic fixture only | Full Ed25519→remote Auth→SQL integration |

## Critical remaining P0

**External revocation gap:** If Supabase Auth revokes a session immediately after a fresh remote check but before PG receives/commits the read, the standalone PostgreSQL transaction cannot coordinate with the external Auth service's state. At best, this design bounds the decision's freshness (test fixture uses 2–3 seconds); it does NOT prove immediate globally consistent revocation. K intentionally demonstrates an external sign-out event that does not update the local mirror and still allows a signed read. No production admission.

**Trust anchor gap:** The K private SQL function validates an HMAC of the full signed request, but HMAC keys are static fixture bytes in this QA repo. Production requires an independent, restricted signer backend that issues proof only after validating G Ed25519 and the real Supabase Auth authoritative session state. A compromised signer or leaked shared key can forge scope and impersonate approved requests.

**Privilege gap:** SECURITY DEFINER executes with a privileged owner and may bypass RLS. The candidate grants only its narrow function to a synthetic NOLOGIN role and removes obsolete I/J EXECUTE grants. A real deployment must inventory all callable functions/default grants, PostgREST exposed schemas, privilege inheritance and service-role bypass paths.

**Canonical Store gap:** Connected Supabase staging lacks stores/store_memberships and Store-aware restrictive RLS. Real same-Tenant Owner A/B cannot be admitted.

**Human review gap:** No second independent human security reviewer has attested code SHA, exact reviewed schema, signing-key custody or actual redacted Auth A/B evidence.

## Required proofs before real access

- Approved canonical Store schema migration with PITR/restore evidence and independently reviewed least-privilege roles.
- Trusted Auth source: fixed project issuer/JWKS/audience, `getUser()` with active session binding and an independently verified session-state lookup; never accept user_metadata as permission.
- Explicit revocation model with measured bounded lag or a reviewed fail-closed authoritative coordination mechanism. Test revoked-before, revoked-during, outage, timeout, provider lag, rollback and race.
- Cryptographically protected exact RPC proof, private rotated keys, short validity, replay protection, audit without tokens/PII, and no generic SQL/API exposure.
- Actual independent Owner A/B private UAT in SAME Tenant, Store A and B negative cross-access proof.
- Independent human security signoff; no production writer/send from this candidate.

References: https://supabase.com/docs/guides/auth/sessions ; https://supabase.com/docs/guides/auth/server-side/advanced-guide ; https://supabase.com/docs/guides/observability/advisors?lint=0029_authenticated_security_definer_function_executable.

**Final:** Local PG transaction + fresh external verdict is a useful mitigation, NOT a demonstration of global/instantaneous revocation guarantees. `PRODUCTION_AUTHORITY_ADMITTED=false`.
