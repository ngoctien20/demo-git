# V18.0-P0T — FastAPI Protected Auth Adapter × Private Access Gate × Independent Owner A/B UAT

**2026-11-18 JST — SOURCE-ONLY QA TESTED / HOSTED NO-GO / PRODUCTION NO-GO.**

Parent: Draft PR #385, P0S commit b12170439b6fa8dbe319646748a03fad9089669d.

## 1. Verified read-only inventory

- Render tien404-data-staging (srv-dbphtas9v7es73bursrg): LIVE deployment dep-dbqj9plg1s2s73egr30g at commit ab940a95dae8afdff426bc6ac71693833d5348ce; Auto Deploy OFF; direct origin IP allowlist 0.0.0.0/0. Deployed ops/data-platform/app/main.py uses Python/FastAPI, Supabase /auth/v1/user and tenant membership, but it does not independently verify the current signed session_id/revocation, protected Access JWT or canonical Store authority.
- Supabase staging ifxlvrhyjhbzbrkdsida: aggregate-only read-only SELECT finds one tenant with 2 eligible active owner accounts, only 1 with an auth.sessions record and 1 with a nonexpired-looking record; another tenant with one owner/session. A database session row is not real signed JWT possession or real browser/session revocation evidence. Canonical public.stores + public.store_memberships = 0; checked Commerce store_id columns = 0.
- Cloudflare Access: four existing Access applications, none protecting the direct Render origin. No Cloudflare policy was changed.
- Operator: two separate accounts already confirmed by founder. P0O local comparison not received; both independent Owner consents not verified. 31 real signed JWT Store A/B UAT scenarios remain 0/31 NOT_RUN.

## 2. Implemented P0T source artifacts

- qa/v180-p0t/protected_auth_candidate.py — Python-native asynchronous P0R contract. Requires injected server-owned trust ports for cryptographically verified Access assertion, trusted Access-to-Auth binding, verified Supabase JWT claims, live Auth user, current non-revoked session, active tenant Owner and independent scoped consent. Rechecks session/Owner/consent when correlating A/B. Output always denies Store, order, provider send, signed receipt and production authority. It is NOT a real cryptographic verifier, live session adapter, distributed replay ledger or authorization service.
- qa/v180-p0t/fastapi_nohost_denial_router.py — deliberately unmounted FastAPI router. Even in isolated local test its POST path only returns HTTP 404 and never reads JWT body/headers.
- qa/v180-p0t/test_protected_auth_candidate.py — fabricated source-only security scenarios including Access signature/issuer/audience/expiry, key claims, identity binding, current session revocation, owner and consent denial, same-actor pair and in-process replay.
- .github/workflows/v180-p0t-fastapi-protected-auth-source.yml — source-only CI with isolated pinned testing dependencies, no real Auth tokens or deployed backend calls. Do not merge into deployed gateway by copying the entire Draft PR: it has a different branch lineage and contains unrelated experimental work.

## 3. QA evidence

[GitHub Actions P0T #44230162693](https://github.com/ngoctien20/demo-git/actions/runs/44230162693) SUCCESS on earlier source commit 2d3650d38973c3698deea57ce9f04d419e0882e7. Read-back log: **62 passed, 0 failed**, 1 Starlette/AnyIO test-client DeprecationWarning; static message P0T_SOURCE_ONLY_UNMOUNTED_NO_CREDENTIALS_NO_SEND_PASS.

This is **synthetic source QA**. It does not prove a real Cloudflare Access signature, Supabase signed user JWT, live session or revocation, independent Owner consent, atomic durable server receipt, Store permissions, external Messenger/Zalo provider signatures or any hosted UAT.

## 4. Private Access / live FastAPI integration gates requiring explicit separate approval

1. Approve dedicated staging-only Access application with narrow host/path, explicit authorized QA principals, strict policy and no Access Bypass. Existing Access apps must not be repurposed without review.
2. Enforce signed Cloudflare Access JWT issuer/audience/expiry/JWKS at the trusted origin itself, including direct Render origin URL negative tests; CORS or proxy alone is insufficient. Design private-origin or equivalent non-bypassable enforcement first.
3. Independently security-review actual Python trusted ports: Supabase JWT signature and claims, live /auth/v1/user, backend current auth.sessions lookup and session revocation, least-privilege credential storage and rotation plan, pinned tenant, strict timeout and rate limits. No service keys in GitHub/chat/browser/n8n.
4. Collect real authenticated independent consent from BOTH existing authorized owners, not just a boolean. Require separate Access principal binding per subject, live distinct signed JWT sessions and same tenant. Do not infer Store ownership from tenant owner.
5. Design protected short-lived one-use challenge/receipt with transactional consumption, replay prevention across instances, redacted private audit and explicit no-send/no-Store-access scope. The Python in-process local replay lock is not durable.
6. Hosted Store migration, RLS changes, grants and owner binding require separately approved M0 backup/restore and rollback evidence; do not operate on real customer data in identity UAT.

## 5. Safe operator hinge and true QA status

The already-existing P0O local read-only comparison can be performed in two existing authorized browser profiles at:
https://tien404-auth-staging.onrender.com/auth-evidence.html

Operator may report ONLY LOCAL_COMPARE_PASS or the nonsensitive BLOCKED_REASON. Do not share JWT, password, email, user/session UUID, nonce, raw receipt, fingerprints, client secrets or customer data. If one account lacks a real browser session, STOP; do not manufacture proof or silently create another account.

Current real signed two-owner UAT = NOT_RUN. Existing 31 Store A/B JWT UAT cases = NOT_RUN. This phase prepares the Python/Access integration; it does not admit real owner JWTs or expose a protected hosted endpoint.

## 6. Change/rollback

- VERIFIED: Render LIVE baseline, staging Auth aggregate counts, Access application inventory, no canonical Store schema.
- IMPLEMENTED: isolated Python candidate, denied FastAPI route, offline QA.
- TESTED: 62/62 synthetic source QA; final HEAD CI must be checked separately.
- BLOCKED: real Owner A/B signed session, private Access-protected origin, independent consents, actual live adapters, one-use receipts, Store authority, hosted UAT.
- NOT CHANGED: Render deploy, Cloudflare Access, Supabase credentials/Auth/data/roles/schema, Messenger, Zalo, n8n, provider sends, payments, production.
- ROLLBACK: revert P0T source-only additions in Draft PR #385; no runtime rollback needed. M0 waiver remains restricted to source/read-only/disposable QA.

**Decision: P0T_PYTHON_SOURCE_QA_PASS_62_OF_62 / PROTECTED_HOST_NOT_DEPLOYED / REAL_OWNER_AB_UAT_BLOCKED / PRODUCTION_NO_GO.**
