# TIEN404 V18.7.6C-M — Messenger Webhook Event Inspector (NO SEND)
Date: 2026-11-19 JST | CANDIDATE — OFFLINE QA ONLY | Based on Draft PR #448

## Evidence
- User reports subscribing additional Meta Page webhook fields on 19 Nov 2026; actual selected fields have not been independently verified after the clicks.
- Prior Meta screenshots show messages and messaging_postbacks at v27.0 already subscribed in the App Dashboard.
- Actual Page-level subscribed_apps, permissions, App Review and live events are NOT VERIFIED.
- Messenger n8n workflow Z7FdV7uDvApfbURQ remains Published and Active. Execution search after 2026-11-19T00:00Z found 0 executions at inspection; latest inspected #5236 success on 18 Nov UTC.
- Meta documentation: https://developers.facebook.com/docs/graph-api/reference/page/subscribed_apps/ and https://developers.facebook.com/docs/graph-api/webhooks/getting-started/webhooks-for-messenger/

## Implementation
- Pure Node.js offline signed-event-inspector: requires raw HTTP bytes and HMAC-SHA256 over those exact bytes, using a synthetic test-only secret.
- Classifies messages, postbacks, echoes, deliveries, reads, referrals, handovers, standby, optins, policy enforcement, reactions and provisional edits.
- Unknown/unsupported shapes are quarantined; no AI routing, no provider send, no order write and no customer-private data read.
- Event summaries disclose only types/counts/NO-SEND flags. Never output Page IDs, PSIDs, message IDs, message text, tokens or raw attachments.
- Signature-valid for synthetic bytes is NOT proof of live Meta origin; liveMetaVerified, storeVerified, installationVerified and pageLevelSubscriptionVerified are ALWAYS false.
- No HTTP server, n8n ingress, Meta call, database, credential, data-table or Webhook activation in this isolated module.

## Run offline QA
node --test experiments/v1876cm-meta-inspector/tests/*.test.cjs

## Owner verification AFTER subscription
1. Check App Dashboard Page Webhooks v27 list for blue Da dang ky for each exact field selected.
2. Independently confirm Page-level subscribed_apps and App Role/permissions in owner's own secure session. Never paste tokens.
3. Existing Callback is live n8n; do NOT indiscriminately click TEST on new fields. First prepare an isolated, explicitly approved test endpoint.
4. On a new protected no-send test endpoint, use Meta sample tests one field at a time, recording only field, execution ID, HTTP code, expected no-reply/no-write.
5. Distinguish message_deliveries from marketing_message_deliveries; feature variants may have different payload shape.
6. A successful callback response alone does not prove the event was processed, that Store authority is valid or that the Page installed the app.

## Production gates
- P0: verified provider ingress must check HMAC on original raw body, exact Page installation, active Store membership, short-lived authority and durable idempotency.
- P0: Store Authority remains a separate unapproved dependency (PR #420, #448). Never infer Store from Page name or incoming payload.
- P1: validate actual v27 event fixtures before promoting mappings; Handover Protocol requires separate approval.
- PR stays DRAFT. No n8n Published changes, no Meta registration changes, no live traffic or credentials. Rollback is closing this PR.
