# TIEN404 V17.7H.4 — Private Native Zalo Bot Read-Only Operator CLI (Windows, No Docker)

**2026-11-17 JST — SOURCE IMPLEMENTED; OFFLINE QA ONLY; REAL PROVIDER READBACK NOT EXECUTED IN THIS PR; OWNER / SAME-STORE / HOSTED CANARY NO-GO.**

## 1. Parent, ownership, and why this is not another synthetic review

- Direct parent [Zalo Bot owner H.3 Draft PR #373](https://github.com/ngoctien20/demo-git/pull/373), pinned HEAD `66da1056adc3aa52a854b515c68b2a4c30aa838b`. The parent offers an injected managed-secret **MOCK ONLY** readback and independent hard-NO-GO reviewer. No owner/provider identity is certified by those mock results. This child adds a **potentially real but manually authorized** local read-only transport path, without modifying the parent or copying any real secret.
- Cross-channel [V17.22H Draft PR #378](https://github.com/ngoctien20/demo-git/pull/378) independently audited no canonical Store or JWT/RLS admission; its hosted Messenger→Zalo order UAT remains NO-GO. No code from the cross-channel track or Store/RLS owner track is changed here.
- The current user has a Windows computer; use local PowerShell and Node.js, **no Docker** and no new paid infrastructure.
- **Zalo Bot and Zalo OA are separate**. This CLI uses only Zalo Bot, not OA OAuth.

## 2. Official API verification (current docs)

- Zalo Bot `getMe` — **POST** `https://bot-api.zaloplatforms.com/bot{BOT_TOKEN}/getMe` with empty JSON body; response `ok:true` and `result.id`, `result.account_name`:
  https://docs.zaloplatforms.com/docs/BOT/apis/getMe
- Zalo Bot `getWebhookInfo` — **POST** `https://bot-api.zaloplatforms.com/bot{BOT_TOKEN}/getWebhookInfo`, returns `ok:true` and `result.url`, `result.updated_at`:
  https://docs.zaloplatforms.com/docs/BOT/apis/getWebhookInfo
- Both operations read Bot configuration; **neither** sends messages, changes the webhook nor provides human Bot Creator session provenance. Token possession and a correct Bot ID are not legal merchant authority. No `sendMessage`, `setWebhook`, `deleteWebhook` or `getUpdates` is permitted.

## 3. New code

- `qa/v17-7a-oa-independent/v17-7h4-private-real-readback-gate.mjs` — validates independently pinned **numeric Bot ID**, explicit limited local consent, a one-shot ephemeral local secret callback, and strictly two permitted method responses. If `getMe` mismatches the pinned Bot ID it fails before the second API call. On success it returns only SHA-256 of the Bot ID and configured webhook URL, a boolean for existing webhook, a timestamp and explicit **owner/Store/JWT/hosted NO-GO**. Even a valid two-readback result cannot certify independent owner authority.
- `qa/v17-7a-oa-independent/v17-7h4-private-pinned-https-transport.mjs` — fixed Zalo Bot API hostname, TLS certificate validation, POST JSON, max 8 KiB response, 7-second timeout, no automatic redirects or retries. Errors are redacted rather than returning a token-bearing URL.
- `scripts/v177h4-private-bot-readback.mjs` — **OFF BY DEFAULT** local Node process, rejects GitHub Actions/CI/non-interactive use, consumes token from short-lived environment populated by the trusted local wrapper, clears environment values before requests, and prints only sanitized status/digest. If a webhook already exists, classify `EXISTING_WEBHOOK_HARD_STOP_OWNER_UNVERIFIED`.
- `scripts/v177h4-private-bot-readback.ps1` — Windows PowerShell local launcher, prompts for Bot ID and `READONLY` consent, requests Bot Token using **masked SecureString**, clears environment and BSTR memory in `finally`. No public log, raw provider response, screenshot, credential or actual API request is placed in GitHub.
- `qa/v17-7a-oa-independent/v17-7h4-private-real-readback.test.mjs` — **18 offline fake-transport tests** for exact allowlist, secret URL redaction, no-provider owner escalation, wrong Bot ID, existing webhook hard stop, malformed response, HTTPS host pinning, request failures and CI refusal.
- `.github/workflows/v17-7h4-private-readonly-cli-no-live.yml` — only test fakes; the real operator job is statically disabled (`if:false`).

## 4. When the user is ready — private manual operation (NOT performed here)

**Preconditions before executing**, not achieved by this source PR:
1. Verify the actual Bot ID in the currently logged-in Bot Creator account on your own phone. Confirm whether this is the existing TIEN404 Bot used by active n8n `yIJk8LvJoLF40Z62`. If uncertain, **do not use this as a dedicated QA Bot**.
2. Obtain explicit consent only for these **two read-only calls**, using a trusted Windows account/workstation, with security tracing/transcripts/screenshare recording disabled and provider traffic allowed. Do NOT paste token or token-bearing URL in chat or GitHub.
3. Use Node.js, Git and the latest code of this Draft PR in a dedicated temporary local folder. Confirm source commit SHA first. **Never execute a script from an untrusted URL**, and review the PowerShell code/Node entry before running.
4. Run the local `scripts/v177h4-private-bot-readback.ps1`; the script will ask for the numeric Bot ID, display the two allowed methods, ask you to explicitly type `READONLY`, and prompt for the **Bot Token with hidden characters**. This is user-initiated. It is not automatically invoked by this chat or CI.
5. After the manual process, share **only** the status class and whether an existing webhook was found, not Bot ID digest, webhook URL digest, Bot ID, Bot Token, customer fields or credential logs. The SHA hashes are local evidence only.
6. If status is `EXISTING_WEBHOOK_HARD_STOP_OWNER_UNVERIFIED`: STOP; do not repoint, delete or replace the current callback. Match its configuration with the existing n8n provider route privately. For a disposable isolated QA Bot, create a separate Bot **only after** owner approval and budget/impact review.
7. If status is a valid two-call readback, it still proves **token access to the Bot ID only**. It does not verify who currently owns the Bot Creator session or that the Bot/Meta Page are bound to the same canonical Store.

**Security limitation:** The official token appears in the HTTPS URL path. It is not printed by these scripts, but could still appear in external TLS proxies, system/APM tracing or endpoint inspection. Use only a privately approved workstation/network with no URL logging. PowerShell's ephemeral child-process environment is still visible to sufficiently privileged local processes; this is **not** a managed production Vault. Do not present it as one. For production, use independently approved managed secret broker infrastructure with a stricter private audit.

## 5. GO/NO-GO and rollback

- **VERIFIED:** official Zalo Bot read-only API shape, connected previous parent mock-only source and no existing current hosted Store scheme per V17.22H.
- **IMPLEMENTED:** opt-in local native read-only transport/CLI and Windows masked token launcher.
- **TESTED:** only synthetic transport/CI until the exact HEAD job succeeds.
- **NOT EXECUTED:** real provider getMe or getWebhookInfo, no live Bot Owner proof, no hosted canary.
- **BLOCKED:** original Bot Creator owner role and same-Store binding, independent private operator review, actual Meta Page authority, full M0 recovery acceptance, canonical Store/JWT/RLS, one-event native no-send approval.
- **NEEDS APPROVAL:** running the real local two-method API readback; any new QA Bot, provider callback, paid resource, credentials change or live UAT remains a separate action.
- **ROLLBACK:** close this child Draft PR. No hosted resources, customer files, Bot settings or secrets have changed.

**Checkpoint:** `V17_7H4_PRIVATE_LOCAL_TWO_METHOD_RUNNER_SOURCE_READY · OFFLINE_CI_TESTED_PENDING · REAL_NATIVE_GETME_NOT_EXECUTED · MESSENGER_ZALO_HOSTED_NO_GO`.
