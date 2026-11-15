# TIEN404 AI — V14.5-LIVE03B Trusted Messenger Tool-Call Hard Denial Checkpoint

**Checkpoint:** 2026-11-16 JST
**Classification:** IMPLEMENTED + TESTED OFFLINE; **NOT CONNECTED TO META LIVE ORDER FLOWS**
**Release status:** EXPERIMENTAL, DRAFT PR #116 stacked upon DRAFT PR #115.
**Operator instruction:** No real Order write, no changes to Published, credentials, webhook, token, hosted data or trial billing.

## 1. Baseline and dependencies (VERIFIED)

- LIVE01 Messenger smoke: execution #3866, HMAC verified, AI completed, Meta Send succeeded, owner received response, ACCEPTED.
- LIVE02-A consultation #3867 and LIVE02-B quotation #3868: signed webhook PASS, read-only Products tool returned A002 159000 VND stock 25, Agent correct, Meta Send IDs matched, owner received both, ACCEPTED.
- LIVE03 dry-run QA workflow momDd2gARJf5nFYI: Inactive, 8/8 synthetic cases PASS execution #3871.
- Existing Published Messenger: Z7FdV7uDvApfbURQ, version d5c96b6b-d790-4270-8b0f-d0ebdd8bbd92, still active and NOT modified.
- Published Create Order Tool: KrSn4DNR9ALX5ng4, version 4740251a-cd01-4f7f-b8e1-e300a8393151, ACTIVE; includes Google Sheets Append Order operation append. **Cannot claim this tool is a no-write mechanism.**
- Existing V14.5 45-test raw-body HMAC fixture gate reused in source: qa/messenger-live-gate-v145/trusted-webhook-qa.cjs.

## 2. LIVE03B source deliverable (IMPLEMENTED)

File: qa/messenger-live03b/write-denial-gateway.cjs.

The module has no network, credential, Google Sheets, Supabase, database, HTTP, Meta Send, subworkflow executor or real Page dependency. It imports the previously tested raw-byte HMAC verification and private synthetic Page→Tenant→Store registry.

Trust controls:
1. Only OFFLINE_NO_WRITE_QA mode is permitted; constructor rejects any invalid config.
2. A signed synthetic Meta webhook raw Buffer is verified by HMAC SHA-256 and strictly bound to a private Page→Tenant→Store registry, with MID replay checking.
3. Session handle is held in process WeakMap, so a JSON object saying verified=true cannot manufacture tool privileges. Only one fresh signed message is allowed per dispatch context.
4. All AI-proposed tool calls pass through a positive allowlist. Allowed: catalog.read, quote.read, qa.order.prepare, qa.order.confirm, qa.order.cancel; everything else is hard-denied BEFORE any action.
5. Specifically DENIED: create_order, manage_order, update_order_address, get_order_status, create_support_ticket, stock mutations, HTTP, Meta Send and all unrecognized tool aliases.
6. Client or agent-provided tenantId/storeId/pageId, roles, isAdmin, token, force, authorization or dryRun cannot widen privileges.
7. Demo Page/Store A and B use different synthetic A002 prices; cross-store read and quote requests are not allowed.
8. Integer-VND quote, stock, expected_total validation, explicit positive signed QA order intent.
9. A separate signed customer event must contain exact text "XAC NHAN QA-" followed by the server-generated 12-hex identifier. A tool call by itself cannot mark an order confirmed.
10. Confirmation yields an ephemeral JS Map mock ONLY, with zero persistent order, stock decrement, owner notification or provider send.
11. In-process duplicate confirmations are idempotent; signed cancellation is allowed only before mock confirmation.
12. A "chưa đặt" message or other negative/nonorder inquiry is NOT sufficient to prepare a mock order.
13. Outputs explicitly identify SYNTHETIC_QA_ONLY_NOT_A_REAL_ORDER and zero actual external writes/sends.

**Important:** This is an isolated Node.js library, not wired into the current n8n Published AI Agent. Its in-memory replay and mock state is NOT cross-worker atomic or durable; do not reuse as-is as a hosted multi-tenant Commerce backend.

