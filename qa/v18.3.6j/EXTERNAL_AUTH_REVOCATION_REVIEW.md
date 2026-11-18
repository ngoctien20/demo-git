# V18.3.6J — External Supabase Auth Revocation Consistency Review

**Status: P0 BLOCKER — NO REAL AUTH UAT OR PRODUCTION ADMISSION**

## Verified assumptions from current Supabase documentation
- Supabase access tokens are short-lived JWTs and expose a `session_id`. Session termination and JWT expiration are distinct; a JWT can remain valid until expiration even when the session is no longer active.
- `getClaims()` verifies the cryptographic JWT but does NOT alone demonstrate immediate revocation of the underlying session.
- Security-sensitive flows must use trusted server-side Auth validation and a protected authoritative session-state lookup, with well-defined synchronization and failure semantics. Review source `auth.sessions` / supported server APIs and privileges before implementing.

## Three-ordering matrix: local PostgreSQL (disposable)

| Ordering | Tested outcome | Limit |
|---|---|---|
| Local session revocation commits before the transaction-bound catalog RPC | DENY_SESSION and no nonce consumed | Proves only local PostgreSQL lock behavior |
| Local membership revocation commits before read | DENY_MEMBERSHIP | Store authority must be authoritative |
| Catalog RPC gets row locks first and completes before local revoke | Read allowed; later admission denied | Serial ordering within one DB, no external Auth |
| Same JTI concurrent reads | One ALLOW_CATALOG, one REPLAY | Local unique constraint persists |
| **External Auth sign-out signal not propagated into local session mirror** | **ALLOW_CATALOG can still occur** | **P0: explicit unsafe behavior demonstration, not a security pass** |
| External Auth API unavailable or status stale | Should DENY, but real integration not implemented | BLOCKED |

## Root limitation

The J procedure uses a synthetic session mirror with `last_authority_check_at` and validates that it is at most **60 seconds old**. This protects against very old local verification but does not prevent an external Auth revocation event in the intervening period. The external sign-out test inserts a separate **fixture only** and demonstrates a read may be admitted when the internal mirror remains active. No actual Supabase Auth API was invoked.

A copy of `auth.sessions`, event listener, webhook or cache cannot be treated as instantaneous authoritative revocation without measured delivery guarantees and negative outage/retry tests. `service_role` is not a replacement for verifying the real user/session.

## Admission requirements
1. Implement server-side validated Auth signatures/issuer/audience/user IDs and active session checks without leaking tokens to clients/CI.
2. Define explicit maximum consistency lag and semantics for a revoked session, logout, password reset and account disable. For strict immediate revocation, block until authoritative coordination has been proven; do not rely solely on JWT exp or `last_authority_check_at`.
3. Ensure the protected real data read happens in the same reviewed transaction/snapshot as Store membership and nonce checks. External Auth validation must be bound to the exact session/authority receipt and cannot be forged by the gateway client.
4. Test external revocation racing a private read: before, during, after, network failure, slow API, duplicate/out-of-order events and restart, with private redacted evidence.
5. Obtain independent human security review, protected tenant/Store schema and real owner A/B approval before anything beyond offline QA.

**Decision:** REAL_AUTH_REVOKE_CONSISTENCY=BLOCKED; PRODUCTION_AUTHORITY=NO-GO.
Sources: https://supabase.com/docs/guides/auth/sessions and https://supabase.com/docs/guides/database/postgres/row-level-security.
