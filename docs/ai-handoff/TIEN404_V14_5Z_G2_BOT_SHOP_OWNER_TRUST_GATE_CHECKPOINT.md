# TIEN404 AI — V14.5Z-G2 Trusted Zalo Bot Identity × Shop B Owner Certification
**Checkpoint date:** 2026-11-16 JST
**Mode:** READ-ONLY LIVE PROVIDER PREFLIGHT + OFFLINE SIGNED SECURITY QA
**Environment:** existing Zalo Bot staging, no real outbound.
**Branch:** `work/v145z-live01-limited-uat-gate` — PR #103 DRAFT
**Final G2 decision:** BLOCKED (no real identity + owner certification)

## 1. Previous acceptance
- User G1 synthetic Shop A/B acceptance: 8/8 PASS, file `TIEN404_UAT01_NGHIEM_THU.json` self-reported locally, previously independently backed by UAT hosted HTTP 12/12 and CI 316/316; not real Bot/Commerce acceptance.
- Never modify working AI_SALES_DEMO Products/Orders/credentials or use them as real Commerce tenant data.
- No credential, Published webhook, production, payment, real Orders, or outbound Zalo changes authorized by G2.

## 2. Real provider and n8n live read-only evidence (2026-11-16 JST)
1. Original inactive manual Bot identity workflow **`xayBLEyUwd64mcLK`**, version `6bf96508-60f6-480a-a5c4-aa8012992a43`, executed without modification:
   - execution **3869 SUCCESS**, HTTP 200, `bot_token_valid:true`, `provider_sends:0`, `orders_written:0`, `bot_shop_binding_verified:false`, `owner_recipient_binding_verified:false`, `live_uat_ready:false`.
   - Existing protected Cloudflare Worker `tien404-zalo-outbound-v1-staging` calls official Zalo `POST /bot<TOKEN>/getMe` internally, but **intentionally returns only the boolean**, not `result.id`. Cloudflare code inspection confirms no `result.id` processing in that sanitized route.
2. Original inactive manual WebhookInfo workflow **`bD510xyr5jBHQ99K`**, version `c45a3f84-06a3-4ddf-af99-a2c244eb2153`, executed read-only:
   - execution **3870 SUCCESS**, `has_webhook:true`, `matches_staging_webhook:true`, `matches_test_webhook:false`.
   - Webhook host `ngoctien20.app.n8n.cloud`; webhook path `/webhook/tien404-zalo-bot-lab-v1`; external sends **0**, configuration changes **0**.
