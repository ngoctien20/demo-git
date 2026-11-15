# TIEN404 AI V13.4 — Sales Lite Commercial Product Alignment

**Checkpoint:** 2026-11-15 JST · STAGING / EXPERIMENTAL · **NOT CANDIDATE / NOT RELEASED**  
**Previous:** PR #69 V13.3 (HEAD at audit `56d002b029eedd19e11c1971531b0fc2200dcbe7`).  
**New branch:** `work/v134-sales-lite-multichannel-contracts-staging`, based exactly on the audited V13.3 HEAD.  
**Product positioning:** TIEN404 Sales Lite is a **multi-channel AI Sales SaaS** for Vietnamese small shops. **Zalo is a channel, not the product.**

## 1. Source of truth — verified vs historical

| System | Audited state | Reuse / restriction |
|---|---|---|
| GitHub #41 Owner Core | OPEN DRAFT HEAD `2ce3eeb0` | Reuse owner identity, owner sessions, binding; do not reimplement/merge silently |
| GitHub #52 Customer Core | OPEN DRAFT HEAD `6277c5af` | Reuse guarded Customer AI preview, not live sender |
| GitHub #67 Menu V13.1 | OPEN DRAFT HEAD `8e9c416d` | Reuse menu registry/actions, optional per-channel presentation |
| GitHub #68 Studio/Portal | OPEN DRAFT HEAD `fda208ae` | Reuse merchant portal design; no separate competing dashboard |
| GitHub #69 V13.3 | OPEN DRAFT HEAD `56d002b0` | Inherited no-send Core Bridge, read-only Merchant resolver, Studio preview |
| Zalo Ingress | Published workflow `yIJk8LvJoLF40Z62` version `8ca4a6f6…` | Provider-authenticated ingress already exists; **not wired into V13.4** |
| Zalo Customer Router | Published `sIPs6egzIwOY1GNv`, version `8d91d23c…` | Keep as-is, no new live sends |
| Zalo Owner Shadow | Published `OgDZNSAvKEvhnAvn`, version `f00ba506…` | Shadow only, no side effects |
| Zalo AI Intent Draft | Inactive `uGesZLvNkhY4ZO6l` | Not paid-model/provider-verified |
| Messenger Bot | Published `Z7FdV7uDvApfbURQ` version `d5c96b6b…` | Existing Messenger DEMO, not commerce multi-tenant |
| AI Sales Main | Published `v6PBwcqSapVzACMW` version `c0f04eb1…` | Existing DEMO tools, not shared commerce production |
| Cloudflare Pages | V13.3 preview deploy succeeded; Access preview policy exists | Access is **not** Merchant authorization; no production change |
| Supabase `tien404-staging` | ACTIVE_HEALTHY from preceding audit; tenant/membership RLS exist | **Hosted signed-session cross-shop E2E still BLOCKED** |
| Render Auth/Data | Prior architecture describes Merchant capabilities | **Current live Render workspace/service not reverified in this V13.4 operation** |
| Subscription/Billing | No confirmed shared live read-only subscription source in inherited portal | No automatic billing/expiry mutation |

**Do not infer current live state from old Work V9/V10 documentation.** When Render access is explicitly scoped, validate deployed SHA/service endpoints before reusing them. Supabase's 2026 Data API exposure defaults have changed; do not assume new tables become public.

## 2. Target architecture — one SaaS, independent adapters

```text
Website Chat     Messenger     Zalo Bot/OA       [other approved channels]
     \              |             /                        /
                 Channel Adapter
                       |
     Provider verification + anti-replay + inbound idempotency
                       |
           Trusted Tenant/Store Resolver
           (provider_key -> verified channel_binding -> store -> tenant)
                       |
            Subscription / Quota Guard
                       |
              SHARED AI SALES CORE
       catalog / wholesale-retail price / stock / sales intents
                       |
             Commerce Business Services
                order request / status
                       |
    tenant-scoped Postgres + RLS + transactional idempotency
                       |
              Notification Outbox
       owner delivery adapters independent from customer channels
                       |
    Merchant Dashboard / Authorized Owner Channels
```

**Store-owned** means cryptographically and server-authoritatively scoped records for each tenant/store. It does *not* imply one physical database per shop; a shared Postgres deployment with correct keys, RLS and defense-in-depth is acceptable.

### Contracts and trust boundaries

- Raw provider payload is **untrusted**, including any claimed `tenant_id`, `store_id`, `role` or `price`.
- Channel Adapter validates each provider using its real method (signed Messenger webhook, authenticated Zalo Bot webhook, Website Chat server session). These are not interchangeable.
- Backend maps only verified provider identity to channel binding and tenant/store. No client-selected ownership.
- Shared Sales Core reads only server-scoped catalog with tenant/store readback; all prices in integer VND.
- Order request is not paid revenue. Order status transitions, idempotency and notification outbox require authorized server transactions.
- Owner notification channel is independent of the customer inbound channel; delivery requires permission, subscription, retry and deduplication.
- UI/staging Menu Studio cannot mint roles or call production tools.
- Fail closed when subscription source, bot binding, membership or provider capability is unknown.

### Source code added in this PR

