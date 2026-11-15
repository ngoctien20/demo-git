# TIEN404 AI — V14.4.7–V14.4.10 Messenger Test-Ready Checkpoint

**Date:** 16 Nov 2026 JST.
**Lifecycle:** EXPERIMENTAL / DRAFT, Level 1 OFFLINE TEST READY; Level 2, 3, 4 NOT VERIFIED.
**GitHub Draft PR:** https://github.com/ngoctien20/demo-git/pull/110
**Branch:** work/v1447-v1449-messenger-four-flow-offline-qa-20261116
**Parent:** V14.4.6 PR #108 HEAD b23ac8e724ce738c70778ffb3e5d082560185893.
**Separate unmerged dependencies:** Store/Knowledge PR #86, Messenger replay PR #95.
**Release policy:** NO production, hosted database write, n8n Published modification, credential change, billing or real Messenger/Zalo sends.

## 1. Actual read-only audit — VERIFIED

- n8n Published TIEN404_MESSENGER_TEST ID Z7FdV7uDvApfbURQ remains ACTIVE, Draft/Published version d5c96b6b-d790-4270-8b0f-d0ebdd8bbd92, 27 nodes. It includes HMAC verification, AI Agent, Google Sheets DEMO Products, legacy DEMO Order create/update/manage tools, order status and support tools. It is NOT a verified multi-Store Commerce Order backend.
- Rich UI experimental workflow X0MwwQ7LRUqfOVjM remains INACTIVE, no-send, manual QA. Messenger order-status 4DFFCk60exrzaIl6 and support KqSuGxCHixc6fsiu remain ACTIVE.
- Last visible published Messenger webhook metadata success execution 2246, 2026-11-11T11:50:42.706Z. No new real Meta message was sent by this task.
- Supabase staging project ifxlvrhyjhbzbrkdsida remains PG17.11, Products=2, Orders=2; no public.stores or public.store_memberships; 6 permissive tenant-wide SELECT policies remain. No actual Store RLS migration performed.
- Operator backup has prior readable archive list, but full isolated Restore remains DEFERRED/UNTESTED. It remains a P0 gate before hosted migration.
- Existing V14.4.6 Pg17 atomic request and inventory ledger proof remains isolated in disposable CI and not connected to Meta.

## 2. IMPLEMENTED — safe Messenger 4-flow offline source

- qa/messenger-sales-v1448/messenger-four-flow-offline.cjs: 3 synthetic Pages and Store A/B same tenant, C other tenant; same SKU with different VND price. Synthetic gateway brands envelopes, not a real raw-HMAC authenticator.
- CONSULT: catalog QA consultation/fallback.
- QUOTE: strict per-Store fake price and stock, no fake wholesale discount, no order creation by quote.
- ORDER: pending explicit confirmation and current-price/stock recheck; only on explicit confirmation writes an in-memory synthetic Order Request and then an unsent Outbox record. No real stock reservation, customer record, DB write or provider message.
- ORDER SUPPORT: only same synthetic sender+Page can see their in-memory request status, no unauthorized edit/cancel/PII.
- Replay guard: same Page/MID/text/sender returns prior response; reused MID with changed sender or content fails closed.
- Always reports offline fixture level, zero hosted writes, zero provider sends, no real AI Agent or Meta HMAC/JWT.
- qa/messenger-sales-v1448/messenger-four-flow-offline.test.cjs: 33 unit tests.

## 3. n8n operator QA LAB — IMPLEMENTED AND TESTED

URL: https://ngoctien20.app.n8n.cloud/workflow/jeLqAGOlG06LanDv
Workflow ID: jeLqAGOlG06LanDv
Name: TIEN404 V14.4.8 — Messenger 4-Flow Sales QA [OFFLINE - NO SEND]
Location: Personal project → 90_QA - DIAGNOSTICS
State: INACTIVE, Manual only, Draft version 39b10832-4461-4067-9e2b-c75016a306be; no Published version.
Nodes: Manual Trigger → Choose Scenario Set → Offline Code. 3 nodes, zero assigned credentials.
Execution: #3862, SUCCESS, 8/8 output items status PASS. Flags: syntheticOrdersOnly=true, realAiAgent=false, realMetaMessaging=false, noHostedWrites=true, noProviderSends=true.

