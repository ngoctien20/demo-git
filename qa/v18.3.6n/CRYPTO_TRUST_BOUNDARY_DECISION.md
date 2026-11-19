# V18.3.6N — Production Crypto Trust Boundary Decision (Architecture)

**Decision:** `PROPOSED PREFERRED DIRECTION`; **not a production cryptographic trust approval**.

## Preferred candidate: private Node Ed25519 verifier + same-transaction Auth/Store DB

```text
Browser / provider inputs (UNTRUSTED)
  -> Protected backend gateway, verify origin/rate/installation
  -> Verify Supabase JWT issuer/audience/signature using pinned trust, real active session
  -> Validate Ed25519 TIEN404 authority in isolated Node.js code with pinned kid/alg/iss/aud
  -> Derive signed Tenant/Store/resource/scope from verified server-side mapping
  -> Internal private RPC proof (FINAL CRYPTO MECHANISM NOT SELECTED)
  -> PostgreSQL: real auth.sessions + Store membership + Catalog + nonce in ONE transaction
  -> Read-only data or deny
```

## Options and decision

| Option | Evidence | Judgment |
|---|---|---|
| A. Private Node native crypto Ed25519 verification | G–M offline signed verification tests; no external crypto extension needed for Node | **PREFERRED SIGNATURE VERIFICATION LAYER** |
| B. PostgreSQL public-key Ed25519 verifier | No supported/approved SQL verifier established for actual Supabase-hosted PostgreSQL 17.11 | **BLOCKED** until extension/algorithm/privilege and byte-canonicalization review |
| C. Dedicated private RPC HMAC | K disposable Node↔PostgreSQL HMAC and short TTL tested; DB shared-secret custody expands compromise blast radius | **FALLBACK REVIEW ONLY**, not approved for production |
| D. Generic service-role backend proxy or public SECDEF function | Privileged bypass risks, no safe active session/Store binding | **REJECTED** |
| E. Stateless JWT signature only | Revoked access token can remain valid to `exp` | **REJECTED** |

## The unresolved "last metre"

Node verifying Ed25519 does not automatically make the DB caller trustworthy. PostgreSQL must reject forged Tenant/Store/subject claims even if a gateway or credential is compromised. The **private RPC authentication** (e.g. independently approved signed proof verifier, constrained identity, key custody, nonce + same-transaction Auth membership check) remains unselected. Never enable production until an independent cryptography and DB-privilege reviewer approves the actual mechanism, supported PostgreSQL verifier/extension and rotation/compromise scenario.

## Key custody requirements

- Dedicated Auth JWT *verification* trust (JWKS/current issuer); never reuse JWT signing secret.
- Separate TIEN404 Ed25519 issuer key (ideally nonexportable, only if verified KMS/HSM supports Ed25519 and approved signing operations).
- Separate private RPC caller proof key or public verifier; no shared QA static HMAC.
- Independent owner/operator/reviewer and environment isolation, per-`kid` expiry and revocation, redacted signing audit, safe backup/rotation and compromise procedure.
- Never put service-role key, private signing key, production signer permission or customer token in frontend, GitHub Actions, n8n or ChatGPT logs.

**Stage N selection:** Backend Ed25519 layer = **PROPOSED PREFERRED**, DB verifier/caller = **BLOCKED**, production key custody = **BLOCKED**, release = **NO-GO**.
