# V18.3.6I — Protected Issuer-to-Nonce Binding Contract

## Flow, in strict order

1. A protected **server-owned**, authenticated session handle is resolved; the caller cannot create trusted dependencies.
2. V18.3.6G signed verifier checks the Ed25519 signature against pinned `kid`, exact `typ`, `alg`, issuer/audience, expiry, JTI, read-only capability, Tenant+Store, subject, session HMAC fingerprint and membership revision.
3. The verifier consults the H trusted-session and Store-membership callbacks **again** at redemption.
4. Only after verification does its `consumeNonce({jti,expiresAt})` callback execute. The I adapter derives exact token SHA256 plus HMAC digests of the signed Tenant, Store, subject, session binding and membership revision from those **verified claims**, not from user input.
5. The private nonce repository receives exactly that signed authority fingerprint and the intended read-only capability. It must lock and re-check currently authoritative session and membership state **inside the transaction that inserts the nonce**. A database outage or unexpected return denies.
6. Only the literal `ACCEPTED` returns a synthetic read-only admission result. No customer data read, send or write occurs in this module.

### Parameters bound by the server

`issuer, audience, jti, capability, expiresAt, tenantHash, storeHash, subjectHash, sessionBindingHash, membershipRevisionHash, authorityDigest`.

No raw JWT, Auth session ID, user ID, Store ID, provider account ID or private key is forwarded to the database in the I callback. Digests are HMAC-SHA256 for scoped identity and SHA256 of the signed token for exact signed authority fingerprint. **SHA256 of a token can be a sensitive stable fingerprint; keep it private and never log or expose it to clients.**

The generated PG schema accepts these fields and rechecks session/member fixture rows before a ledger INSERT. It does NOT verify Ed25519 itself and must not be exposed through Supabase Data API or directly to customer-facing n8n tools.

## The trusted adapter integration gap

The G module currently accepts a nonce callback containing JTI and expiry. I wraps this callback in a sealed per-request closure and derives the verified claim fields after the verifier has validated the signature. Tests prove sequencing with a synthetic DB callback. The PostgreSQL procedure and JS code are **not wired to the same hosted service**; a real private RPC adapter still requires authorization, secure transport, retries, monitoring, grant audit and independent review.

Never let a caller define `commitVerifiedNonce`, `scopeBindingSecret`, pinned signing keys, the session verifier or the membership query. They are private process dependencies only. If a private executor is compromised, the SQL routine is insufficient protection against forgery of its input digests.

## Linearization limitation

The nonce transaction only proves *admission happened before/after a simulated local revocation update*. To guarantee a later sensitive **data operation** uses that same authorized snapshot, perform that operation in the same trusted DB transaction while required session/membership locks are held, or implement a separately reviewed equivalent guard. This test intentionally does not grant Commerce writes or production data reads.

Real Supabase session revocation is external to this disposable fixture. No guarantee of immediate production revocation has been demonstrated.
