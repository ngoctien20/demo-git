# TIEN404 AI — V17.7A Zalo OA OpenAPI offline acceptance
2026-11-17 JST | status: SOURCE-ONLY CANDIDATE | LIVE OA HOSTED UAT NOT PERFORMED

## Purpose and isolation

User currently does not have a verified enterprise Zalo OA. Build and QA the provider-independent contract now, with no OAuth grant/token, no live provider API invocation, no send, no real merchant/customer data and no Commerce writes. When the owner later obtains OA authorization, use a separately approved private callback and staging worker for the real no-send acceptance; do NOT reuse the published Zalo Bot ingress or Messenger demo credentials.

This independent V17.7A branch is based on main and does not merge or modify V17.ZALO-SOURCE-04E Draft PR #309, published n8n workflows, Supabase tables or Cloudflare Workers. The older OA source PR stack (#300/#305/#309) remains Draft.

## Verified official API contract sources

- GET https://openapi.zalo.me/v2.0/oa/getoa ; request header access_token ; permission to manage OA information required.
  https://stc-developers.zdn.vn/docs/v2/official-account/quan-ly/quan-ly-thong-tin-oa/lay-thong-tin-zalo-official-account
- POST https://oauth.zaloapp.com/v4/oa/access_token ; header secret_key; application/x-www-form-urlencoded; authorization_code with PKCE code_verifier or refresh_token grant. Auth code 10m/once; access token 25h; refresh token 3 months / once; old access token invalidated on successful refresh. State or provider-confirmed custom redirect nonce mandatory.
  https://stc-developers.zdn.vn/docs/v2/official-account/bat-dau/xac-thuc-va-uy-quyen-cho-ung-dung-new
- POST https://openapi.zalo.me/v3.0/oa/message/cs ; SEND API, NO-SEND contract only. No HTTP invocation or access token.
  https://stc-developers.zdn.vn/docs/v2/official-account/tin-nhan/tin-tu-van/gui-tin-tu-van-trich-dan
- OA webhook X-ZEvent-Signature: mac=sha256(appId + raw JSON data string + timestamp + OA secret key). Event user_send_text is POST JSON, recipient.id identifies OA; message.msg_id for replay. OA native signature shape and raw-byte preservation need real provider proof later.
  https://stc-developers.zdn.vn/docs/v2/official-account/webhook/tin-nhan/su-kien-nguoi-dung-gui-tin-nhan
- Common error codes: -223 permission not granted, -124 invalid token, -240 legacy message V2 disabled. Do not retry unauthorized events blindly.
  https://stc-developers.zdn.vn/docs/v2/official-account/phu-luc/ma-loi
- Rate limit headers X-RateLimit-Limit / X-RateLimit-Remain need separate production telemetry once actual granted scope is available.
  https://stc-developers.zdn.vn/docs/v2/official-account/phu-luc/gioi-han-toc-do-api

## Implemented files and boundaries

- qa/v17-7a-oa-independent/offline-channel-gate.mjs (existing source-only V17.7A in-progress from current session): Zalo Bot, Messenger and Website synthetic trusted channel contract. No Zalo OA fallback or Shop authority sourced from client.
- qa/v17-7a-oa-independent/zalo-oa-openapi-offline.mjs: exact documented endpoint descriptors; GET_OA synthetic data contract; denied CS send, OAuth code/refresh dry-run metadata, fail-closed error inspection, token rotation version-CAS requirements without secrets.
- qa/v17-7a-oa-independent/zalo-oa-webhook-offline.mjs: mock-only signature over raw Buffer (not replayed JSON stringify), X-ZEvent-Signature header shape, strict App ID/OA ID/msg_id, timestamp window, replay reservation, no message content/output leaks. Synthetic fixture secret must begin QA_ONLY_; NEVER use for actual webhook ingress, do not claim native Zalo acceptance.
- Individual Node test suites for all modules; GitHub Actions syntax checks, full offline suite, static no fetch/HTTP/provider send/Commerce write gate. CI results to be recorded only after exact final HEAD success.

## Required later owner-supplied data (through private secure flow only)

1. Legitimate Zalo OA owner/administrator consents using official Zalo UI to a dedicated TIEN404 QA App with minimum permission to read OA profile and receive webhook. If only renting an OA for one month, written provider authorization and legitimate OA owner direct OAuth grant are essential. Never buy/share raw credentials.
2. Provider-issued App ID and OA ID cross-check through authenticated GET_OA. Authorization code and PKCE verifier must stay in secret-managed private callback; never paste tokens, callback code or secrets into ChatGPT/GitHub.
3. Dedicated privately gated staging ingress + OA secret in managed secrets, native exact raw-body signature, durable replay/DoS guard. NO-SEND and no Commerce writes.
4. Independently authenticated merchant/operator and real Supabase Auth JWT + same-Tenant Store A/B RLS acceptance, with customer and merchant data access only after approval. Source-only synthetic Store keys are not real permission evidence.
5. QA evidence needed: successful read-only getoa; unauthorized/mismatched OA denied; real native signed user_send_text no-send; duplicate/malformed/wrong OA rejected; token refresh once/CAS proven; Cloudflare Access external anonymous deny; revoke OA authorization and verify token invalidation; cost and rollback proof.
6. Only a separate explicit approval may ever allow one-shot real message sending or Commerce writes; this source phase does not request it.

## Verified n8n observations from V17.7A preparation (read-only/manual QA)

- Zalo Bot V1 yIJk8LvJoLF40Z62 active, HTTP POST with X-Bot-Api-Secret-Token; distinct from Zalo OA OpenAPI.
- Messenger TEST Z7FdV7uDvApfbURQ active, includes Meta signature verification and send node. Do not execute production send as part of this QA.
- Zalo Website shared Core shadow 4ycmVzaNzVRulBjQ active and no-send.
- Manual staging results: V17.1P simulated Store reader exec 5018, 208/208 synthetic PASS, 0 hosted DB reads/sends/writes, HOSTED_NO_GO; unified channel exec 5020 26/26 synthetic PASS, 0 provider sends/orders; G06 exec 5021 36/36 PASS 0 sends/writes; Commerce catalog price inventory exec 5022 24/24 PASS 0 sends/orders. These are n8n workflow QA, NOT Zalo OA provider API UAT.

## Release decision

- VERIFIED: endpoint and auth/signature documentation; current staging workflow structure.
- IMPLEMENTED: source-only OpenAPI compatibility modules + unit tests + CI.
- TESTED: only after exact-head GitHub Actions show success.
- BLOCKED: actual OA owner grant, provider GET_OA, native signed real webhook, token vault hosted refresh, same-Tenant Store A/B JWT/RLS, actual external Access UAT.
- ROLLBACK: close this Draft PR; no deployed cloud/n8n/Supabase state to revert. Keep all legacy active functionality unchanged.
