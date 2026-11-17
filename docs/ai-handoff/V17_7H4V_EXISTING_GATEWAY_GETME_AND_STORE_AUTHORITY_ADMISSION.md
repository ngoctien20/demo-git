# TIEN404 AI — V17.7H.4V Gateway getMe Provenance Reconciliation × Zalo Bot/Store Authority Acceptance

Checkpoint: 2026-11-18 JST. VERIFIED HOSTED READ ONLY, NO NEW PROVIDER CALL, NO LIVE STORE/ORDER ACCESS.
Parent work: Draft PR #389 V17.7H.4T/U HEAD c506a07b128b27f5363d3e01af9050cc578327c9; underlying PR #383 and native provider CLI PR #381 still OPEN/DRAFT.

## 1. Critical newly verified existing getMe evidence (no need to repeat)

n8n workflow **TIEN404_V145Z_LIVE01_BOT_READONLY_PREFLIGHT_NO_SEND** `xayBLEyUwd64mcLK` is **INACTIVE**. It has Manual Trigger → generic authenticated HTTPS POST `Zalo getMe via existing locked Gateway` → Code sanitizer.

Actual configured HTTPS destination is the existing Cloudflare Worker `tien404-zalo-outbound-v1-staging.tienmobi208.workers.dev`, **not direct** Zalo native API from n8n. The sanitizer checks gateway response `statusCode=200`, `ok=true`, and `bot_token_valid=true`; only then it records `ZALO_GETME_READONLY_CONFIRMED`.

Five successful pre-existing manual executions: #3843, #3854, #3869, #3875 (2026-11-16 JST) and #5087 (2026-11-17 23:52:33 JST). Their sanitized final output is uniform:
- `result=ZALO_GETME_READONLY_CONFIRMED`, `http_status=200`, `bot_token_valid=true`
- `provider_sends=0`, `orders_written=0`, `webhook_changed=false`
- `bot_shop_binding_verified=false`, `owner_recipient_binding_verified=false`, `live_uat_ready=false`.

**Interpretation:** n8n + connected Gateway reported valid existing Zalo Bot credential through a GETME-shaped read-only flow. We did NOT read the raw provider TLS response, actual Bot ID or Bot Token; therefore this is **Gateway-reported native-token validation**, NOT independently verified human Bot Creator ownership, not an independent pinned-provider native transcript, and not an accepted Bot→Store binding. No need to repeat the five requests merely to duplicate the same report. The PR #389 V17.7H.4U local getMe tool stays optional/inactive and must not be described as already used privately.

## 1B. Read-only Cloudflare deployed Gateway provenance
- Cloudflare account Worker script inventory confirms `tien404-zalo-outbound-v1-staging` exists, last modified 2026-11-15 19:59:57 UTC.
- Cloudflare Worker deployment API identifies the latest inspected deployment `17b7106a-d66a-4e37-a18e-0d8ec97d6f78` dated 2026-11-15T20:04:08 UTC with **100% traffic** routed to version `3422864f-f095-45b9-85ca-a7d03cb87a3f`. This is deployment metadata, not a webhook callback or a new send.
- Cloudflare read-only Worker content inspection found native Zalo Bot API host `bot-api.zaloplatforms.com`, outbound `fetch`, `getMe`, and gateway `bot_token_valid` flag deriving from `r.ok && j.ok===true`. The inspected code includes an upstream HTTPS fetch and response-success check; no token, binding values or raw script contents were exported.
- **Interpretation upgraded:** existing n8n HTTP200 sanitized getMe outcomes are consistent with a deployed Worker containing real native provider-read code, rather than proof from mocks alone. The exact raw native response and one-to-one mapping between the currently pictured Bot Creator account, numeric Bot ID, Gateway credential and canonical Store were **not independently verified** in this audit. This does not change the Owner/Store release NO-GO.
- Worker read-only GETs only. **No deployment, secret read, credential rotation, provider request, tail or production write** performed.

## 2. Real customer acceptance already observed — do not repeat
- Customer QA `TIEN404 EXT 03` marker 2026-11-17 15:59:59 UTC:
  `v123_ext03_ingress=SEEN_AUTHENTICATED_WEBHOOK`, `v123_ext03_customer=CUSTOMER_ROUTE_ELIGIBLE`, `v123_ext03_route=CUSTOMER_ROUTE_ELIGIBLE`.
