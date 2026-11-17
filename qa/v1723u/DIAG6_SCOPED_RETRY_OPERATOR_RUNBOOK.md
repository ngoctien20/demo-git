# V17.23U-DIAG6 — New QA Bot One-Event Scoped Webhook Retry

**Status:** PREPARED ONLY. Owner authorized an attempt to retry QA, not blanket publication or mutation of production/Commerce credentials. The new QA Bot API credential remains private and unavailable to connectors. No live Worker/Secret changes and no event send in this checkpoint.

## Baseline read-only 2026-11-18 JST
- Worker `tien404-v1723u-qa-inbound-locked-staging`: workers.dev=false, preview=false; deployed version `75d9a289-64c3-4fe1-bc13-18c0051b529f`; there is no custom domain route for the dedicated Worker.
- D1 `tien404-v1723u-qa-bot-once-disposable`: `qa_canary_once` count 0.
- Bindings include `QA_CALLBACK_PATH`, `QA_CHALLENGE`, `QA_EVENT_PEPPER`, `QA_HEADER_SECRET` (secret_text), `QA_EVENT_DB` (D1), and `QA_CANARY_MODE`, `QA_START_MS`, `QA_END_MS` (plain_text). New diagnostic bindings are not deployed.
- Current QA window already expired. `QA_CANARY_MODE=OWNER_SCOPED_PRIVATE_NO_SEND_ONCE`; require a new <=30min bounded window before a live attempt.
- Official Zalo Bot docs: https://docs.zaloplatforms.com/docs/BOT/apis/setWebhook and https://docs.zaloplatforms.com/docs/BOT/webhook ; provider `secret_token` is an independent 8-256 character shared header, distinct from Bot API Token, sent as `X-Bot-Api-Secret-Token`.
- Owner-reported prior mis-entry of Bot API Token during Worker setup; possible `QA_HEADER_SECRET` confusion remains unproven because actual secret values cannot be read back.

## Phase A — operator-only local generation, NO hosted writes
The owner must verify the **NEW** QA Bot in the Bot Creator, not old Bot/OA. Generate 3 independent random local values using PowerShell 5.1-compatible cryptographic RNG. Do not paste any into chat/screenshots/GitHub/CI; do not print values.

```powershell
$rng = [Security.Cryptography.RandomNumberGenerator]::Create()
function New-QA-Random {
  $bytes = New-Object byte[] 32
  $rng.GetBytes($bytes)
  return [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+','-').Replace('/','_')
}
$QA_WEBHOOK_SECRET_NEW = New-QA-Random
$QA_CALLBACK_PATH_NEW = '/qa/zalo-bot/' + (New-QA-Random)
$QA_CHALLENGE_NEW = 'TIEN404-QA-' + (New-QA-Random)
$QA_WEBHOOK_URL_NEW = 'https://tien404-v1723u-qa-inbound-locked-staging.tienmobi208.workers.dev' + $QA_CALLBACK_PATH_NEW
$rng.Dispose()
'QA_LOCAL_VALUES_PREPARED'
```

Keep the local PowerShell session open for the full attempt, and **do not** disclose values. The callback path is deliberately high entropy. Never reuse Bot API Token as webhook secret. Do not overwrite `QA_EVENT_PEPPER`.

## Phase B — scoped Worker binding preparation only after owner ready
User manually edits the dedicated QA Worker **only** at Cloudflare Dashboard > Workers & Pages > `tien404-v1723u-qa-inbound-locked-staging` > Settings > Variables and Secrets. Changing a secret deploys a Worker version; verify preview and public worker subdomain remain OFF after changes. Save existing baseline version and record rollback info (without secret material).

| Worker binding | Type | Exact source |
|---|---|---|
| `QA_HEADER_SECRET` | Secret | `$QA_WEBHOOK_SECRET_NEW` (separate from Bot API Token) |
| `QA_CALLBACK_PATH` | Secret | `$QA_CALLBACK_PATH_NEW` |
| `QA_CHALLENGE` | Secret | `$QA_CHALLENGE_NEW` |
| `QA_EVENT_PEPPER` | Secret | **KEEP existing unchanged** |
| `QA_CANARY_MODE` | Plain text | Keep `OWNER_SCOPED_PRIVATE_NO_SEND_ONCE` |
| `QA_EVENT_DB` | D1 | Keep exact disposable D1 |
| `QA_START_MS` and `QA_END_MS` | Plain text | Must be reauthorized together for a new fixed 20-min window **only when ready for Phase C**, not now |

Windows PowerShell can place each generated value into the clipboard without printing it: `Set-Clipboard -Value $QA_WEBHOOK_SECRET_NEW`, `Set-Clipboard -Value $QA_CALLBACK_PATH_NEW`, `Set-Clipboard -Value $QA_CHALLENGE_NEW`. Paste in Cloudflare correct field, change clipboard to next value. After secret use, clear clipboard with `Set-Clipboard -Value ''`. Do not share screenshots of secrets.

