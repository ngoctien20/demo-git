# TIEN404 V18.7.6C-M3-H2 — Secret Binding × HTTPS Callback × Meta Test Delivery

Date: 2026-11-19 JST | **PREPARATION ONLY / NO LIVE SECRET BINDING / NO PUBLIC CALLBACK**
Parent Draft PR: #460. This is a stacked QA candidate; do not merge/publish.

## Actual Cloudflare state (read-only checked)
- Account: existing TIEN404 Cloudflare account.
- Script: \`tien404-meta-messenger-qa-canary-v1876cm3\`, one deployed version, code from M3 source SHA \`5727b6ab0df4f466073ea4c5600151ad1078a0d7\`.
- \`INSPECTOR_MODE=ISOLATED_QA_ONLY\`, \`INSPECTOR_ENABLED=false\`.
- \`workers.dev\` routing disabled; zero custom Worker domains attached.
- **Neither \`META_APP_SECRET\` nor \`META_VERIFY_TOKEN\` binding exists.**
- Workers account usage model: standard. Account billing/subscriptions/spend-policy API requests returned 403. **The paid/free plan, current quota, spending alerts and available headroom are UNVERIFIED.**
- Meta QA App ID \`2366045790814059\` exists per owner's screenshots; Webhook Page callback, Verify Token, Page subscription and Page access token not configured in screenshots.
- Primary Meta App callback / n8n Messenger Published remain unchanged.

## Prerequisite: owner-side billing check (blocks activation)
In Cloudflare Dashboard, review **Workers & Pages → Plans** and **Billing → Spend Management**, and confirm the current plan and usage. Never create an upgrade or paid feature for this QA. A spending limit applies across all account Workers and can stop other TIEN404 Workers, so do **not** set/change the account-wide cap without an impact review. If current plan cannot guarantee no additional charges, leave ingress disabled.

Cloudflare docs:
- https://developers.cloudflare.com/workers/platform/limits/
- https://developers.cloudflare.com/workers/platform/spend-management/

## Secret Binding procedure — OWNER ACTION (not executed)
1. Open Cloudflare Dashboard → Workers & Pages → \`tien404-meta-messenger-qa-canary-v1876cm3\` → **Settings → Variables and Secrets → Add**.
2. Select **Secret**, exact name \`META_APP_SECRET\`. Obtain the **App Secret from the NEW Meta QA App**, not the main TIEN404 Meta App. Copy the value directly in your authenticated browsers; never paste it into ChatGPT, GitHub, n8n, source files, screenshots or logs.
3. Select **Secret**, name \`META_VERIFY_TOKEN\`. Locally generate a distinct, random, >=32-character high-entropy token and keep it available to paste into the Meta QA App's Verify Token field. Do NOT reuse the main Meta App's Verify Token.
4. Click **Deploy** in Cloudflare to apply the two secrets. Confirm the **name and binding type Secret only**. Do not expose values or switch \`INSPECTOR_ENABLED\` to true yet.
5. Verify Worker still shows \`INSPECTOR_ENABLED=false\` and \`workers.dev\` disabled after the change. Do not add a production route, KV, D1, storage or AI integration.

Reference: https://developers.cloudflare.com/workers/configuration/secrets/

## HTTPS activation — SEPARATE GATE after all prerequisites
1. Confirm billing and secret binding metadata; verify main App callback unchanged and that only independent QA App \`2366045790814059\` will connect.
2. Explicitly authorize enabling \`INSPECTOR_ENABLED=true\` and \`workers.dev\` **for the isolated QA Worker only**, with a short test window and rollback. The callback must be reachable by Meta; an interactive Cloudflare Access login in front of GET/POST will prevent Meta verification.
3. Candidate callback URL after activation, **NOT CURRENTLY ACTIVE**:
   \`https://tien404-meta-messenger-qa-canary-v1876cm3.tienmobi208.workers.dev/meta-qa/webhook\`
4. Execute negative HTTPS tests before Meta registration: wrong path should 404; wrong verify token 403; missing/bad HMAC 401; invalid/malformed JSON denied; oversized payload denied. These results must be from the hosted version, not only local tests.
5. In the new Meta QA App → **Messenger API Settings / Webhooks → Page**, enter that HTTPS URL and locally generated Verify Token, then click **Verify and Save**. Do not enter the App Secret in Meta's Verify Token field.
6. In QA App, subscribe the minimum fields (start \`messages\`, \`messaging_postbacks\`); then run **Test → Send to My Server** for a single field. This sends to the App's configured callback, NOT to any arbitrary n8n or Worker.
7. For additional fields (\`message_deliveries\`, \`message_reads\`, \`message_echoes\`, \`messaging_handovers\`), test one at a time and record which exact field Meta sends under \`entry[].changes[]\` or \`entry[].messaging[]\`.
8. Check HTTP delivery status and safe event type/count only, with no raw payloads. For a real Page conversation event, use a separate QA Page actually subscribed to the QA App and authorized test-role account.
9. If 403/401/422/5xx repeats, errors, or unexpected traffic occur, immediately disable \`INSPECTOR_ENABLED\`; if needed disable workers.dev in the QA Worker. Do not change any primary App or Published n8n connection.

## Important distinctions
- GET Verify Token validates the setup challenge, it is NOT an App Secret and does not authenticate a POST.
- POST must verify \`X-Hub-Signature-256\` over exact raw bytes with the QA App Secret; signed payload only identifies correct secret use, not tenant/store authority.
- Meta dashboard Sample/Testing field wrappers can differ from normal Page message webhooks. Only \`messaging_postbacks\` under \`entry[].changes[]\` has direct signed n8n evidence from existing callback execution #5533.
- This Worker has **no durable receipt inbox/log** and is not approved for downstream actions. For actual event UAT, record only redacted status/counters, Cloudflare telemetry and QA run references. Do not claim stored evidence where none exists.
- The service remains **NO-SEND, NO-WRITE, NO-ORDER-ACCESS, STORE AUTH NO-GO**. No runtime API integrations are installed.

## Owner evidence checklist (non-secret only)
- [ ] Cloudflare plan/current spend and safe quota checked by owner
- [ ] Two QA-only Secret bindings exist (names/types only)
- [ ] Worker remains locked before activation
- [ ] Explicit hosted activation approval (if not already covered by an approved test window)
- [ ] Wrong token and bad signature hosted tests PASS
- [ ] Correct GET challenge responded 200 from QA callback
- [ ] Meta QA App Page Webhooks verified callback and minimum fields subscribed
- [ ] Page-level app subscription verified separately
- [ ] First signed Meta QA delivery redacted evidence captured
- [ ] No AI, customer data, provider sends or orders involved
- [ ] Disable/rollback rehearsal passed

## Rollback
- Initial preparation: close Draft PR, keep Worker flag false and workers.dev disabled.
- After owner-enabled test: disable QA Worker flag and workers.dev; adjust only QA App subscriptions after approval. Do not delete/rotate primary credentials or alter n8n Published.
