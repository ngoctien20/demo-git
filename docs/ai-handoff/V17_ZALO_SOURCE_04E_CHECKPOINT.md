# TIEN404 — V17.ZALO-SOURCE-04E checkpoint
## Private Real OA Owner Proof × Isolated Inactive Worker Authorization × External Access Denial UAT
Date: 2026-11-17 JST
Status: IMPLEMENTED SOURCE-ONLY, LIVE PROVIDER AND HOSTED ACCESS STILL BLOCKED.

Parent: Draft PR #305 at 112ee34b4b7c44e5f39b152700ce7831f4748e5a.
Child: work/v17-zalo-source04e-real-owner-inactive-access-uat-gates-20261117.
No existing PR merged, no production n8n edit, no Cloudflare write, no worker uploaded, no Access policy changed, no Supabase DDL or customer data read, no OA OAuth, no provider sends, no paid services.

### Read-only verified infrastructure findings

- GitHub parent #305 OPEN DRAFT; SOURCE-04D had 290/290 synthetic tests at exact checkpoint.
- Cloudflare account: 28 Worker scripts. Exactly ONE Access application exists, targeting public Pages staging at *.tien404-ai-git-staging.pages.dev with an INLINE email-allow policy. Zero reusable policies reported; do not misinterpret zero reusable as absence of all policies.
- Cloudflare worker domains API: one existing custom Worker domain for personal Bio site, not QA. No dedicated OA Worker-level Access application verified.
- Supabase staging ifxlvrhyjhbzbrkdsida is ACTIVE_HEALTHY.
  - Private QA schema tien404_r1_qa has tenant_identity_map, owner_bindings, shop_bots and related tenant/store keyed fixtures, and tien404_v175_qa has auth_customer_binding and channel_identity. These are real tables and some have RLS; previous statements implying there was no Store-related structure at all were overbroad.
  - Read-only aggregates: tenant_identity_map has two rows, two distinct tenant keys and two distinct store keys. Owner_bindings also has two rows, two distinct tenants and two distinct store keys. A per-Tenant grouping returned max distinct Store keys per Tenant = 1. Therefore NOT a same-Tenant Store A/B fixture.
  - No real Owner A/B session token evidence or provider OA ownership was inspected; no customer IDs, actual messages, tokens or order rows were queried.
- Zalo OAuth authoritative documentation: https://stc-developers.zdn.vn/docs/v2/official-account/bat-dau/xac-thuc-va-uy-quyen-cho-ung-dung-new
  - 43-character verifier; one-time authorization code; bind code to verifier using returned state or a custom approved redirect_uri parameter, NEVER drop anti-CSRF.
- Cloudflare Worker Access: https://developers.cloudflare.com/workers/configuration/cloudflare-access/
  - Worker-level destination (type worker) protects production+preview routes for one selected Worker; do not use all_workers, preview_worker-only or Pages application in this OA QA.
- Cloudflare workers.dev and preview URL behavior:
  https://developers.cloudflare.com/workers/configuration/routing/workers-dev/
  https://developers.cloudflare.com/changelog/post/2025-09-17-update-preview-url-setting/

### Source-only implementation

1. qa/zalo-oa-source-admission/oa-04e-inactive-access-denial-offline.mjs:
   - Read-only inventory preflight: expected specific isolated Worker script and provider Worker ID, workers.dev disabled, preview URLs disabled, no active deployments/triggers, no matching public routes/domains; exactly one strictly pinned Worker-level Access application using SOURCE-04D policy checker. Every accepted shape still denies actual deployment/traffic and requires hosted proof.
   - External UAT receipt preflight for anonymous challenge (302/303 redirect to exact pinned team.cloudflareaccess.com), unrelated operator denied at edge, approved operator allowed only to SOURCE-04B no-send status, OAuth/webhook routes 404 and approval POST 423. Unique correlation IDs, receipt freshness within five minutes. Never mistake an application-generated 403 for an Access edge denial.
   - All synthetic probe pass responses remain edgeAccessProved=false, realOwnerProved=false, canDeploy=false, canSend=false, canWriteOrders=false.
   - A fixed ownerAndCostReleaseGate ignores self-reported booleans and keeps real owner, Access deployment and cost authorization blocked.
