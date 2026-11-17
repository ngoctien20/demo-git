# TIEN404 AI — V17.ZALO-SOURCE-04D checkpoint
## Real Cloudflare Access API audit × Zalo OAuth callback binding compatibility
Date: 2026-11-17 JST
Status: SOURCE-ONLY IMPLEMENTED. REAL OA/ACCESS HOSTED UAT BLOCKED.

Parent: Draft PR #300 exact head 40dbfc6cc287062ee0aaf2c41aba52315fab7797.
Child branch: work/v17-zalo-source04d-real-config-oauth-preflight-nosend-20261117.
No hosted Cloudflare, Supabase, n8n, Messenger or Zalo state changed. No secrets, OAuth code exchange, Zalo sends or Commerce writes.

## VERIFIED READ-ONLY
- Cloudflare: 28 Worker scripts returned; Access applications list yielded 1 existing Pages staging application, destination type public, domain *.tien404-ai-git-staging.pages.dev, INLINE allow policy using specific email selector. Reusable Access policy list is empty, NOT proof that the existing app is unprotected. No dedicated operator Zalo OA Worker Access app found.
- Supabase staging previously found active; same-Tenant Store A/B owner JWT/RLS not proven. No OA grant authenticated or secret stored.
- Official Zalo OAuth guide: https://stc-developers.zdn.vn/docs/v2/official-account/bat-dau/xac-thuc-va-uy-quyen-cho-ung-dung-new
  - QA OA Admin must explicitly approve in Zalo UI, OA callback supplies code+oa_id. Authorization code single use and short-lived. Zalo requires 43-char PKCE verifier.
  - For binding authorization code to verifier, documentation says use state OR a custom param in redirect_uri. This is not permission to disable CSRF. Both must be random, one-time and tied to a server-verified owner session.
- Official Cloudflare Workers Access: https://developers.cloudflare.com/workers/configuration/cloudflare-access/
  - Worker-level destination uses type worker with the real Worker ID, not Pages hostname or all_workers account-wide policy.
  - Actual Access API returns destinations and INLINE policies; email selector is include: [{email:{email:"operator@example.invalid"}}], not fictional allowedActorIds.
  - Access ctx.access applies to directly authenticated Worker requests; Service Bindings and Static Assets may not propagate identity.

## IMPLEMENTED SOURCE ONLY
1. qa/zalo-oa-source-admission/oa-04d-real-access-audit-offline.mjs
  - Read-only strict Cloudflare API-shaped Access audit. Pin exact operator app, Audience, one Worker ID destination, no public/Pages/global preview-only destination, no public path overrides, single allow-email policy exact to approved operator(s), session max one hour.
  - Passing audit NEVER proves Access was enforced externally; any returned result has accessAdmissionProved=false and canDeploy=false.
  - The ACTUAL currently existing Pages staging Access configuration cannot be treated as an OA Worker policy.
2. qa/zalo-oa-source-admission/oa-04d-oauth-binding-offline.mjs
  - Trusted server transaction selects exactly STATE_QUERY or REDIRECT_QUERY_NONCE. The latter requires an echo of private custom callback query key tien404_qa, with 43-char random nonce.
  - Mandatory current owner session / actor / Store / Tenant / App binding, short TTL, exact HTTPS origin and path, no duplicate/unknown callback parameters, atomic one-time consumption.
  - Both modes forbid OAuth code exchange or trusting claimed oa_id until real private OA profile readback; returning candidate is not real Zalo proof.
3. Two synthetic adversarial test suites + dedicated inherited CI and zero-outbound/zero-Commerce guard.
4. Existing PR #300 and every Published Messenger/Zalo/n8n workflow untouched.

## PRACTICAL PRIVATE MERCHANT OA CONSENT (NOT YET EXECUTED)
1. The actual QA OA administrator logs into Zalo Developers and verifies a dedicated staging App and callback (never a Messenger/Zalo production callback). Select least privilege for OA identity and permitted webhook events; no sending or shop/order modifications.
2. OA Admin consents directly using Zalo's official UI; the short-lived OAuth code goes only to a dedicated HTTPS callback and secure backend, NEVER to GitHub, ChatGPT, screenshots or logs.
3. A separate backend (requiring explicit owner and operator authorization) exchanges code once using a managed-secret provider, reads OA profile using the provider's official read-only endpoint and compares App/OA/Store ownership.
4. Callback must carry the pre-registered state OR provider-preserved custom redirect nonce. If neither echoes, STOP: no insecure fallback.
5. Authenticated Owner and independent operator approve exact OA, Store/Tenant, scope, timebox, no sends/orders/stock/billing, kill switch. Do not accept screenshots, links, uploaded files, guessed OA IDs or self-attestation as provider proof.

## SAFE CLOUDFLARE DEPLOYMENT ORDER (NOT AUTHORIZED OR PERFORMED)
1. To obtain a new Worker ID for a dedicated Access app, first create or inspect an INACTIVE Worker with no public domain/route/preview. Confirm network exposure is disabled; do not make a Worker publicly callable before Access applies.
2. With separate explicit permission, create a dedicated Worker-level Access application for THAT Worker ID, exact operator allow-email and short-lived sessions. Do not change or reuse Pages staging Access app or enable an all_workers policy.
3. Independent external checks must observe an anonymous denial, unauthorized identity denial and approved operator identity through ctx.access.getIdentity(). Validate every enabled hostname/route/preview before any OA traffic.
4. The operator-only Access Worker exposes at most an inert status endpoint. Never put Zalo provider webhook behind human login Access. Its separate provider gateway needs native MAC over ORIGINAL raw bytes, trusted App/OA registry, durable replay/rate limits and no-send flags.
5. The hosted canary remains prohibited until OA admin consent, vault, provider callback proof, real same-Tenant Store A/B JWT/RLS, independent approval, cost ceiling and rollback are verified.

## RELEASE DECISION
- VERIFIED: Cloudflare Pages app, no dedicated Access app, parent PR SHA, official Zalo and Cloudflare documentation.
- IMPLEMENTED: source-only Access API parser and callback CSRF modes.
- TESTED: claim only after exact HEAD GitHub Actions are green.
- BLOCKED: real OA Admin, Access Worker, real OAuth grant, Store RLS and signed provider no-send UAT.
- ROLLBACK: close child Draft PR; no hosted resource modifications to revert.

Security rule: **A synthetically signed OAuth/webhook fixture cannot authorize a real Zalo OA.**
