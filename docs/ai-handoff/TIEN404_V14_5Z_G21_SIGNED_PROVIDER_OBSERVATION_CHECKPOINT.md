# TIEN404 AI — V14.5Z-G2.1 — Trusted Read-Only Provider Bot Identity Attestation
**Checkpoint:** 2026-11-16 JST  
**Authorization:** User explicitly approved G2.1 read-only authenticated Bot ID attestor using existing protected Zalo Bot Token internally and separate signing keys. Approval excludes real sends, credential rotation, webhook Published changes, customer data and production.  
**Decision:** `G2.1 VERIFIED_PROVIDER_OBSERVATION`; overall G2 still BLOCKED.

## 1. Scope and pre-change rollback
- Credential-bound **staging** Worker: `tien404-zalo-outbound-v1-staging`.
- Original deployed version `ed172d3c-e1f1-4daa-bc56-643406441091`, deployment `2ce7ea81-3755-47b1-afdd-a799db3da3c8`.
- Original private Worker source SHA256 `b1c58cf85e74b3e235807d4a5d731369bd15579e5076b18d8774f75e9f5351d3`. Script source and secrets **not committed** to GitHub.
- Original 6 binding names and kinds preserved: `GATEWAY_AUTH_KEY` secret_text, `REPLAY_DB` D1, `ZALO_BOT_TOKEN` secret_text, `ZALO_OWNER_APPROVAL_EXPIRES` plain_text, `ZALO_OWNER_CHAT_ID` secret_text, `ZALO_SEND_ENABLED` plain_text `false`.
- Verified Cloudflare strict binding inheritance with an **undeployed identical test version** `36783a59-6b42-4801-8dfb-47b3b644f6bf`: 6/6 existing bindings retained and deployed version unchanged. Pre-change record `docs/ai-handoff/TIEN404_V14_5Z_G21_WORKER_PRECHANGE_ROLLBACK.md`.
- Existing Worker version remains available for **reversible 100% deployment rollback**. No destructive restore or private credential extraction necessary.

## 2. Implemented and deployed read-only endpoint
- G2.1 new independent module `qa/zalo-live-v145z/g21-provider-attestor-route.mjs` on Draft GitHub; attached as second module to **one** new route `POST /v1/g2-provider-attest`, directly after existing request path parsing. Original route implementations and their authorization/sending logic otherwise remain unchanged.
- Version uploaded via Cloudflare Worker Versions API with `bindings_inherit=strict` and `keep_bindings` for existing secrets/D1/plain text. Newly generated **secret_key** bindings `G2_PROVIDER_SIGN_KEY` (ECDSA-P256 signing) and `G2_PROVIDER_HASH_KEY` (HMAC SHA-256). Generated within the connected Cloudflare execution; private key material NEVER returned, copied to GitHub, stored in n8n or sent to the user. Existing Bot Token not rotated, copied or displayed.
- New deployed Worker version `3422864f-f095-45b9-85ca-a7d03cb87a3f`; deployment `17b7106a-d66a-4e37-a18e-0d8ec97d6f78`; complete 8 binding list verified after deployment. `ZALO_SEND_ENABLED=false` verified after and again during final audit.
- New route accepts exactly a 64-hex challenge in a JSON POST, requires the existing protected gateway Bearer auth and global send kill switch OFF, and only invokes the official Zalo `POST getMe` internally via the existing token. Endpoint returns a challenge-bound HMAC digest of `getMe.result.id` (processed as a string) inside a P256 signed evidence payload. The raw Bot ID, account_name, Bot Token, key materials, owner Chat ID, customer data and provider URL with token are never in its response.
- Public verification key **ONLY** pinned in `qa/zalo-live-v145z/g21-provider-public-trust-root.json`; verification key is not secret. The payload intentionally contains `owner_verified:false`, `bot_shop_binding_verified:false`, `can_send:false`, `challenge_replay_prevented:false`. It is a signed **server observation** of Zalo getMe response, **not a native Zalo signed certificate**. It cannot certify Shop B or Owner.
- The route has no outbound `sendMessage`, Orders or D1 writes; normal send endpoints are unchanged and remain disabled. A supported version preview URL was unavailable because `previews_enabled=false`; user-scoped staging deployment and immediate HTTP QA were performed with pre-pinned rollback.
 
