# TIEN404 AI — V13.7 FIVE ZALO BOT API STAGING CHECKPOINT

**Ngày:** 15/11/2026 (JST)  
**Trạng thái:** VERIFIED / IMPLEMENTED / TESTED (offline + một lệnh read-only) / BLOCKED (outbound sends).  
**Release:** EXPERIMENTAL, Draft PR #80; KHÔNG MERGE, KHÔNG DEPLOY production.

## I. Yêu cầu chủ sở hữu

Nghiên cứu và thiết lập QA staging theo thứ tự an toàn cho 5 API Zalo Bot:
sendPhoto, sendChatAction, getWebhookInfo, sendSticker, sendVoice.
Yêu cầu cụ thể: kiểm toán, checkpoint/sao lưu, kiểm thử read-only/offline trước, Draft PR, và hỏi phê duyệt riêng trước khi gửi tin thật; giữ nguyên global send kill switch và production.

## II. VERIFIED — môi trường gốc trước thay đổi

GitHub:
- Repo ngoctien20/demo-git.
- Base PR #79, OPEN DRAFT, HEAD SHA 52e9072963b9f6e2096bcf359f5701d9432c6a3f.
- Nhánh triển khai mới V13.7: work/v137-zalo-five-apis-offline-qa-staging.
- PR #80: https://github.com/ngoctien20/demo-git/pull/80, DRAFT → work/v136-zalo-button-capability-lab-staging.

Cloudflare:
- Worker STAGING: tien404-zalo-outbound-v1-staging.
- Version đang deploy TRƯỚC/Sau: 21b0580c-a76d-4331-bacf-d959e289da6d.
- Deployment ID: 912a5946-719b-434c-9802-fecd532125c6.
- Previous rollback version: ef7b7a33-5551-48e0-954b-646c047b5c6d.
- Global ZALO_SEND_ENABLED = false.
- Bindings names/types ONLY: GATEWAY_AUTH_KEY (secret_text), REPLAY_DB (d1), ZALO_BOT_TOKEN (secret_text), ZALO_OWNER_APPROVAL_EXPIRES (plain_text), ZALO_OWNER_CHAT_ID (secret_text), ZALO_SEND_ENABLED (plain_text). No binding values or chat IDs saved.
- Source read-only content/v2 response representation SHA256: 342f98ba7263163b215421df8e41599f137dd4964c5db9491da1a81978279c30 (digest of retrieved representation, not a canonical source Git SHA).
- Cloudflare source already includes protected /v1/webhook-diagnostics route for getWebhookInfo/getMe; no sendPhoto/sendSticker/sendChatAction/sendVoice references were found in this Worker snapshot.
- No Cloudflare write API calls made in this V13.7 task.

n8n:
- TIEN404_ZALO_BOT_LAB_V1_STAGING workflow yIJk8LvJoLF40Z62, active; version 8ca4a6f6-ab3f-42f1-8637-d4f5db790a3e.
- T1/T2/T3 prior one-shot sender workflow qWMu4n1wLkTZBNpI inactive, version dca573d8-bbcf-44fb-a306-90168e336b55; all Send T1/T2/T3 nodes disabled, old quota exhausted.
- Previous standalone preflight kRJQAll005V21o5H inactive.
- Existing read-only diagnostics workflow bD510xyr5jBHQ99K inactive, version c45a3f84-06a3-4ddf-af99-a2c244eb2153. Has only manual trigger, code prep, one credentialed HTTP POST to existing Webhook diagnostics Worker route, code assert. NO DataTable changes, message sends, setWebhook, deleteWebhook.

Baseline rollback/sao lưu: GitHub base SHA + Cloudflare version/deployment IDs, previous rollback version, non-secret binding manifest, current n8n workflow IDs/versions/active states. **Không sao chép credential/token hoặc đặt raw Cloudflare Worker code vào repo công khai**. Không có thay đổi runtime cần khôi phục; Cloudflare versioning vẫn giữ bản trước.

## III. VERIFIED — Zalo official API

Sources:
- https://docs.zaloplatforms.com/docs/BOT/apis/sendPhoto
- https://docs.zaloplatforms.com/docs/BOT/apis/sendChatAction
- https://docs.zaloplatforms.com/docs/BOT/apis/getWebhookInfo
- https://docs.zaloplatforms.com/docs/BOT/apis/sendSticker
- https://docs.zaloplatforms.com/docs/BOT/apis/sendVoice

