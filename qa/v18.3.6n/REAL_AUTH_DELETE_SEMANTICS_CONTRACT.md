# V18.3.6N — Supabase Auth Service SignOut/Delete Semantics Contract

**Status:** SPECIFICATION + SYNTHETIC OFFLINE QA. **NO real Auth API test has been run.**

## Documented Supabase Auth behavior

- `signOut({scope:'global'})` terminates all sessions for that user (JavaScript default).
- `signOut({scope:'local'})` terminates only the current session.
- `signOut({scope:'others'})` terminates sessions other than current for same user.
- Existing access JWTs can remain cryptographically valid to their JWT `exp` after signout, even if the session is removed. JWT signature validity alone is not an active-session proof.
- JWT `session_id` maps to an `auth.sessions` row; checking row existence can help detect signout. But time-box/inactivity expiry may not delete session rows immediately; Supabase describes deferred cleanup, so existence alone is **insufficient** to prove all policies.
- Session termination can result from password changes, security-sensitive actions, inactivity, maximum lifetime or single-session policy. The actual Auth service behavior and cleanup ordering are NOT proven for TIEN404.

Docs (reviewed 2026-11-19): https://supabase.com/docs/guides/auth/signout and https://supabase.com/docs/guides/auth/sessions .

## Real Auth test admission matrix — must use separate approval

| Test | Required real private evidence | Status |
|---|---|---|
| LOCAL_CURRENT_SESSION | Test user A: only current session revoked; other A session remains | BLOCKED |
| GLOBAL_ALL_USER_SESSIONS | User A all sessions invalidated, unrelated user B unaffected | BLOCKED |
| OTHERS_PRESERVES_CURRENT | User A current survives, others revoked | BLOCKED |
| DELETE_WINS_BEFORE_READ | Auth Service signOut commits before protected DB read, no subsequent read permitted | BLOCKED |
| READ_WINS_BEFORE_DELETE | Authorized read holds SQL locks first, logout ordering is defined, later requests denied | BLOCKED |
| ACCESS_JWT_VALID_AFTER_SIGNOUT | Signature can still validate, but sensitive Auth/Store gate denies | BLOCKED |
| TIMEBOX_EXPIRED_ROW_STILL_PRESENT | Deny even when session record remains due to delayed cleanup | BLOCKED |
| INACTIVITY_EXPIRED_ROW_STILL_PRESENT | Deny even when session row is not yet cleaned | BLOCKED |
| SINGLE_SESSION_POLICY | Other device terminates expected prior session | BLOCKED |
| PASSWORD_CHANGE_OR_USER_DISABLE | Password/security action and disabled-user effect | BLOCKED |
| REFRESH_REUSE_AND_TOKEN_ROTATION | Refresh/reuse handling and token rotation | BLOCKED |
| AUTH_SERVICE_ERROR | Auth API unavailable, DNS/timeout/HTTP 5xx, no cached success | BLOCKED |
| DB_ROW_LOCK_TIMEOUT | Transaction lock timeout returns DENY/failed request and burns no nonce | BLOCKED |
| STORE_MEMBERSHIP_REVOKED | Real Tenant/Store membership revocation denies same-session user | BLOCKED |
| REPLAY_SAME_JTI | Duplicate request rejected durably | BLOCKED |

## Proposed real-test constraints (not executed)

1. Use a **new isolated Supabase Auth QA project**, not current staging's real owner A/B sessions; separate approval if it creates cost/resources.
2. Create disposable QA identities with test-only credentials, never expose them in GitHub/ChatGPT outputs. Use private operator/browser; no real customer or owner data.
3. Verify actual `auth.sessions` SQL semantics in the **same transaction** as Store authorization, but only under independently reviewed, least-privilege access. Never grant public `auth.sessions` SELECT or create generic service-role proxy.
4. Trigger real Auth `signOut` for local/global/others through supported SDK; verify actual signed JWT identity, session row lifecycle and expected disappearance/expiry across lock ordering.
5. Test actual timebox, inactivity and single-session policies even when rows persist; signed JWT expiry/refresh must not be conflated with immediate logout.
6. Establish safe teardown, session/token redaction, rollback (no true user data) and a second reviewer. Do not log plaintext Auth tokens or sensitive IDs.
7. Only publish redacted counts, statuses, test SHA and test time. Evidence pack hashes alone are not proof of real Auth security.

`auth-service-delete-contract.mjs` simulates scope semantics and policy checks but **always** returns `realAuthServiceVerified:false`; `assessRealAuthServiceAdmission` cannot mark a production admission.

**Security outcome:** P0 cross-service/Auth signout behavior remains OPEN. Production authority NO-GO.