## 3. Automated security QA

- qa/messenger-live03b/write-denial-gateway.test.cjs — **63 cases**, raw HMAC input, typed tool calls, bad sig, tampering, replay, Page/Store scopes, malicious tool calls, fake admin, forged context, wrong total, insufficient stock, explicit confirmation, cancellation and in-process duplicate.
- qa/messenger-live03b/live03b-n8n-manual-lab.test.cjs — **9 tests**, replaying the exact n8n Code node snapshot in a Node VM. 21 n8n synthetic cases verified, no external I/O, unknown selectors fail closed.
- Inherited QA in CI: 13 LIVE03 synthetic order cases, 45 signed webhook tests, 33 historical four-flow offline tests.
- GitHub workflow .github/workflows/v145-live03b-no-write-gateway.yml: new gateway + QA lab + source no-I/O static guards + inherited regressions.
- CI status and run URL should be read from the current PR HEAD, not inferred from earlier commits.

## 4. n8n LIVE03B manual Lab (IMPLEMENTED / TESTED)

URL: https://ngoctien20.app.n8n.cloud/workflow/Srey0pqbAw8R0DXn
- Workflow ID Srey0pqbAw8R0DXn
- Personal project, folder 90_QA - DIAGNOSTICS
- INACTIVE; no published version; no credentials
- Only Manual Trigger → Set scenario → Code
- No real Meta webhook, cryptographic signature check, network or external tool/AI calls.
- Exact Code node source snapshot at qa/messenger-live03b/live03b-n8n-manual-lab.js
- Manual execution **#3877 SUCCESS; 21/21 synthetic results PASS**, with zero flagged external calls, Google Sheets writes, hosted writes, stock writes and Meta sends.

**The "syntheticSignedContext" flag in this n8n lab is NOT evidence of real HMAC verification.** Cryptographic HMAC is validated independently in the GitHub Node.js source tests. They have NOT yet been integrated end-to-end as a live real-Page ingress-to-tool adapter.

## 5. Hands-on QA instructions

1. Open n8n QA Lab URL (not the active Messenger bot).
2. Keep node 02 scenario=ALL, then press Execute workflow.
3. Open node 03 DENY WRITE TOOL (QA ONLY); expect **21 outputs with status PASS**.
4. Confirm each output records providerSends=0, googleSheetsWrites=0, orderWrites=0 and isRealMessengerTest=false.
5. Use a single scenario if desired; the selector is evaluated in memory. Do not Publish this QA lab or add credentials.
6. Do not send an actual order confirmation to Page TIEN404 AI. Live Published still has create_order wired to the old Sheets writer.

## 6. NEXT gate, blocked items and approvals

- [IMPLEMENTED] Draft source and isolated manual n8n demonstrator.
- [TESTED] Signed synthetic ingress and tool-denial unit tests; n8n manual 21 cases; no actual external writes.
- [NOT TESTED] Live Page order-intent and confirmation via Messenger, multi-instance durable replay, hosted Store RLS/owner 4-row and independent backup restore.
- [BLOCKED] Real Messenger LIVE03 order testing under NO-WRITE requirement. The current Published AI Agent still directly exposes the legacy create_order Tool; prompt directives cannot prevent bypass.
- [PROPOSED] V14.5-LIVE03C candidate-only separate ingress/agent with write-capable tools ABSENT, trusted binding, dry-run tool dispatcher wired at the actual tool boundary; no integration to current Page or webhook by default.
- [REQUIRES SEPARATE APPROVAL] Any Meta Page subscription or real Send, webhook routing change, Published workflow change, token/credential changes, hosted RLS/GRANT/migration, real Orders/Stock write or budget upgrade.

## 7. Rollback and checkpoint

- Source changes are only in stacked Draft PR #116; revert/close PR to roll them back.
- Newly created n8n QA Lab remains INACTIVE, with no credentials or impact on existing Published workflows. Archival only after owner approval.
- No hosted data, credential, Meta settings or live Orders/Stock changed in this work.
- Do not call this a production-safe order system until a deterministic no-write boundary is wired into a separately approved QA ingress and externally verified with full test evidence.
