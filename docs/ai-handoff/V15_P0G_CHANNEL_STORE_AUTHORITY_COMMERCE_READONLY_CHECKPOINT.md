# TIEN404 AI — V15 Sales Lite P0-G
## Verified Channel/Store Authority × Commerce Read-Only Pilot Contract

**Checkpoint:** 2026-11-16 JST  
**Parent:** Draft PR #177 HEAD `f0daea413e807ca6186764c5fec48a06ce7436e0`  
**Release State:** EXPERIMENTAL source-only / synthetic QA / **NO-SEND, NO-ORDER-WRITE**  
**Scope:** Minimal Sales Lite pilot for 1–3 Vietnamese merchants. Do **NOT** accelerate Advanced Dashboard, premium model selector or Enterprise Bot Studio.

### 1. VERIFIED read-only baseline
- Supabase `tien404-staging` project ref `ifxlvrhyjhbzbrkdsida`: 3 Auth users, 2 Tenants, 3 active memberships, 2 Products, 2 Orders. **NO** `public.stores`, `public.store_memberships` or `store_id` among the seven core Commerce entities. Therefore **real Channel → canonical Store ownership cannot currently be independently verified on hosted**, nor can same-Tenant Store A/B RLS be certified.
- n8n `TIEN404_MESSENGER_TEST` workflow `Z7FdV7uDvApfbURQ` active, version `d5c96b6b-d790-4270-8b0f-d0ebdd8bbd92`; reads DEMO Google Sheets and still has `create_order` `KrSn4DNR9ALX5ng4`, `manage_order` `fDB9dvs1qPPVt9Sp`, `update_order_address` `BkAi6TVUKAjCnI7v`. This is **legacy DEMO**, not Commerce. Do not repoint/merge credentials or order data silently.
- n8n `TIEN404_COMMERCE_AI_AGENT_SANDBOX` `iyfGUiEsZlNTBWOR` inactive, version `ddc3ce5b-365e-47e2-a06d-08daffceb9a8`, not a hosted verified Commerce channel.
- From PR #177: Zalo claim has a private Vault gate and QA challenge controls; it does **not** replace native real Zalo provider signature. Product write RPC checks Tenant owner/manager but lacks Store. Both still need later approved remediation.
- References: https://supabase.com/docs/guides/api/securing-your-api and https://supabase.com/docs/guides/database/postgres/row-level-security

### 2. What P0-G actually implements
`qa/v15-sales-lite-p0g/channel-store-readonly-contract.cjs` **composes**, rather than replaces:
- Existing V15.03H `attestSyntheticRequest` + `isAcceptedSyntheticContext`: two distinct P256-signed **QA** attestations, pinned fixture matching, in-memory test nonce, frozen accepted context. Not provider-signed, not hosted/JWT, not a production replay guard.
- Existing V15.04H `authorizeQaBusinessTool`: read-only price and catalog, synthetic store/tenant digest pin, integer VND/stock validation, no writer.
- Existing V15 P0-A `previewCommerceRequest`: draft order request re-quotes and rejects mismatched `expected_total_vnd`, never creates an Order or Outbox.
- Existing V14.7 immutable `FIXTURES.A/B/C`: A and B same **synthetic** Tenant with same SKU but distinct product/price/stock; C other Tenant. These are synthetic demonstration data, NOT Supabase or Google Sheets Products.
- A new pinned **QA-only** Store x Channel registry (3 x 4 = 12 synthetic bindings) with private WeakSet identity and safe disabled channel / paused Store checks. Its registry cannot be cloned/fabricated to gain actual authority. It has zero real hosted provider bindings.

**Client intent contract:**
```json
{ "kind": "quote", "sku": "A001" }
```
Allowed `kind` values: `catalog`, `quote`, `order_request`. For `order_request`, only `sku`, integer `quantity` in 1..99 and optional exact integer `expected_total_vnd` (VND) are accepted. **No tenant_id, store_id, customer_id, recipient, confirmation override, SQL, tool name, provider flag or payment data from the client.**