sendPhoto: chat_id, photo URL, optional 1–2000-character caption.
sendChatAction: chat_id and action=typing; upload_photo is coming soon/not ready.
getWebhookInfo: read-only POST with empty body; returns private Webhook URL and update time; never expose raw URL.
sendSticker: chat_id and sticker ID from the Zalo sticker source; sample ID in docs is not a proven valid ID for our Bot.
sendVoice: chat_id and voice_url ending .aac; 1:1 only, no caption; API ACK in a group could occur without actual message delivery.

All five are Bot Creator APIs (not Zalo OA).

## IV. IMPLEMENTED — isolation

- qa/zalo-multimedia-v137/contracts.cjs: frozen offline drafts, strict 5-method whitelist; requires synthetic fixture references; reserved .invalid photo/voice URLs; no chat ID, Bot Token, real HTTP, authorization, billing or Orders. Distinguishes provider ACK from actual delivery.
- qa/zalo-multimedia-v137/contracts.test.cjs: 26 positive/negative tests: JSON schema, no-send, exact methods, webhook URL redaction, caption bounds, host allowlist, voice 1:1, unsupported upload_photo, unverified sticker provenance, provider ACK limitations, identity spoof and no writes.
- qa/zalo-multimedia-v137/README.md: official contract table, local run instructions, migration gates and rollback.
- .github/workflows/v137-zalo-five-apis-offline-qa.yml: no deployment; 5-suite Node QA including regression from V13.1/V13.5/V13.6.

These files are QA-only and do NOT modify existing Webhook/Worker, active Bot or commercial Sales Core.

## V. TESTED — evidence

GitHub Actions:
- https://github.com/ngoctien20/demo-git/actions/runs/43689787465 — SUCCESS at source SHA 857ad02eb3240c074cc8d2da9747a6bdc17768ec.
- 26/26 V13.7 contracts PASS.
- 18/18 V13.6 Button Lab PASS.
- 14/14 V13.5 Rich Text PASS.
- 16/16 V13.5 gateway safety PASS.
- 116/116 V13.1 menu regression PASS.
- **TOTAL 190/190 PASS** for the source code checkpoint before this document-only commit.

Zalo true read-only:
- Manual n8n workflow bD510xyr5jBHQ99K execution **3823**, SUCCESS, HTTP 200.
- Real Zalo getWebhookInfo through existing protected Cloudflare gateway: provider_ack=true; has_webhook=true; matches_staging_webhook=true; matches_test_webhook=false; external_sends=0; configuration_changes=0; general_sending_enabled=false.
- No private Webhook URL, host, path, token, chat ID or personal account info included here.
- Remaining 4 outbound methods: **MOCK/OFFLINE ONLY, real new sends=0**.

## VI. Rủi ro còn lại — đề xuất không thực thi

- P0 trước live sending: confirm Bot Token scope / Shop B verified QA recipient; server-side owner/tenant binding; fixed time-limited one-shot quota; D1 idempotency/replay protection; no retry; no global kill switch override; no real customer messages.
- sendPhoto: use approved HTTPS media host, validate image type and size, never arbitrary user-supplied URLs.
- sendSticker: obtain real permitted sticker ID from Zalo, verify account applicability.
- sendVoice: verify .aac real file, 1:1 recipient, no caption; do not assume API ACK implies playback.
- sendChatAction: typing only and transient; unsupported upload_photo remains blocked.
- Review and authorize any new Cloudflare Worker staging deployment separately before a real send batch; first test all negative cases.
- Collect redacted provider ACK and real Zalo screenshots separately.

### Approval pending

**No approval requested or inferred for any outbound Photo/Typing/Sticker/Voice calls.** Explicit owner approval must specify approved test recipient and max attempt quota per method; prior Rich Text T1–T3 permission already exhausted. Do not reactivate old sender or reset D1 claims.

## VII. Checkpoint and rollback

- Current branch: work/v137-zalo-five-apis-offline-qa-staging.
- Draft PR #80 (do not merge production).
- No infrastructure writes; rollback by closing/reverting PR #80. Do NOT reset Cloudflare settings or n8n published workflows because nothing was changed.
- Next step: after explicit approval, build a separate per-method staging sender design; complete QA first; only then send one at a time to allowlisted recipient. Keep the platform multi-channel and keep AI Studio as FUTURE/PRESERVED.

**No production deployment, credential change, real multimedia send, payment or Order write in V13.7.**
