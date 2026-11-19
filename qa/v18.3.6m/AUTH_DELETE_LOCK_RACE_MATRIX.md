# V18.3.6M — Synthetic Auth Session DELETE × Scoped Read Lock Matrix

**Only real PostgreSQL 17.12 is tested; no real Supabase Auth API or data.** The `qa_m_auth.sessions` table imitates only the minimum structure required to reason about row locks (`id`, `user_id`, `not_after`).

| Competition | Lock order / outcome | Security meaning |
|---|---|---|
| DELETE transaction locks and removes session first, read concurrently starts | Read waits, then `DENY_SESSION`, nonce not inserted | DB ordering works when both operations touch same row |
| Scoped READ transaction locks session first and holds it until COMMIT | DELETE waits; first read `ALLOW_CATALOG`, later fresh read `DENY_SESSION` | A read already linearized before sign-out may legitimately finish |
| Two identical signed JTI reads at same time | One `ALLOW_CATALOG`; one `REPLAY`; one ledger row | Unique nonce prevents concurrent reuse |
| Session row held by conflicting transaction and gateway lock_timeout expires | SQL raises lock timeout; no catalog result and no nonce | Fail-closed under contention |
| Session row missing or expired, wrong user or Store | `DENY_SESSION` or `DENY_MEMBERSHIP`; no nonce burn | Missing authority never returns data |
| Supabase Auth session expires/terminates by a different service path without deleting the locked row | **NOT TESTED** | Actual Supabase behavior remains P0 blocker |
| Auth sign-out commits AFTER an authorized read, but before a separate provider send | **NOT AUTHORIZED** | Recheck authorization at final sensitive transaction |

The function holds `FOR UPDATE` on the session row, then the Store membership row, then `FOR KEY SHARE` on catalog before the atomic nonce insert; it never upgrades a weaker session lock after acquiring it. The PostgreSQL version and SQL semantics are grounded in the PostgreSQL 17 locking documentation.

**Security boundary:** the procedure receives synthetic `p_user_id`, `p_session_id`, `p_store_id` and JTI and does **not cryptographically authenticate the caller**. In production the server MUST verify issuer/key/audience and sign exact Store scope; the database must restrict EXECUTE via a proven private identity, and the actual `auth.sessions` semantics must be verified with supported APIs. The current SQL is **not a migration**.