Operator instructions:
1. Open workflow link.
2. In node "02 - Chọn luồng thử (ALL hoặc từng module)", leave scenario=ALL or select CONSULT, QUOTE, ORDER, SUPPORT, CROSS_STORE, DUPLICATE, STOCK, RICH_UI.
3. Click "Execute workflow". Inspect node "03 - 8 luồng QA giả lập - KHÔNG GỬI".
4. ALL should yield 8 PASS items, without any real messages or customer data. One scenario yields one item.
5. This is a scripted visual n8n test, NOT a real multi-turn AI session, Meta Send API or actual PostgreSQL Order commit.

## 4. QA — VERIFIED

**GitHub Actions:** https://github.com/ngoctien20/demo-git/actions/runs/43745047167
All 3 jobs completed SUCCESS at source/docs HEAD before this checkpoint:
- 33/33 NEW offline Messenger multi-turn Node cases PASS.
- 579/579 inherited source regression Node cases PASS.
- Total 612/612 Node tests PASS, 0 FAIL.
- Reused disposable actual PostgreSQL 17 V14.4.6: 30 direct Order/Stock SQL assertions PASS, 8 real concurrent separate-session assertions PASS.
- Static no-network/no-credential/no-hosted-write guard PASS.
- Initial experimental run 43744730321 had 32/33 due a fallback string wording mismatch ("mô phỏng" vs "giả lập"); fallback wording updated to explicitly state offline and final runs PASS. Not a leakage or hosted operation.
- Important: only PG17 disposable tests use real SQL; n8n 8/8 and Node 33/33 are synthetic contract tests.

## 5. V14.4.10 Meta Page readiness — PROPOSED, NO SEND

See docs/ai-handoff/V14_4_10_META_PAGE_READINESS_NO_SEND.md.
- Official Meta docs checked for webhook raw-body signature, Page token/permissions, subscribed fields and Messenger send eligibility.
- Existing Published Messenger webhook had historical success, but current Page/App rights, pages_messaging permissions, tester cohort and actual send window remain NOT VERIFIED in this task.
- No current owner approval for a real Page/App change, Meta credential operation, or actual live message send. Keep all published systems untouched.

## 6. Blockers / approvals

P0: Full isolated restore of actual archived staging backup still not verified. Requires separate approval/verification before Store schema/RLS migrations.
P0: Four existing Product/Order records have not been independently assigned to canonical Store. No Store/Membership schema, six unsafe old tenant-wide SELECT policies. No real scoped Auth/JWT acceptance.
P0: Legacy Messenger bot still routes through Google Sheets DEMO tools. Never silently connect to Commerce Store backend, change Published nodes or leak customer data.
P0: Actual Meta App/Page tester role, signature verification, Page token permissions, and bounded real send not reviewed/authorized.
P1: Real AI Agent/catalog integration, multishop Shop Knowledge, durable atomic order+outbox, actual Owner notification and Rich UI visual receipt not tested in this release.
P1: V14.4.6 test-only reserve-on-merchant-accept policy is not a commercial decision.

## 7. Acceptance levels

LEVEL 1 OFFLINE VERIFIED — PASSED (n8n manual 8/8; Node 33+579; disposable PG17 30+8).
LEVEL 2 STAGING INTEGRATION VERIFIED — BLOCKED (needs actual adapter/AI/Store resolver/Order-Request/outbox integrated within isolated staging).
LEVEL 3 REAL MESSENGER QA VERIFIED — BLOCKED (needs QA Page authorization and actual verified tester send/receipt, separate approval).
LEVEL 4 COMMERCIAL RELEASE APPROVED — BLOCKED (restore/RLS/JWT/Meta/business policy/customer QA and release authorization).

Rollback: close/revert Draft PR only. The new separate inactive n8n workflow can remain in QA or be separately archived with explicit owner approval. No existing n8n Published workflows, Supabase credentials, Orders, Products, stock, billing or production changed.

## 8. Recommended next approval scope

Authorize READ-ONLY inspection of one nominated QA Meta Page/App and existing Page registry to establish Page/tester/permission eligibility (no credential disclosure); then separately authorize a small capped number of real QA sends after evidence passes. If a real Store data-write pilot is desired, first complete isolated restore, per-row owner evidence, hosted Store RLS/JWT and owner-approved stock policy. Never assume a historical Messenger webhook execution proves these gates.