3. n8n registry QA Data Table `qLf19z9QjEaIHk00`: **2 synthetic** `zalo_bot_fixture / synthetic_qa / dry_run` records. This is NOT trusted production Bot-to-Shop mapping, even if tenant/store fields are populated.
4. Owner allowlist QA Data Table `dRPj5k0t51hihJUW`: 1 `ALLOWED_STAGING_OWNER`, expires at **2026-11-20 13:17:32.511 UTC = 22:17:32.511 JST**. Chat ID intentionally not recorded in this file. An allowlist row alone cannot prove Zalo Bot Manager ownership or authorized Store membership.
5. Active Published Zalo ingress `yIJk8LvJoLF40Z62`, version `8ca4a6f6-ab3f-42f1-8637-d4f5db790a3e`, still hard-codes `trusted_bot_id:'b'`, `trusted_route_ref:'route-b'`, `trusted_binding_scope:'SINGLE_STAGING_WEBHOOK_TO_SYNTHETIC_SHOP_B'`; no change. Thus G2 cannot treat ingress's Shop B binding as real.
6. Cloudflare Worker `tien404-zalo-outbound-v1-staging` still has `ZALO_SEND_ENABLED=false`. No secret values inspected or exported. G2 read-only calls made **0 provider sends** and **0 webhook changes**.
7. Zalo official docs: [getMe](https://docs.zaloplatforms.com/docs/BOT/apis/getMe) responds to a **POST** with `ok:true` and `result.id` as an immutable **string**. This JSON is not documented as a signed identity certificate. [getWebhookInfo](https://docs.zaloplatforms.com/docs/BOT/apis/getWebhookInfo) verifies the URL but not Store/Owner.

## 3. Implemented / QA tested G2 code on Draft PR only
- Source `qa/zalo-live-v145z/g2-trusted-bot-shop-owner-gate.cjs` reuses the existing V14.5Z LIVE03 ECDSA-P256 trust verifier. This new code is **not deployed to the live credential-bound Worker**.
- Gate requires 4 independent, pinned public signing keys `provider / registry / owner / hosted`, four valid signed payloads, matching 64-hex Bot/Tenant/Store/Owner digests, shared time-limited challenge nonce, *trusted backend-pinned Shop B/Tenant*, exact official getMe attestation, one real server-resolved mapping, independently verified Owner chat/consent and valid allowlist, hardened real ingress and durable atomic nonce consumption.
- Client can never provide or override trusted signing keys, expected tenant/store, or durable single-use nonce store; if any are unavailable, fail closed.
- Even the complete **synthetic positive fixture** returns `ELIGIBLE_FOR_PRIVATE_OWNER_REVIEW_ONLY`, **not** a signed real ownership certificate, not a registry promotion, **never `can_send:true`**. Any actual owner certification must separately review provider evidence provenance and credential boundary.
- `qa/zalo-live-v145z/g2-trusted-bot-shop-owner-gate.test.cjs`: **45/45 offline tests PASS** including invalid issuer/signature, duplicate trust roots, missing provider proof, replay, cross-tenant/shop, owner expired, synthetic registry, untrusted webhook binding, and attempted send/credential promotion.
- GitHub CI after addition **361/361** (316 inherited + 45 G2), run [43753063959](https://github.com/ngoctien20/demo-git/actions/runs/43753063959) SUCCESS.
- There are **zero actual pinned provider/registry/owner/hosted signer roots configured**. All signing keys in tests are generated in ephemeral test process with synthetic data, not real Bot/Owner credentials.

## 4. G2 subgates — evidence and acceptance
| Gate | Criteria | Current result |
| --- | --- | --- |
| G2.0 provider token valid + expected staging webhook | Official read-only `getMe` token validity and `getWebhookInfo` read-only; zero sends | **VERIFIED** (3869, 3870) |
| G2.1 official Bot ID provenance | Authenticated server-side `getMe.result.id` as string; signed privacy-protecting digest; no raw Bot ID or token in public logs/UI | **BLOCKED** |
| G2.2 genuine Bot→Tenant→Shop B server mapping | One unique real Bot ID mapping with server-controlled tenant/store scope and no synthetic registry promotion | **BLOCKED** |
| G2.3 QA Owner proof and consent | Independently validate Owner Zalo account control **and** merchant authority/consent; allowlist not expired; no raw Chat ID public | **BLOCKED** |
| G2.4 real ingress trust | Cryptographically/authenticated provider request origin supported by platform, verified Bot scope, no hardcoded synthetic Shop ID, replay protection, no send | **BLOCKED** |
| G2.5 signed 4-issuer certificate replay guard | Four pinned signer roots, atomic nonce consumption and 45 negative QA plus independently reviewed issuer provenance; no send | **IMPLEMENTED CANDIDATE / BLOCKED HOSTED** |

## 5. Narrow approval needed to unblock real evidence — NO SEND
Current Worker has existing `ZALO_BOT_TOKEN` and `GATEWAY_AUTH_KEY` secret bindings. Existing `/v1/bot-check` only outputs `bot_token_valid`. Without a code change to the **credential-bound staging Worker** (or a specially provisioned isolated secret-attestor Worker), its current public/read-only surface **cannot return `getMe.result.id`**. Do not bypass by parsing masked screenshots or posting Bot Token in ChatGPT.

A narrowly scoped **separate authorization** would permit:
- add a new **server-authenticated, read-only, NO-SEND** attestor route or isolated staging attestor using the existing Bot Token only internally;
- provision a **separate private signing key**, enforce server-side challenge origin/TTL, return only signed digest and sanitized status, never raw ID/token;
- run negative QA and read-only provider check; **no changes to Published Zalo ingress**, send endpoints or Shop data;
- prevent rollout if signing-key storage, consent or durable replay cannot be certified.

This change would touch a credential-bound Worker and signing-key provisioning; it has **not** been approved or executed in this checkpoint.

## 6. Owner-controlled manual evidence / privacy
- The owner can view Zalo Bot Creator and confirm that Bot TIEN404 AI is active and webhook matches the expected staging URL **without** sharing Bot Token, Secret Token, customer Chat ID or payment details.
- A screenshot showing the Bot name/active state is supporting context, **not immutable ID proof**.
- A future challenge sent **by the owner** through an authenticated Zalo session might prove control of a chat account, but **not** necessarily ownership/admin authority over the Bot or Shop. Do not claim a provider Owner API exists without docs.
- No user-supplied personal/secret IDs shall be put in GitHub logs or public UAT page. Review privately.

## 7. Rollback and next step
- Only new source, tests, CI and sanitized documents on Draft PR #103 are changed in G2; read-only executions 3869/3870. No n8n workflow activation or changes, no Cloudflare Worker deployment or D1 mutation.
- Revert Draft branch G2 commits to roll back source candidates; no operational rollback needed.
- Upon explicit scoped authorization for a credential-bound **read-only** attestor, audit Worker backup/version, add minimal isolated route with separate signer key, run tests, and certify `getMe.result.id` digest. This is still distinct from changing Published ingress or allowing a real Zalo send.
- G3 real AI/Orders/Stock/RLS and G4 real-send approvals remain separate gates; n8n trial choice still deferred to the planned Nov 22 review.

## 8. G2 provider attestor compatibility adapter (not deployed)
- New draft-only `qa/zalo-live-v145z/g2-provider-identity-attestor.mjs` is a separate, private **WebCrypto** module (not an HTTP handler) receiving a trusted server-owned `getMe` callback and **separately provisioned ECDSA P-256 signing + HMAC-SHA256 CryptoKeys**. The module itself never accesses Bot Token, webhook, n8n or any network. It fails closed for invalid callback, context, ID type, signing keys, nonce, provider error, and never emits raw Bot ID/account_name, credential URLs, or untrusted error detail.
- It emits only a nonce-bound HMAC Bot digest inside a **SIGNED_PROVIDER_OBSERVATION_ONLY** provider proof; its ECDSA signature is verified by the existing `LIVE03` pinned-key verifier, with no issuer private key shipped in the repository. This is **server attestation of a Zalo API observation, NOT a native Zalo-signed identity certificate**.
- `qa/zalo-live-v145z/g2-provider-identity-attestor.test.mjs`: **18/18 synthetic offline PASS**, including WebCrypto P1363 signature compatibility and error redaction. Full GitHub CI [43753823368](https://github.com/ngoctien20/demo-git/actions/runs/43753823368) **379/379 PASS** (previous 316 + 45 G2 gate + 18 provider signer). This is a synthetic test, **not a real Bot ID observation or actual key provisioning**.
- The four signer roles are still NOT provisioned; registry/owner/hosted issuer adapters and authoritative owner association are still pending. Existing credential-bound Worker /v1/bot-check returns boolean only. No source-only code can certify a real Bot without a trusted provider observation.
- For any future deployment, ensure Bot ID is read as a **string** from Zalo `getMe.result.id` (not JS Number), the nonce is consumed atomically in a trusted server store and the signer keys never enter public logs/PR. This needs a separately approved security change, not an implicit continuation of the G1 self-report acceptance.

## 9. G2.1 actual hosted provider signed Bot ID evidence — later checkpoint supersedes G2.1 BLOCKED
- User explicitly authorized narrow credential-bound staging **read-only** G2.1 provider attestor with independent signing key, excluding actual send, Published webhook, Bot Token rotation and customer data changes.
- Cloudflare original Worker `tien404-zalo-outbound-v1-staging` source hash/backout version pinned; new version `3422864f-f095-45b9-85ca-a7d03cb87a3f` deployed as `17b7106a-d66a-4e37-a18e-0d8ec97d6f78`, maintaining all six old bindings plus two new `secret_key` CryptoKeys, `ZALO_SEND_ENABLED=false`. No existing secret value read or committed.
- Actual n8n manual read-only execution **3874 SUCCESS**: protected Zalo `getMe` HTTP 200, Bot ID string transformed **server-side** into nonce-bound HMAC digest, returned as P-256 signed proof, raw Bot ID/token absent, `provider_sends:0`. Independently validated signature against pinned public SPKI (verified true).
- Negative hosted execution **3878 SUCCESS**: 405 GET disallowed, 401 missing auth, 422 invalid authenticated challenge, 423 general sends locked, 200 health send-disabled. Original read-only regressions **3875**, **3876** SUCCESS with no config changes.
- CI 43755059657 and 43755579758 **409/409 PASS** (prior 379 + 30 new isolated G2.1 contract). Public root and deployed version `qa/zalo-live-v145z/g21-provider-public-trust-root.json`. Full checkpoint `docs/ai-handoff/TIEN404_V14_5Z_G21_SIGNED_PROVIDER_OBSERVATION_CHECKPOINT.md`.
- **G2.1 = VERIFIED, restricted to signed server observation of provider getMe result.id**. It is not native provider-signed data and does **not** prove Shop B, owner control or merchant membership. G2.2–G2.5 remain BLOCKED; no registry fixture promotion; Published ingress still `trusted_bot_id:'b'` synthetic. The attestor deliberately has no durable nonce replay consumption, so later G2.5 must add an independent issuer/replay store. Real Zalo send remains NO-GO.
