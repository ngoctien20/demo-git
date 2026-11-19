# V18.3.6O — Gateway Cryptographic Proof Admissibility Matrix

**Class:** ARCHITECTURE REVIEW / OFFLINE QA / PRODUCTION NO-GO.  
**Date:** 2026-11-19 JST.

## Truth boundary

The V18.3.6N preferred direction is a protected backend verifying a TIEN404 Ed25519 authority receipt with pinned issuer, audience, algorithm, key ID, subject, session, resource, Store and nonce; separately validating the Supabase Auth JWT and exact user/session authority. The final Commerce read must check **real session + Store membership + resource + single-use nonce within one PostgreSQL transaction**.

This is an architecture candidate, not a deployed flow. Auth sessions cannot be read directly by anon/authenticated/service_role in current staging metadata. No canonical Store authority exists, and no production signer key or SQL signature verification method is approved.

## Seven proof models

| Option | Trust mechanism | Classification | Current missing proof |
|---|---|---|---|
| P1 — Private Node Ed25519 + DB-side public key verifier | Server verifies Ed25519; DB independently verifies per-operation signed proof without holding signing secret | **CONDITIONAL CANDIDATE** | Managed PG17 SQL Ed25519 support, extension safety, key/ACL/rotation |
| P2 — Private Node Ed25519 + DB protected HMAC | Separate bounded HMAC to SQL; DB shares verification secret | **CONDITIONAL CANDIDATE** | Independent production symmetric key custody, leak/backup/rotation risk, SECDEF ACL |
| P3 — Private backend with tightly scoped PostgreSQL identity | Server attests verified user/store, DB role can execute one operation with no generic SQL | **CONDITIONAL CANDIDATE** | Caller impersonation/compromise blast radius, real scope verification and Auth session access |
| X1 — Service-role proxy in browser or untrusted n8n | Broad privilege crossing untrusted input | **REJECT** | BypassRLS and credential exposure |
| X2 — Signed access JWT alone | Doesn't prove live session or Store membership | **REJECT** | Revocation/expiry race |
| X3 — Committed K synthetic HMAC fixture | Secret is publicly known | **REJECT** | Not a secret |
| X4 — Claim pgcrypto HMAC implies Ed25519 verification | Algorithm confusion | **REJECT** | HMAC and Ed25519 not interchangeable |

**No option currently ADMITTED.** P1 is a worthwhile research direction, not verified available on this Supabase Postgres environment. P3 may avoid custom SQL signature verification but requires independent DB identity security proof; do not present it as inherently safe. P2 may be feasible but requires actual symmetric secret shared between DB and backend; it cannot be marketed as no-DB-secret.

## 12 mandatory acceptance criteria for any conditional option

1. Fixed Supabase Auth issuer, audience, algorithm/JWKS trust.
2. Auth session eligibility rechecked in same PostgreSQL transaction; not merely signed JWT.
3. Canonical Tenant/Store membership with current revision.
4. Exact permitted operation and resource bound to proof.
5. Signed subject/session/JTI/expiry/purpose.
6. Database-side nonce uniqueness and durable replay handling.
7. Nonpublic RPC with no direct tables or generic privileged SQL.
8. Default EXECUTE/legacy SECURITY DEFINER grants reviewed; no alternate route.
9. No service_role or BYPASSRLS privilege escalation/trust shortcut.
10. Independently secured signing key and tested rotation/compromise response.
11. Replay, outage and ambiguous-ack negative QA.
12. Independent human security review bound to exact commit/schema and private proof.

Even 12/12 metadata flags plus candidate-specific evidence only results in **EVIDENCE_PACKET_READY_FOR_PRIVATE_REVIEW**, not production permission. An independent reviewer must inspect actual private evidence; no crypto implementation may be shipped solely on this matrix.

## Specific review matrix for proof bytes

- Canonical serialization is versioned and byte-for-byte verified across Node and DB (avoid string normalization ambiguity).
- Signature domain separation: exact protocol version, issuer, audience, tenant/store, subject, session, operation, immutable resource and payload digest, nonce, timestamps, key ID.
- No algorithm downgrade, confused-deputy reuse of JWT or issuer key, or user-controlled Store ID.
- Nonce ledger atomicity on retries, transaction-lock ordering and crash/restart, independent tenant scope.
- Key rotation: active, verify-only, revoked, emergency compromise; avoid accepting old keys beyond approved TTL.
- Deny on key store unavailable, JWKS stale, Auth timeout, missing membership, ambiguous transaction result.
- No credential, JWT, MAC signing key, session ID or customer PII in logs, GitHub, frontend or n8n nodes.

## Bounded decision

**PROPOSED preferred next research:** evaluate P3 trusted, dedicated DB identity and P1 public-key DB proof in **separate disposable test plans**, without deploying either. Do not install pgsodium/pgjwt or grant auth.sessions SELECT. P2 is fallback only if a signer/DB secret-custody security review explicitly accepts compromise blast radius.

**PRODUCTION_RPC_PROOF=UNSELECTED / OWNER_APPROVAL=NOT_GIVEN / HUMAN_SECURITY_REVIEW=BLOCKED / RELEASE=NO-GO**.
