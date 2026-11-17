# TIEN404 V17.4P — Private Hosted Website Issuer × Owner/Domain Evidence

Checkpoint 2026-11-17 JST. SOURCE QA TESTED. NO new Cloudflare Worker, new Access application, key/secret, Durable Object, DNS or external hosted Browser UAT deployed.

## Verified by private Cloudflare/Render/Supabase connector (READ ONLY)
- Active Cloudflare zone ngoctien20.io.vn exists in authenticated account. This belongs to the personal BIO site and is NOT a Shop A/B merchant-domain proof.
- Pages projects tien404-ai-git-staging.pages.dev and tien404-ai-staging.pages.dev exist. The first project is GitHub gh-pages backed.
- Cloudflare Access application tien404-ai-git-staging - Cloudflare Pages is a self-hosted app scoped to *.tien404-ai-git-staging.pages.dev with one allow policy, 24-hour session. It has NOT been demonstrated to secure any proposed V17.4P Worker. Do not modify it.
- Existing Render staging consists of Auth static site and Data staging Python API. There is NO issuer V17.4P.
- Supabase staging project ifxlvrhyjhbzbrkdsida has no public.stores, public.store_memberships or core Products/Orders/Customers store_id columns; one anon-executable SECURITY DEFINER QA RPC still requires separate P0 review. NO merchant Store ownership or hosted per-Store JWT-RLS acceptance.
- PR #243 is a concurrent V17.12 workstream. V17.4P was branched separately from commit a09a54b098c9707461ed1f5e5964be449bdb2aaf to avoid overwriting its work.

## Implemented (NOT DEPLOYED)
- hosted-issuer.worker.mjs is a Cloudflare Workers source candidate. Always requires mode QA_SYNTHETIC_ONLY and owner proof status UNVERIFIED_QA_ONLY.
- Cloudflare Access Cf-Access-Jwt-Assertion JWT RS256 validated independently with a private/pinned JWKS and checks for exact audience, issuer, validity, kid and signature canonical Base64URL.
- HMAC secret bound only on server, mint a 300-second signed QA-only Website token scoped to Access subject, Shop A Website installation and Bot A; public browser never receives App Secret or real customer authority. Same-origin Cloudflare Access cookies can be sent to Cloudflare; app token stays only in JS memory.
- catalog_read only; never provider send, LLM call, Commerce read/write or real customer identity. Fake price 159000 VND and fake stock 5.
- DO binding V174P_REPLAY_DO mandatory before processing messages; exported V174PReplayGuard uses state.storage.transaction to atomically claim event ID, duplicates do no action and changed payload replay is denied. No deployed DO proof; local tests use simulated state.
- release-gates.mjs is an OPERATOR evidence checklist only, not a public authorization API. It distinguishes hosting control, issuer Access/app, secret/key rotation, durable replay, rate limit, real hosted UAT, DNS challenge, Store owner proof and hosted RLS.

## Automated tests and limitations
- hosted-issuer.test.mjs: 50 QA source cases, fake RSA Access JWT + HMAC signing and fake DO. No real JWT or secret.
- release-gates.test.mjs: 16 independent operator release gates.
- browser-local-worker-simulator.test.mjs: 21 Chromium tests on actual 127.0.0.1 self-signed HTTPS, with a synthetic Access edge proxy and QA-only cookie. Browser viewport 390x844; session re-use, no sends, no localStorage, Store B denial, write tool rejection, duplicate and Access cookie removal. This is REAL LOCAL BROWSER UAT, NOT EXTERNAL HOSTED UAT.
- GitHub workflow v174p-private-hosted-issuer-source-qa.yml executes these tests. The hosted UAT and live release jobs are intentionally SKIPPED. Verify the final exact HEAD before claiming all green.

## Operator approval needed before any actual deployment
1. Approve creation of one new isolated Cloudflare Worker plus a distinct Access app restricted to authorized QA operators, confirm no cost outside approved budget. Do NOT reconfigure existing Pages/production access.
2. Choose a dedicated issuer URL under the owned staging account. workers.dev URL must be protected with Access before enabling; existing Pages wildcard protection does not implicitly protect that URL.
3. Configure approved secret bindings V174P_SESSION_HMAC_KEY and V174P_ACCESS_JWKS_JSON via Cloudflare secret management, verify JWKS key rotation plan, never put secrets in GitHub source or browser.
4. Configure issuer origin, Access issuer/audience, and QA mode as described in deployment-admission.example.json. No merchant Shop authorization is inferred.
5. Provision the SQLite-backed Durable Object V174P_REPLAY_DO; independently test concurrency, TTL cleanup, rate limits and alerting; no Store database bindings.
6. Perform bounded external HTTPS Browser UAT with a dedicated Access operator and fake catalog; verify first unauthenticated request blocked upstream, session signed, multi-turn, revoked operator, wrong Store, duplicate, zero sends/writes/paid calls, rollback.
7. For commercial release, separately attest real merchant domain through DNS TXT challenge and Store Owner membership using a trusted control plane; hosted Store A/B RLS and customer challenge must pass. No real orders before then.

Documentation:
Cloudflare Access https://developers.cloudflare.com/workers/configuration/cloudflare-access/
JWT validation https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/
Worker secrets https://developers.cloudflare.com/workers/configuration/secrets/
Workers.dev routing https://developers.cloudflare.com/workers/configuration/routing/workers-dev/
Durable Objects pricing https://developers.cloudflare.com/durable-objects/platform/pricing/

Rollback: close/revert this V17.4P Draft only. No hosted resource was touched. If separately authorized future hosted resources exist, disable private issuer route and Access safely before secret revocation; do not destroy DO data without approval.
