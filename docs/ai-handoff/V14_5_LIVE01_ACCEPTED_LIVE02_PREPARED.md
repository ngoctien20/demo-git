# TIEN404 AI — V14.5-LIVE01 ACCEPTED × LIVE02 Consultation & Quotation QA Gate

**Checkpoint date:** 16 November 2026 (Japan, JST)  
**Scope:** one real Messenger smoke-test accepted; next two read-only consultation/quote tests PREPARED, NOT YET SENT.  
**GitHub:** PR #113 Draft; do not merge, republish or deploy.  
**Published workflow:** TIEN404_MESSENGER_TEST \`Z7FdV7uDvApfbURQ\`, active version \`d5c96b6b-d790-4270-8b0f-d0ebdd8bbd92\`.  
**Page:** TIEN404 AI, numeric Page ID \`2379295362359912\`.

## 1. LIVE01 ACCEPTANCE — VERIFIED

Owner provided explicit user observation: the QA account RECEIVED the bot response on Messenger for the sent message.

**Exact tester message:**
\`TIEN404 QA LIVE01 — Xin chào bot.\`

**Actual n8n webhook execution #3866**:
- Started \`2026-11-15T19:10:28.711Z\` = \`2026-11-16 04:10:28.711 JST\`.
- Completed \`2026-11-15T19:10:34.007Z\`; 5.296 seconds.
- Input text matched the exact QA message; sender/page PSIDs were not copied to report; Page matched target TIEN404 AI.
- Webhook1 success, Crypto success, \`Verify Signature Timing-Safe\` verified=true, \`Verify Meta Signature\` verified=true, \`Extract Messenger Text\` produced one text event; no duplicate rejection.
- \`Messenger AI Agent\` success, nonempty output; \`Prepare Messenger Reply\` success.
- \`Send Messenger Reply - CONFIGURE TOKEN\` success with Meta \`message_id\`, \`Verify Messenger Send Result\` success and matching \`metaMessageId\`, \`Record Successful Messenger MID\` success.
- create_order, manage_order, update_order_address, get_order_status and create_support_ticket were NOT invoked.
- Owner expressly confirmed Messenger client received the reply.

**Baseline #3865:** success at \`2026-11-15T19:07:52.338Z\` = 04:07:52 JST; 7.163 seconds. New #3866 occurred afterward without workflow version change.

**Verdict:** V14.5-LIVE01 REAL MESSENGER TEXT SMOKE TEST = **ACCEPTED / TESTED** (Meta signed webhook → n8n AI → Meta Send → confirmed client receipt). This does NOT attest correct live consultation, product prices, multi-store RLS or order creation.

**Audit note:** Existing workflow has normal automatic state/log activities (MID replay ledger, execution history, AI memory); the project/operator did not perform any independent order/stock write, admin mutation, token change, webhook reconfiguration or workflow publish. No sensitive token, PSID, personal message body or customer record exported here.

## 2. LIVE02 SOURCE DATA — VERIFIED READ ONLY AT PREPARATION

Inspected n8n Published \`Read Products - Messenger Read Only\` Google Sheets Tool. Its connected source is the Google Sheet titled **AI_SALES_DEMO**, spreadsheet ID \`1flbUFHb6ybJVLnnXTf3FQD70YNtd6MneL_xVpPYsscE\`, tab **Products**, sheetId/gid=0.

Read a bounded Product range \`Products!A1:F15\` without modifying cells. Headers:
- \`sku\`, \`name\`, \`price\`, \`stock\`, \`price_clean\`.

**LIVE02 product sentinel (as of preparation):**
- SKU \`A002\`.
- Name \`Áo thun nam trắng basic size M\`.
- Listed price \`159.000đ\` and normalized integer \`159000\`.
- Stock \`25\`.
- Another observed product \`A003\` is a black size L t-shirt listed at 159000 and 18 stock, available only for subsequent QA if necessary.

The Google Sheet is a LEGACY AI_SALES_DEMO catalog; it is NOT canonical hosted Commerce, tenant/store isolation proof, an approved merchant price sheet or an atomic stock ledger. Re-read the value if it changes before testing.

## 3. LIVE02 controlled testing — PREPARED / NOT SENT

**Exactly two separate user-sent messages** on the same QA Page, one at a time and only after the previous message result is captured. No tools here will send the messages. The user chooses when to send.

**LIVE02-A — CONSULT (no Order Request):**
\`TIEN404 QA LIVE02-A — Shop có áo thun nam trắng basic size M (mã A002) không? Hãy tư vấn về sản phẩm này. Chưa đặt hàng.\`

Expected acceptance:
1. New n8n webhook execution >3866 for exact QA-A message, signature verified true, Page matched, Agent nonempty answer, Meta Send returned ID, and tester visibly receives response.
2. Product \`A002\` and name consistent with Product Sheet; answer does not invent attributes beyond known catalog or authorized shop knowledge.
3. \`create_order\`, \`manage_order\`, \`update_order_address\` and other order-writing tools NOT invoked. No row appended to Orders by this test.

**LIVE02-B — QUOTE (no Order Request):**
\`TIEN404 QA LIVE02-B — Báo giá niêm yết và số lượng còn hàng của áo thun nam trắng basic size M (mã A002). Chỉ báo giá, chưa đặt hàng.\`

Expected acceptance:
1. New webhook execution, HMAC verified, Page matches, Agent success, Google Sheets Products read tool executes (or other independently verified authorized read-only source), Meta Send success + client receipt.
2. Answer clearly identifies SKU \`A002\`, unit price **159.000đ** and recorded inventory **25** *if unchanged from source at test time*. Do not treat these as guaranteed real-time commerce stock.
3. No made-up discounts, wholesale prices, shipping charges or reservation promises.
4. No Order/Stock write or owner notification. If the bot quotes another value, inspect the same source at execution time before marking PASS/FAIL.

**Event correlation:** compare (a) exact incoming QA-A or QA-B text, (b) new execution ID/time after #3866, (c) Page ID, (d) signatures, (e) Agent/tool calls, (f) Meta Send ID, (g) tester screenshot/confirmation. Record redacted output only.

**Stopping rules:** Stop after first failure, repeated unexpected replies, first order-write tool call, ambiguous Page attribution, mismatched product data, missing provider result or mismatched tester receipt. Do not resend automatically. Do not run the workflow manually to emulate live Messenger because that can call real tools.

## 4. Explicit approval and impact boundary

The owner has APPROVED LIVE01 and confirmed receipt. The request is to PREPARE LIVE02; the assistant must not itself send a Meta message or execute the workflow. The owner may manually send the two specified read-only QA questions. Each live inbound can consume AI inference and create ordinary existing Published n8n log/MID/memory records even though no Order/Stock write is requested.

- No changes to \`TIEN404_MESSENGER_TEST\` Published or token, webhook, App permissions, Meta settings, Sheet Products/Orders, Supabase RLS/GRANT or production.
- Do not use customer PII, real telephone numbers or addresses in tests.
- Never treat this legacy Google Sheets DEMO as a secure multi-Store Commerce source.
- No real stock reservation or Order Request test in LIVE02.
- If Agent invokes an order-writing tool unexpectedly, treat as P0 test failure and halt; inspect read-only evidence before any safe Draft fix.

## 5. Live02 acceptance template

| Test | Execution | HMAC | Catalog read | AI content | Meta sent | Tester received | No order writer | Verdict |
|---|---|---|---|---|---|---|---|---|
| LIVE02-A consultation | PENDING | — | — | — | — | — | — | NOT TESTED |
| LIVE02-B quotation | PENDING | — | — | — | — | — | — | NOT TESTED |

**Rollback/checkpoint:** This Markdown update is documentation-only on PR #113. Original Published workflow and data unchanged by assistant. Revert the checkpoint file or close Draft PR to undo documentation; no runtime rollback required.

**Next:** Ask user to send only LIVE02-A first; inspect new execution and confirm Messenger receipt before LIVE02-B. Keep Level 3 limited to Messenger tester text consultation/quote; Level 4 Commerce Release remains BLOCKED by actual Restore, Store RLS/JWT, four-row owner evidence, policy and separate approval.


## 6. LIVE02 FINAL ACCEPTANCE — 16 Nov 2026 JST (supersedes PREPARED status above)

Both LIVE02-A and LIVE02-B were actually received by the owner's Messenger tester and expressly accepted. **LIVE02-A/B = ACCEPTED / REAL MESSENGER CONSULTATION & QUOTATION QA**, not Commerce multi-Store acceptance.

| Verification | LIVE02-A | LIVE02-B |
|---|---|---|
| n8n execution | #3867 | #3868 |
| Start UTC | 2026-11-15T19:27:25.424Z | 2026-11-15T19:28:01.876Z |
| Start JST | 2026-11-16 04:27:25 | 2026-11-16 04:28:01 |
| Webhook signature timing-safe + Meta signature | true + true | true + true |
| Page | 2379295362359912 | 2379295362359912 |
| Incoming text | EXACT LIVE02-A | EXACT LIVE02-B |
| Read-only Products tool | 1 successful run | 1 successful run |
| Actual tool's Products record | A002 name/159000/25 | A002 name/159000/25 |
| AI Agent completed with nonempty answer | yes (429 chars) | yes (92 chars) |
| Price/stock wording | matches Products | matches Products |
| Meta Send provider message ID | present | present |
| Verify Send Result matches same ID | yes | yes |
| Record Successful Messenger MID | yes | yes |
| create_order, manage_order, update_order_address | 0 calls | 0 calls |
| Tester confirms received response | yes | yes |
| Verdict | ACCEPTED | ACCEPTED |

In LIVE02-A, Agent suggested A004 (polo navy size M 289000) and A010 (denim jacket size M 549000); these matched the same read-only Products tool. This is legacy DEMO pricing only. Actual Commerce Store stock remains unverified.

Both tests ran through existing Published Messenger unchanged. Automated execution history, memory and MID ledger may be written normally; no direct assistant DML. No order-writing tool executed in these two runs, but external Sheet mutation auditing is not claimed.

## 7. LIVE03 HAZARD — DO NOT SEND AN ORDER CONFIRMATION TO PUBLISHED BOT

Read-only inspection of Create Order Tool KrSn4DNR9ALX5ng4 confirmed the **Published** graph includes Read Products, Read Orders, Validate Order, Should Create?, and **Append Order** with Google Sheets operation append. Published version 4740251a-cd01-4f7f-b8e1-e300a8393151 differs from Draft af9ee686-2a9f-483e-9622-6e449500ac5e.

Therefore, a real Messenger message requesting products plus confirmation **might invoke the legacy order writer and append an Orders row**. 'For QA only' in the prompt is NOT a trusted no-write guarantee.

**LIVE03 shall use an independent INACTIVE manual Order Request Dry-Run QA workflow with zero credentials, DB/Google Sheets/Meta/HTTP nodes and synthetic in-memory fixtures.** The real Messenger order pilot remains BLOCKED until an independently verified no-write gate or separately authorized isolated Order Request backend, actual scoped tenant/store security and explicit owner approval.

Test scenarios: QUOTE_ONLY; PREPARE; CONFIRM_MOCK; REPLAY; WRONG_TOTAL; NO_STOCK; CROSS_STORE; CANCEL. All synthetic, no real name, phone or address. The historical A002 159000 and stock=25 remain QA reference sentinels only, not verified real Commerce data.
