# TIEN404 AI — V17.23Q | Real Zalo Bot Read-Only Proof × Private Provider Event Admission

**STATUS: DRAFT / REAL GETME READ-ONLY VERIFIED / DEDICATED QA INSTALLATION UNVERIFIED / REAL PROVIDER EVENT NO-GO / STORE A/B JWT NO-GO**

Parent [V17.23P Draft PR #377](https://github.com/ngoctien20/demo-git/pull/377), verified starting SHA `ec237fca3e97fff3422adf989fc82fa20f4d79e5`. Continue existing private Owner/operator protocol [PR #244](https://github.com/ngoctien20/demo-git/pull/244); do NOT create an alternate public identity collector.

## New read-only actual provider identity evidence (2026-11-17 JST)

A **manual** n8n execution was performed after reviewing the exact published staging Cloudflare Worker route `/v1/bot-check` and inactive manual workflow graph:

- n8n workflow: `TIEN404_V145Z_LIVE01_BOT_READONLY_PREFLIGHT_NO_SEND` ID `xayBLEyUwd64mcLK`.
- Execution: **5087**; status `success`; `2026-11-17T14:52:33.430Z` → `14:52:36.556Z`.
- Existing locked gateway `tien404-zalo-outbound-v1-staging` `POST /v1/bot-check`: code requires sending disabled, owner approval gate and request authentication, then calls Zalo Bot API `getMe` (POST with empty JSON body). Separate owner-one-shot send path and `/v1/send` remain locked; this execution did **not** target either.
- Sanitized n8n output only: `ZALO_GETME_READONLY_CONFIRMED`, HTTP **200**, `bot_token_valid=true`; workflow reports `provider_sends=0`, `orders_written=0`, `webhook_changed=false`, `bot_shop_binding_verified=false`, `owner_recipient_binding_verified=false`, `live_uat_ready=false`.
- The result demonstrates **the configured provider credential can successfully call a real read-only Bot identity API**. It is **NOT** independent proof that this existing credential corresponds to an authorized *separate disposable QA Bot* or that a Merchant owns a particular store. Counters are reported by the workflow rather than independently reconciled against provider logs. No signed webhook was received, no message was sent, and no production endpoint was altered during this run.

## Current Commerce and authority blockers

- Direct read-only Supabase staging: **2 Tenants, 2 Products, 2 Orders, 3 Auth users, 5 Auth sessions**; `public.stores` and `store_memberships` not present; 0/6 Commerce Store ID columns; 0 Customer/Channel/Order ownership mappings; legacy tenant-only Orders SELECT remains.
- Nine connected n8n credential records (metadata only) include Zalo, Meta, QA pairing, HMAC, but **credential names, presence and a getMe response do NOT establish dedicated QA installation ownership**. No credential secret was read or printed.
- Private Cloudflare issuer, no-send runner and replay Worker deployments exist but workers.dev is disabled; provider V177H Worker has no deployed version. Do not open public endpoints or change any existing webhook.
- Owner deferred real local backup; M0 recovery scope undecided; real same-tenant Store A/B JWT and cross-channel Order UAT remain **NO-GO**.

## Track A — dedicated provider private no-send canary, independent of Commerce

**Not executed in this milestone.** A future test could be authorized after independent, out-of-band checks:

1. Merchant Owner documents control of a **dedicated QA** Meta App/Page or Zalo OA/App or Zalo Bot. Verify exact installation in a private authenticated admin/provider interface, separate from live channel; record scoped consent/expiry and independent reviewer.
2. Only after consent, capture one *actual provider-origin* event in approved **isolated private** ingress, without replacing production callback or causing Order/customer reads. For Meta verify `X-Hub-Signature-256` over raw bytes. For Zalo OA verify official applicable `X-ZEvent-Signature` digest with correct data/canonicalization. For Zalo Bot use provider-documented webhook header or equivalent authentication; a shared header **is NOT a cryptographic signature over payload**.
3. Test wrong installation, malformed/missing auth, changed payload where authenticity is payload-bound, replay/duplicate and concurrent replay race using **durable atomic** dedup storage (not in-memory), expiry, owner revocation, and no-send/no-write guard. For Zalo Bot, header-only auth must not be described as per-payload tamper evidence; its transport/TLS, installation and replay safeguards are necessary.
4. Independent reviewer signs a redacted private receipt with a separate trusted key registry and nonce/retention. No raw event, user ID, bot token, JWT, merchant document, private key or App secret in GitHub or chat. Verify endpoint and rollback before any event subscription change.

## Track B — real JWT Store A/B

Independent of Track A, remains blocked until Owner-selected M0 recovery, accepted real four-row Store attribution, canonical same-Tenant Store A/B memberships and atomic RLS/foreign-key cutover. Two real Supabase Auth JWT sessions must be independently issuer-verified and tested no-send with actual database policies; unverified metadata, self-reported JSON or service_role query never proves Store isolation.

## New source artifacts

- `private-provider-evidence.mjs`: fixed sanitized observed getMe checkpoint, **not owner admission**; strict opaque evidence envelope checks and Ed25519 *cryptographic consistency* under two distinct caller-supplied keys. Even cryptographically consistent signatures do NOT confer independent Owner/operator authority without trusted private key registry, revocation and durable replay. All public approval flags remain NO-GO.
- `private-provider-evidence.test.mjs`: fabricated keys and identities for CI only; tests signature forgery, time expiry, secret leakage, wrong audience/roles, duplicate packet, and no-send/no-deploy fail-closed.
- This repository does NOT store real signed receipts, private owner identities or provider secrets, and DOES NOT expose an actual private HTTP webhook.

## No-host changes and rollback

- Read-only Zalo `getMe` workflow #5087 **executed** (external identity lookup). No Provider Event Canary was opened; no webhook change, message send, customer/order access, store migration, credential change, Cloudflare deployment, publish, spending, privileged RPC or production change.
- Source-only GitHub Draft child PR is the only code change; close Draft PR to revert source. No hosted rollback required. The historic #5087 read-only provider request remains an audit event and cannot be undone.
- **Status:** `REAL_ZALO_GETME_READONLY_OBSERVED` / `REAL_PROVIDER_INSTALLATION_OWNER_UNVERIFIED` / `PRIVATE_SIGNED_EVENT_NOT_ACCEPTED` / `M0_DEFERRED` / `STORE_AB_JWT_NO_GO` / `PRODUCTION_NO_GO`.

References:
- Zalo Bot API: https://docs.zaloplatforms.com/zalo-bot
- Meta webhook: https://developers.facebook.com/docs/graph-api/webhooks/getting-started/
- Zalo OA webhook: https://docs.zaloplatforms.com/docs/OA/webhook/quan-ly/su-kien-nguoi-dung-zalo-thuc-hien-quyen-chu-the-du-lieu
