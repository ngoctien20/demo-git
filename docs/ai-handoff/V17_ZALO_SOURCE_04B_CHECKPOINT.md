# TIEN404 AI — V17.ZALO-SOURCE-04B checkpoint
## Private OA Owner Authorization × Access-Protected No-Send Canary
Date: 2026-11-17 JST
Status: IMPLEMENTED SOURCE-ONLY / NO LIVE PROVIDER UAT / NO HOSTED DEPLOYMENT

Parent SOURCE-04: Draft PR #296 exact HEAD 23e34f5a11096c36b30d6d22d59fafe146353e26.
Branch: work/v17-zalo-source04b-owner-access-nosend-20261117.
No merge, production workflow edits, Supabase writes, Cloudflare Access policy changes, secrets, OAuth exchange, provider sends, Commerce writes, model calls, billable calls or public deployments.

## Direct verification before implementation
- GitHub parent #296 OPEN DRAFT at expected pinned SHA and 146/146 source tests successful.
- Supabase staging ifxlvrhyjhbzbrkdsida ACTIVE_HEALTHY; public core tables have RLS, but catalog queries across non-system PG schemas show no stores, store_memberships, oa_installations or other tables with name containing store. Real same-Tenant Store A/B owner JWT/RLS evidence BLOCKED.
- Connected Cloudflare account lists 28 Worker scripts; Access API lists only one self-hosted application for Pages staging, not a dedicated Zalo QA Worker; 0 reusable Access policies. No Access-protected OA Worker is established. Existing Workers were not modified.
- Official Cloudflare Worker Access guide (updated November 2026): https://developers.cloudflare.com/workers/configuration/cloudflare-access/
  * Protect a Worker across every hostname, not just one route; ctx.access only exists on authenticated direct Worker requests.
  * Service Bindings and Static Assets do not propagate ctx.access consistently.
  * No Access bypass policies for protected operator canary.
- Official Zalo OA webhook: https://stc-developers.zdn.vn/docs/v2/official-account/webhook/tin-nhan/su-kien-nguoi-dung-gui-tin-nhan
  * Zalo provider POSTs with X-ZEvent-Signature; it does not participate in a browser Cloudflare Access login. Therefore do NOT put provider callback behind operator Access.

## Actual source-only files
1. qa/zalo-oa-source-admission/oa-private-owner-04b-offline.mjs
   - Strict injected operator Access actor, fresh Supabase-style owner session, different owner and operator actor, server re-authorization of Tenant/Store ownership, privately issued one-use merchant OA admin consent handle, one-use independent operator approval, full binding digest, TTL, zero sends/Orders/stock/billable calls/deploy.
   - Injected atomic one-shot reservation and no-go response. Can NEVER accept a client checkbox as authenticated proof. All private dependencies synthetic in tests. No real Supabase or Cloudflare integration and no real private evidence custody.
2. qa/zalo-oa-source-admission/oa-private-access-worker-04b.mjs
   - Proposed SOURCE template for an OPERATOR-ONLY Worker. Without exact trusted ctx.access audience and explicit kill-switch configuration, return 403. POST approval ALWAYS 423. GET /private/oa-canary/status indicates Access-present but provider ownership false and no send. /oauth/* and /webhook/* always 404.
   - No outgoing fetch, token exchange, credential reads, provider callbacks, storage or business side effects. NOT DEPLOYED. No Worker-specific Access app yet.
3. qa/zalo-oa-source-admission/oa-private-owner-04b-offline.test.mjs
   - Synthetic Store B and Tenant ownership denial, forge/collusion/expired consent/unauthorized operator/replay/kill-switch/header spoof/nonmatching Access audience and no-send invariants; no PII fixture or customer data.
4. .github/workflows/v17-zalo-source04b-private-owner-nosend.yml
   - Full inherited OA unit tests and local Worker Access source checks, no outbound guard.

## Threat model and negative gates
- Malicious actor impersonates a merchant and submits a link/file claiming OA ownership: PRIVATE EVIDENCE INTAKE ACCEPTS HANDLES ONLY, NOT URLS/FILES. No fetching or parsing arbitrary uploaded content. Merchant must authenticate via independently checked Supabase Auth, then the operator checks real Zalo OA admin consent via OAuth/app/provider in a private single-shot later.
- Self-approved operator: DENY.
- Session revoked or token stale: DENY.
- Store A owner claims Store B OA, even same Tenant: DENY.
- Callback OA ID, app ID, code or client-supplied JWT without backend verification: NEVER PROOF.
- Missing Access protection or mismatched audience: DENY; never trust raw CF-Access-Jwt-Assertion user header.
- Zalo signed webhook is NOT routed into Access-protected operator Worker. Dedicated externally reachable ingress must verify native provider signature over original raw bytes, strict APP/OA server-installed binding, atomic durable replay + limits + response ACK; that separate ingress and hosted secrets are NOT implemented.
- Any request to activate/send/Order/Stock/write/approve production always denied in SOURCE04B.

## Private real OA UAT protocol (BLOCKED until separate owner/operator authorization)
1. Owner chooses an authorized QA OA and exact TIEN404 Store, signs in via REAL Supabase Auth; verify a current session and Store Ownership independently. Record consent in a privately managed access-restricted evidence system; handles only in logs.
2. Independent TIEN404 operator authorizes exact App ID/OA ID/Store/TTL/scopes, costs and NO SEND. Both actor identities must differ; approvals cannot be simulated.
3. Enable Cloudflare Access for a dedicated operator Worker before deployment, with scoped allowed operator(s), expected AUD, access-deny tests and no bypass. Confirm a public unauthenticated request gets Access challenge/403 before any private endpoint. ctx.access is defense-in-depth.
4. For Zalo OAuth: separate HTTPS callback with verified owner session/state binding, real PKCE and private one-time exchange; verify OA ID via /oa/getoa and verified OA admin consent. Token custody in managed vault, refresh lock/lease and recoverable rotation. Do not insert token in GitHub, n8n pin data, comments or logs.
5. For real Zalo webhook: separate dedicated ingress (not operator worker) with raw-body signature verification, verified App/OA ownership, durable replay, rate limits, bounded size/timeout and non-sensitive ACK. Only customer-authorized QA owner test messages; never send any outbound customer message.
6. Independently validate authenticated same-Tenant Store A/B JWT / FORCE RLS, invalid signature, spoof Store, replay, linked OA conflict. Evidence: application deployment SHA, immutable workflow version, redacted audit digest, original provider receipt externally observed, zero sends/Orders/stock writes and rollback readiness.
7. No promotion to Commerce Core or public Zalo integration until another explicitly approved release gate.

## Owner authorization and cost/deployment gates
- BLOCKED: no real owner OA proof, no same-Tenant store schema/RLS, no dedicated Access app, no managed token vault, no signed webhook canary, no independent cost and deployment authorization.
- Before hosted deployment, inspect Access app/policy names and verify least privilege; build/Access changes require explicit user approval. Before any paid resource creation, request separate price/cost approval.
- Source-only PR is safe to review. Commit SHA and CI job must be checked at exact final HEAD before claiming tests pass.

## Rollback
Close child Draft PR or reset child branch to #296 pinned HEAD. No external service changes, therefore no Cloudflare/n8n/Supabase data rollback required.
