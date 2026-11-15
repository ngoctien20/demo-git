# TIEN404 AI — Strategy Decision Record V12 Sales Lite (2026-11-15 JST)

## Decision
**PROPOSED PIVOT / APPROVAL FOR REDUCED PRODUCT SCOPE**, NOT a production rollback.
Owner asked to revert to the minimal functionality if comprehensive AI Studio scores below 6/10 commercially. Assessed comprehensive multi-tenant AI Studio at **4.8/10**, Sales Lite opportunity at **7.5/10** (qualitative judgment, NOT QA score or completion percentage).

Launch-first product: **TIEN404 Sales Lite — intake SKU or order request → save pending request → notify verified shop owner via Zalo Bot → owner confirms/marks paid → owner requests revenue by Zalo Bot**.
AI Studio/Agent Lab and V12.4R+ Customer Core remain retained, **R&D ONLY**, not deleted, not exposed to customers, not merged or deployed under this decision.

## What was verified live, 2026-11-15
- n8n workflow `TIEN404_ZALO_BOT_LAB_V1_STAGING` `yIJk8LvJoLF40Z62` active and accepts webhook, normalized/read-only; links Shadow/router and marker tables; **does not** send automatic order alerts from saved production orders.
- Private router `sIPs6egzIwOY1GNv` active but only read-only and no real customer order commit; four manual execution successes on 2026-11-14.
- One-shot staging `Nm2sYvW0cCT2FpWR` execution `3361` SUCCESS with `API_ACCEPTED`, `send_count=1`, `delivery_read=false`, `production_ready=false`: valid proof of one **authorized** Zalo Bot send, not end-to-end automatic order notification.
- Revenue V3 `AEFI11cvvBrrYCbu` is manual synthetic-only; execution `2662` returned REPORT_OK and synthetic paid revenue 318000 VND; **not real revenue**.
- Live workflow `AI SALES - Revenue Report` `U2DJsxzSYPH5hRop` reads **AI_SALES_DEMO** Google Sheet and sends via Gmail, **NOT Zalo**; must not be reused as SaaS multi-tenant revenue.
- Supabase `tien404-staging` public.orders currently has id, tenant_id, customer_id, status, total_vnd, order_source, created_at, updated_at; **NO paid_at and NO store_id**. Therefore transaction-confirmed revenue **cannot yet be claimed with reliable paid date or per-store segmentation** from this public table. There are only 2 staging order rows and 0 order_items at audit time. QA sandbox_orders has separate synthetic fixtures.
- Messenger `Z7FdV7uDvApfbURQ` Published and still wired to AI_SALES_DEMO write tools; never plug into Sales Lite without explicit isolation/approval.
- Work in progress PR #41 (Owner), #52 (Customer Reply), #62 (Core Retention), #64 (Catalog RLS) remain separate; V12.4R.3 transaction-bound source work paused. No destructive rollback is part of this decision.

## Lean business flow

### A. Customer capture — deterministic, model optional
`channel inbound (Messenger/Website/Zalo customer only if separately verified) → signature and tenant/store/bot binding → validate SKU + quantity → read merchant's verified current catalog → create order_request status=NEW_PENDING_OWNER (NO stock deduction, NO payment claim) → unique server-generated request ID → append outbox notification in same DB transaction.`

- If SKU/quantity missing, request clarification; if price unavailable, report price **unverified**, do not invent a monetary amount. Refuse unknown stock/prices. Non-model rules-first for first paid version.
- Customer should receive receipt **request ID** (not confirmed sale). Avoid exposing real customer PII to owner channel without consent / least privilege.
- Assign UUID/ULID on server, human short code with database UNIQUE(tenant_id, store_id, human_code), and UNIQUE(tenant_id, store_id, channel, provider_event_id). Never use AI to invent IDs. Same inbound event must never create duplicate requests.
- For MVP per-shop isolation is mandatory. Do not silently reuse `public.orders` which lacks store_id; design approval-only scoped migration or an isolated new table.

### B. Notify shop owner via Zalo Bot
`committed order_request → outbox unique event → server-side verified shop→owner chat binding and subscription state → Zalo Bot sendMessage → record provider ACK/failed/attempts/retry key`.
No sends before COMMIT; no cross-store recipient, no duplicate alerts; store send failure without deleting the request. Recipient must have interacted/been bound according to provider API rules; account must not be assumed reachable just because bot has a token. Separate `OWNER_ALERT_SENT` from `ORDER_CONFIRMED`.

