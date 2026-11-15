# TIEN404 AI — Zalo Bot V13.7: 5 API QA (staging, no-send)

Mode: read-only and offline first. No Zalo multimedia delivery; no credential, Worker, webhook, n8n workflow or customer data mutations. This is part of TIEN404 multi-channel Sales SaaS.

## Official provider contracts (verified 2026-11-15 JST)

| API | POST body schema | Caveats |
| --- | --- | --- |
| getWebhookInfo | Empty JSON object | Read-only; provider response may include private webhook URL and updated_at, therefore redact URL before reporting |
| sendPhoto | chat_id, photo (URL), optional caption | If provided, caption length 1–2000 characters; media URL must be validated and reachable by Zalo |
| sendChatAction | chat_id, action: typing | upload_photo documented as coming soon and deliberately blocked |
| sendSticker | chat_id, sticker ID | Zalo sticker catalog ID required; documentation sample is not proof of validity for current bot |
| sendVoice | chat_id, voice_url | Audio must end .aac; 1:1 chat only; no caption; group request might ACK without delivery |

Official Zalo documentation:
- https://docs.zaloplatforms.com/docs/BOT/apis/getWebhookInfo
- https://docs.zaloplatforms.com/docs/BOT/apis/sendPhoto
- https://docs.zaloplatforms.com/docs/BOT/apis/sendChatAction
- https://docs.zaloplatforms.com/docs/BOT/apis/sendSticker
- https://docs.zaloplatforms.com/docs/BOT/apis/sendVoice

These are Bot Creator APIs, not Zalo OA OpenAPI/ZBS/Mini App. No native button or callback claim.

## Implementation

- contracts.cjs: frozen strict whitelist for five API operations and fake media fixtures on reserved media.qa.invalid host. NO live fetch, credentials, chat_id, tenant, order, Webhook mutation or outbound call. Invalid inputs fail closed.
- readOnlyWebhookResult: removes URL, path, token, query, user information; retains only high-level config status.
- sanitizeProviderResponse: separates provider ACK from actual recipient delivery or Zalo client rendering; does not emit message IDs.
- contracts.test.cjs: 26 cases, including caption limits, invalid external URLs, group voice, unsupported photo upload action, arbitrary sticker, injected chat_id/tenant IDs, webhook secrecy, negative provider responses.
- GitHub Actions v137-zalo-five-apis-offline-qa.yml: 26 new + 18 V13.6 + 14 Rich Text + 16 protected gateway + 116 V13.1 menu-engine regression = 190 tests.
- Local run: node --test qa/zalo-multimedia-v137/contracts.test.cjs.

A live gateway sender must be a SEPARATE, explicitly authorized staging adapter. Do not add Bot Token, chat_id or actual HTTP operations to this offline package.

## Actual read-only provider verification

Existing n8n workflow TIEN404_ZALO_SHOP_B_WEBHOOK_DIAGNOSTICS_STAGING, ID bD510xyr5jBHQ99K, version c45a3f84-06a3-4ddf-af99-a2c244eb2153, was fully audited before the manual run. It has a manual trigger, input preparation, a single credentialed HTTP request to the protected Cloudflare staging read-only diagnostics route and an assertion node. It has NO dataTable mutation or send endpoint.

Execution 3823: SUCCESS, HTTP 200; Zalo provider ACK true, webhook configured, matches staging yes, test webhook no, external_sends 0, configuration_changes 0 and general_sending_enabled false. Private webhook host and path are NOT copied into GitHub.

Four outbound methods remain OFFLINE ONLY, with ZERO newly sent multimedia/status calls.

## Future real-message test approval gates

1. Request new explicit Owner approval for per-API sending quota and a strictly authorized recipient. Previous T1–T3 allowance is fully consumed.
2. Recheck Shop B QA Owner pairing, correct Bot/tenant/store, chat type and time-limited authority. Never bind recipient or tenant IDs from untrusted client content.
3. Media must be stored and verified on an approved HTTPS host; reject SSRF and arbitrary URLs. Validate a real Zalo sticker ID and real AAC file, not documentation samples or .invalid placeholders.
4. Add a separate staging sender with a fixed test-fixture allowlist, bounded TTL, persisted idempotency, single-send attempts, no retries, and secure sanitized provider receipts.
5. Never enable global ZALO_SEND_ENABLED, change live Webhook/credential/Orders, or promote to Core Bot without separate permission.
6. Negative QA must cover expired approval, wrong recipient, replay, malicious URLs, group voice, upload_photo, invalid formats, and tenant isolation.
7. After a separately approved send, inspect the actual Zalo app. API_ACCEPTED is not proof of delivery or display.
8. Real Cloudflare Worker deployment/security or other production changes require separate Owner approval.

## Status and rollback

VERIFIED: API contracts + n8n and Worker read-only state + real getWebhookInfo diagnostics.
IMPLEMENTED / TESTED: offline contract library, mocks and GitHub Actions.
PROPOSED: new scoped multimedia staging sender.
BLOCKED: new sendPhoto, sendChatAction, sendSticker, sendVoice real sends, pending the above gates.

Rollback: close/revert Draft PR; Cloudflare Worker, D1, n8n, Supabase, Render and production remain as previously deployed.
