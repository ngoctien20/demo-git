# V18.3.6H — Trusted Supabase Session Adapter Contract

## Trust flow

Protected browser/Auth session → **private session handle** → trusted server retrieves access token (never logs it) → verifies JWT signature using pinned Supabase project keys/algorithm and issuer/audience → independently checks user identity through Supabase Auth → verifies **active session ID** through trusted private session registry → resolves canonical Tenant+Store membership via private DB query → supplies G issuer the normalized verified principal.

The `trusted-session-adapter.mjs` module defines the callback contract but does not include a production Supabase client or expose an HTTP endpoint. CI uses fully synthetic `OFFLINE-NOT-JWT` fixtures.

## Required trusted callbacks

| Callback | Contract | Mandatory property |
|---|---|---|
| `resolveOpaqueSessionHandle(handle)` | Private server session store returns access token | Untrusted browser cannot create or overwrite handle |
| `verifyJwt(accessToken)` | Trusted Supabase JWT verifier | Cryptographic signature, fixed project issuer/audience, key validation |
| `fetchUser(accessToken)` | Server-side Supabase Auth user validation | User ID must exactly match JWT subject; disabled/deleted/anonymous denied |
| `lookupActiveSession({userId,sessionId})` | Trusted privileged session registry | Exact subject/session, active/not revoked, fresh check, no stale session cache |
| `readCanonicalStoreMembership({userId,tenantId,storeId})` | Protected canonical Store authority lookup | Exactly one active member under active Store/Tenant, valid expiry, revision and read-only capability |
| `clock()` | Server clock | Reject future/expired evidence |

### Session revocation

An unexpired signed JWT may remain cryptographically valid after session termination. `getClaims()` alone does not guarantee instantaneous revocation. Sensitive issuer use requires separately approved server-side session-state validation (such as a protected `auth.sessions` check), least-privilege grants and short TTL. The current repository DOES NOT contain such a privileged live implementation.

### Do not trust

Raw `user_metadata`, browser Store IDs, client-submitted `source: trusted...`, manually decoded JWT payloads, unsigned callbacks, n8n user text, provider sender ID alone, or service-role secrets passed into client code.

### Compatibility with G

V18.3.6G currently has a **synthetic-only Supabase issuer constant** pointing to an `.invalid` test domain. H unit tests intentionally use this constant solely for integration checks. **Before a real private issuer, replace hardcoded G test configuration with a pinned, independently reviewed per-environment project Auth issuer and audience** and rerun signed cross-issuer/cross-audience negatives. Do not reuse the mock issuer or key material in staging/production.

### Signer responsibility

The adapter returns current session and membership evidence, not an authorization. G issuer/verifier still independently validates its own audience, capability, session HMAC fingerprint, Store scope, membership revision, expiry and atomic nonce. Do not allow the caller to configure any trusted callback.
