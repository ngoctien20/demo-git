# TIEN404 AI — V17.2C.33 Privileged Commerce Writer Audit × Trusted Channel-to-Store Binding × Migration Compatibility Review

Date: 2026-11-18 JST. Continues V17.2C.32 Draft PR #392 and P1 Issue #402.
User-selected Option A: **no Supabase Pro upgrade, no paid branch, no production publish, no customer records writes**.
Audit evidence comes from connected n8n **current draft AND active published** node graphs, and live Supabase metadata-only SQL. No workflow execution or n8n mutation occurred.

## 1. VERIFIED real n8n writer inventory

| n8n workflow ID | Workflow | Active/Published | What was directly inspected | Store/tenant authority gap |
|---|---|---|---|---|
| `Z7FdV7uDvApfbURQ` | TIEN404_MESSENGER_TEST | Active, current Published = Draft, version `1064b1b3-d3f1-4a6b-a367-2414ba691522` | HMAC handling, AI Agent, attached create_order/manage_order/update_order_address/get_order_status workflow tools; send reply node | Tool inputs are customer details/order_id/phone/SKU, not trusted tenant_ref/store_ref/installation proof. This is the legacy Google Sheets write path, NOT same-tenant multi-Store-ready |
| `KrSn4DNR9ALX5ng4` | Create Order Tool (AI_SALES_DEMO) | Active, Draft `af9ee686-2a9f-483e-9622-6e449500ac5e`, Published `4740251a-cd01-4f7f-b8e1-e300a8393151` | Trigger takes customer_name, phone, address, sku, quantity; Google Sheets Read Products, Read Orders, Append Order; mapped append fields order_id, customer_name, phone, address, sku, quantity, unit_price, total, status, created_at | No tenant_id/store_id/verified provider installation in trigger and append mapping. Current Published validator differs from Draft; audit both before future fixes |
| `fDB9dvs1qPPVt9Sp` | AI SALES - Manage Order | Active, Draft `2e8786fd-e5c5-410f-9d6c-655653c32278`, Published `137d5689-40c5-4147-9bbc-b22809ad5908` | Trigger mode/order_id/phone/new name/phone/SKU/qty/expected_total; Google Sheets read by order_id and Update Order Row | No Store binding in input/validator inspected; phone/order_id protects a different legacy authorization contract, NOT verified cross-channel Store authority. Draft ≠ Published |
| `BkAi6TVUKAjCnI7v` | AI SALES - Update Order | Active, Draft `3bd7043f-78e7-4a1c-93e5-2bc9d60ac767`, Published `93cf227a-ab8a-42c6-9185-7ec44f7aeb00` | Trigger order_id/new_address/phone; Google Sheets read and update by order_id | No server-attested store in input; Draft ≠ Published |
| `4DFFCk60exrzaIl6` | TIEN404_MESSENGER_ORDER_STATUS | Active, Published = Draft, version `1faaa1ee-a45c-4bf0-8e3f-f197051f33f8` | Trigger order_id/phone; Google Sheets read by order_id, subsequent owner/status validator | No Store authority in input; phone and order_id are not a cryptographic Messenger↔Zalo customer identity link |
| `5Eeh8hbpsoNhuiVo` | TIEN404_COMMERCE_TENANT_RESOLVER | Active, Published = Draft, version `a99c7350-7aea-446d-bdc5-4b10f52c3ad1` | Trigger channelType/accountId; trusted Data Table matching channel/tenant/features and Safe Tenant Config | Current inspected output logic is tenant-based; **no Store authority** in code/inputs reviewed; not sufficient as multi-Store resolver |
| `iyfGUiEsZlNTBWOR` | TIEN404_COMMERCE_AI_AGENT_SANDBOX | Active, Published=Draft | Uses tenant resolver, catalog/cart tools, store availability tool, safe read-only consultation shadow; no direct public Orders writer inspected | Sandbox reader != proven order writer |
| `oOOXicKXGkBskKqh` | TIEN404_COMMERCE_CATALOG_QUERY | Active, Published=Draft | Tenant catalog via Data Table; no Store field found in inspected nodes | Tenant-only catalog preview |
| `yIJk8LvJoLF40Z62` | TIEN404_ZALO_BOT_LAB_V1_STAGING | Active, Published=Draft | Protected inbound webhook, QA Data Table marker upserts, staging bot identity, V12.3 customer router and shared Core read-only shadow | **QA marker writes exist**, not real Commerce Orders writes. Not a proven Store-order writer |
| `sIPs6egzIwOY1GNv` | TIEN404_ZALO_V123_PRIVATE_CUSTOMER_ROUTER_STAGING | Active, Published=Draft | Reads trusted QA bot registry, owner allowlist and QA catalog, code references tenant_id/store_id/store_key | Store-aware **QA read-only**, not live Order write authorization |
| `FqEcdmc8PRRMNUEb` | TIEN404_G06_SIGNED_CHANNEL_STORE_COMMERCE_INACTIVE_QA_NO_SEND | INACTIVE, unpublished | Synthetic signed Messenger/Zalo channel fixture and installation registry check | Source QA only; not deployed proof |
| `p5OsIaB0NkMDFMw7` | TIEN404_V171P_TRUSTED_AUTH_STORE_COMMERCE_READER_STAGING_NO_SEND | INACTIVE, unpublished | Synthetic same-tenant Store A/B verifier/read simulation, explicit Real JWT NO-GO | NOT connected to real Auth |
| `4ycmVzaNzVRulBjQ` / `dw1JOxWOEY8csTnm` | Shared Zalo/Web and Messenger Core shadows | Active, Published=Draft, no external trigger | Deliberate no-send, no-order fail-closed rehearsal | Does NOT activate approved Commerce writing |

