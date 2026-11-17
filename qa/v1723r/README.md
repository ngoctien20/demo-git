# TIEN404 V17.23R — Real Bot WebhookInfo × Dedicated QA Bot NO-GO × Private One-Event Gate

**Draft only. Production and real cross-channel UAT NO-GO.** Parent: [V17.23Q PR #380](https://github.com/ngoctien20/demo-git/pull/380), SHA `7650ece388525766f759098903f3f32835c40336`.

## Direct live read-only evidence

- Existing Zalo Bot identity: n8n workflow `xayBLEyUwd64mcLK`, manual execution **#5087**, `success`, real provider `getMe` via protected Gateway, HTTP **200**, marker `ZALO_GETME_READONLY_CONFIRMED`. Bot Store/Owner authority **not verified**.
- **NEW** Zalo Bot webhook metadata: n8n workflow `bD510xyr5jBHQ99K`, manual execution **#5088**, `success`, sanitized marker `ZALO_WEBHOOK_INFO_READONLY`, `has_webhook=true`, `matches_staging_webhook=true`, `matches_test_webhook=false`, workflow-reported `external_sends=0`, `configuration_changes=0`. No webhook URL or credential exposed.
- Audited existing Cloudflare Worker `tien404-zalo-outbound-v1-staging` `POST /v1/webhook-diagnostics` before running: authenticates request and requires sending disabled; makes read-only Zalo Bot API `getWebhookInfo` and `getMe` calls, **no** `setWebhook`, `deleteWebhook`, `sendMessage` or database write in that branch.
- This Bot is **already bound to the existing staging callback**. It is not eligible for a new *dedicated* provider-only QA callback without disturbing staging. **Do not reassign/delete the webhook, call getUpdates in webhook mode, or send to this Bot to fabricate a private canary.**
- Zalo V1 `yIJk8LvJoLF40Z62`: all **11** returned execution records were manual, no real webhook-mode execution. Zalo V2 shadow `OgDZNSAvKEvhnAvn`: **1** manual execution. Thus no independently confirmed native provider-delivered QA event in these sources.
- Supabase read-only: `public.stores` and `store_memberships` absent, 0/6 store_id columns across Commerce, channel/customer/order ownership maps empty, five Auth session rows do not attest two real JWT Store A/B. Previous owner M0 backup deferral retained.

## Implementation (source only)

- `provider-real-evidence-gate.mjs`: strict allowlisted summaries of #5087/#5088; blocks reused staging webhook, missing independent Owner/Store proof, forged or extra/credential metadata, and all hosted actions.
- `evaluateOneRealEventAdmission`: 10 prerequisite categories for a **separate dedicated QA Bot** and independently authenticated private receiver. Always returns `PRIVATE_REAL_EVENT_NO_GO` regardless of caller-supplied flags. It cannot verify signatures, real events, ownership, durable replay or a real JWT.
- Adversarial negative tests and standalone GitHub Actions. No customer PII, raw webhook, provider token, callback URL or private keys are stored in public CI.

## Minimum private Track A approval-gated plan

1. Owner identifies or creates a **different** Zalo Bot dedicated to QA, shows ownership from the official provider admin in a private authenticated channel. Written scoped no-send/no-write consent; separate independent verifier or trusted out-of-band identity.
2. Verify QA Bot **read-only** `getMe` and `getWebhookInfo` with managed secrets; ensure it does not share the current staging callback/credential. Do not call `setWebhook` before explicit approval of the isolated destination and rollback.
3. Approved isolated private ingress: current official provider mechanism (Zalo Bot `X-Bot-Api-Secret-Token` is a **shared-secret header**, not a signature of payload bytes), TLS, installation→Bot binding, rate limits, strict event-size/type, **durable atomic replay**, zero outgoing messages, zero Commerce/Customer access.
4. After explicit authorization to update the **separate QA Bot only**, send **one user-origin test message**, verify one actual inbound event plus wrong-header/replay/foreign-Bot negatives. Provider-origin authenticity, delivery audit and no-send independently signed in private vault. No secrets or event details to GitHub.
5. Separate real Supabase JWT Store A/B UAT remains blocked pending M0, canonical ownership and Store-scoped RLS. Provider-only acceptance never grants real Order reads.

## Safety and rollback

Only hosted action in V17.23R: a read-only provider API operation through already connected gateway; #5088 reports no sends/configuration changes but these are gateway assertions, not independent provider-log proof. No changes to n8n Published, Cloudflare routes/Workers, Supabase, RPC, Meta/Zalo webhook, credentials or customer data. Close child Draft PR to roll back source-only changes. No production deployment.