- `qa/sales-lite/v134/channel-core-bridge.cjs`: server-port multi-channel preview for WEBSITE_CHAT / MESSENGER / ZALO_BOT / ZALO_OA. Uses one `customerPreview` port, checks provider verified ingress, binding, subscription scope, catalog scope, price/stock; sends 0 messages, writes 0 orders.
- `qa/sales-lite/v134/order-request-contract.cjs`: pure order request proposal, server-verified price snapshot, deterministic idempotency key, role/version-gated state transition proposal, revenue from verified PAID orders only.
- `qa/sales-lite/v134/product-readiness.cjs`: commercial package hypotheses, 12 Merchant Dashboard capability labels, explicit release gates with no automatic RELEASED promotion.
- `qa/sales-lite/v134/v134-contracts.test.cjs`: synthetic/negative tests, **NOT hosted RLS or provider E2E**.
- `.github/workflows/v134-sales-lite-contract-qa.yml`: standalone no-send tests + inherited V13.1–V13.3 regression, zero deploy/mutation.

**Adapter is currently OFFLINE.** No webhook, provider token, live session, database writer, payment or model inference is connected. Injected ports are security-critical and require server-side integration + independent hosted tests before they are trusted.

## 3. Product packaging — research assumptions only

| Plan | Research price | Scope (hypothesis) | Guardrail |
|---|---|---|---|
| Sales Lite | 199,000 VND/shop/month | 1 shop, 1 supported customer channel, essential catalog/order/owner reporting | Limited usage; AI, messaging, support quotas **unknown** |
| Sales Lite Plus | 349,000 VND/shop/month | More channels, wholesale-retail pricing, staff/reporting enhancements | Limits/cost/permissions **not finalized** |

No charges, subscription DB writes, pricing production publication, or promise of unlimited AI. Subscription is a **platform entitlement** for the entire product, not a charge for Zalo Bot.

## 4. Prioritized V13.4 delivery roadmap

### P0 — complete a useful, secure sales loop

1. **Merchant identity:** audit existing Render Auth and PR #41; real JWT/session; hosted A/B owner/manager/revoked/nonmember RLS. Fix `qa_shop_b_zalo_claim` privileged `anon EXECUTE` exposure only after caller inventory, backup and separate approval.
2. **Merchant Dashboard consolidation:** extend existing V13.3 Merchant Portal; reuse prior Render dashboard/catalog/order read components. Make it the primary mobile merchant surface; do not clone a new SaaS front end. First expose verified account, catalog, orders, channel status and subscription *read-only*.
3. **One real safe customer channel pilot:** prefer Website Chat as initial provider-independent sales-loop candidate **after provider/session verification**, since Zalo native buttons/commercial rules remain unknown. Messenger and Zalo remain future adapters to shared Core. Choice is PROPOSED, not current LIVE integration.
4. **No-write order flow:** customer asks item -> read verified price/stock -> prepares request -> customer confirmation -> backend transaction / idempotency only after separate approval -> Notification Outbox -> Owner approval -> correct paid revenue.
5. **Subscription/Quota:** source authoritative state, default deny when expired/unknown; no production Billing or unlimited usage.

### P1 — incremental multichannel

Channel Integration Center (Website Chat/Messenger/Zalo) with connection health, owner binding, receive/reply capabilities, quota, webhook failure and pause state. Owner notification preferences (Zalo when authorized, Telegram, Gmail, Dashboard). Support and Super Admin remain separate RBAC domains.

### P2 — deferred

Rich Message studio enhancements, advanced native menus, Agent Factory, industry templates, complex analytics, enterprise features. Do not prioritize over a functioning sales pilot.

## 5. Acceptance scenarios and hard stops

- Shop A F01 and Shop B F01 may have different prices; no cross-shop response, inventory, order, notification or report.
- Customer cannot call owner actions. Owner cannot access Staff Studio; staff Access login alone cannot confer tenant permissions.
- Provider key lookup must precede shop access; fake webhooks rejected. Duplicates need durable backend idempotency (SHA-256 key alone does not deliver deduplication).
- Negative input: price injection, quantity overflow, stale stock, stale order version, absent subscription, expired membership and revoked session.
- No revenue from REQUESTED/PENDING_OWNER/CONFIRMED/FULFILLED or unpaid PAID records.
- If a channel fails, other channels should continue after adapters are independently deployed and verified; this is not yet tested.
- Paid model/API quotas, Zalo commercial rights, actual message buttons, costs, taxes and support workload remain UNKNOWN until real measurement.
- Production P0 blockers: hosted RLS, live Auth/Billing binding, privileged RPC review, verified channel scope, E2E order and outbox QA, rollback and owner release approval.

## 6. Change safety / rollback

This V13.4 draft adds **new isolated source/tests/docs/workflow** on a feature branch based on PR #69; no existing production code or V13.1–V13.3 module is replaced. Rollback: close/revert its Draft PR; keep #69 and older PRs unchanged. No SQL change, n8n publish, Cloudflare Access edit, credential edit, order write, Zalo/Messenger send or payment action was performed.

**Reporting rule:** VERIFIED / IMPLEMENTED / TESTED / PROPOSED / BLOCKED; do not mark RELEASED after synthetic tests.
