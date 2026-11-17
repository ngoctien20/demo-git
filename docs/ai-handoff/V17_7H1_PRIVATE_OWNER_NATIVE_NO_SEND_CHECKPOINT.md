# TIEN404 AI — V17.7H.1 Verified QA Bot Owner × Private Operator Consent × Native Webhook No-Send Admission

Date: 2026-11-17 JST. **SOURCE-ONLY implemented; real provider-owner and externally delivered signed webhook NO-GO.**

## 1. Exact parent checkpoint and scope

Parent Draft [PR #343](https://github.com/ngoctien20/demo-git/pull/343), HEAD `f04b2d28d9aa6d2897fa6f36f31bdd539eb47829`, 484/484 offline QA with 8/8 CI green. Existing Cloudflare Worker `tien404-v177h-provider-nosend-inactive-staging`, ID `0265c4d1f3d64f9196eb7587b8f1a552`, version `c39b8e9d-2dfc-454d-b29d-40b495ff2043`. Current read-only Cloudflare reinspection reconfirmed: one saved version; **zero deployments**, `deployed_on=null`, workers.dev and previews disabled, no bindings, no cron, no custom domain. The worker's 404 source is NOT executing externally.

Existing n8n manual-only QA `MQcbjLWZ5QUTJW0k` inactive. Existing Zalo Bot LAB webhook `yIJk8LvJoLF40Z62` Published and may UPSERT PII-free QA markers. Existing Messenger TEST has HTTP SEND. No live webhook, credential, credential vault, provider Bot, Facebook Page, published n8n workflow, Cloudflare Access/R2, Supabase DB or real Customer data was modified in this V17.7H.1 phase.

Supabase `ifxlvrhyjhbzbrkdsida`: current private QA tenant_identity_map 2 tenants, max one Store per tenant; **0 same-Tenant real Store A/B auth UAT**. The canonical Store schema/RLS migration remains Draft PR #247, not part of this branch. This is not a customer Commerce reader rollout.

## 2. Official Zalo Bot authority and no-disruption contract

- Zalo Bot Manager → Bot Creator is where the creating Zalo account sets up a Bot; the platform sends the **Bot Token** via Zalo chat to that account. **Token possession alone does not prove current human/Store owner authority.** Source: https://docs.zaloplatforms.com/docs/BOT/create_bot
- `getMe` at `POST https://bot-api.zaloplatforms.com/bot{TOKEN}/getMe` returns Bot ID/account_name. This is a *read-only business operation* despite being HTTP POST. A real getMe call has **NOT** been executed; token must be consumed only by a separately authorized managed-secret private runner. Never store the raw token or a URL containing it in GitHub/chat/logs. https://docs.zaloplatforms.com/docs/BOT/apis/getMe
- `getWebhookInfo` at `POST .../getWebhookInfo` obtains current callback URL before any change, again read-only in business semantics. **NOT** executed in V17.7H.1. https://docs.zaloplatforms.com/docs/BOT/apis/getWebhookInfo
- `setWebhook` is a MUTATING operation and includes the `secret_token` used for incoming `X-Bot-Api-Secret-Token`; never call it here or repoint the existing active Bot. https://docs.zaloplatforms.com/docs/BOT/apis/setWebhook
- Zalo Bot incoming webhook JSON `ok.result` was corrected in PR #342; Zalo Bot shared secret header differs from Meta raw-body HMAC and native Zalo OA OAuth/signature. https://docs.zaloplatforms.com/docs/BOT/webhook
- If one existing Bot is already in production, dedicate a separate disposable QA Bot instead of reusing/redirecting its callback. Avoid touching any customer interactions. After a real pilot, reset/revoke disposable QA Bot token using Bot Creator, with owner approval; official docs say tokens persist until reset. https://docs.zaloplatforms.com/docs/BOT/authorize

## 3. Required real independent identity protocol — PROPOSED, NOT EXECUTED

A. **Owner channel control:** real Bot Creator owner authenticates in provider-owned UI through separate private controlled session. Independent operator verifies exact QA Bot ID and its management scope. A screenshot or arbitrary bearer token is insufficient evidence of Merchant/Store ownership. Never request raw Bot Token, cookie, password, JWT, OTP or secret in ChatGPT.

B. **Trusted readback:** operator with scoped written owner permission uses private secret vault to execute real `getMe`, pins returned `result.id` to the disposable QA Bot; executes `getWebhookInfo` only to discover whether the Bot already has a callback. If callback exists, **STOP** rather than calling `setWebhook` automatically. Do not emit response URL or Bot Token in CI, audit only redacted digest and independent receipt.

C. **Three-role challenge:** owner, independent TIEN404 operator and QA/security reviewer sign a short-lived nonce/challenge bound to exact Bot ID, installation, staging project and NO-SEND scope, using a privately trusted credential issuer. Actor identities and role assignments must be independently verified; the temporary offline Ed25519 keys used in CI **do not create actual permissions**. One challenge consumed once in a real durable ledger; expiry 10 minutes. Consent expires and is revocable.

D. **Merchant/Store rights separately:** real customer Store owner requires original four source row Merchant evidence G0 and same-Tenant Store A/B real JWT/RLS G3 via RPC10 PR #247. Bot admin rights must **never imply** Supabase Store owner role, Tenant scope, price or order writes.

E. **Webhook staging activation (separate approval):** only after all above, approve bounded spend/quota, one dedicated QA Bot, one private callback staging Worker (not Merchant RPC16), signed Header, strict installation registry, hosted durable replay and no-send lock. Use a separate inactive version first, inspect routes/public URL/preview before any activation. User/operator must approve exact domain and scope; no published legacy webhook changes. The currently saved V17.7H Worker is 404-only and has **no live route**, so it cannot receive provider events.

F. **Independent external UAT:** one benign QA message from explicitly authorized test account after route approval; independent QA confirms native ingress receipt, wrong-header deny, duplicate replay deny, wrong Store deny, rate bound, original delivery records and zero send, zero order, zero stock (from authoritative provider, n8n, Supabase audit logs). Real edge denials require real external requests; no synthetic fixture counts as real cloud UAT.

G. **Rollback:** revoke the pilot admission/managed secret, disable route/Worker, restore QA Bot's previous webhook only if changed under authorization, and verify provider/DB logs. Do not delete the old RPC16 Merchant Worker, RPC17.2 code, or published Messenger/Zalo Bot workflows. Current V17.7H.1 source rollback = close this new Draft child PR; hosted worker version remains inert and unchanged.

## 4. Source-only implementation

- `qa/v17-7a-oa-independent/v17-7h1-three-role-owner-challenge-offline.mjs`: offline Ed25519 verify with role-domain-separated canonical challenge (owner, operator, independent reviewer), QA audience, one installation/provider, max 10-minute TTL and injected mock replay reservation. Keys are ephemeral in CI tests. The module **cannot authorize real provider account or Store** even when signatures pass.
- `qa/v17-7a-oa-independent/v17-7h1-three-role-owner-challenge-offline.test.mjs`: positive role signatures + negative tests for replay, wrong channel, changed Bot ID, tampered signature, key/actor overlap, expired challenge, raw token/PII, send/Commerce scopes.
- `qa/v17-7a-oa-independent/v17-7h1-zalo-owner-readback-offline.mjs`: synthetic strict `getMe` and `getWebhookInfo` shape, mismatch denial and no-overwrite; **never calls real API**. Token controls Bot API, not human identity.
- `qa/v17-7a-oa-independent/v17-7h1-zalo-owner-readback-offline.test.mjs`: negative readback and URL handling. Never emits token, real owner or webhook URL to logs.
- `qa/v17-7a-oa-independent/v17-7h1-hosted-owner-readiness-evidence.json`: directly audited cloud Worker ID/version, no deployment/route/binding, n8n inactive and Supabase Store A/B blocked. Explicit untested flags.
- `.github/workflows/v17-7h1-private-owner-native-nosend.yml`: inherited V17.7A–H Node test suites, source syntax, static no provider network/no send/no Commerce write and read-only evidence assertions.
- This checkpoint.

## 5. Security threat checklist and acceptance

| Threat | Source-only mitigation / real acceptance gap |
|---|---|
| Malicious actor rents TIEN404, claims Bot owner | Private provider admin login + independently verified signed 3-role challenge; **not yet tested** |
| Stolen Bot Token or spoofed getMe response | Token only proves API access; check exact provider ID, real owner session, current privilege; no token in public evidence |
| Fake Tenant/Store from event | Trusted server installation registry, mandatory separate RLS, fail closed |
| Cross-channel identity mix | Never equate Zalo ID to Meta Page sender/Website session |
| Replay or changed webhook | Separate durable on-host ledger and read-only getWebhookInfo, never auto setWebhook |
| Prompt injection / malware via link or uploaded file | No file/URL ingestion into this owner proof; RPC16 quarantined R2 and scanner are separate security gates, not authorized to open |
| Provider send or Commerce write during QA | No-send/no-write policy; actual logs **not available** until approved real event |
| Public URL exposed by accident | V17.7H Worker is version-only; workers.dev/previews off, 0 deployment and routes; verify again before changes |
| Excess cost | No new resources in H.1; real staging route/DO requires independent budget authorization |

## 6. Current evidence and go/no-go

- VERIFIED: parent Draft PR #343, inactive Cloudflare Worker metadata/version, n8n manual workflow, Supabase QA mapping; official Zalo Bot Create, getMe, getWebhookInfo, setWebhook contracts.
- IMPLEMENTED: PRIVATE QA owner/three-role signature **synthetic** protocol, Zalo Bot read-only response contract, negative test suite and evidence.
- TESTED: only after exact final PR HEAD CI success; not real Bot Creator owner UAT.
- BLOCKED: real QA Bot owner authentication, real getMe/current webhook readback, independent operator, real Store identity and JWT/RLS, native webhook delivery, hosted DO replay, independent external no-send acceptance.
- NEEDED APPROVAL: confirm one disposable QA Bot owner through official interface, grant one bounded private operator consent and independent reviewer, configure managed secret and private verification runner; separately approve public native callback and test message once security gates are met.
- All existing published Messenger, Zalo Bot, Cloudflare RPC16/RPC17/R2, Supabase, and V17.7H hosted Worker unchanged. No customer data access, credential rotation, cost-incurring provider usage or production message sends.

**Checkpoint:** `V17_7H1_THREE_ROLE_SIGNED_OWNER_FIXTURE_PASS_PENDING_CI__HOSTED_INACTIVE_PRESERVED__REAL_PROVIDER_NO_GO`.
