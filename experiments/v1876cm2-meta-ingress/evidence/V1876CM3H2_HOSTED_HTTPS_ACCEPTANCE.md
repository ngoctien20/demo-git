# TIEN404 — V18.7.6C-M3-H2 Hosted HTTPS QA Canary Acceptance

Date: 2026-11-19 JST. Scope: **only QA Canary**; no Messenger Published, primary Meta App, Supabase, n8n, provider send or order changes.

## VERIFIED — Cloudflare runtime
- Worker script: `tien404-meta-messenger-qa-canary-v1876cm3` under TIEN404 Cloudflare account.
- Owner screenshot confirmed Cloudflare Workers plan is **Free ($0)**; no account-wide spend cap modified.
- Bindings: `INSPECTOR_MODE=ISOLATED_QA_ONLY`, `INSPECTOR_ENABLED=true`, `META_APP_SECRET=secret_text`, `META_VERIFY_TOKEN=secret_text`. No secret values were fetched, logged, shown or copied.
- `workers.dev` is **enabled** for QA Worker. Preview URLs disabled; no matching Worker custom domains.
- Callback URL: `https://tien404-meta-messenger-qa-canary-v1876cm3.tienmobi208.workers.dev/meta-qa/webhook`.
- This is **public HTTPS ingress** with a constrained validator, **not** verified Meta integration.
- Worker code continues to return only generic error reason / sanitized event counts and hardcoded NO-SEND flags. No AI, network forwarding, DB, Commerce read/write, or provider send.

## VERIFIED — real public HTTPS negative acceptance, GitHub Actions
- First gated stage: [run #44524620136](https://github.com/ngoctien20/demo-git/actions/runs/44524620136), `INSPECTOR_ENABLED=false`: wrong-token GET **503**, bad-signature POST **503**, PASS.
- Next enabled stage: [run #44524829388](https://github.com/ngoctien20/demo-git/actions/runs/44524829388), `INSPECTOR_ENABLED=true`: wrong-token GET **403**, bad-signature POST **401**, PASS.
- Expanded live HTTPS: [run #44525097666](https://github.com/ngoctien20/demo-git/actions/runs/44525097666), commit `28cbf74fce631e866ff5bd7c3466237a43117da1`: wrong-token GET **403**, bad-signature POST **401**, invalid path **404**, unsigned POST **401**, invalid Content-Type **415**, PASS.
- No genuine App Secret or Verify Token was included in GitHub Actions. These are **negative** remote acceptance checks only.
- Existing offline Node regression suite: **84/84 PASS** at earlier checkpoint; new smoke script separately verified with real HTTPS. Confirm exact HEAD workflow result before claiming full suite on the latest SHA.

## PENDING — Meta QA application callback verification
1. Owner opens **Meta QA App ID 2366045790814059**, Messenger API Settings or Webhooks > Page.
2. Enter the full Callback URL above into **Callback URL**, and the same distinct **META_VERIFY_TOKEN** value privately saved when creating the Cloudflare Secret into **Verify Token**. **Never use App Secret for Verify Token. Never paste secrets to GitHub, ChatGPT, n8n or screenshots.**
3. Click **Verify and Save**. Expect GET 200 challenge with correct token; **this positive response has not been observed by the assistant**.
4. Register **only** `messages` and `messaging_postbacks` initially in **QA App**. Preserve original Meta App subscriptions and callback.
5. Send a sample **messaging_postbacks** from **QA App** Test > Send to My Server, one controlled event at a time. The QA Worker does not send replies or write orders; it validates HMAC over raw body.
6. Verify Meta reports successful test delivery, check Cloudflare Worker request/error metrics; do not interpret a request count alone as proof of specific event field. A later redacted receipt mechanism may be needed for independent field-level proof. Current Worker intentionally has no durable event inbox or logs.
7. Test Page-level subscribed_apps, app roles and real user messaging separately; dashboard sample alone is not proof of Page/customer event delivery.
8. Stop on any unexpected error, abnormal quota usage or traffic. Disabling `INSPECTOR_ENABLED=false` **and** workers.dev is the planned rollback, strictly limited to QA Worker.

## Security and unresolved gates
- Main Meta App and Messenger Published remain intact. Original Messenger workflow `Z7FdV7uDvApfbURQ` published version `1064b1b3-d3f1-4a6b-a367-2414ba691522` was Active on last check.
- QA Meta App binding **names/types** verified, but actual secret values intentionally not read; correct token acceptance and valid signed POST remain **UNVERIFIED**.
- If QA App Secret was ever stored as plaintext before conversion, rotate/regenerate **QA-only** secret after reviewing exposure; changes to credentials are owner-controlled.
- Real Owner A/B/C JWT Store RLS and any Commerce/private order access remain **NO-GO**.
- No live user messages, provider sends, tenant/store resolution, order writes, payment or production rollout authorized.

## Rollback
On owner request or unexpected traffic, set the QA Worker's `INSPECTOR_ENABLED=false` and disable its workers.dev route. Do NOT touch the primary Meta App, its Callback URL, n8n Messenger Published or any real Commerce records. Closing the Draft PR alone does NOT disable this hosted Worker.

Checkpoint: `V18.7.6C-M3-H2 | PUBLIC QA HTTPS NEGATIVE TESTED | QA SECRETS BOUND | META VERIFY&SAVE PENDING | NO SEND | NO WRITE | STORE AUTH NO-GO`.
