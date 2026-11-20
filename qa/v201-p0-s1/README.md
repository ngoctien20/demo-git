# TIEN404 V20.1-P0-S1 — RPC Security × Published Commerce × Zalo QR Admission

**Status:** READ-ONLY AUDITED + SYNTHETIC OFFLINE QA. **HOSTED/PRODUCTION NO-GO**.  
**Evidence:** 2026-11-21 JST. **Parent:** V19.8.18 Draft PR #472, HEAD `22a6cb6f7ce294f674cb0f32350e27adfb8ced57`.

This branch adds **only** documentation, pure Node.js offline QR guard and tests. No hosted SQL, credential changes, workflow publication, provider send, order write, customer data or new live QR. The parent PR remains unmerged and unchanged.

## 1. Privileged RPC security findings — LIVE METADATA VERIFIED (READ ONLY)

Supabase staging project `ifxlvrhyjhbzbrkdsida` (PostgreSQL 17) `pg_proc` / `has_function_privilege` showed three `public` **SECURITY DEFINER** RPCs owned by `postgres`, all configured with an empty `search_path`:

| RPC | anon EXECUTE | authenticated EXECUTE | Auth model seen in function body | Gate |
|---|---|---|---|---|
| `qa_shop_b_zalo_claim` | YES | NO | Vault secret comparison, synthetic challenge claim gate; public RPC still callable | P1 BLOCKED |
| `qa_owner_pairing` | NO | YES | `auth.uid()`, active tenant owner membership, timed challenge, staging identity map | Store owner UAT blocked |
| `save_merchant_product` | NO | YES | `auth.uid()`, tenant owner/manager membership, strict input checks, optimistic timestamp and audit; **no canonical Store** | P1 BLOCKED |

A security advisory flags executable definer functions; that is **not** proof of exploitation. DO NOT revoke `anon EXECUTE` blindly: published `TIEN404_ZALO_V2_SHADOW_STAGING` `OgDZNSAvKEvhnAvn`, version `f00ba506-c52a-4340-9a0c-809fd9c6ea9a`, contains `Submit pending claim for Shop B` HTTP request to the existing RPC. Real external callers and traffic remain unclosed.

**Proposed closure; not executed:** snapshot original function/grants and caller versions; inventory all published + dynamic n8n, Render, Cloudflare and external PostgREST consumers; create trusted authenticated backend admission route; run local + authorized hosted real Owner A/B, revoked JWT, anonymous, cross-Store, replay and legacy compatibility QA; approval for restore-tested backup and cutover; only then revoke unnecessary public execution or migrate in a dedicated reviewed change. Do not silently change the existing `save_merchant_product` contract used by legacy clients. Failed cutover must restore original function/grants and Published routing from snapshots, with NO-SEND maintained.

## 2. Commerce contract — EXACT PUBLISHED GRAPH VERIFIED

Workflow `iyfGUiEsZlNTBWOR` active: Draft `c96422e0-170b-46a3-8d75-3a2695e645e7` vs Published `456862c9-e5ee-4bfa-9931-47dbc39ab73d`. Both contain 19 named nodes, but saved node parameter configurations differ.

- Published input: `{channelType:string, accountId:string, senderId:string, chatInput:string}`.
- Tenant resolver `5Eeh8hbpsoNhuiVo` accepts `channelType,accountId`, resolves a tenant, **not verified canonical Store owner authority**.
- Catalog query `oOOXicKXGkBskKqh`; cart preview `igPOsSbEgd4NgtRA`. Neither creates a production Store-scoped order.
- Published safe reply: `{success,tenantId,shopName,environment:'sandbox',canSend:false,canWrite:false,reply,live:false}`. Rejection branch also outputs no send/write. These flags alone are not a security boundary.
- `V17.15 Query Existing Commerce Catalog` has a fixed **demo Messenger `accountId`**, not suitable for new merchant QR routing.
- Published Messenger TEST continues to call Google Sheets **DEMO** order writers. Per parent PR #472 the full published/external writer caller inventory is **BLOCKED**. Do not migrate/disable it silently.

Hosted `public.products`, `orders`, `order_items` use `tenant_id`; `public.stores`, `store_memberships`, and the matching canonical `store_id` columns were **not found** in read-only schema inspection. V19.8.18 Docker PostgreSQL Store RLS/JWT tests are **not** a hosted migration. No direct QR → Commerce production writer integration is authorized.

## 3. Merchant Zalo QR — trust architecture (PROPOSED)

```text
Real merchant Auth JWT + server-verified Store Owner/Manager
  -> short-lived, single-use owner consent
  -> official provider bot identity receipt, secure secret binding
  -> Trusted Installation Registry (tenant/store/bot/epoch/status)
  -> provider-confirmed bot chat URL + actual device scan UAT
  -> approved QR issuance (not part of this PR)

Provider-verified webhook / transport evidence
  -> installation registry lookup by trusted bot identity
  -> canonical store from registry (never query, QR parameter, sender/chat ID)
  -> policy / subscription / replay / rate / idempotency guards
  -> read-only Commerce capability
  -> channel adapter + transactional outbox only after approval
```

The customer-facing QR is **not** the merchant-admin QR. Neither may contain bot token, JWT, API key or secrets. A query parameter cannot choose a Store. Revocation, Store transfer, consent expiry, token epoch or provider errors must fail closed.

**Provider limitation:** Official Zalo Bot documentation establishes Bot Creator, `getMe` and webhook facilities; audit has **not established an official, provider-verified Bot chat deep-link format or real QR device-open acceptance**. Do not invent a bot URL. The tests use reserved **`fixture.zalo.invalid`** synthetic link and a **synthetic HMAC key**, not genuine provider identity. `getMe` alone does not prove merchant ownership.

## 4. QA — synthetic offline only

Run `node --test qa/v201-p0-s1/qr-admission-offline.test.mjs` on Node 22.

32 test cases: complete synthetic evidence **never** issues a live QR or grants send/write; expired/forged owner/provider/link evidence, revoked installation, wrong store/tenant/bot, URL origin and secret leak, replay and unsigned/expired inbound evidence all fail closed. The test-only HMAC signer is a simulation of a trusted boundary, **not** real Zalo attestation. It does not exercise hosted JWT, production RLS, real webhook or actual QR scan.

Required future acceptance: real Store Owner A/B signed JWT UAT; all privileged RPC/Published callers closed; independent backup and security review; verified Zalo Bot Identity + owner consent + provider link; two-device QR UAT; non-send inbound receipt and cross-store negative tests; explicit owner authorization for any live provider send. Until then: `QR_ISSUANCE_ENABLED=false`, `PROVIDER_SEND_ENABLED=false`, `ORDER_WRITE_ENABLED=false` **as release requirements**, not claims that these flags already exist in live configuration.

## 5. Change log / checkpoint

- **AUDITED**: Hosted RPC definitions/grants; Published Commerce graph and Zalo shadow caller; hosted Store schema; existing parent PR #472.
- **IMPLEMENTED**: Pure offline QR guard + deterministic Node tests + CI workflow + this audit.
- **TESTED**: 32/32 on local Node 22; CI status must be checked separately, not assumed.
- **BLOCKED**: Hosted privileged RPC closure, Store RLS, real merchant Authorizations, official QR link/device acceptance, multi-tenant protected order write.
- **Rollback**: Revert/close this Draft PR. No hosted or provider state changed.
- **NEXT**: Close caller dependency and real provider link admission evidence; open a separate approval-gated migration/cutover proposal only after tests.
