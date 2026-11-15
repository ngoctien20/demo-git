# TIEN404 SALES LITE V1.1 — Menu & Operations Candidate (V13.1)

**Status:** `EXPERIMENTAL` · staging branch `work/v131-sales-lite-menu-staging` · **NO SEND / NO ORDER WRITE**.  
**Checkpoint source:** V12.4R Customer Core PR #52 and Owner/Shop B PR #41, both separate Draft PRs. **Do not merge or overwrite either.**

## Components implemented

| Component | Source | State |
|---|---|---|
| MenuRegistry | `menu-registry.json` | 17 stable actions, Customer(6), Owner(7), Support(4) |
| MenuTemplateService / MenuRenderer | `menu-engine.cjs` | TEXT_NUMBERED, TEXT_COMMAND, MOCK_TESTED |
| MenuActionRouter | `menu-engine.cjs` | stable ID, role-local number, Vietnamese aliases |
| MenuPermissionGuard | `menu-engine.cjs` | backend-resolver context, permission, shop paused, subscription expired |
| MenuSessionManager | `menu-engine.cjs` | `SINGLE_PROCESS_QA_ONLY` memory receipt/TTL, **not durable** |
| MenuAnalytics | `menu-engine.cjs` | no-PII counters, QA only |
| ChannelMenuAdapter | `menu-engine.cjs` | zero external sends, rejects native/quick API |
| Customer/Owner business contract | `business-contracts.cjs` | injected read ports, proposals and order transition validation; **no writes** |
| Support Bot contract | `business-contracts.cjs` | ticket draft only, no creation claim |
| Subscription Lite contract | `business-contracts.cjs` | verified read-only expiration, no payment |
| Customer/Owner mobile mock | `mock/index.html` | client-only UI, uses shared JSON registry |
| Subscription Lite website mock | `mock/subscription-lite.html` | read-only UI placeholders, no credentials |
| Zalo menu capability audit | `docs/ai-handoff/V13_1_ZALO_MENU_CAPABILITY_AUDIT.md` | BOT API vs OA/ZBS differentiation |
| n8n manual isolated smoke | workflow `2JUqVjPToWUmLfPL` | 16 synthetic QA, execution 3809, inactive |

## Run locally

Requires Node.js 22. All tests use Node built-ins; no npm install or paid AI calls needed.

```sh
node --test qa/sales-lite/v131/*.test.cjs
cd qa/sales-lite/v131
python -m http.server 8080
```

Open `http://127.0.0.1:8080/mock/` for mobile chat mock; `http://127.0.0.1:8080/mock/subscription-lite.html` for subscription mock. The phone demo fetches `../menu-registry.json` relative to its folder. Opening `file://` may block fetch due to browser cross-origin restrictions.

These prototypes have **no login, Zalo API, backend, storage or customer data**. Selecting `OWNER` in the demo controls only the display. The real Owner identity must come from server-side signed provider ingress and pairing binding.

## Separation from existing development

- **Customer PR #52:** reuse `qa/commerce/v124-core` through a future trusted `customerCore.preview()` port, currently not imported or deployed. Existing Customer Core remains authoritative for price, stock, AI intent and read-only multi-turn QA; this module does **not** copy its Orders engine.
- **Owner PR #41:** reuse its Owner Gate/binding and private session work after security review; do not expose Customer context to Owner tables.
- **Notification Outbox:** `prepareHeldNotification()` returns only a `SEND_DISABLED` candidate **after** a backend-supplied verified persisted order; it never inserts rows. Existing outbox service is the sole future writer after separate approval.
- **n8n:** all published Zalo workflows unchanged. The separate manual workflow has only Manual Trigger + Code; no HTTP, AI, database or Zalo nodes.
- **Supabase:** no V13.1 SQL migrations, ACL changes or credentials. Shop A/B source tables remain isolated.
- **Website:** existing login/account/subscription pages are not overwritten. Only a static prototype was added.

## Security & release blockers

1. **P0:** native Bot buttons / callback contract not verified. Bot `sendMessage` reference only exposes `text` etc.; see audit.
2. **P0:** actual backend resolver not connected; a demo `source/isVerified` flag is not proof of authentication. Do not pass a client object as trusted context.
3. **P0:** MenuSessionManager memory receipts do not guarantee cross-worker exactly-once; replace with persistent transaction and idempotency store before live traffic.
4. **P0:** Customer Core PR #52 and Owner PR #41 cannot be merged blindly; review field names, provider auth, tenant ownership and per-store readback before integration.
5. **P0:** no live order save/stock decrement, Owner notification, payment confirmation or auto reply has been enabled.
6. **P0:** No verified Supabase full backup/restore and read/write permission grant for private backend, as of V12.4 checkpoint. Do not bypass credential gate.
7. **P1:** support ticket and subscription renewal paths are drafts; no claims of delivery, ticket persistence or paid revenue.
8. **P1:** Bot API commercial use, interactive callback rights, quotas/costs unverified. Subscription price hypothesis is NOT configured for Billing.

## Release states

- `IMPLEMENTED`: registry, deterministic menu router, guards, renderer, business contracts, QA mocks.
- `TESTED`: GitHub isolated unit cases and manual n8n synthetic fixtures, see checkpoint.
- `UNKNOWN`: provider-native interactive menu, Bot buttons/callback API and SaaS commercial terms.
- `BLOCKED`: two-way production Zalo, actual Orders, outbound notifications and payment.
- `RELEASE`: **not authorized**. Continue EXPERIMENTAL; promote only after reviewed QA and approval.

## Rollback

No live components were edited. Rollback only new branch files and leave previously published V1/Customer Router/Owner Shadow intact. The manual n8n QA workflow is inactive and can remain as QA evidence; do not delete it without separate approval.

**Known variants:** Lite 199.000đ/tháng and Plus 349.000đ/tháng are research hypotheses, not commercial prices currently charged.
