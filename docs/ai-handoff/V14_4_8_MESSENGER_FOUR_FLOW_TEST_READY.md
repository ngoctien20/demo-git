# TIEN404 AI V14.4.8–V14.4.9 — Messenger Four-Flow Sales Test-Ready (OFFLINE ONLY)

As of 16 Nov 2026 JST. Branch work/v1447-v1449-messenger-four-flow-offline-qa-20261116; based on V14.4.6 PR #108. This IS NOT a live Messenger pilot, not an AI Agent integration, not hosted JWT/RLS and does not send messages.

## 1. Deliverables

- qa/messenger-sales-v1448/messenger-four-flow-offline.cjs: offline in-memory integration contract with three entirely synthetic Pages, two Stores in one tenant (same SKU different price), a third tenant, synthetic sender-bound identity, explicit confirmation, price and stock snapshot check, per-Page MID replay and no-send outbox.
- qa/messenger-sales-v1448/messenger-four-flow-offline.test.cjs: 33 offline tests of product advice, integer VND price/quantity, not creating orders on quote, wholesale negotiation refusal, explicit confirmation, in-memory request+outbox, MID conflict, no stock writes, Store isolation and owner-bound order status.
- .github/workflows/v1448-messenger-four-flow-qa.yml: 33 new tests, 579 inherited source regressions and real disposable PG17 V14.4.6 30 business checks + 8 simultaneous-connection checks; no hosted secrets or real Meta calls.
- New n8n manual QA: https://ngoctien20.app.n8n.cloud/workflow/jeLqAGOlG06LanDv
  Workflow ID jeLqAGOlG06LanDv, name TIEN404 V14.4.8 — Messenger 4-Flow Sales QA [OFFLINE - NO SEND]; Personal / 90_QA - DIAGNOSTICS; Inactive, Manual Trigger, Set Scenario, Code only; no auto-assigned credentials.
- First manual execution #3862: SUCCESS with eight outputs, all eight PASS and noHostedWrites/noProviderSends true.
- Existing Published Messenger Z7FdV7uDvApfbURQ and Rich UI Candidate X0MwwQ7LRUqfOVjM untouched.

## 2. How the owner can personally test the manual n8n workflow

Open: https://ngoctien20.app.n8n.cloud/workflow/jeLqAGOlG06LanDv

1. Click node "02 - Chọn luồng thử (ALL hoặc từng module)".
2. Leave "scenario" value ALL, or select CONSULT, QUOTE, ORDER, SUPPORT, CROSS_STORE, DUPLICATE, STOCK, or RICH_UI.
3. Press "Execute workflow" (Manual QA). If you changed the node, Save Draft only. DO NOT Publish.
4. Open node "03 - 8 luồng QA giả lập - KHÔNG GỬI" and inspect output. For ALL, expect 8 items, all status PASS. For one name, expect 1 item.
5. Verify level LEVEL_1_OFFLINE_MOCK, syntheticOrdersOnly=true, realAiAgent=false, realMetaMessaging=false, noHostedWrites=true, noProviderSends=true.
6. This console is SCRIPTED mock behavior, NOT a real multi-turn AI session or Messenger client. For actual real-transaction PG17, separately inspect V14.4.6 CI and rerun isolated GitHub Action. Do not run any test SQL on Supabase staging.

## 3. End-to-end contract vs actual implementation

- CONSULT: simulate product consultation for known QA Store. No real AI call; no shop owner knowledge yet connected.
- QUOTE: price fetched from trusted synthetic Page→Store fixture, 159000 VND Shop A vs 209000 VND Shop B. 3 units in Store A = 477000 VND. No automatic discounts/wholesale or order writes.
- ORDER: "đặt 2 áo" → explicit "xác nhận" → create an in-memory synthetic Order Request and outbox event once; stock stays unchanged. No phone/address/customer real data collected.
- SUPPORT: only same fake sender + Page can view their synthetic request; edit/cancel requires separately authorized store/order/state workflow, no live changes.
- OWNER NOTIFICATION: the source module records only READY_OFFLINE_NOT_SENT after synthetic in-memory request persistence, never sends or claims delivery.
- RICH UI: reuses the existence of existing X0MwwQ7LRUqfOVjM inactive Rich UI proposal; this new n8n lab shows structural candidate names only and does not send a Meta Carousel or verify Page UI.
- SECURITY: synthetic gateway brands envelopes in process memory. This is NOT real X-Hub-Signature-256, Page access token or real staff/merchant Auth. Real Messenger P0 gates remain open.

## 4. What remains blocked for real Messenger test

1. Confirm which Meta Page/App is permitted for an isolated tester-only pilot and verify its webhook callback, subscribed events, pages_messaging permission, current Page token permissions, Page role, developer/tester access and messaging-window compliance. No credentials to be copied into GitHub or chat.
2. Verify raw-payload HMAC and MID replay, trusted Page → Tenant → Store resolver and negative tests on the real ingress.
3. Never wire Published legacy DEMO Order tools into Commerce multi-tenant. Require separately approved Order Request storage and valid store scope. Product V2 and hosted Store RLS remain unimplemented; 4 historical Product/Order ownership mappings not validated.
4. User's original local PostgreSQL backup can be listed but full isolated restore is NOT tested; migration and any hosted RLS/GRANT operations stay blocked.
5. For an actual owner notification, verify durable commit and Outbox idempotency plus Page owner consent and platform policy. Real dispatch requires separate explicit authorization.
6. Real AI Agent consultation is not tested by the deterministic offline lab; AI tool/knowledge acceptance needs independent read-only QA and a separate approved QA inference budget if required.
7. Cross-store hosted JWT acceptance and customer data privacy tests are NOT accomplished by mock sessions.

## 5. Acceptance levels and rollback

LEVEL 1 OFFLINE VERIFIED: new n8n mock 8/8 PASS, code Node tests, isolated PG17 regressions once final CI confirms.
LEVEL 2 STAGING INTEGRATION VERIFIED: NOT YET; requires actual link between Messenger adapter, AI Agent, trusted catalog, transactional Order Request and Outbox on isolated staging.
LEVEL 3 REAL MESSENGER QA VERIFIED: NOT YET; needs approved test Page and actual inbound/outbound evidence.
LEVEL 4 COMMERCIAL RELEASE APPROVED: NOT YET; requires restore, RLS/JWT, owner mapping, Meta app permissions, policy acceptance and release approval.

Rollback: close/revert Draft PR; leave standalone n8n QA workflow Inactive (archival requires separate owner approval). No existing Published flow, Supabase data, credential or production changes.
