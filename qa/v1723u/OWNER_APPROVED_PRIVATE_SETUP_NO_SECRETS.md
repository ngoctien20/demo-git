# V17.23U Track U-B — Owner-approved private config handoff (2026-11-18 JST)

**APPROVED BY OWNER (scope only):** Dedicated new QA Zalo Bot, one inbound event, maximum 30 minutes, no send, no Commerce, no modification to existing staging Bot/webhook, no new spend beyond verified allowance. **NOT YET ARMED OR ROUTED** because secrets must be entered by owner directly in authenticated Cloudflare and Zalo Bot Creator UI. GitHub/chat do not receive any Bot Token, Webhook Secret Token, random path, pepper, QA message nonce, or raw event.

## Current hosted state (read-only reconfirmation)
- Script `tien404-v1723u-qa-inbound-locked-staging` uploaded and version matched, with only `QA_EVENT_DB` D1 binding; `workers.dev=false`, previews disabled, no routes/domains.
- D1 `tien404-v1723u-qa-bot-once-disposable`, distinct from the existing 3 staging D1s; single-row `qa_canary_once` table; zero real event receipts at latest inspection.
- Account workers.dev subdomain: `tienmobi208`. Future *base* hostname (not enabled yet) is `tien404-v1723u-qa-inbound-locked-staging.tienmobi208.workers.dev`. Full URL is private and must append owner-generated random `QA_CALLBACK_PATH`.
- No `QA_CANARY_MODE`, `QA_HEADER_SECRET`, `QA_EVENT_PEPPER`, `QA_CALLBACK_PATH`, `QA_CHALLENGE`, time variables installed/verified. Thus Worker has no authorized ingress.
- Cloudflare account plan / current billing usage could not be independently certified through connector; cost gate remains fail-closed until owner verifies current usage and no upgrade.

## Owner-only setup
1. At Cloudflare Dashboard → Workers & Pages → this exact Worker → Settings → Variables and Secrets → Add, set:
   - `QA_HEADER_SECRET`: **Secret**, cryptographically random >=32 characters, **same value** as the new QA Bot's Zalo Bot Creator **Secret Token**; NOT the Bot API Token.
   - `QA_EVENT_PEPPER`: **Secret**, separate >=32 random characters for HMAC storage.
   - `QA_CALLBACK_PATH`: **Text**, unique `/qa/zalo-bot/<24-80 random URL-safe chars>`; keep it private.
   - `QA_CHALLENGE`: **Text**, `TIEN404-QA-<16-64 random URL-safe chars>`, the exact one-off test message.
2. Keep mode missing or `DISABLED` and workers.dev OFF. Save/Deploy Secrets. Check D1 binding was retained.
3. In **new QA Bot only** at Zalo Bot Creator → Thiết lập chung → Secret Token, enter the exact same `QA_HEADER_SECRET`. Do not reset Bot API token or modify old staging Bot. Do not click **Lưu thay đổi** until setup is fully inspected.
4. **At test start, not hours before:** set `QA_START_MS`, `QA_END_MS` as integer Unix milliseconds with 20-minute difference, and finally text `QA_CANARY_MODE=OWNER_SCOPED_PRIVATE_NO_SEND_ONCE`. The code rejects windows over 30 minutes or outside the window.
5. Confirm limited usage / billing, independent QA owner operator and rollback. **Only then** enable workers.dev (keep previews OFF), verify no-header request denied, and set full HTTPS callback in **new QA Bot only**. A distinct authorized test account sends one exact `QA_CHALLENGE`. Observe one D1 receipt and independently audit zero outgoing sends, no order/customer access.
6. Disable workers.dev and mode before the window ends; remove the QA-only webhook from the new Bot under the approved rollback. Keep old Bot unchanged.

Windows PowerShell 5.1-safe offline random generation (owner's machine, not in GitHub CI):
```powershell
function New-QAHex([int]$length) {
  $b = New-Object byte[] $length
  $r = [Security.Cryptography.RandomNumberGenerator]::Create()
  try { $r.GetBytes($b) } finally { $r.Dispose() }
  return ([BitConverter]::ToString($b)).Replace('-', '').ToLowerInvariant()
}
$qaHeaderSecret = New-QAHex 32
$qaPepper = New-QAHex 32
$qaCallbackPath = '/qa/zalo-bot/' + (New-QAHex 24)
$qaChallenge = 'TIEN404-QA-' + (New-QAHex 16)
# To copy locally, for example: Set-Clipboard -Value $qaHeaderSecret
# Just before opening the webhook:
$qaStart = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
$qaEnd = $qaStart + (20*60*1000)
```

## Risk note and evidence gates
- `X-Bot-Api-Secret-Token` is a shared header, NOT a payload signature. The receiver's HMAC is a privacy-preserving stored digest, NOT provider-signed proof.
- Official Zalo Bot webhook is POST JSON `{ok:true,result:{event_name,message}}`. The receiver also accepts a separately reported flat shape only under the same gates.
- Cannot independently assert account plan cost from current connected Cloudflare billing permissions. Do not activate a publicly reachable endpoint if billing usage cannot be confirmed within approved free/included limit.
- **Source-only CI PASS is not real Worker request UAT.** Real provider event and independent no-send acceptance remain BLOCKED pending secret configuration, private callback approval, and observed event.
- No token/secret/complete callback URL/private QA chat data in public repo. Never auto-publish, merge to production or touch old Bot. Keep Draft PR #394.
- Rollback of hosted exposure: disable worker.dev and QA_CANARY_MODE. Delete isolated D1/Worker only with separate destructive approval.

Official references:
- https://docs.zaloplatforms.com/docs/BOT/webhook
- https://developers.cloudflare.com/workers/configuration/secrets/
- https://developers.cloudflare.com/workers/configuration/routing/workers-dev/
- https://developers.cloudflare.com/d1/platform/pricing/
