# V18.3.6G — Private Signed Authority Issuer Contract

**Version:** `V18.3.6G-1`. **Status:** OFFLINE CANDIDATE; no live issuer, credential, OAuth or Auth session.

## Distinct identities and trust boundaries

1. Supabase access JWT is a separate token with its own issuer and audience. Validate by a **trusted server-side Supabase Auth adapter**; do not hand the raw Auth access token to a generic n8n Code node.
2. The private authority issuer is distinct from Supabase Auth. It receives **only** a server-attested session result and canonical Store membership from a protected internal backend. Caller input may request Store/capability but cannot establish membership.
3. The short-lived authority JWT is signed with Ed25519 (JOSE `EdDSA`), dedicated `typ=tien404-private-authority+jwt`, pinned `kid`, `iss=tien404-private-authority-staging` and `aud=tien404-private-commerce-readonly`.
4. Redemption verifies the Ed25519 signature and ALL claims before asking the trusted adapter to check current session, membership and Store status again. The nonce is consumed **atomically** in a shared durable store.
5. No production DB writer, Messenger/Zalo send or Commerce Order Commit is implemented by this module.

## Exact signed claims

| Claim | Contract |
|---|---|
| `v` | `V18.3.6G-1` |
| `iss` / `aud` | Authority-specific issuer/audience; not interchangeable with Supabase JWT |
| `sub` / `actor_type` | Verified Supabase user from trusted adapter; actor_type currently `human` only |
| `tenant_id` / `store_id` | Must equal canonical membership and request scope |
| `session_binding` | HMAC-SHA256 over opaque session ID with a server-only binding secret (never raw session ID) |
| `membership_revision` | Checked against current canonical Store membership at redemption |
| `capability` | Only `CATALOG_READ` or `ORDER_READ` in this read-only candidate |
| `jti` | UUIDv4 random one-use nonce |
| `iat` / `nbf` / `exp` | Signed timestamp; maximum TTL 120 seconds and no later than validated source-session expiry |

Mandatory JWS protected header: **exactly** `alg=EdDSA`, `typ=tien404-private-authority+jwt` and `kid`. No `jku`, `jwk`, `x5u`, `crit`, unsigned `alg=none`, algorithm substitution or dynamically fetched public key is accepted.

## Issuer inputs and implementation requirements

The module `createPrivateIssuer` requires:
- an Ed25519 private KeyObject and allowed kid, held by restricted issuer process;
- a server-only HMAC binding key of at least 32 bytes;
- trusted `verifySession(sessionHandle)` callback;
- trusted `resolveMembership(userId, tenantId, storeId)` callback;
- server clock.

**Critical:** the returned `verified:true` field or `source` string alone is not proof. The callback implementation must itself authenticate an actual Supabase access session by validating signature, allowed JWT algorithm/key, issuer/audience, expiry, user identity and session status. The module has no actual Supabase client or Auth verifier. Client/browser-provided callbacks, metadata, tokens or claims must NEVER be injected into it.

For sensitive access the private admission operator should use server-side validated identity (see Supabase `getClaims()` and `getUser()`), and also verify session validity/`session_id` via a privileged, reviewed private method that does not expose tokens to chat, GitHub or n8n. `getClaims()` alone may accept an unexpired JWT even after sign-out/revocation.

Membership must be read from canonical Store authority tables with exact Tenant+Store+user scope, active status, no revocation, valid expiry, active parent Store and correct capability. A new membership revision immediately invalidates older authority receipts.

## Redemption contract and privilege isolation

- Verifier only accepts pinned Ed25519 public keys. Rotation is a deliberate registry update; revoked `kid` is removed.
- Verify signature BEFORE considering claims; reject noncanonical JSON, unknown headers/claims, unsupported capability, forged Store, stale revision, session mismatch, expiry and replay.
- Call the session/membership verifier AGAIN at redemption; fail closed on adapter failure.
- Atomically consume `jti` in a durable Store-scoped database/cache operation with unique constraint and correct expiry retention. In-memory `Set` is **test-only**, not allowed in multi-node production.
- A verified read-only receipt is not permission to send a message or change Orders.
- Gate privileged DB operations through a protected, narrow, separately audited gateway. BYPASSRLS/service-role can bypass Store RLS. No table-wide SQL interface to n8n, web or provider payloads.
- Prevent nonce reuse even across server restarts or worker instances; test with two independent connections before any live admission.
- Do not log raw signed receipts, Auth session IDs, JWTs, raw provider IDs, IP addresses, customer PII or the private key.

## Key protection and rotation

- CI generates ephemeral Ed25519 keypair in memory; no private key file exists in GitHub.
- For future live issuer, use HSM/KMS or restricted secrets service, role-separated key administration, audit of issuance and key rotation; restrict signing to trusted backend, not n8n workflow source or client JavaScript.
- Public keys pin by kid and issuer in a private trusted registry. Never accept a token-supplied JWKS URL.
- Future version/algorithm changes require new formal acceptance and independent security review.

## Scope exclusions

No provider actor, no signed webhook grant, no real Owner A/B session or merchant consent, no Storage media rights, no operational write, no production registration or permission changes. Current issuer is OFFLINE QA and fails closed unless its injected trusted adapters return their expected synthetic results.

References: https://www.rfc-editor.org/rfc/rfc8725 ; https://supabase.com/docs/guides/auth/sessions ; https://supabase.com/docs/reference/javascript/auth-getclaims ; https://supabase.com/docs/guides/auth/server-side/advanced-guide.
