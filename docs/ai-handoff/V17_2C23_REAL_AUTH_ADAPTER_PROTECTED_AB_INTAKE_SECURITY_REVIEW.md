# V17.2C.23 — Real Auth Adapter Implementation × Protected A/B Consent Intake Staging × Independent Security Review

Date 2026-11-18 JST. Draft PR #392. Predecessor V17.2C.22 HEAD da8dcbe44912b64aeefef7f7393df0cddaec4f03.

## Verified starting evidence
- Prior three GitHub CI workflows on V17.2C.22 were SUCCESS: 44226638533, 44226638642, 44226638588.
- Supabase staging ifxlvrhyjhbzbrkdsida has zero development branches. No approved disposable project/branch. No verified independent A/B consent, authorized cost or restore drill.
- Supabase public docs indicate the Auth JWT session_id correlates to auth.sessions; signature/claims alone are insufficient for immediate revocation checks.

## Implemented in Draft source only
- qa/v172c-rpc-closure/v172c23-supabase-real-auth-session-adapter.cjs: server-only Auth adapter that calls pinned HTTPS Supabase project /auth/v1/user with the bearer and publishable key, no redirect and 5-second timeout. Prechecks JWT issuer/audience/subject/session ID, issued/expiry timestamps, requires Auth service to return matching user ID explicitly marked is_anonymous=false, then requires independent active-session lookup. Returns internal HMAC evidence, not token or raw session ID.
- qa/v172c-rpc-closure/v172c23-private-active-session-reader.cjs: server-only parametrized PostgreSQL read of auth.sessions with both id and user_id constrained, denying missing/revoked sessions by absence. Requires approved private database read credentials and a limited role; no such credential wired or exposed.
- Corresponding test files exercise mocked Auth success and negative cases: non-200/redirect, forged/malformed token, invalid expiry, audience/issuer mismatch, anonymous/unknown anonymous status, session missing/mismatch/revoked, injection and SQL read errors.
- Existing protected consent CI workflow updated to include both V17.2C.23 test files.

## Security boundaries
- Fake JWT strings and injected mock HTTP/DB in tests are NOT real Supabase signed JWT verification. No actual user tokens were accessed. No network/Auth hosting or real customer data was modified.
- Actual private service still needs protected HTTPS route, independent A/B Auth logins, server-side user ownership lookup, single-use intent challenge and consent signing, reviewer identity proof, rollback and cost approval. Never accept tenant/Store/session authority from client JSON or expose Supabase service_role secret to browsers.
- The active-session checker is supplied as a private dependency and requires an independently reviewed principal with only necessary read permissions; the Auth API endpoint does not alone prove the session remains unrevoked.
- No independent human security reviewer consent/sign-off has been collected.
- A/B tenants should remain synthetic only. Staging and personal BIO are excluded as disposable destinations.

## GO / NO-GO
Source Auth adapters: IMPLEMENTED on Draft.
CI for V17.2C.23 must be verified at tested commit SHA; not a hosted UAT.
Private hosted Auth A/B intake, independent owner receipts: BLOCKED.
Approved disposable Supabase branch with price/cost ceiling and verified restore: BLOCKED.
Independent human security sign-off: BLOCKED.
Real JWT/PostgREST UAT and production release: NO-GO.

Rollback: revert V17.2C.23 Draft source/workflow commits or close PR #392. No Supabase DDL, credential, n8n, Messenger, Zalo or customer write occurred.
