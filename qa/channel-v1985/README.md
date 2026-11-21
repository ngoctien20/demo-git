# TIEN404 V19.8.5 — Protected Catalog Adapter × Commerce Core Compatibility

Status: CANDIDATE / OFFLINE QA ONLY / NO LIVE COMMERCE.

## VERIFIED LIVE n8n CONTRACT SNAPSHOTS (19 Nov 2026 JST)

### 1. Commerce Tenant Resolver
- Workflow `5Eeh8hbpsoNhuiVo` active/published version `a99c7350-7aea-446d-bdc5-4b10f52c3ad1`.
- Trigger input: `channelType`, `accountId`.
- Resolver currently permits `messenger`, `zalo_oa`, `website`; `zalo_bot` is not admitted.
- Resolver returns tenant-level identity only, and expressly blocks a production candidate (`live_connector_not_implemented`).
- Its `canSend` and `canWrite` are false. It cannot provide canonical Store authorization for a real Zalo Bot.

### 2. Commerce Catalog Query
- Workflow `oOOXicKXGkBskKqh` active/published version `e0f1e345-8e6c-40cb-8e6a-d7ad2eb92696`.
- Trigger input: `channelType`, `accountId`, `query`, `limit`; no `storeId`, `installationId`, or verifiable issuer proof.
- `Rank and Return Safe Products` filters by `tenantId`, not canonical Store. Same-tenant Store A/B cannot be isolated using this contract.
- Existing legacy result shape includes `success`, `tenantId`, `products`, `count`, `currency`, `environment`, `canWrite`; do not forward this result to a Store-scoped Zalo assistant without a new read adapter.

### 3. Commerce AI Core
- Workflow `iyfGUiEsZlNTBWOR` active/published version `456862c9-e5ee-4bfa-9931-47dbc39ab73d`.
- Trigger input: `channelType`, `accountId`, `senderId`, `chatInput`.
- Its V17.15 read-only demo branch explicitly permits only the Messenger demo Page / `demo_tien404`, not real Zalo Bot QA or a canonical Store. Other branches can involve a language model and older DEMO tools.
- Not safe to wire live Zalo webhook V19.7I directly into this core. The inbound QA webhook deliberately strips text/recipient identifiers.

## V19.8.5 CANDIDATE CONTRACT

Files: `protected-catalog-compat.mjs`, `protected-catalog-compat.test.mjs`.

New isolated mode `V1985_SYNTHETIC_QA_ONLY` accepts a *synthetic* server-owned Bot installation binding, mock webhook receipt, owner consent marker, exact `sku`+`quantity`, and prior V19.8.4 reader fixture rows. Every field is a simulated input only and NOT signed evidence. This module has no network/DB/LLM/provider integration.

The new request parser accepts only `source`, `channel=zalo_bot`, `sku` and `quantity`. Any extra customer claim such as `tenantId`, `storeId`, `isAdmin`, `owner`, `serviceRole`, or `canWrite` is denied, including claims that match the expected Store. Store identity must be derived from **real trusted server state**, never the chat message.

The adapter checks synthetic protected transport, installation, store owner approval, freshness/replay flags, exact SKU/currency, price and stock. All test outputs include `canReadHosted=false`, `canSend=false`, `canWrite=false`, `providerSends=0`, `orderWrites=0`, `stockWrites=0`, `modelCalls=0`, `legacyPublishedWorkflowsCalled=0`, `productionReady=false`.

Output `OFFLINE_PREVIEW` or `INSUFFICIENT_STOCK` is a demo-only Vietnamese preview; it is never a quote, reservation, purchase or actual Zalo message. If denied, output has empty products, no customer reply, and no tenant/store identifier.

### Backward compatibility is **DENY**, not cutover

`legacyCatalogCompatibility` accepts the legacy four-field *shape* for compatibility assessment, and always returns `LEGACY_TENANT_ONLY_CATALOG_NOT_STORE_SAFE` with no products. This prevents silent fallback to a tenant-wide reader. Existing Published workflows remain untouched and continue to serve their current sandbox callers.

## QA / EVIDENCE
- V19.8.5 contract test: 66 synthetic cases. Positive Store A/B candidate, QA owner-as-customer, quantity/stock, wrong Store, forged authority and replay, invalid currency, expired prices, request format, legacy Messenger/Zalo OA/Zalo Bot/Website deny.
- Real PostgreSQL 17 reader tests from V19.8.4 remain independent and passed in GitHub Actions.
- No real Supabase Auth JWT tested. No live Store Authority mapping. No hosted read, LLM or Zalo Send.

## NEXT LIVE ADMISSION GATES — NOT AUTHORIZED BY THIS PR
1. Sign-off on canonical Store migration, writer compatibility and RLS replacement.
2. Verified merchant owner sessions A/B for **two stores under one real test tenant**, no service_role bypass.
3. Server-bound Zalo Bot identity from authenticated endpoint/installed credential plus approved owner consent, with installation scoped durable idempotency.
4. Real trusted protected reader with static source of truth, schema version, row freshness and price/stock atomics.
5. Distinct `V19.8.5` internal adapter triggered **only by verified backend proof**, never public request claims. Keep all owner/admin capabilities off in customer conversations.
6. Private no-send rehearsal before explicit user approval for one live Zalo QA reply. A separate approval applies to orders, inventory, billing and owner revenue messages.

## ROLLBACK
Close Draft PR #459 or revert `qa/channel-v1985/` and the QA-only GitHub Workflow. No Supabase/n8n/Cloudflare/Zalo runtime or credentials changed.

Checkpoint: `V19.8.5_PROTECTED_CATALOG_COMPAT_CANDIDATE_66_SYNTHETIC_NO_LIVE`.