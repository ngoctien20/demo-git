# TIEN404 AI — V17.23P: Dedicated Provider Authority × Signed Ingress × Private JWT Admission

**SOURCE-ONLY DRAFT / SYNTHETIC QA / NO SEND / NO HOSTED WRITE / REAL PROVIDER & JWT NO-GO**

## Existing evidence, not a fresh system

- Parent: [V17.23O PR #374](https://github.com/ngoctien20/demo-git/pull/374), head SHA `0d56da07b72daceb8294ae638682ddb6489e178b`, prior independent CI **189/189**.
- Private merchant Operator intake is already proposed in [RPC12 PR #244](https://github.com/ngoctien20/demo-git/pull/244). Do not build a second public path for credentials, original Order IDs, JWTs, or Merchant ownership documents.
- Real original Commerce tables in staging `ifxlvrhyjhbzbrkdsida`: 2 tenants, 2 products, 2 orders, 3 Auth users, 5 session rows. **No** `public.stores` or `public.store_memberships`, **zero** store_id across six Commerce tables; `tien404_v175_qa.channel_identity`, `customer_identity`, `order_ownership`, `replay_claims` all have zero rows. Two historical QA owner bindings and two QA tenant maps do **not** certify two Store owners in the same Tenant; historical active sessions alone do not verify real JWT.
- n8n `TIEN404_MESSENGER_TEST` has recent successful webhook executions (Nov 17), but execution success alone cannot attest native Meta signature, QA Page ownership, or no-send. Zalo V1/V2 inspected recent runs were manual Nov 13; this is not a signed QA provider event.
- Existing QA workflow `TIEN404_V1723A_CUSTOMER_PAIRING_STORE_AB_MANUAL_NO_SEND` `U7nl15gRnhklJqzy` is **inactive**; prior synthetic manual run #5085 is not a hosted Store A/B Auth UAT.
- Cloudflare staging resources **already exist**: `tien404-v175e1-private-issuer-nosend-staging`, `tien404-v175e2a-private-hosted-runner-nosend-staging`, `tien404-v1721h2-zalo-replay-private-nosend-staging` have deployment metadata but `workers.dev=false`. `tien404-v177h-provider-nosend-inactive-staging` has no deployed version and `workers.dev=false`. No existing Worker was exposed, activated, or changed.

## The two **independent** acceptance tracks

### Track A — dedicated provider-only signed/no-send QA (not Commerce)

Goal: prove that a one-off event came from an Owner-authorized dedicated QA installation and was handled by an isolated private ingress with zero customer/Order access and zero outgoing message.

- **Meta Messenger**: owner confirms separate QA App/Page and installation. Verify `X-Hub-Signature-256` HMAC over **exact raw bytes**, with the QA App secret loaded by the private credential manager. Never use a production Page or its App Secret in GitHub/chat.
- **Zalo OA**: owner verifies separate QA OA/App OAuth installation. Current OA docs describe `X-ZEvent-Signature` with SHA256(appId + exact event data + timeStamp + OASecretKey). Do NOT copy Meta’s HMAC or convert Bot’s header to OA verification. Confirm actual provider encoding and exact canonicalization from signed QA event before any real acceptance.
- **Zalo Bot**: use a separately controlled QA Bot, verify ownership with a private **read-only** `getMe` and `getWebhookInfo` if available. Provider ecosystem documents `X-Bot-Api-Secret-Token` header (shared secret, NOT per-event signed payload). Confirm current official behavior/secret-token support before accepting; use TLS, durable replay/rate controls and private installation ownership. **Do not classify a shared-header match as payload-signature proof.**
- Preserve current live provider webhook paths. No `setWebhook`, OAuth reauthorization, provider send, public route enablement or parallel live subscriber until separate owner consent and rollback plan.
- Private operator verifies raw event offline, checks protocol-specific negative cases, stores only redacted evidence in independent private registry, keeps raw events and keys out of GitHub. The provider-only track does **not need to wait for Commerce Store/M0 recovery**, provided it does not access or modify Commerce/customer data and receives separate provider QA authority. Public CI cannot grant that authority.

### Track B — real Supabase Store A/B issuer-validated JWT **read-only** UAT

- Still **BLOCKED** by M0 owner-deferred recovery, missing canonical Store A/B, independent four-row Store origin, tenant-wide permissive Orders SELECT, no channel customer/order ownership binding.
- Requires two distinct real Auth principals/sessions validated against Supabase issuer and active session state, same Tenant separate canonical Stores with independent Merchant authority, Store-scoped RLS positive/negative tests and provider installation mapping from Track A.
- No `service_role` to emulate a user-scoped read, no client-provided Store metadata, no real Order read until approved isolated QA resources and independent reviewer acceptance. No writes/sends.

### Track C — Messenger order → Zalo lookup

Do **NOT** open Track C until both Track A and B have independent acceptance, a one-time cross-channel customer challenge and a negative test with an unrelated account. Provider signature acceptance alone does not identify the customer or prove Order ownership.

## Executable V17.23P source fixture

- `qa/v1723p/synthetic-provider-canary.mjs` exercises **only** fabricated raw bytes and fake secrets with the inherited [V17.23O](../v1723o/native-provider-private-canary.mjs) provider-specific verifier.
- Meta synthetic HMAC, Zalo OA synthetic SHA256 digest, Zalo Bot synthetic header compare.
- Synthetic incorrect installation, changed bytes, wrong secret, expired **synthetic ingress receipt timestamp** and duplicate event are rejected as appropriate. **Zalo Bot header-only auth is NOT payload-bound** — deliberately tested with changed body still matching header. The timestamp for Meta/Bot in this harness is a test-ingress receipt timestamp, not an asserted native provider-signed timestamp.
- `SyntheticReplayMemory` is **single-process and not durable**, intentionally not production-capable. Real canary requires durable atomic event-ID/replay protection externally.
- `reviewQaInstallationAdmission()` intentionally returns `PRIVATE_AUTHORITY_NO_GO` even when a caller claims to be an Owner: it cannot validate authentic private Owner/Operator or provider installation receipts. It rejects raw JWT, provider tokens, customer identities or original event in public GitHub. **Never wire this synthetic module as real authorization.**

## Operator's minimum private evidence packet (NOT in GitHub)

1. Verified Merchant Owner independently controls dedicated QA Page, OA or Bot (one channel chosen), written scoped consent, expiry and installation authority; independent reviewer.
2. Official provider account/app installation authority, privacy-scoped webhook proof and approved no-send isolated destination; all identifiers and secrets remain in a managed private vault.
3. One provider-native event captured by approved private ingress, raw-body signature/header verification as applicable and invalid-signature, wrong-installation, replay, expiry, replay-race and rate-limit negative results.
4. Observed no provider send, no Order read/write, no customer PII export, no Supabase Auth bypass. Private Operator/Reviewer signs redacted receipt and rollback.

## Release decision and rollback

`SYNTHETIC_TESTED` when CI passes; `DEDICATED_QA_INSTALLATION_UNVERIFIED` / `REAL_NATIVE_PROVIDER_EVENT_NO_GO` / `REAL_STORE_AB_JWT_NO_GO` / `CROSS_CHANNEL_ORDER_NO_GO` / `PRODUCTION_NO_GO`.

Changes are additive **Draft GitHub-only**; close child PR to roll back. No Cloudflare Worker change, n8n publish, Supabase migration, JWT/session use, credential, customer data, provider send, paid resource or webhook reassignment.

Sources:
- Meta: https://developers.facebook.com/docs/graph-api/webhooks/getting-started/
- Zalo OA: https://stc-developers.zdn.vn/docs/v2/official-account/webhook/tin-nhan/su-kien-nguoi-dung-gui-tin-nhan
- Zalo Bot platform: https://docs.zaloplatforms.com/docs/BOT/create_bot and https://docs.zaloplatforms.com/zalo-bot
- Zalo Bot webhook header ecosystem: https://kaiyodev.github.io/zalo-bot-js/en/webhook-events
