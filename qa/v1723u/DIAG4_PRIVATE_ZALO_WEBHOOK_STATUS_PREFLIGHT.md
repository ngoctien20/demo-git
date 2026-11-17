# V17.23U-DIAG4 — Private read-only Zalo Bot webhook preflight

Status: DOCUMENTED / OWNER EXECUTION PENDING / HOSTED WORKER OFF / NO NEW SEND.

## Verified official Zalo Bot contract
- getMe: POST https://bot-api.zaloplatforms.com/bot{BOT_TOKEN}/getMe, no parameters. Checks token and returns bot account identity; read-only.
- getWebhookInfo: POST https://bot-api.zaloplatforms.com/bot{BOT_TOKEN}/getWebhookInfo, no parameters. Reads currently registered webhook configuration; read-only.
- deleteWebhook and setWebhook are mutations and MUST NOT be called during this preflight.
- Official docs: https://docs.zaloplatforms.com/docs/BOT/apis/getMe and https://docs.zaloplatforms.com/docs/BOT/apis/getWebhookInfo .

## Owner-only privacy and authority gates
- Use ONLY NEW dedicated TIEN404 QA Bot API Token, not existing staging Bot token and NOT webhook Secret Token.
- Do not paste token, bot ID, full endpoint URL, raw JSON response, authorization header or callback path into chat, screenshots, CI or GitHub.
- Token must be securely entered at a local PowerShell prompt (Read-Host -AsSecureString), decoded in transient memory and used over HTTPS for getMe and getWebhookInfo only. Token exists in the HTTP request path by provider protocol; don't print network exceptions or verbose logs.
- Compare returned bot identity privately against the QA Bot shown in Bot Creator. A valid token alone does not prove it belongs to the intended QA Bot.

## Sanitized output contract
| Output | Meaning |
|---|---|
| QA_BOT_TOKEN_VALID_CHECK_OWNER_IDENTITY | getMe succeeded; owner still must check that this is NEW QA Bot |
| QA_WEBHOOK_ABSENT_CONFIRMED | getWebhookInfo returns ok=true, result.url empty |
| QA_WEBHOOK_PRESENT_STILL_REGISTERED | getWebhookInfo returns ok=true, result.url non-empty |
| QA_WEBHOOK_STATUS_404_AMBIGUOUS | getWebhookInfo returned ok=false,error_code=404; prior no-webhook case did this, but not documented as a guaranteed deletion proof |
| QA_WEBHOOK_STATUS_INCONCLUSIVE | Other provider error or unrecognized result |
| QA_READ_ONLY_HTTP_ERROR_N | HTTP error N; never report the raw request URI or provider response |

These outputs prove only current provider configuration for the supplied token, never the origin or successful delivery of historical messages. No webhook re-enrollment or send authorized.

## Historical checkpoint and next gate
- Cloudflare aggregate 403/405/410 evidence at DIAG3 is NOT tied to a verified Zalo caller. This API does not expose event delivery logs.
- Dedicated QA Worker workers.dev and previews OFF, D1 original accepted receipts 0, diagnostic mode/schema not installed. Keep that state.
- After owner-only read-only verification, review provider registration vs controlled one-event testing; new public exposure, migrations, and diagnostic storage require separate scoped security/budget approval.
- Production Commerce and original Zalo Bot remain out of scope.
