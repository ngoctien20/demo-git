# TIEN404 AI — V17.4P Private Hosted Issuer × Domain Authority × Secret-Managed UAT Admission

Checkpoint 2026-11-17 JST. Status SOURCE IMPLEMENTED / OFFLINE + REAL LOCAL HTTPS CHROMIUM TESTED; REAL PRIVATE CLOUDFLARE HOSTED ISSUER AND MERCHANT DOMAIN OWNER PROOF BLOCKED.

## 1. Actual status and read-only audit
- Original main integration Draft PR #243 was updated in parallel to V17.12 by another workstream. To avoid overwriting or changing its metadata, V17.4P is isolated in branch work/v174p-private-hosted-issuer-owner-gate-20261117, created at parent verified commit a09a54b098c9707461ed1f5e5964be449bdb2aaf.
- Cloudflare account was authenticated and observed one ACTIVE zone ngoctien20.io.vn. It is personal BIO and MUST NOT be represented as the shop-specific merchant domain.
- Two Pages projects found: tien404-ai-git-staging.pages.dev and tien404-ai-staging.pages.dev. The git staging project deploys gh-pages. One existing Access app named tien404-ai-git-staging - Cloudflare Pages scoped to *.tien404-ai-git-staging.pages.dev, self-hosted with one allow policy and 24h session. This proves configuration exists for Pages previews, NOT that a new Worker issuer is secured, and not merchant Store ownership.
- Existing Cloudflare Workers list does not contain a V17.4P issuer. No new Worker, Access application, secret, DO namespace, DNS or CNAME was created or changed. Render has two existing Auth/Data staging services, unchanged.
- Supabase staging metadata SELECT: public.stores=false, public.store_memberships=false, Products/Orders/Customers store_id columns=0, anon-executable SECURITY DEFINER QA RPC count=1. Hosted Store Owner/RLS P0 remains not accepted. This is a risk signal, not evidence of exploitation.
- Website marketer n8n and Messenger/Zalo Published workflows remain unchanged. Meta QA App/Page remains deferred.

## 2. Implemented SOURCE ONLY
- qa/v174p-private-hosted/hosted-issuer.worker.mjs: Workers module candidate. ALWAYS denies unless mode=QA_SYNTHETIC_ONLY, owner proof status UNVERIFIED_QA_ONLY, exact approved HTTPS issuer origin, Access issuer/audience, secret key 32+ bytes and pinned JWKS from private bindings. Independently verifies RS256 Access JWT signatures and exact canonical Base64URL encoding, exp, iat, nbf, kid, issuer and aud. No Access token, signing secret or customer identity returned to browser or GitHub.
- Browser QA client sends only same-origin Access cookies so Cloudflare can authenticate operator, while storing Website app session only in JS memory. Session: HMAC SHA-256, 300 seconds, Access-subject hash and fixed QA Store A / Bot A scope. Browser never selects Tenant/Store/Bot. Only synthetic catalog_read of QA_SKU_001 at 159000 VND/stock 5.
- V174PReplayGuard class is a SQLite Durable Object runtime candidate using state.storage.transaction to atomically claim messages. Without actual DO binding the Worker returns 503 for messages. Source QA uses a MOCK DO, not proof of real Cloudflare storage durability, retention or concurrency.
- No model, provider Send API, Commerce DB/Orders, customer data or tenant privileges. Real owner, domain proof and Store-RLS are explicitly FALSE in responses.
- qa/v174p-private-hosted/release-gates.mjs: operator-only admission matrix, not runtime authorization; mandates host control, dedicated issuer Access app and JWT aud, HMAC key and JWKS rotation, DO, cost consent, actual private hosted UAT and independent merchant domain/Store/RLS proof before real Commerce.

## 3. Evidence and QA
- hosted-issuer.test.mjs: 50 cases using fake RSA Access keys, signed JWT, HMAC and MOCK DO. Tests authentication, spoof, scope, expiry, unknown kid, invalid alg, malicious body, Store B refusal, duplicate/conflict, no-send and missing-secret fail closed.
- release-gates.test.mjs: 16 cases checking independently missing controls, no false owner/domain or Store RLS certification.
- browser-local-worker-simulator.test.mjs: 21 REAL Chromium browser cases using TLS loopback server and an explicitly synthetic Access proxy/cookie. Covers 390x844 mobile UI, multi-turn, same-origin Access cookie, in-memory session, Shop B rejection, create_order refusal, duplicate replay and no external calls. No real cloud deployment, customer or credentials.
- GitHub Actions .github/workflows/v174p-private-hosted-issuer-source-qa.yml runs 50+16 source and 21 local browser checks. External hosted/browser and live release jobs are intentionally SKIPPED.
- QA transparency: earlier test commits had a release-gate unit-test syntax error and a noncanonical Base64URL JWT edge case (textual signature mutation left same decoded bytes). Both were corrected; final code rejects noncanonical encodings and subsequent CI passed. Never count a prior failed run as release proof.
- Exact final branch commit/Actions run must be rechecked after final documentation, then attach URL to Draft PR. No real hosted login or DNS TXT challenge UAT has been run.

## 4. Proposed deployment, gated by owner approval and cost
1. Explicitly approve one new dedicated staging Cloudflare Worker and distinct Cloudflare Access application, its hostname and spending cap. Do not change existing Pages wildcard policy, BIO site, Messenger/Zalo callbacks, or production Worker routes.
2. Confirm a dedicated staging host is controlled by the operator and protected by Access even on workers.dev / preview; public unauthenticated requests must fail at edge and independent Worker JWT verification.
3. Secret manager must hold V174P_SESSION_HMAC_KEY and pinned V174P_ACCESS_JWKS_JSON; no sample/recycled demo secrets and no secret logging. Refresh JWKS on key rotation.
4. Create a SQLite-backed Durable Object bound as V174P_REPLAY_DO; independently test multi-worker atomic claims, replay TTL cleanup, rate limits before external UAT.
5. Perform actual external HTTPS Browser UAT with a designated Cloudflare Access operator: verified signed 300s Website QA session, 3 turns, negative Store B, revoked operator, duplicate and no-send; keep only metadata/redacted screenshots and rollback evidence.
6. Separately prove genuine merchant domain using a one-time DNS TXT or HTTP challenge from the owner-controlled host and check Store owner/membership through trusted hosted DB, then same-Tenant Shop A/B JWT-RLS. This cannot be inferred from the active personal BIO zone or the Pages project.
7. Only after independent acceptance consider read-only Commerce catalog, never cross-channel customer Order lookup without identity challenge. No live AI Sales Core or provider send without a further approved scope.

## 5. Critical security and cost
- Access JWT validation inside Worker does NOT substitute for Cloudflare Access policy on the public URL; workers.dev routes can otherwise be public.
- The signed Website session identifies an Access-authorized QA operator, NOT the real merchant customer. Store A/B production data must never be read using fake registry or a browser claim.
- DO storage retention/pruning, hosted rate limits, JWKS rotation, cost ceiling and Access logout/revocation acceptance are needed before hosted go.
- No provider or billing data was modified. Any new charged resource, secret or critical Access change requires explicit scoped approval.

## 6. Rollback and continuity
- No live Cloudflare/Render/Supabase/n8n mutation; rollback is to close/revert V17.4P child Draft PR only, without touching shared PR #243 or previously working marketing bot.
- Keep previous V17.4 loopback test evidence and earlier V17.3/Central Core work intact. Do not delete or migrate data.
- Next gate: Private Host Approval × Dedicated Access Admission × Secret/DO Binding × One External Browser No-Send Canary. CURRENTLY NO-GO.