2. qa/zalo-oa-source-admission/oa-04e-inactive-access-denial-offline.test.mjs: negative cases for public routes, preview leakage, missing Access, broad policies, wrong Worker ID, anonymous 200, spoof login redirect, unauthorized operator, accidental sends or provider routes, stale/duplicate evidence, self-claimed OA admin proof.
3. Dedicated CI: .github/workflows/v17-zalo-source04e-inactive-access-nosend.yml; full inherited QA and static no-network/no-provider/no-Commerce guard.

These pure Node modules NEVER call a remote host and NEVER independently certify live Cloudflare Access enforcement. They are preflight guards only.

### Private real OA owner authorization — manual evidence required

Owner: a human who holds legitimate admin rights on a QA-only Zalo Official Account.
- Sign into the official Zalo Developers portal and approve one dedicated staging Zalo App with exact OA, intended Store and callback URI.
- An authenticated, independent backend verifies a short-lived one-use OAuth code, nonce/state, PKCE and read-only OA profile via official Zalo endpoint. Token vault must be managed and private; no code/secret/access/refresh token in ChatGPT, GitHub, screenshots, browser localStorage, n8n pinned data or CI logs.
- Check the real Supabase Auth Owner session against independently managed Store authority. The current QA mapping has two different Tenants and cannot prove same-Tenant Store A/B isolation. Build a disposable same-Tenant fixture only after separate DB migration/owner authorization, preserving existing QA rows.
- Independent TIEN404 operator (not the same actor as the merchant) records private approval: target OA/App/Store, one-shot scope, session freshness, no customer send, no Orders/Stock writes, explicit cost ceiling and rollback. Do not accept self-assertion, external URLs, uploaded executable files, email screenshots or guessed OA ID as authoritative proof.

### Isolated Cloudflare worker authorization sequence — NOT EXECUTED

1. Obtain separate explicit owner/Operator approval for a dedicated QA-only inactive Worker and the Access application; confirm cost (including request/storage usage). Do not create or mutate Cloudflare resources without this authorization.
2. Inspect script name collision and selected account. If adding script to obtain a Worker ID, ensure it cannot serve public traffic: workers.dev disabled, preview disabled, no routes/custom domains/cron, no active deployment; if provider cannot guarantee no exposure, abort creation.
3. Create and read back dedicated per-Worker Access app with exact worker ID destination, narrow explicit email operator allowlist, short session, NO bypass and no Everyone/email domain or all-workers policy. Do not alter existing Pages staging policy or unrelated scripts.
4. Only after proving Access protects every enabled Worker hostname, deploy a strictly inert status-only Worker with a kill-switch off. Do not expose provider webhook or OAuth callback in this operator application.
5. External independent browser/UAT session tests:
   - Anonymous GET status: Access login challenge at exact pinned team domain, Worker handler not invoked.
   - Unauthorized authenticated user: denied by Access at edge, handler not invoked.
   - Authorized operator: only inert status GET 200 with ctx.access audience, no-send flags. No secrets or customer identifiers in body.
   - Authorized GET /oauth/* and POST /webhook/*: 404, no callback or provider ingress.
   - Authorized POST /private/oa-canary/approve: 423, canActivate false.
   - All probes carry unique QA correlation IDs and timebox; verify worker invocation counters/Access audit from independent evidence. 403 from the Worker is insufficient proof Access blocked at edge.
6. Keep real Zalo webhook separate from operator-only Access application. Public provider ingress eventually requires authentic native MAC over raw event bytes, private OA installation registry, durable replay/rate limiting, and zero sends/Commerce writes until a later approved release.

### Outcome and rollback
- VERIFIED: real Access inventory and QA schema metadata/aggregate; official provider docs.
- IMPLEMENTED: new SOURCE-04E source-only preflight modules, tests and checkpoint.
- TESTED: only after exact final PR head CI reports SUCCESS, no live host tested.
- BLOCKED: real OA admin grant, same-Tenant Store A/B JWT, independent approval, Cloudflare Access Worker application, script upload, external browser Access denial, signed live provider canary.
- Rollback: close child Draft PR. No hosted changes to reverse.

THIS CHECKPOINT IS NOT PERMISSION TO CREATE A WORKER OR SEND A PROVIDER MESSAGE.