**Do not confuse active legacy Google Sheets writers with the proposed Supabase multi-Store Commerce Core.** No production n8n workflow changes or real messages were sent by this audit. Other undiscovered workflows or external service-role writers may exist and need a second inventory; this is not a complete network-wide proof.

## 2. VERIFIED Supabase metadata (no customer/order rows)
- `public.orders`, `order_items`, `products`, `customers`: tenant_id but **no store_id**.
- `public.tenant_memberships`: tenant_id/user_id, no Store membership. Orders/Items SELECT RLS permits active tenant owner/manager, not same-tenant Store A/B isolation; direct authenticated INSERT/UPDATE/DELETE denied.
- `public.merchant_paid_orders_daily`, `public.merchant_revenue_v3`: SECURITY INVOKER, executable by authenticated, read tenant-scope reports; their result is not Store-filtered.
- Metadata-only matching of selected functions in public/app_private/QA: no `public.orders` direct writer surfaced. `public.save_merchant_product` is SECURITY DEFINER for products, not Orders; evaluate separately in RPC privilege workstream. `tien404_r1_qa.commit_order_qa` exists but auth/anon lack EXECUTE and it is for QA, not public Commerce.
- `app_private.channel_secrets`: tenant_id/platform/external_account_ref/secret_ref but NO store_id. `tien404_r1_qa.tenant_identity_map` has tenant_key/store_key/bot_key/auth_tenant_id but belongs to QA, not canonical Commerce. `tien404_v175_qa.channel_identity` exists in QA. None establish a live server-approved Store for public Orders.
- No real signed JWT, Bot/Meta webhook request, private Auth session or customer mapping was used.

## 3. SOURCE-only trusted channel→Store boundary candidate
Implemented on Draft:
- `qa/v172c-rpc-closure/v172c33-trusted-channel-store-binding-candidate.cjs`
- `qa/v172c-rpc-closure/v172c33-trusted-channel-store-binding-candidate.test.cjs`
- Existing `.github/workflows/v172c21-protected-consent-qa.yml` includes the new tests.

Server-injected dependency contract: verify raw provider signature, find installation from trusted registry using channel+provider account, verify tenant/store/installation association and active provenance, atomically consume provider event for anti-replay, enforce synthetic/no-send/no-write release gate; derive an opaque HMAC evidence reference. Client-supplied tenant/store/owner flags are always rejected. Returns `INTERNAL_READONLY_BINDING_NO_ORDER_AUTH` with `canSend:false`, `canWriteOrder:false`. The evidence reference is NOT a substitute for genuine identity/consent or order-write grant.