**Outputs:** `QA_CATALOG_READ_ONLY`, `QA_QUOTE_READ_ONLY`, `QA_ORDER_REQUEST_REQUIRES_CONFIRMATION`, or a specific `BLOCKED` reason. All outputs set `synthetic_only=true`, `provider_identity_real=false`, `hosted_store_authority_verified=false`, `real_price_verified=false`, `can_send=false`, `can_write_orders=false`, `orders_written=0`, `stock_deducted=false`, `owner_notifications_sent=0`, `paid_model_calls=0`. Do not present QA prices to real customers.

### 3. Target real backend integration (PROPOSED, **NOT** IMPLEMENTED OR AUTHORIZED)
```
Native provider verified ingress (Meta HMAC / Zalo official verification /
  first-party Website Widget server-issued session)
  -> normalized event with event-id and source-owned provider_account identifier
  -> TRUSTED SERVER channel registry lookup provider_account + exact channel
     -> canonical tenant_id + store_id + channel_binding version + status
     -> independent owner consent and app-level Store membership where required
  -> Store-scoped read service under authenticated SERVER authorization / RLS
     -> SELECT catalog/price/stock filtered by canonical tenant_id + store_id
     -> small immutable quote response with price_vnd integer and data version
  -> DRAFT output in sandbox / preview / no provider send
```
- **Provider account/Channel ID must come from verified ingress**, not LLM text, unverified sender handle, redirect URL, or mutable user metadata.
- **For customer chat, the shop's Merchant JWT is NOT the customer's session.** Owner privilege is established independently; customer read access uses an explicitly designed server-side read path bound to channel+Store with least privilege, not a global `service_role` shortcut.
- Website widget uses server-issued widget installation identity, host/domain restrictions and signed session. A pasted widget ID from an arbitrary domain is not trusted evidence.
- Backend lookup must require Store status `active`, channel binding `active`, tenant ownership and valid grant; refuse unknown/ambiguous/disabled/revoked bindings. Avoid cross-channel same provider-account collisions with a compound unique key.
- Product reads require exact `tenant_id` + `store_id` and validated SKU; enforce PostgreSQL RLS + least-privileged grants and Store-composite FK, not just an application WHERE clause. Use current price snapshot/version and no price hallucination; no implicit currency string-to-zero conversion.
- Cache/nonce/rate-limit scopes include tenant+store+channel+event; revoke bindings and stale authorization; don't let webhook retry emit duplicate quote or order. Mask PII in logs; QA evidence must exclude actual tokens, messages, phone, raw JWT.
- A read-only quote is **not** permission to send a provider message. Provider send and real Order+Outbox need separate independent release gates, persistent replay prevention, merchant consent, backup and UAT.

### 4. P0-G acceptance test plan
| Test | Evidence | Scope |
| --- | --- | --- |
| A/B same Tenant same SKU with different quoted prices | automated Node QA | synthetic fixture |
| C other Tenant isolated | automated Node QA | synthetic fixture |
| Messenger, Zalo Bot, Zalo OA, Website Widget | automated Node QA | synthetic fixture |
| forged Store / Tenant / owner / provider credentials | automated negative QA | synthetic only |
| unknown SKU, invalid VND, changed expected_total, insufficient stock | automated negative QA | synthetic only |
| disabled channel, paused Store, expired/replayed signed nonce | automated negative QA | synthetic only |
| preview no Order, no Outbox, no send, no paid model | automated QA | source-only |
| actual provider signature and exact Page/Bot/OA consent | **BLOCKED** | real provider |
| canonical Store membership + hosted real JWT/RLS A/B/C | **BLOCKED** | hosted |
| authoritative Commerce price/stock read via restricted role | **BLOCKED** | hosted |
| real merchant pilot | **NO-GO** | requires independent approval |

### 5. Dependency release and rollback
**Cannot promote to hosted:** backup real + restore; exact owner-certified canonical Store migration, hosted JWT/RLS Shop A/B/C and Shop C, trusted provider registry/native consent, read-only restricted Postgres service and source-price QA. Then independent review to approve an authorized, narrowly scoped read-only staging pilot. Live Meta/Zalo send, paid model and Order+Outbox always require separate authorization.

**Rollback now:** close child Draft PR and discard only its source files; no hosted or Published change to undo.

**Next proposed:** `V15 Sales Lite P0-H — Real Channel/Store Evidence Mapping × Hosted Read-Only Preflight` with independent private evidence intake (no real customer sends). Do not create more synthetic approval paperwork; prioritize real authorized proofs and a safe Staging Store migration decision.
