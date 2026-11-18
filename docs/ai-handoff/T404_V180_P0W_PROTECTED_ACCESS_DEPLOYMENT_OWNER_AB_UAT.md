# TIEN404 V18.0-P0W — Protected Access Deployment Approval × Live Session Verification × Independent Owner A/B Read-Only UAT

**2026-11-18 JST · SOURCE-ONLY PREDEPLOY TESTED · HOSTED REAL OWNER A/B NO-GO · PRODUCTION NO-GO.**

Parent: Draft PR #385 P0V HEAD `e603fd25d923151a055764f0ad068a629f43a4e8`.

## 1. Verified current inventory (read only)

- Render `tien404-data-staging`: LIVE service `srv-dbphtas9v7es73bursrg`, deploy `dep-dbqj9plg1s2s73egr30g`, source `ab940a95dae8afdff426bc6ac71693833d5348ce`, autoDeploy OFF, origin publicly routable via `0.0.0.0/0`. **Deployed code is on a separate Render branch**, not the QA Draft branch. Existing FastAPI Data Gateway untouched.
- Cloudflare Access account inventory: 4 existing applications. **None** protects the direct Render Data Gateway origin. No new Access app, policy or gateway modification was performed.
- Supabase staging `ifxlvrhyjhbzbrkdsida`: one tenant has 2 eligible active Owners, **only 1** with any `auth.sessions` record/candidate non-expired session; another tenant has 1 owner/session. A session record is not an attested signed JWT or Owner consent. No raw user IDs, session IDs, keys or customer data fetched.
- Canonical Store A/B authorization and live cross-channel Store order read remain **NO-GO**. Planned real signed Owner A/B Store UAT **0/31 NOT_RUN**. P0O local browser comparison and independently authenticated A/B consents have not been provided.

## 2. P0W source-only implementation

- `qa/v180-p0w/pinned_jwks_source.py`: async server-owned **public-key** JWKS fetch candidate. Only fixed official Cloudflare Access `/cdn-cgi/access/certs` or Supabase Auth `/.well-known/jwks.json`, validated strict HTTPS provider issuer. No arbitrary client-supplied hostname/JWKS URL or redirects; HTTPS verification, 3s timeout, no environment proxy, 32KiB cap, no duplicate key IDs, strict allowed signature key types, bounded 60s cache and fail-closed fetch failure. No keyset can be supplied by a user as verification authority. Endpoint strings must ultimately be injected by reviewed server-only configuration.
- `qa/v180-p0w/pinned_auth_user_source.py`: pinned Supabase `GET /auth/v1/user` candidate using a **publishable-only key** and provided Bearer, no service-role or restricted credential, no redirects, 3s timeout, safe strict user response with only id/verified flag, and refusal for anonymous, invalid, deleted or banned user. **Only a component** of live session proof; it does not check `auth.sessions` alone or infer Store access. Strict `banned_until` handling is intentionally conservative pending live Auth response-contract review.
- `qa/v180-p0w/test_pinned_sources.py`: all outbound operations intercepted by `httpx.MockTransport`; generates **synthetic** RSA/EC private keys to prove cryptographic signature validation over synthetic Access/Supabase JWTs; rejects forged/malformed key sets, bad URLs, redirects, malformed Auth users, banned/anonymous accounts, expired cache, provider outages, token leaks and stale cache success.
- `qa/v180-p0w/protected_deployment_approval_packet.json`: scoped host/path and requested approval steps; explicitly **no approvals granted** to create Access app, deploy Render, create Supabase privileged DB read, ingest Owner JWTs, allocate new receipts/credentials or activate a provider send.
- `.github/workflows/v180-p0w-protected-uat-preflight-nohost.yml`: isolated source CI; compile + static fail-closed gate + P0W/P0V/P0U/P0T synthetic regression. A base branch may not contain `ops/data-platform/app/main.py`, because deployed Render runs from its separate branch; CI handles absence and no live import/mount.

## 3. CI evidence