- `owner_gate=denied` at 16:00:00 UTC.
- Core #5098 → Sandbox #5099 → Resolver #5100: technical **No-Send/No-Commerce-Write** deny; source Zalo Bot is deliberately coerced to Zalo OA in a negative-control Shadow, not the actual Bot adapter. End-to-end customer Store assignment remains missing.
- Earlier LIVE Zalo ingress intentionally writes PII-free QA markers; **do not claim globally zero Data Table writes**.
- No need to send more customer QA messages for this unchanged setup.

## 3. Reconciled connected registry and Store security (read-only 2026-11-18)
n8n:
- Main Zalo LAB `yIJk8LvJoLF40Z62`, Customer Router `sIPs6egzIwOY1GNv`, Shared Core Shadow `4ycmVzaNzVRulBjQ`, Commerce Resolver `5Eeh8hbpsoNhuiVo`: **all active, published/current version IDs match**.
- `TIEN404_COMMERCE_CHANNELS`: six records, zero `zalo_bot`; `zalo_oa` record disabled/not_connected.
- `TIEN404_G05_QA_TRUSTED_INSTALLATION_REGISTRY_NO_SEND`: seven records, all `qa_only=true` and `approval_scope=QA_SYNTHETIC_NO_REAL_OWNER`; one active QA `ZALO_BOT` entry. Not accepted real Bot installation/owner evidence.

Supabase staging `ifxlvrhyjhbzbrkdsida` (SELECT metadata only):
- Six Commerce public surfaces `products, orders, order_items, customers, conversations, messages`: **6/6 RLS, 6/6 FORCE RLS, 6/6 tenant_id, 0/6 store_id**.
- `public.stores`, `public.store_memberships`, and `rpc178_qa` **not deployed**.
- No same-Tenant real Store A/B JWT + RLS negative acceptance or trusted Messenger↔Zalo customer identity association.
- Supabase Free plan has no scheduled platform backup per Owner screenshot; separate manual full recoverability not proven. No migrations are authorized.

## 4. Exact acceptance decision
1. Gateway credential check: **VERIFIED AS GATEWAY REPORT**, no extra getMe needed for same claim.
2. Zalo customer webhook/owner denial: **VERIFIED IN QA**. Native provider event body independently rechecked against Creator admin session: **UNVERIFIED**.
3. Native Bot Creator account ownership → stable provider Bot ID: **NOT INDEPENDENTLY VERIFIED**, separate from token validity. Owner UI screenshots are supporting but not sufficient standalone.
4. Stable server-owned Bot installation → canonical Tenant and Store: **BLOCKED**; synthetic registry cannot mint a real binding; no automatic channel insert, OA fallback or role grant.
5. Store A/B authenticated RLS isolation: **BLOCKED**; no `store_id`, canonical Store entities or tested JWT A/B.
6. Real Messenger customer ↔ Zalo sender consent and order-owner proof: **BLOCKED**; neither phone, matching name nor order code is sufficient.
7. Read-only real order status and outbound test sends: **NO-GO** until preceding gates and separate bounded approvals; keep the existing negative-control Shadow intact.

**NEXT MOST USEFUL REVIEW:** choose a trusted private identity attestation method for this existing Bot, then reconcile the exact provider bot identifier to an approved canonical Store contract. Do **not** add synthetic QA channel rows to real Commerce registry or replace `zalo_oa` with `zalo_bot` in the Shadow. Canonical schema/backup and real Auth A/B independently require formal staging admission. No new mock getMe calls, token reissue or repeated customer messages.

## 5. Changes and rollback
- Read-only n8n workflow/execution/registry observations and Supabase pg_catalog SELECTs only; no customer field contents opened.
- This checkpoint is a **GitHub source documentation update only**. No webhook/provider changes, real credentials, Cloudflare Worker deploy, n8n mutation/publish, Supabase DDL/DML, actual Commerce order access, real sends or paid instance.
- Parent PR #389 remains DRAFT; rollback by reverting this source-only checkpoint/closing the Draft PR.

FINAL CHECKPOINT: `V17_7H4V_GATEWAY_GETME_5_EXISTING_SUCCESS · ZALO_CUSTOMER_QA_PASS · BOT_CREATOR_OWNER_NOT_INDEPENDENTLY_VERIFIED · REAL_BOT_STORE_NO_GO · REAL_STORE_JWT_AB_NO_GO · NO_SEND`.
