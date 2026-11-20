# TIEN404 AI — V18.7.6C-M3-H6 Message Read × Delivery × Echo Real Acceptance

Date: 2026-11-20 JST | **CANDIDATE / READINESS QA** | Separate from original Messenger Published and Store Auth A/B/C.

## Verified starting point
- Previous checkpoint: H5 Cloudflare redacted receipt at 2026-11-20 21:27:46 JST: verifiedHmac=true, httpStatus=200, eventTypes.messaging_postbacks=1, no Send, no Write. H5 closed the receipt/log window after this result.
- Meta QA App: 2366045790814059. QA-only Callback URL is https://tien404-meta-messenger-qa-canary-v1876cm3.tienmobi208.workers.dev/meta-qa/webhook .
- Cloudflare runtime read-only at H6 preflight: INSPECTOR_MODE=ISOLATED_QA_ONLY, INSPECTOR_ENABLED=true, REDACTED_RECEIPTS_ENABLED=false, REDACTED_RECEIPTS_EXPIRES_AT_MS=0, Observability disabled, both QA app bindings secret_text, workers.dev public/preview disabled.
- Active QA Worker version before H6 is 2c01899d-8602-4fa2-885c-71484c252682, deployed at 100%; prior pinned rollback edbfa125-b852-4fc2-91c4-b73eac022a91.
- Primary Messenger Published n8n Z7FdV7uDvApfbURQ active; not modified.

## Exact H6 acceptance matrix
| Field in Meta QA App | Potential Page wire envelopes (synthetic candidates) | Expected redacted receipt | Verified real? |
| --- | --- | --- | --- |
| message_reads | entry[].messaging[].read OR entry[].changes[].field=message_reads | eventTypes.message_reads = 1, verifiedHmac=true, httpStatus=200 | PENDING |
| message_deliveries | entry[].messaging[].delivery OR entry[].changes[].field=message_deliveries | eventTypes.message_deliveries = 1, verifiedHmac=true, httpStatus=200 | PENDING |
| message_echoes | entry[].messaging[].message.is_echo=true OR entry[].changes[].field=message_echoes | eventTypes.message_echoes = 1, verifiedHmac=true, httpStatus=200 | PENDING |

Meta Page Webhook field reference: https://developers.facebook.com/docs/graph-api/webhooks/reference/page/ . Page-level app subscription/permissions are distinct: https://developers.facebook.com/docs/graph-api/reference/page/subscribed_apps/ .
**Do not treat the candidate wire formats above as guaranteed Meta v27.0 shapes**; only a new sanitized signed receipt establishes actual H6 event field acceptance. Meta Dashboard sample delivery does not certify a real user read, delivery, or actual Page send.

## Owner-side Meta operations (only on QA App; main App unchanged)
1. Open the TIEN404 Messenger QA App (ID 2366045790814059), Webhooks > Page, and confirm its callback points to the existing independent Cloudflare QA Worker.
2. Find message_reads, message_deliveries, and message_echoes at v27.0. Subscribe these three **only in the QA App**. Do not subscribe every Page field or touch the primary App.
3. Report 'ĐÃ ĐĂNG KÝ H6' once the three blue subscribed indicators appear, optionally share a screenshot with tokens/IDs hidden. A subscription click alone does not prove Page-level subscribed_apps; keep that separate.
4. Only after this step and a new Cloudflare preflight should H6 temporarily activate REDACTED_RECEIPTS_ENABLED=true and Worker-specific Observability (invocation_logs=false, redact_query_string=true, traces=false). Window <=30 minutes recommended. Code expiry <=90 minutes, but disabling Observability also requires an explicit follow-up action.
5. Meta QA App: Test > Send to My Server exactly **once** for message_reads, record its timestamp; then repeat **once** for message_deliveries and **once** for message_echoes, avoiding live-user chats, Page Access Tokens and the Send API.
6. From Cloudflare Workers Logs, read only the markers TIEN404_QA_REDACTED_RECEIPT and permitlisted redacted fields: verifiedHmac, httpStatus, eventCount, eventTypes, canSend, canWrite, storeVerified, payloadPersisted. No raw requests, PSIDs, Page IDs, message text, IP, user identifiers, credential values or arbitrary log output should be returned to the chat.
7. Required success for **each exact field**: one HMAC-authenticated POST recognized as that field with HTTP 200, not a generic Worker invocation success. If the field is missing, or the app reports a delivery error, report BLOCKED and do not invent a result or expand live access.
8. Read-only n8n main Messenger execution check. A customer-sent message and Page-level subscribed_apps UAT are separate gates.
9. After collecting the three receipts (or after the QA window), restore REDACTED_RECEIPTS_ENABLED=false, expiry=0 and observability disabled. Reverify both secrets are of type secret_text and active main Messenger unchanged. Never leave logs enabled on the QA endpoint unnecessarily.

## Staging guardrails
- No provider send / AI agent / Commerce read-write / Order, Stock, Customer, Payments writes.
- No customer identities, no real Page token, no Meta production App Secret, no cross-shop Store Authority.
- Old Worker version remains available as a rollback candidate; closing a GitHub Draft PR does not revert an actual deployed Worker.
- Cloudflare Free account-wide request allowance still shared across all TIEN404 Workers, so do not run high-volume samples.
- Runtime already recognizes these event classes and both envelope paths, so H6 does not deploy a new runtime change unless the real samples show a mismatched contract.

## QA release gates
- VERIFIED: M5 signed Postback receipt, H6 preflight runtime security state.
- IMPLEMENTED: H6 synthetic three-field regression and this runbook.
- TESTED: only after exact HEAD CI on this branch passes.
- BLOCKED: real H6 3-field acceptance until owner QA App subscriptions and new Meta Test receipts exist.
- PRODUCTION NO-GO: Owner A/B/C real Auth + canonical Store Authority, Page-level installation, real customer send/read/echo and provider send remain outside this phase.

## Rollback
Code: close Draft PR without merging. No production change. Telemetry after explicit H6 staging activation: set receipt=false, expiry=0, observability disabled and verify. Optional emergency isolation: INSPECTOR_ENABLED=false and workers.dev disabled for **QA Worker only**; never touch the main App/Published bot.

Checkpoint: M3-H6 | THREE-FIELD QA CANDIDATE | TELEMETRY OFF | REAL META READ/DELIVERY/ECHO PENDING | NO SEND | NO WRITE.
