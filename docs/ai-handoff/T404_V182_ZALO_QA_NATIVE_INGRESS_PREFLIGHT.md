# TIEN404 V18.2 — Zalo Bot QA Native Ingress

**2026-11-18 JST · READ-ONLY VERIFIED / SOURCE VALIDATOR CANDIDATE / HOSTED NATIVE WEBHOOK NO-GO**

Parent: Draft [PR #400](https://github.com/ngoctien20/demo-git/pull/400), exact base `f6727d3276e5b66ca5040f348528e178d7167592`. Reuse the existing inactive QA workflow. Do **NOT** publish or setWebhook, deleteWebhook, getUpdates or sendMessage without a separate scoped operator approval and rollback plan.

## Evidence verified

1. The dedicated n8n workflow **TIEN404_ZALO_QA_V18_1_ISOLATED_INBOUND_DRAFT_NO_SEND** (`RCHb4m9YBCNzhITk`) exists, **inactive**, current version `d8f34b66-915a-479e-b993-c4a24a04f513`, with `X-Bot-Api-Secret-Token` credential **TIEN404_ZALO_QA_INBOUND_V18_1** attached. No current active/published version. POST path `/webhook/tien404-zalo-qa-v18-1-locked`. Always responds 423 `QA_LOCKED`, has no send/Commerce/order nodes, stores no successful executions. It is NOT a working provider registration.
2. The original Zalo Bot Lab `yIJk8LvJoLF40Z62` stays Published and is distinct; no live changes. Do not confuse **Zalo Bot QA**, the older Zalo Bot and **Zalo OA**.
3. Authorized manual n8n synthetic execution `5318` on the QA workflow succeeded, with `provider_sends=0`, `order_writes=0`, `commerce_calls=0`, `credential_verified_by_execution=false`.
4. Founder's prior local read-only `getMe` response matched QA bot ID `1556301397801600805`. This result does not establish its current webhook URL. No QA bot token is available in this task's read-only connector scope, so no official `getWebhookInfo` call was performed.
5. Cloudflare Worker `tien404-v1723u-qa-inbound-locked-staging` previously inspected. No direct n8n forward target was observed in the specific inspected Worker script. This does not rule out separate webhook routing configurations.

## Official API reference

- [getMe](https://docs.zaloplatforms.com/docs/BOT/apis/getMe): POST, read-only bot identity.
- [getWebhookInfo](https://docs.zaloplatforms.com/docs/BOT/apis/getWebhookInfo): POST, no body parameters, read-only current webhook URL and update timestamp.
- [setWebhook](https://docs.zaloplatforms.com/docs/BOT/apis/setWebhook): POST, sets an **HTTPS** URL and **8–256-character** `secret_token`. Header name is `X-Bot-Api-Secret-Token`.
- [Webhook payload](https://docs.zaloplatforms.com/docs/BOT/webhook): HTTP POST JSON, `ok: true`, `result.event_name=message.text.received`, and `result.message.{from,chat,text,message_id,date}`.

## Deliverables (source only)

- `qa/v182-zalo-native/native-qa-validator.mjs`: strict, static, no-network QA event shape checker with timing-safe header hash comparison, PRIVATE-chat-only, exact `QA_ZALO_NATIVE_182` canary, 2-minute freshness and HMAC digest output (never raw sender IDs, messages, secrets or payload). Returns **REVIEW_ONLY** at most: does NOT claim native Zalo authenticity, atomic replay, durable intake, Store/Commerce authority, reply or webhook publication.
- `qa/v182-zalo-native/native-qa-validator.test.mjs`: synthetic positive and negative tests.
- `qa/v182-zalo-native/get-webhook-info-readonly.ps1`: local operator read-only POST `getMe` + `getWebhookInfo` using the already-secured QA Bot token from process environment or a hidden PowerShell SecureString prompt. Outputs booleans, never URL or token. Run only after separately opening a secured local PowerShell session; never paste token into ChatGPT or GitHub.
- `.github/workflows/v182-zalo-native-preflight-no-send.yml`: offline test job. No provider calls or secrets.

### Verified route checklist

1. **READ-ONLY**: Run `getWebhookInfo` for the **QA bot token only**, confirm the bot id and whether URL is empty, points to approved QA endpoint, or points elsewhere. If a different webhook is configured, preserve it; do not overwrite.
2. Review existing QA n8n credential and secret-token parity **without reading or printing secret values**. The configured webhook header secret must be the same value used by QA Bot `setWebhook`, not the Bot API token.
3. Change the QA-only receiver from its static 423 lock to a **bounded authenticated durable-receipt handler** in staging, separately approve this change, and independently test no-write/no-send negatives. Do not reply 200 for undurably accepted messages.
4. Under **explicit separate consent** for the exact QA bot and only after negative QA passes, consider publishing **the isolated QA workflow** and calling `setWebhook` for **QA Bot token**, never older Bot/OA. Store the old callback metadata securely for rollback. Do not delete or disturb any existing production webhook.
5. Send a one-time non-PII QA canary `QA_ZALO_NATIVE_182` from an authorized tester. Correlate native provider delivery, Cloudflare/n8n ingress metadata and a new execution ID. Raw provider user IDs and message contents remain out of reports.
6. Confirm no model calls, owner notifications, Commerce writes or outgoing messages. If all gates pass, move to independent customer identity link and Store/Order access tests in V18.3; do not grant access automatically.

**Rollback**: before any provider `setWebhook`, retain previous QA webhook URL/secret reference from secure secret management (never store raw secrets in public GitHub); restore only by separately approved action. This source-only branch can be closed with zero hosted rollback.

**Current release gate:** `V182_SOURCE_PREFLIGHT_ONLY / ZALO_NATIVE_DELIVERY_NOT_VERIFIED / WEBHOOK_REGISTRATION_NO_GO`.