**Critical:** this adapter is not wired into Active n8n or Supabase. All provider attestation/storage dependencies are mocked during source QA. A private deployment must implement them with actual HMAC/signature verification, trusted HTTPS, atomic persistent replay table and authenticated Store session authority.

## 4. Compatibility matrix — V17.2C.32 migration blockers
| Contract area | Existing actual | Target canonical Store model | Gate |
|---|---|---|---|
| Order create legacy | Sheets rows no tenant/store | Exact tenant_id + store_id from trusted installation and signed actor/context | P1 BLOCKED, cannot silently adapt |
| Update/Manage legacy | order_id + phone + expected_total | Store-scoped order ownership + authenticated actor + unambiguous confirmation | P1 BLOCKED |
| Messenger status → Zalo lookup | order_id/phone legacy; distinct platform sender identifiers | Explicit cross-channel identity proof or store-owner authorized lookup, never phone-only identity merge | P1 BLOCKED |
| Commerce resolver | channelType/accountId → tenant config | signed provider installation → one authorized Store, no client Store override | Source QA only |
| Products/SKU | UNIQUE(tenant_id,sku) | eventual Store-specific SKU identity after checked migration | OPEN, no data change |
| Order Items FKs | only tenant/order or tenant/product | tenant+store+order/product composite FK | Isolated SQL preview PASS |
| Customers & order ownership | tenant-scoped, consent_at | trusted Store/customer ownership and privacy scope | BLOCKED |
| Revenue RPCs | tenant-wide daily/revenue_v3 | Store-scoped report by default; tenant-wide only explicit multi-Store owner permission | BLOCKED |
| Notification outbox | mixed legacy staging and planned multi-channel | event_id + tenant_id + store_id + order_id + channel + idempotency + no-send until authorized | BLOCKED |

## 5. Required release order (PROPOSED)
1. Keep legacy DEMO/Google Sheets and new Commerce V3 data, integrations, credentials and Store identities **strictly separated**. Legacy path is not approved for multi-Store. Do not disable working customer behavior without separate change approval.
2. Confirm canonical Tenant 1:N Store decision, Store ownership, immutable external installation account, opt-in cross-channel identity link; define a versioned `StoreAuthorityContract`.
3. Create a dedicated Store-aware **internal** order writer candidate with server-only actor validation, Store membership, price/stock recheck, atomic idempotency and exact order Store binding. Never pass a bare `tenant_id` or customer-supplied `store_id` from an LLM tool to a privileged write.
4. Test old vs new `create/update/status` dual adapters and 1 Tenant 2 Store negative paths using the isolated PostgreSQL CI; do not use real customer records or merge Store columns before verified provenance.
5. In a separately approved environment, test actual signed Messenger/Zalo provider ingress, Real Auth A/B active sessions, Consent A/B, Supabase RLS with same-tenant Store split and cross-channel lookup negatives; independently approve cost/recovery and reviewer.
6. Only after sign-off consider staging deployment, backfill, read cutover, versioned bot/channel contract and eventual production release.

## 6. Evidence / status / rollback
Code commit `08711c9f093c1abc6e8df060a99674782b85cb5e`:
- Protected Source + Trusted Binding synthetic QA [44237749690](https://github.com/ngoctien20/demo-git/actions/runs/44237749690) SUCCESS.
- RPC privilege source [44237749685](https://github.com/ngoctien20/demo-git/actions/runs/44237749685) SUCCESS.
- Ephemeral Postgres 17 RLS + migration preview [44237749653](https://github.com/ngoctien20/demo-git/actions/runs/44237749653) SUCCESS.
VERIFIED: selected *actual* n8n Published/draft graphs, Supabase metadata and all three CI outcomes.
IMPLEMENTED: isolated binding contract/test on Draft branch only.
TESTED: mock-provider fail-closed negative suite and isolated Postgres QA.
BLOCKED: real provider signatures in integrated ingress, published Store-aware writers, real JWT A/B, customer identity proof, migration backfill, independent reviewer.
NO-GO: production multi-Store, cross-channel order visibility and actual Commerce write release.

Rollback: revert only source/test/CI/checkpoint commits on Draft PR #392 (no runtime rollback required). No n8n workflow edits/publishes/test executions, no Supabase migration, credentials, customer data writes or charge occurred.