### C. Owner confirmation and revenue
`verified owner chat / dashboard → confirm request → mark paid with evidence/paid_at (if collected), otherwise status CONFIRMED only → revenue service queries PAID only by paid_at, per shop and timezone Asia/Ho_Chi_Minh → /doanhthu or report request → reply via verified Zalo Bot`.
**Do not count NEW_PENDING_OWNER or CONFIRMED as paid revenue.** Provide separate metrics for new requests, confirmed orders, paid revenue, cancelled/refunded, and DATA_INCOMPLETE if paid_at/total is absent.
Report content must disclose unverified reconciliation (paid status is not equal to bank-settled cash). Owner's identity and current shop must be rechecked on every report request.

## Scope to remove from customer MVP (not delete source)
- Autonomous GPT product negotiation, promotions, and pricing; model-generated order mutations.
- Multi-step stock reservation, loans, returns/refunds, advanced order editing, broad AI Studio/customer authoring UI.
- Cross-platform fan-out, arbitrary webhook workflows, direct customer self-service multi-tenant AI agent factory.
- Full history/LLM memory as an operational dependency. Keep Messenger/AI Studio versions in QA, not promoted.

## Minimal modules needed
1. Ingress / Tenant Resolver (channel provider signature, bot_shop identity, shop subscription; reject default/fallback shop).
2. Catalog SKU read-only, price and stock validation, store-scoped.
3. Order Request Ledger + Outbox with independent ID, UNIQUE keys, immutable event evidence and owner authorization.
4. ZaloBotNotificationAdapter (owner chat-only, policy/allowlist, ACK/retry/failed, no live send in shadow).
5. Revenue ReadOnlyService (PAID-only paid_at + Asia/Ho_Chi_Minh, permission checked each call).
6. Minimal dashboard: pending requests, confirmed/paid, resend failed alert, daily counts.

## Commercial fit assessment (qualitative)
- Comprehensive AI Studio: **4.8/10** present commercialization readiness. Strong exploratory test coverage, but hosted RLS/tenant/store/multi-worker channel/gateway cost/transaction stock guards, verified data feed and Zalo owner notifications not production-complete.
- Sales Lite: **7.5/10** expected product-market execution fit (lower cost, simpler UX, basic order+report need), **NOT released and no real traffic capacity benchmark**.
- Target first: one live shop after staged acceptance, then 2 shop tenant-isolation test, then multi-shop load testing; never claim N tenants concurrency without test evidence.

## Mandatory QA release gates
- [ ] Zalo Bot owner recipient verified per store and allowed to receive bot messages; report access unauthorized=403/fail closed.
- [ ] Ingest 1 message twice concurrently → exactly 1 order_request + exactly 1 outbox event; maintain provider event_id uniqueness.
- [ ] Distinct Shop A/B same SKU with different prices → no cross-store product, order, revenue or owner recipient.
- [ ] Missing/invalid SKU, noninteger quantity, stale price, invalid VND, malformed timestamp, revoked shop, expired subscription → no phantom order, no notification.
- [ ] Owner confirms before status transitions; no automatic paid marking; report counts PAID only.
- [ ] Revenue paid_at timezone + refunds/data completeness; report from durable database NOT synthetic fixture.
- [ ] Outbox retry, 429/timeout, Zalo rate/provider policy, no duplicate notification, recipient privacy; Zalo provider ACK is not end-user delivery/read proof.
- [ ] Isolated staging one-shot + manual owner signoff; no model call, no Gmail/Messenger/production mutation.
- [ ] 2 shops × 20 concurrent messages, stress duplicates and independent tenant scope; numbers are **test targets**, not present capacity claims.
- [ ] Production release explicitly approved after backup, evidence, rollback, cost/channel policy review.

## Zalo integration distinction
- Official **Zalo Bot API** has `sendMessage` with a bot token and chat_id; owner must be correctly bound to the Bot/Chat.
- **Zalo OA** customer-facing communication follows separate 2026 OA / ZBS Template Message policies, template review and fees; do not treat it as interchangeable with a Zalo Bot owner alert.
Official docs: https://docs.zaloplatforms.com/zalo-bot and https://oa.zalo.me/home/documents/guides/tong-quan-cac-loai-tin-nhan-tren-zalo-official-account-_3651713298729094511

## Change control / rollback
- **No changes yet** to Published n8n workflows, Supabase roles/RLS/schema, customer data, Zalo sends, Google Sheets DEMO, billing, or AI model budget.
- Prior branch checkpoint: `checkpoint/v12-sales-lite-before-strategy-pivot-20261115`. Proposed source branch: `strategy/v12-sales-lite-zalo-owner-mvp-20261115`.
- This is a product **scope rollback**, not destructively reverting the whole codebase. Preserve PR #41, #52, #62, #64 and V12.5 Tester QA as ARCHIVED/ON-HOLD workstreams, not automatically merged, deleted, or disabled.
- New DB migrations, credential creation, role/RLS changes, subscription/billing changes and production Zalo notifications each need explicit owner approval.