## 3. Proof and QA evidence
- n8n inactive manual QA workflow `bOjbj4MZIZnMn8XP`, version `c831adcc-fd04-404e-9df4-17c213321fc0`, in `90_QA - DIAGNOSTICS`. Reused the existing read-only gateway `httpHeaderAuth` credential **reference only**, without reading or changing its value.
- **Execution 3874 SUCCESS:** `POST /v1/g2-provider-attest` via existing protected Bearer auth returned HTTP 200, a signed proof with 86-character P1363 signature, a 64-hex Bot HMAC digest, and no raw Bot ID. Response says `provider_sends:0`, `orders_written:0`, `owner_verified:false`, `can_send:false`.
- Independently cryptographically verified signed proof using Cloudflare WebCrypto P-256 against the exact **public SPKI** pinned in GitHub; `signatureVerified:true`, `getme_result_id_string:true`, `source:SERVER_HTTPS_ZALO_GETME`, challenge match, no raw Bot ID in signed payload. Evidence recorded here only as boolean results, never the digest or owner identifiers.
- n8n manual QA workflow `wAJddACuIgq93UdZ`, version `429d71e3-519b-4f0f-a1c4-7f50be5660c6`, **INACTIVE**, executed **3878 SUCCESS**. Hosted security negative suite:
  - GET attestor wrong method → HTTP **405**;
  - POST attestor without authorization → HTTP **401**;
  - authorized POST with malformed challenge → HTTP **422** (no provider request);
  - POST `/v1/send` → HTTP **423 KILL_SWITCH_OFF**;
  - GET `/health` → HTTP **200**, send enabled FALSE.
- Pre-existing read-only workflow regressions: **3875 SUCCESS** `/v1/bot-check` still HTTP 200 token valid, no sends; **3876 SUCCESS** `getWebhookInfo` matched unchanged staging webhook, no config mutation or sends.
- GitHub [Actions run 43755059657](https://github.com/ngoctien20/demo-git/actions/runs/43755059657) and [43755579758](https://github.com/ngoctien20/demo-git/actions/runs/43755579758) SUCCESS: inherited **379** + **30** new G2.1 route contract tests = **409/409 PASS**. This test total is source/contract QA; the real-provider evidence is execution 3874 and the separate cryptographic verification.
- Latest observed n8n inventory: **104 workflows, 19 Active**; the two new QA workflows remain Inactive. Changes in workflow count also reflect other independently created QA workflows and should not be mistaken for 104 active workflows.
- Existing Published Zalo ingress `yIJk8LvJoLF40Z62` remains active and unchanged version `8ca4a6f6-ab3f-42f1-8637-d4f5db790a3e`, with synthetic trusted_bot_id `b`; **no Published changes**.
- Isolated LIVE03C budget D1: **0 unexpired QA_ARMED grants**.

## 4. Gate status and constraints
| Gate | Result |
|---|---|
| G2.0 token and webhook provider preflight | VERIFIED |
| **G2.1 getMe immutable provider ID** | **VERIFIED — privacy-safe signed server observation** |
| G2.2 true provider Bot → Tenant → Shop B mapping | BLOCKED: QA registry still 2 `zalo_bot_fixture/synthetic_qa/dry_run` rows; no trusted new real mapping |
| G2.3 independently verified QA Owner / merchant consent | BLOCKED: allowlist alone not proof; existing allowlist expires 2026-11-20 13:17:32.511 UTC |
| G2.4 real, authenticated hosted ingress routing | BLOCKED: Published ingress hardcodes a synthetic Shop B binding |
| G2.5 independently signed 4-role certificate + persistent replay-proof nonce | BLOCKED: only provider signing root currently configured, no registry/owner/hosted roots, and endpoint explicitly indicates no durable challenge replay prevention |
| G3 AI pricing/Orders/tenant isolation | BLOCKED pending separate QA |
| G4 real Zalo sends | NO-GO / requires separate explicit final approval |

## 5. Rollback and next recommendation
- Rollback deploy previous `ed172d3c-e1f1-4daa-bc56-643406441091` at 100% to `tien404-zalo-outbound-v1-staging`; recheck `ZALO_SEND_ENABLED=false`, `/v1/bot-check` HTTP 200, and `/v1/send` HTTP 423. Do NOT delete/rotate any secret or destroy keys without separate approval. The new keys belong to the newer version.
- Future G2.2/3 readiness: create isolated trusted resolver for **the exact server-observed Bot ID**, with an independent privately verified Shop B/Owner enrollment. Existing fixture registry rows MUST NOT be promoted or overwritten. Arrange owner consent and re-evaluate allowlist expiry; the current value is not proof of merchant ownership.
- Future G2.4: replace the synthetic ingress-to-Shop B hardcoding only in separately reviewed **staging candidate**, preserving Published webhook until owner approval.
- Trial continuity / n8n subscription evaluation remains deferred per user decision until the scheduled 2026-11-22 review. No payment or Auto top-up done here.
- **Overall decision:** G2.1 signed real provider observation completed, G2 full certification still BLOCKED, real Zalo send NO-GO.
