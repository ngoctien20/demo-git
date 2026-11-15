# TIEN404 AI — V14.5 LIVE02 ACCEPTED → LIVE03 ORDER REQUEST DRY RUN

**Date:** 16 November 2026 JST
**Lifecycle:** LIVE02 REAL MESSENGER ACCEPTED; LIVE03 OFFLINE TEST READY; NO REAL ORDER WRITE.
**Parent branch:** V14.5 Draft PR #113, commit b920289c9345d558f042bfc8203c2ccfac72b547.
**Source protection:** Do not change Published Messenger, Google Sheets Orders/Products, Supabase, Meta credentials/webhook, or production.

## 1. LIVE02 acceptance (VERIFIED)

The owner explicitly confirmed receipt of both live consultation and quotation replies.

| Check | LIVE02-A | LIVE02-B |
|---|---|---|
| Execution | #3867 | #3868 |
| Time JST | 16 Nov 04:27:25 | 16 Nov 04:28:01 |
| Exact incoming LIVE02 message | matched | matched |
| Page ID | 2379295362359912 | 2379295362359912 |
| Signature timing-safe and Meta verification | true | true |
| Read-only Products tool | 1 successful call | 1 successful call |
| A002 returned price / stock | 159000 VND / 25 | 159000 VND / 25 |
| AI Agent result | successful, 429 chars | successful, 92 chars |
| Meta Send message_id matches Verify Send Result | yes | yes |
| Create/Manage/Update Order tools called | NO | NO |
| Client received message | confirmed | confirmed |
| Verdict | ACCEPTED | ACCEPTED |

LIVE02-A also suggested A004 and A010, names and prices matching the same Products tool. Values are from legacy AI_SALES_DEMO, not Commerce Store inventory. Normal execution/MID/memory writes can occur automatically under existing Published workflow.

## 2. P0 — DO NOT SEND LIVE ORDER CONFIRMATION TO PUBLISHED BOT

Read-only inspection of Published Create Order Tool ID KrSn4DNR9ALX5ng4 confirmed a Google Sheets node named Append Order with operation append. Its Published version 4740251a-cd01-4f7f-b8e1-e300a8393151 differs from its Draft version af9ee686-2a9f-483e-9622-6e449500ac5e.

The active Messenger workflow Z7FdV7uDvApfbURQ can call this DEMO order writer. Even a QA-only customer instruction might invoke the writer. LLM instructions like "do not save" do not securely prevent writes. The operator requested NO real Order write and NO Published change; therefore LIVE03 Messenger Order confirmation is NOT AUTHORIZED.

## 3. IMPLEMENTED / TESTED — separate n8n LIVE03 offline lab

**Workflow URL:** https://ngoctien20.app.n8n.cloud/workflow/momDd2gARJf5nFYI

- ID momDd2gARJf5nFYI.
- Name TIEN404 V14.5 LIVE03 — Order Request Dry Run [OFFLINE NO WRITE].
- Personal project, folder 90_QA - DIAGNOSTICS.
- INACTIVE, no Published version and no assigned credentials.
- Only three nodes: Manual Trigger → Set Scenario → Code.
- NO Sheets, Supabase, PostgreSQL, n8n Data Tables, HTTP, Meta Send, webhook, external AI Agent or actual order writer.
- Uses temporary JS Maps for mock request/outbox and synthetic shop/customer aliases. No phone, address, real sender PSID or customer PII.
- Shop A fixture SKU A002 159000 VND stock=25; Shop B same SKU 209000 VND stock=8. Both values are synthetic. Code QA-DRYRUN-0001 is NOT a persisted order ID.

**Execution #3871 SUCCESS — eight/eight scenarios PASS:**

| Scenario | Verified offline outcome |
|---|---|
| QUOTE_ONLY | 2 × 159000 = 318000, zero requests/outbox |
| PREPARE | waiting explicit confirmation, zero requests |
| CONFIRM_MOCK | one in-memory fake request + one unsent outbox; stock unchanged |
| REPLAY | repeated confirmation does not duplicate fake request/outbox |
| WRONG_TOTAL | rejects 1000 instead of 318000 |
| NO_STOCK | rejects 26 > fixture stock 25 |
| CROSS_STORE | rejects applying Shop A price to Shop B |
| CANCEL | cancellation before confirmation leaves zero requests |

Each output flags hostedWrites=0, googleSheetsWrites=0, providerSends=0, isRealOrder=false. The in-memory object counts are not SQL transactions; see V14.4.6 disposable PG17 test evidence for real race/concurrency behavior.

## 4. Steps for user hands-on testing

1. Open the workflow URL above in n8n.
2. Node 02 - Chọn trường hợp (ALL = 8 bài): keep scenario ALL or select exactly QUOTE_ONLY, PREPARE, CONFIRM_MOCK, REPLAY, WRONG_TOTAL, NO_STOCK, CROSS_STORE, CANCEL.
3. Click Execute workflow (manual). Save Draft only if editing Set; DO NOT Publish.
4. Open node 03 - Dry Run xác nhận đơn - NO WRITE and inspect the results. ALL returns 8 items; all should show status PASS, hostedWrites=0, googleSheetsWrites=0, providerSends=0, isRealOrder=false.
5. Any QA-DRYRUN code is a visual mock, never a submitted real customer request.
6. DO NOT send "đặt 2 áo" followed by "xác nhận" into the Published Page during LIVE03.

## 5. Future LIVE03 Messenger gate (not yet approved)

Require a separately approved dedicated QA ingress/adapter or deterministic server-side tool-call denial for all write operations; test it without changing the existing Published webhook. Apply signed Page→Tenant→Store routing, durable MID replay and a separately isolated synthetic catalog/order backend. Request separate consent before any Meta live send or provider setting change. Actual hosted Store Order write remains blocked by real backup restore, four-row ownership mapping, Store RLS/JWT, inventory policy and independent merchant approval.

**Rollback:** Close/revert the source-only Draft PR. Separate n8n QA lab stays Inactive (archive only after separate owner approval). No Supabase/Google Sheet/customer data/Published workflow modification made by this task.
