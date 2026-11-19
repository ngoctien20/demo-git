# TIEN404 AI — V18.3.6L ADR-01: Authoritative Supabase Auth Revocation

**Decision class:** PROPOSED / SECURITY REVIEW CANDIDATE. **No live Auth admission.**  
**Date:** 2026-11-19 JST. **Parent:** V18.3.6K Draft PR #442, verified run #44497091023.

## Verified external facts and constraints

Supabase Auth JWTs are stateless. `getClaims()` verifies a token signature and expiry but is **not** proof that the session still exists. When a user signs out, relevant sessions are removed from `auth.sessions` and an already-issued access token can remain cryptographically valid until `exp`. The `session_id` JWT claim identifies a session row in `auth.sessions`. For sensitive operations, documentation recommends checking that `session_id` corresponds to a live row. Session expiry/timebox/inactivity policies may be cleaned up progressively; row existence alone is not proof all additional policy constraints hold. See:
- https://supabase.com/docs/guides/auth/sessions
- https://supabase.com/docs/guides/auth/signout
- https://supabase.com/docs/guides/auth/server-side/advanced-guide
- https://supabase.com/docs/guides/auth/jwts

**Connected staging evidence (metadata-only verified 2026-11-19 JST):** project `ifxlvrhyjhbzbrkdsida`, PostgreSQL 17.11; the `auth.sessions` PostgreSQL relation **exists (1)**. There are 0 canonical `stores`/`store_memberships` tables, 0 `store_id` across six Commerce tables, 0 restrictive Store policies. **Existence of the relation does not establish safe access grants, permitted locking, Auth deletion timing or user/session validity.** No actual Auth session row, identity or token was accessed.

## Alternatives and disposition

| Approach | Expected behavior | Cost / complexity | Decision |
|---|---|---|---|
| **A. Protected same-DB transaction against `auth.sessions` + canonical Store membership + Store-scoped catalog** | Validate signed user identity, then check exact active `auth.sessions.session_id` and matching user, protect row and Store membership during operation; synthetic signout/delete race can be serialized if lock and deletion behavior match | Moderate complexity; schema, ACL and Auth semantics require separate private review | **PREFERRED CANDIDATE** |
| B. `getClaims()` + `getUser()` immediately before a separate PostgreSQL RPC | Stronger than JWT alone, but a logout can occur between Auth response and DB read | Lower implementation cost; bounded freshness only | **NOT sufficient for instant revocation** |
| C. Event-driven local session mirror / webhook propagation | Low per-request latency but queued/late/out-of-order revocations permit stale authorization | Operational resilience and reconciliation needed | **Not an authoritative gate** |
| D. Short TTL signed session lease, replay ledger | Limits exposure duration, cannot eliminate cross-system race | Moderate; rotation and clock skew | Defense-in-depth only |
| E. Block sensitive operations until a real session authority and Store RLS are approved | Guarantees no unauthorized *new* production path while blocked | Delays release | **ACTIVE CURRENT POLICY** |

## Candidate A: private same-DB read contract, NOT implemented

The critical detail is **colocation**. If Auth's `auth.sessions` and Commerce Store authority are truly in the same Supabase PostgreSQL transactional domain, a protected internal database function may, after private JWT signature/audience/issuer validation:
1. Receive a trusted-bound session ID and subject from a protected server (never user-supplied raw claims).
2. Look up `auth.sessions` by exact session ID and verify the authoritative user/expiry state. The real column names, index, Grants, session life-cycle semantics and constraints MUST be introspected and independently reviewed **without accessing live session rows**.
3. Lock the relevant session row with a PostgreSQL row lock whose interaction with the Auth service's signout DELETE/UPDATE is **empirically tested**. Establish an explicit lock order to avoid deadlocks.
4. Lock the canonical Store membership; verify Tenant, Store, user, revision, status, expiry, isolation and restrictive RLS/privileged-function scope.
5. Perform the exact read operation (catalog fixture initially) and consume nonce in the SAME transaction before releasing locks.
6. Deny on no session, mismatch, revoked user, policy expiry, missing Store, authorization mismatch, transaction conflict, timeout, DB outage and ambiguous result. Never silently revert to cached JWT/Store claims.
7. Use signed and narrowly scoped internal service identity. No raw service-role credentials, user JWTs, profile PII or signing secrets enter GitHub, n8n or client logs.

**Caveats:** Supabase Auth may use a different transaction and different cleanup semantics for logout, password changes and session expiry. PostgreSQL row locking only guarantees ordered DB mutations when the competing Auth operation actually touches the SAME locked row and commits. A missing/expired session in `auth.sessions` is a valid deny; a present row still needs the applicable session-expiry/user-disable policies. Do NOT claim instant global revocation until all these are verified on a disposable Auth/PG integration environment with actual supported APIs.

## Negative QA acceptance matrix required for candidate A

| Case | Expected | Scope |
|---|---|---|
| Auth JWT signature invalid / wrong issuer/audience/key | DENY before DB | Private test Auth |
| Session row absent or user mismatch | DENY | PG transaction |
| Session deleted before request lock | DENY | Two-connection concurrent test |
| Session DELETE waits behind in-flight authorized read | Defined ordered completion, subsequent read DENY | Two-connection concurrent test |
| Password reset / signout scope / refresh reuse anomaly | Must not leave authorized protected reads | Actual Auth API behavior |
| Session expiry, inactivity, timebox, single-session conflict | DENY based on independently verified policy | Actual Auth config |
| Unknown database column/schema privilege | DENY; never create extra elevated grants automatically | Migration safety |
| Store A accesses Store B in same Tenant | DENY with scoped negative proof | Real private A/B only after approval |
| Session/Store lock deadlock or timeout | DENY; safe retry only after new Auth check | PostgreSQL |
| Auth unavailable, stale snapshot, node restart | DENY; no cached allow fallback | Infra failure |
| Replay same JTI, changed signed resource | DENY | Atomic ledger |
| Expired subscription/tenant membership | DENY even with active Auth session | SaaS authority |
| SQL injection / forged `store_id`, JTI, role metadata | DENY | Private gateway |

## Governance and progression

No production access based on this ADR. Current gate remains `AUTH_REVOCATION_P0_OPEN`. To move candidate A forward, first obtain separate owner approval for a **fully isolated disposable** Auth/PG rehearsal, actual supported session-state API / SQL privilege preflight, independent security reviewer, and planned rollback. Never inspect or materialize real owner sessions to GitHub or ChatGPT.

**Outcome:** PROPOSED. `PRODUCTION_SESSION_AUTHORITY_ADMITTED=false`.
