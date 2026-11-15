# TIEN404 AI V14.5-LIVE03C — Order Intent Candidate × Trusted No-Write Integration

Checkpoint date: 16 November 2026 JST
Status: IMPLEMENTED + TESTED OFFLINE; DRAFT PR #119 stacked on PR #116.
Explicit non-goals: no real Meta webhook/Send, no real AI provider, no production deployment, no real Order/Stock/PII write, no token/credential changes.

## 1. Baseline VERIFIED

- Page TIEN404 AI: 2379295362359912.
- Messenger Published workflow Z7FdV7uDvApfbURQ remains Active at d5c96b6b-d790-4270-8b0f-d0ebdd8bbd92.
- Legacy Create Order Tool KrSn4DNR9ALX5ng4 Published 4740251a-cd01-4f7f-b8e1-e300a8393151 contains Google Sheets Append Order. This is a REAL WRITE PATH and remains unchanged. Do NOT test order confirmation on the real Page under a no-write scope.
- LIVE01 execution #3866 accepted after owner-confirmed Messenger response.
- LIVE02 consultation execution #3867 and quotation execution #3868 accepted after owner-confirmed Messenger receipt, real read-only Products A002 at 159000 VND, stock 25, no order tools invoked.
- LIVE03 no-write mock Inactive n8n momDd2gARJf5nFYI, exec #3871 8/8 synthetic PASS.
- LIVE03B signed tool-denial QA PR #116, 63 unit tests PASS, n8n manual Inactive Srey0pqbAw8R0DXn exec #3877 21/21 PASS.

## 2. IMPLEMENTED — signed-fixture order-intent candidate source

- qa/messenger-live03c/order-intent-candidate.cjs
- pipeline: exact synthetic signed raw Meta-style bytes → verified HMAC SHA256 → private QA Page→Tenant→Store registry → deterministic conversation intent planner → LIVE03B allowlisted hard-denial gateway → synthetic reply object.
- Cryptographic raw HMAC uses a SYNTHETIC secret only; no actual Meta App Secret, Page token, PSID or real customer payload.
- Planner is DETERMINISTIC, a stub for future LLM proposals. It does not call an AI provider. Real AI behavior is not certified.
- Hard allowlist only: catalog.read; quote.read; qa.order.prepare; qa.order.confirm; qa.order.cancel.
- All other tools blocked before invocation: create_order; manage_order; update_order_address; meta send; stock mutation; HTTP; DB and unknown aliases.
- QA confirmation requires a distinct signed event containing an exact XAC NHAN QA-12hex message from matching sender Page/Store; only transient in-memory mock objects are created.
- Boundary rejects tampered/missing signature, replay, page mismatch, synthetic role or Store override, prompt injection, stale/insufficient mock stock, cross-store prices and invalid total.
- Every response has actualOrderWrites=0, providerSends=0 and sentToMessenger=false.
- Limitation: in-memory replay and pending data are not durable or multi-worker atomic.

## 3. IMPLEMENTED — isolated n8n manual candidate

URL: https://ngoctien20.app.n8n.cloud/workflow/AuB26qIgAP8AfJhf
ID: AuB26qIgAP8AfJhf
Version: 2b2ff478-4996-4ac1-9220-7afc96dd613c
Project: personal; Folder: 90_QA - DIAGNOSTICS
Status: INACTIVE, not Published, zero credentials.

Six nodes:
1. 01 - LIVE03C QA Manual Start
2. 02 - Scenario Selector (ALL)
3. 03 - QA Synthetic Message Fixtures
4. 04 - Mock Page Resolver + Conversation Planner
5. 05 - HARD DENY Tool-Call Boundary
6. 06 - Safe Reply + QA Verdict (NO SEND)

No webhook, actual HMAC node, Chat Model, real AI Agent, Google Sheets, DB, Supabase, n8n subworkflow, HTTP or Meta Send node. The n8n lab uses an explicit SYNTHETIC signed fixture flag, NOT real HMAC verification; the actual signed raw-byte checks run separately in GitHub Node tests.

Manual n8n execution #3879 SUCCESS: 20/20 distinct synthetic scenario outputs PASS, all googleSheetsWrites=0, hostedWrites=0, realOrders=0, stockWrites=0 and providerSends=0. Cases include greeting, Shop A/B price, prepare→confirm→replay, unauthorized create/manage/update, Meta Send block, fake admin, wrong scope, unsigned, unknown Page, overstock, wrong total, quote-only and other-sender confirmation.

Exact Code node snapshot: qa/messenger-live03c/n8n-manual-stages.json.

## 4. TESTED — CI evidence

- Signed HMAC-to-Tool Gate-to-Reply end-to-end tests: 56/56 PASS.
- Replayed exact four n8n Code stages: 15/15 PASS.
- Inherited LIVE03B gateway tests: 63/63 PASS.
- Inherited n8n LIVE03B source tests: 9/9 PASS.
- Inherited LIVE03 dry-run tests: 13/13 PASS.
- Inherited raw Meta signed-fixture tests: 45/45 PASS.
- Inherited Messenger four-flow offline tests: 33/33 PASS.
- Total dedicated LIVE03C CI: 234/234 tests PASS, no failures; suites have overlapping scope with earlier PRs.
- CI run: https://github.com/ngoctien20/demo-git/actions/runs/43758489041

Initial CI attempt identified six failing accented Vietnamese intent recognition cases; fixed word-boundary treatment then reran to PASS. No live workflow affected. Note: hosted PostgreSQL RLS/restore certification is not implied by these offline tests.

## 5. User manual QA instructions

Open https://ngoctien20.app.n8n.cloud/workflow/AuB26qIgAP8AfJhf
1. Confirm Inactive; DO NOT Publish or attach a Page webhook or credential.
2. Set node 02 Scenario Selector to ALL.
3. Click Execute Workflow (manual).
4. Open node 06 Safe Reply + QA Verdict (NO SEND).
5. Expect 20 outputs with status PASS. Check denial of create_order, manage_order and update_order_address; separate confirmation and Shop B pricing.
6. Each output must indicate no real Meta HMAC in this lab, no AI model, no real Order or provider Send.
7. Never message the real Page with an order confirmation for this test. Published Create Order Tool still has an actual Google Sheets order append path.

## 6. REMAINING P0 / APPROVAL GATES

- LIVE03C real Meta/order pilot = BLOCKED. Current Published bot can still invoke legacy DEMO Append Order.
- Real AI model is not integrated or evaluated, and its tool boundary is not proven on any live provider channel.
- Future LIVE03D candidate must have writer tools absent from the actual agent graph, deterministic server-side tool allowlist, signed trusted Page/Store binding, real LLM evaluation under capped QA spend, and offline negative testing before real Page connection.
- Durable multi-instance atomic MID replay, tenant/store hosted JWT/RLS, verified 4-row ownership, real backup restore, stock policy, and isolated QA Orders backend remain separate gates.
- Separate explicit owner approval required for Meta Page subscription or send, repointing webhook, Publish to production, credential/token changes, hosted migrations/GRANT/RLS, actual Orders/Stock write or new budget.

## 7. CHECKPOINT / ROLLBACK

- GitHub PR #119 Draft and new independent Inactive n8n candidate are the only new artifacts in LIVE03C.
- Old Messenger Published, old Create Order Published, actual Google Sheets Products/Orders, Supabase, Page, token, webhook, subscription and billing remain untouched.
- Rollback: close/revert source-only Draft PR #119; leave Inactive QA workflow for reproducibility or request separate archival approval.
- Final status: LIVE03C IMPLEMENTED + TESTED OFFLINE; not APPROVED/RELEASED.