## Phase C — future live admission gate, not currently performed
- Confirm owner-only bot identity via `getMe`, no webhook URL via `getWebhookInfo`, fresh Cloudflare Worker version and correct binding names; one independent no-send monitor, controlled rate/cost and rollback.
- Only once all private bindings are complete and owner is ready, update `QA_START_MS` and `QA_END_MS` to an exact <=20min QA timebox and temporarily enable `workers.dev` **for this dedicated Worker only**. DO NOT enable previews or unrelated Workers.
- Register the new QA Bot's webhook using `$QA_WEBHOOK_URL_NEW` and **the same** `$QA_WEBHOOK_SECRET_NEW` as `setWebhook.secret_token`. Do not pass bot token into the secret field. Depending on UI, use Bot Creator form; no read-only connector currently has the private Bot API Token.
- Verify `getWebhookInfo` returns `ok=true` with a URL (the owner should compare locally and not post it to chat). Only then send **one** private text message `$QA_CHALLENGE_NEW` to the **new QA Bot**, preferably copying from the same PowerShell session. No customer, order or other conversation data.
- Query Cloudflare aggregate request status and disposable D1 receipt count. Acceptance: exact one D1 receipt and no outbound sends/orders; duplicate event must not produce additional receipts. If D1 remains 0, preserve sanitized status counts without asserting sender identity.
- **Immediate rollback in same session:** delete the new QA Bot webhook; confirm provider `getWebhookInfo` has no URL; disable dedicated Worker `workers.dev` and previews; D1 remains disposable; do not alter old Bot/n8n/Commerce. Ensure worker returns OFF irrespective of test result. If owner cannot guarantee rollback, do not begin Phase C.
- No new hosted diagnostic schema migration without separate specific authorization.

## Security / test status
- This runbook does **not** assert that a secret has been changed, webhook registered, public Worker enabled, a message sent, or D1 accepted.
- Tests and code published at older branch commits verify only synthetic input handling. A source-only GitHub CI PASS is not equivalent to a live Zalo callback acceptance.
- Checkpoint `PREPARED_OFFLINE / LOCAL_PRIVATE_SECRETS_NEEDED / OWNER_READY_GATE / LIVE_TEST_NOT_EXECUTED / PRODUCTION_NO_GO`.

## Owner time-window update — verified before public admission

Owner reported updating `QA_START_MS` / `QA_END_MS`. Cloudflare read-only postflight around 2026-11-18 06:23 JST **verified**:
- `QA_START_MS` = 1794950538271 (2026-11-18 06:22:18.271 JST).
- `QA_END_MS` = 1794951738271 (2026-11-18 06:42:18.271 JST).
- Duration exactly 20 min; both values are safe integer milliseconds; start was in the past at inspection and end was in the future.
- Dedicated Worker deployed version is now `20f281c4-c568-45c9-bd7b-e63a0e7d1fc4`, workers.dev OFF, preview OFF, `qa_canary_once` receipt count remains 0.
- `QA_HEADER_SECRET`, `QA_CALLBACK_PATH`, `QA_CHALLENGE`, and `QA_EVENT_PEPPER` still bound as `secret_text`; actual values are non-readable, thus secret equality and callback/challenge recoverability remain unverified.

**Live admission remains blocked:** Before enabling public Worker, privately verify the owner still possesses the current randomized callback path and exact challenge and can complete provider registration, one-message acceptance and webhook deletion before expiry. **Never leave public ingress enabled if there is insufficient time; refresh the bounded QA window only immediately before an authorized single-message test.**

**No** webhook registration, Worker public activation, secret mutation or customer-message send was performed by this checkpoint.

## Live challenge attempt — after-send QA and public Worker rollback

- **OWNER-REPORTED:** Owner registered webhook on new QA Bot and sent one exact challenge during the authorized 20-minute window.
- **CLOUDFLARE READ-ONLY VERIFICATION 2026-11-18 ~06:33:28 JST:** QA D1 `qa_canary_once` count **0**, `events.workersInvocations` Cloudflare SQL Analytics returned one weighted request `httpResponseStatus=404` at 2026-11-17 21:32:00 UTC (2026-11-18 06:32 JST), over account-scoped range 21:25–21:36 UTC. No 200 sampled at observation. Sampling / delay may limit conclusions; **sender not verified as Zalo**.
- **SECURITY ACTION EXECUTED:** Dedicated QA Worker subdomain disabled using Cloudflare API `POST /workers/scripts/{script_name}/subdomain` with `enabled:false`, `previews_enabled:false`; follow-up Cloudflare GET independently showed workers.dev=false and previews=false. No other Worker/domain touched.
- **CAUSALITY:** Deployed code returns 404 for a route mismatch/query string or invalid `QA_CANARY_MODE` before payload/header validation. QA mode previously observed `OWNER_SCOPED_PRIVATE_NO_SEND_ONCE`; **route mismatch is a hypothesis, not a proven provider failure**. No evidence currently confirms whether the 404 request came from Zalo or owner/browser probe.
- **PENDING OWNER ROLLBACK:** Bot QA webhook deletion in Bot Creator and private read-only `getWebhookInfo` no-URL check. Assistant cannot delete the provider webhook without the owner's private token; no token or callback URL to be disclosed in chat.
- **NEXT SAFE DIAG:** Offline/private comparison of Bot Creator webhook URL with intended exact `https://tien404-v1723u-qa-inbound-locked-staging.tienmobi208.workers.dev` plus stored `QA_CALLBACK_PATH` (including exact path, no query/trailing slash), and check current Cloudflare `QA_CALLBACK_PATH` matches intended local path via owner-only secret attestation or bounded secret rebinding; inspect docs before new public test. No follow-up live send until separate rollback verification and renewed window.
- **STATUS:** `LIVE_ONE_MESSAGE_OWNER_REPORTED / D1_ZERO_VERIFIED / WORKER_ANALYTICS_404_OBSERVED / SENDER_UNATTRIBUTED / WORKER_PUBLIC_OFF_VERIFIED / ZALO_WEBHOOK_DELETE_PENDING`.
