# V18.3.6M — PostgreSQL 17 / Supabase Crypto Verifier Compatibility

**Metadata-only, 2026-11-19 JST:**

| Capability | Connected Supabase PG17.11 | Evidence / decision |
|---|---|---|
| `pgcrypto` | Installed, available | HMAC-SHA256 capability supported; does not by itself establish Ed25519 signature verification |
| `pgsodium` | Available extension, **not installed** | Candidate only; enabling it requires separate approval, compatibility assessment and safe grant/key audit |
| `pgjwt` | Available extension, **not installed** | Do not use it as an assumed Ed25519 verifier; docs flag pgjwt deprecated on PG17 |
| Ed25519-named functions in `public` / `extensions` | **0 observed** | This limited metadata query is NOT exhaustive across all private schemas and does not prove Ed25519 impossible |
| Node.js `node:crypto` Ed25519 | Offline test available | Good candidate for trusted private server verification, but no production signer/KMS custody established |
| K's HMAC-SHA256 Node ↔ PostgreSQL | Already tested in K | **Symmetric secret must be securely held on both sides**, cannot claim public-key-only trust in SQL |

## Technical choices

**Option 1 — Recommended first private architecture:** trusted server validates Supabase JWT and Ed25519 TIEN404 signed authority with pinned public keys and verifies the live Auth session; it presents a separate short-lived, single-operation, nonce-bound attestation to a dedicated SQL RPC. The SQL RPC still requires a credible caller authentication/key custody boundary. This does NOT automatically close the Auth delete race.

**Option 2 — Asymmetric DB-side verification:** explore only if a vetted, maintained Ed25519 verification routine is supported by the managed PostgreSQL environment. Audit SQL callable privileges, extension safety, key rotation, algorithm pinning, and query/byte canonicalization. **Not verified.**

**Option 3 — Database HMAC:** existing pgcrypto supports HMAC. But sharing a symmetric secret between private service and database expands the compromise surface; K's committed `repeat('K',64)` was intentionally nonsecret and MUST NEVER be used outside isolated QA.

No installation, extension upgrade, permission grant, real KMS/HSM key generation, secret retrieval or protected connection was attempted.

References:
- https://www.postgresql.org/docs/17/pgcrypto.html
- https://supabase.com/docs/guides/auth/signing-keys
- https://supabase.com/docs/guides/database/extensions
- https://supabase.com/docs/guides/database/extensions/pgsodium

**Compatibility verdict:** `PGCRYPTO_HMAC_VERIFIED`; `NODE_ED25519_OFFLINE_VERIFIED` after CI; `POSTGRES_ED25519_SIGNED_AUTHORITY_VERIFIER=BLOCKED`; `PRODUCTION_KEY_CUSTODY=BLOCKED`.