- [GitHub P0W Actions #44235656095](https://github.com/ngoctien20/demo-git/actions/runs/44235656095) SUCCESS at source HEAD `cf13b769c123f9931023a9f4997fc5c0c8efe50f`; verified job log shows **209 PASSED, 0 FAILED, 1 non-blocking Starlette/AnyIO deprecation warning** and `P0W_STATIC_NO_REAL_OWNER_JWT_NO_HOSTED_ACCESS_MUTATION_PASS`. Earlier two CI preflight checks failed due to static lint assumptions (restricted-key *denial string* and missing deployed source path in the QA branch); both corrected. No runtime changes.
- This tests **actual cryptographic signatures on CI-generated synthetic keys**, **mocked HTTP response behavior**, and **mocked session queries**. It does NOT test real Supabase/Cloudflare credentials, network, account JWTs, owner consent, actual database connection, direct Render negative tests or hosted UAT.

## 4. Specific approval request — staging-only, risk-controlled

This document is a *proposal*, not evidence that approval occurred. The user asking to continue P0W does not authorize all changes below. Each needs a separately explicit scoped approval:

1. Independent security review of an **exact QA-only private path/hostname** and direct-origin threat model; verify no Cloudflare Access Bypass/redirects/unrelated app changes.
2. Create/activate dedicated Cloudflare Access app/policy only after owner approves its exact host/path and allowed QA users; record original Access state for rollback.
3. Authorize reviewed staging-only Render adapter with signed Access JWT issuer/audience from reviewed server-owned config, no direct-origin bypass on the private route, rate limiting, bounded headers/body, fail-closed key retrieval, deny on missing/invalid signature. No general app rewrite.
4. Authorize narrowly privileged **server-only** Auth session SELECT `id,user_id,not_after` by trusted signed `sub+session_id` in `auth.sessions`; no public API, no real customer rows, no service role in frontend/chat/repo. Provision/rotation of restricted DB access separately approved. Current P0V adapter is only an unmounted source candidate.
5. Independent real signed Auth Owner A/B consent (two existing accounts, not newly created), live session correlation and immediately repeated revoked-session checks. Apply one-time durable atomic consent receipts before any actual admission; share only redacted PASS or nonsensitive BLOCKED_REASON, no JWT or private IDs.
6. Authorized independent 31-case no-send/no-write Store A/B negative UAT **only after** Store canonical owner authority and M0 backup/restore have separately passed. Owner identity QA must not be conflated with Store A/B authorization or Messenger/Zalo order reads.

## 5. Operational no-go and rollback

- **Verified:** read-only Render/Cloudflare/Supabase state and separate deployed branch lineage.
- **Implemented:** pinned public JWKS source, strict no-service-key Auth getUser source, security approval packet, mocked end-to-end signature tests and regression CI.
- **Tested:** 209/209 offline synthetic cases at prior source commit; verify final PR HEAD Actions separately.
- **Proposed:** dedicated Access app/policy, explicit direct-origin deny, server-only minimal session grants, private durable receipt store, real A/B UAT.
- **Blocked:** independent consents, second existing Owner live signed session, protected hosted JWT intake, real read-only Auth session verification, official origin negative tests, Store-specific owner authority, 31 real UAT cases.
- **Not changed:** Render deployments, Access policies, Supabase Auth/DDL/DML/roles/keys, n8n Messenger/Zalo, customer data, payment, production or PR merge.
- **Rollback:** revert P0W source-only Draft commits (no runtime rollback required). Any future approved hosted rollout must have baseline Access policy backup and Render deploy rollback, negative bypass QA, and M0 recovery before Store DDL/RLS.

**Decision:** `P0W_OFFLINE_SOURCE_QA_PASS_209_OF_209 / LIVE_OWNER_A_B_NOT_ATTESTED / PROTECTED_ORIGIN_DEPLOY_NOT_APPROVED / STORE_REAL_UAT_NOT_RUN / PRODUCTION_NO_GO`.
