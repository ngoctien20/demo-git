# TIEN404 — V17.7H.4U: Private Zalo Bot ID Discovery without Creator Bot ID (NO SEND)

**2026-11-18 JST · SOURCE IMPLEMENTED + OFFLINE TESTED · PRIVATE LOCAL GETME NOT EXECUTED · REAL OWNER/STORE NO-GO**

## Reason for this patch
- The actual creator confirmed the Zalo Bot Creator UI did not show a usable numeric Bot ID. Earlier PR #381 assumed a pre-pinned numeric ID and would stop at that precondition.
- The documented official Zalo Bot Creator `getMe` API returns `result.id` as a numeric string, along with `result.account_name`; this is the minimal safe provider read-only method to **discover** the ID before the existing pinned two-method check.
- This is a follow-up to PR #389 real customer `TIEN404 EXT 03` ingress/owner gate PASS. It does not modify the published n8n webhook nor bind a Store.

## Source implementation, strictly local
- `qa/v17-7a-oa-independent/v17-7h4u-private-bot-id-discovery.mjs`: explicitly consented, one-call-only `getMe` via the existing PR #381 pinned TLS transport (exact `https://bot-api.zaloplatforms.com/bot{TOKEN}/getMe`); validates string ID, response shape and account name, never authenticates a merchant Owner or Store.
- `scripts/v177h4u-private-bot-id-discovery.mjs`: OFF BY DEFAULT, requires interactive local TTY and `T404_H4U_OPERATOR_CONSENT=OWNER_CONSENT_GETME_ONLY_LOCAL` populated by Windows wrapper; denies any CI/GitHub Action use; does not print raw response, token, provider URL or webhook URL. Only private local console displays numeric Bot ID and account name.
- `scripts/v177h4u-private-bot-id-discovery.ps1`: Windows no-Docker launcher with explicit **DISCOVER** consent and masked `SecureString` Bot Token prompt; never puts token into script arguments and clears process environment/BSTR memory after completion.
- Separate offline test suite checks unexpected token, wrong response ID, numeric unsafe JSON ID, fake transport, missing consent, network errors and no Store promotion. CI never connects to Zalo.
- Existing `scripts/v177h4-private-bot-readback.ps1` stays unchanged and requires explicit numeric ID plus separate approval to read `getMe` AND `getWebhookInfo`. Reuse discovered local ID from U only if separately authorized. No automatic chaining or changes to webhook.

## Private operator procedure — first read-only step
**Do not paste Bot Token, numeric Bot ID, provider result, webhook URL or local transcript in GitHub/ChatGPT. Do not upload screenshots showing these.**

From an ordinary PowerShell window (not as Admin), get the exact PR #389 branch in an isolated folder. The default PowerShell location may be `C:\WINDOWS\system32`; explicitly change directory:

```powershell
cd $HOME
git clone --depth 1 --single-branch --branch work/v177h4t-zalo-customer-boundary-nosend-20261118 https://github.com/ngoctien20/demo-git.git "$HOME\tien404-zalo-private-qa"
cd "$HOME\tien404-zalo-private-qa"
Test-Path ".\scripts\v177h4u-private-bot-id-discovery.ps1"
```

If the last command returns `True`, inspect the script before execution. Ensure Node.js 22+ is installed: `node --version`. Disable terminal recording, HTTP proxy URL logging and any process dump/telemetry capturing credentials. On a trusted private Windows workstation, run:

```powershell
.\scripts\v177h4u-private-bot-id-discovery.ps1
```

- Type `DISCOVER` to permit **ONE getMe read-only request**.
- Enter the Bot Token **on your own device** using the masked prompt. This is the token of the *existing* Bot TIEN404 AI, NOT an OA OAuth token.
- Output `PRIVATE_GETME_BOT_ID_DISCOVERED_NOT_OWNER_VERIFIED` with `localBotId` and `localAccountName` means the credential authenticated to a Bot profile. Do not share that ID or output; locally compare which Bot you are accessing.
- Output `PRIVATE_BOT_DISCOVERY_NO_GO` or `PRIVATE_OPERATOR_BLOCKED` means STOP with no webhook changes.
- **Do not run a second readback automatically**. If the ID was discovered, the old PR #381 local pinned readback may be separately consented later for `getWebhookInfo`; do not switch webhook or token.
- This method does not prove human account ownership, merchant installation, or Store A/B isolation. Token possession is necessary but insufficient for live use.

## GO / NO-GO
- **VERIFIED:** Zalo official POST getMe response schema and local source-only unit tests.
- **NOT VERIFIED:** actual operator used Bot Token on Windows; Bot Creator human session, provider-native ownership, actual Store binding, same-tenant A/B JWT/RLS, real customer cross-channel identity link.
- **MUTATIONS:** GitHub Draft PR only. No n8n draft/published edits, Supabase migration/data writes, Cloudflare, customer messages/orders, Bot settings, token reset or expense.
- **COST:** no new hosted resource; no Docker needed on Windows.
- **ROLLBACK:** revert files in PR #389 or close PR; hosted runtime was untouched.

Checkpoint: `V17_7H4U_SOURCE_GETME_DISCOVERY_READY · NUMERIC_BOT_ID_NOT_REQUIRED_UPFRONT · REAL_OWNER_STORE_JWT_NO_GO · NO_SEND`.
