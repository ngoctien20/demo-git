# TIEN404 V17.7H.6 — Private Zalo Creator ↔ n8n Published Webhook URL Match (NO TOKEN)

**2026-11-18 JST — SOURCE ONLY / LOCAL UI COMPARISON / REAL PROVIDER & STORE OWNER NO-GO**

## 1. Exact predecessor and direct read-only audit

Parent [V17.7H.5 Draft PR #390](https://github.com/ngoctien20/demo-git/pull/390) HEAD `70128be4ee4bb6ff909e1db0854d0bd8ad5af119`. The user already supplied `UNPINNED_BOT_ID_DISCOVERED_LOCAL_ONLY` from one real locally performed `getMe`, returning Bot ID to the **operator**; that proves a token can query a Bot, **not** an independent human Merchant owner. Bot Creator screenshots confirm a Zalo Bot is active and show a configured n8n-hosted webhook URL, but the screenshot cuts off the exact path.

Connected n8n read-only inspection on 18 Nov 2026:
- Published `TIEN404_ZALO_BOT_LAB_V1_STAGING` ID `yIJk8LvJoLF40Z62`, active version `2d912cb0-007f-452f-9536-b92ba12a03e6`, 12 nodes, **POST** `Zalo Bot Webhook (Protected)` with `headerAuth` credential slot, configured path (23 chars), `responseMode=responseNode`.
- Has two Data Table UPSERT nodes `Upsert V1 PII-Free QA Markers` and `Upsert EXT03 Marker V12.3 No PII` and calls other flows, including active `TIEN404_ZALO_V2_SHADOW_STAGING` which has a POST HTTP node. Therefore live event handling is not accepted as **zero writes/side-effects**; do NOT inject a test event into this Published webhook.
- The read-only tool did not call Zalo's `getWebhookInfo`, access Bot Tokens, alter n8n, or inspect customer payloads.

**Important owner choice:** owner prefers to defer Bot Token rotation until production. Previous PowerShell screenshot exposed a token-like plaintext string, so the security risk remains **OPEN P1**. This PR does **not** authorize further Bot Token use or rotation, and intentionally does not perform provider API requests. Do not change/reset the existing Bot Token, Webhook Secret Token, or webhook URL without specific owner approval.

## 2. A practical credential-free local comparison

The H.6 workflow compares ONLY two URLs manually copied by the **same authorized operator** in a trusted Windows terminal:

1. **Zalo Bot Creator → Bot TIEN404 AI → Thiết lập chung → Webhook URL**. Obtain the **full current saved** URL, not a partial screenshot. Do not click Save/Delete/Reset.
2. In n8n, open `TIEN404_ZALO_BOT_LAB_V1_STAGING` (`yIJk8LvJoLF40Z62`) → Published POST node `Zalo Bot Webhook (Protected)` → copy its **Production URL**, NOT `Test URL`.
3. On Windows with Node.js 22 and reviewed source from this PR, open PowerShell in the repository folder. If execution is blocked by policy, use only an already-reviewed **process-scoped** execution policy, never a permanent machine-wide change. Run `.\scripts\v177h6-private-compare-webhook-ui.ps1`. Type the exact confirmation **`COMPARE`** (not a token); then paste the Zalo URL and the n8n URL into **separate masked prompts**. Do **not** paste Bot Token or Webhook Secret Token into these URL prompts.
4. The local Node matcher rejects anything outside `https://ngoctien20.app.n8n.cloud/webhook/…`, URLs with query/fragment/credentials, URL test endpoints, encoded/ambiguous paths, and different exact paths. Only then returns `LOCAL_UI_URLS_MATCH_SOURCE_ONLY` or `LOCAL_UI_WEBHOOK_PAIRING_NO_GO`. No raw URLs, URL hashes or tokens leave the local process or appear in the result.
5. If mismatch, **STOP**; do not re-register, press Save, delete current callback or send test messages. Investigate which of the two interfaces reflects saved vs draft version privately. If match, classify evidence **`TWO_OPERATOR_COPIED_UI_URLS_MATCH_LOCAL_ONLY`**. This is evidence of **UI-level endpoint consistency only**, NOT native `getWebhookInfo`, Zalo Bot server-side webhook state, user role, owner, Store, JWT/RLS, message delivery or payment authorization.
6. Only if a separate private owner scope later permits reusing a secured Bot API token may an independent read-only `getWebhookInfo` API check provide a stronger provider-side endpoint readback. Do not conduct that check with a known exposed token at this stage.

## 3. Files & tests

- `qa/v17-7a-oa-independent/v17-7h6-private-webhook-ui-url-compare.mjs`: strict local HTTPS origin/path validation and constant-time compare of SHA-256 digests; returns **no URL content** and **zero external/Commerce/LLM calls**; all real native/owner and hosted permission flags remain false.
- `scripts/v177h6-private-compare-webhook-ui.ps1`: Windows PowerShell 5.1 masked prompt for **two URLs**, explicit `COMPARE` consent and temporary child-process ENV cleared in `finally`. Requires trusted local terminal and Node.js 22; not a production Vault. The input strings briefly exist in memory and can be inspected by privileged local processes; do not run under untrusted telemetry/recording.
- `scripts/v177h6-private-compare-webhook-ui.mjs`: refuses CI, GitHub Actions and non-interactive execution; sanitizes output; no network client.
- `qa/v17-7a-oa-independent/v17-7h6-private-webhook-ui-url-compare.test.mjs`: twelve offline cases for match/mismatch, test vs production, wrong host/port/scheme, query/userinfo, encoding/ambiguous paths, URL leakage, exact path case and CI refusal.
- `.github/workflows/v17-7h6-private-webhook-ui-match-offline.yml`: inherited 18 H.4 cases + 10 H.5 cases + 12 H.6 cases = **40** offline Node cases; all provider/hosted steps `if:false`.

**Caveats:** 1) Two self-pasted strings can match even when the provider has a different persisted callback. 2) The script contains a safe workflow ID reference but does **not** independently fetch the live n8n webhook URL: the human must select the Published node correctly. 3) A URL match does not imply webhook header Secret is correctly configured or that inbound event processing is no-side-effect. 4) No raw Zalo/n8n endpoint path was added to GitHub.

## 4. Release decision and rollback

- **VERIFIED:** existing Zalo Bot Published workflow POST path exists, headerAuth configured, Data Table and downstream side effects still possible. Bot ID was obtained by owner through getMe earlier, but independent Bot Creator rights not accepted.
- **IMPLEMENTED:** private UI-level no-token comparator for Windows; no new bot or webhook.
- **TESTED:** source tests only after exact HEAD CI PASS; user has not yet compared the two actual URLs.
- **BLOCKED:** independent provider webhook readback, native user/owner consent, canonical Store, JWT Store A/B RLS, independent M0 restore and hosted one-event **NO-SEND** admission.
- **NEEDS APPROVAL:** any credential reuse/rotation, provider API readback, actual webhook test, n8n Published edits, hosted deploy, payment/order/stock changes.
- **ROLLBACK:** close unmerged Draft PR; no hosted state or provider configuration changed.

**Checkpoint:** `V17_7H6_LOCAL_UI_WEBHOOK_MATCH_SOURCE_ONLY · PUBLISHED_ZALO_CALLBACK_READ_ONLY_AUDITED · BOT_TOKEN_EXPOSURE_P1_OPEN · REAL_PROVIDER_SAME_STORE_NO_GO`.
