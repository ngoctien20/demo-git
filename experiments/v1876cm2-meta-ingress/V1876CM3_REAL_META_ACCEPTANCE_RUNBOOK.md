# TIEN404 V18.7.6C-M3 — Private Meta QA App and Isolated Webhook Canary

Date: 2026-11-19 JST | CODE CANDIDATE | REAL SIGNED CALLBACK OBSERVED | TEST APP/HOSTED CANARY NOT VERIFIED

## Verified evidence (read-only, sanitized)
- n8n Messenger Published workflow Z7FdV7uDvApfbURQ: execution #5533 at 2026-11-19T10:52:39.894Z, status SUCCESS, mode webhook.
- Verify Signature Timing-Safe node output: verified=true.
- Object: page. Event container: entry[].changes[]. Field: messaging_postbacks.
- Value structural keys: sender, recipient, timestamp, postback; postback contains referral. No raw values, PSIDs, Page IDs, message IDs, token or content copied.
- Extract Messenger Text produced zero items. No Send Messenger Reply execution was observed in the selected node subset.
- Exact Meta origin/button causality cannot be independently proven. The observation does not establish an actual Messenger customer event or test-app delivery.
- Safe evidence source file: evidence/execution-5533-minimal-observation.json.

## Fixed contract
Earlier M2 only supported entry[].messaging[] and standby[], and would have returned HTTP 422 for observed Page changes[].
M3 now accepts HMAC-authenticated Page changes[] and classifies known field names (including messaging_postbacks).
Unknown fields map to unknown_page_change, never reflecting untrusted content. For messaging_postbacks the observed value.postback must be an object.
No Page ID, PSID, text, credentials, order or private store data is emitted. No provider send or Commerce write. Additional field shapes remain synthetic-only until individually verified.

## Private Meta Test App and isolated Worker admission — NOT EXECUTED
1. Owner opens https://developers.facebook.com/apps and creates an independent QA-only App/Test App, if available for the relevant Meta app type. Otherwise create an independently configured developer app with Messenger Webhooks. Use an authorized QA-only Page and App Role test users.
2. Preserve the primary Meta App and its existing callback: https://ngoctien20.app.n8n.cloud/webhook/tien404-messenger-qa. Do not change existing Verify Token, App Secret, subscriptions or active Messenger Published workflow.
3. Approve a separate Cloudflare Worker QA deployment and new test-only App Secret / Verify Token bindings, after checking budget and infrastructure overlap. Use a distinct Worker name and route.
4. Meta must access callback GET/POST via HTTPS. Do not put interactive Cloudflare Access login on the Meta callback: Meta cannot answer it. Use HMAC-SHA256 + bounded body/method/schema checks + rate limiting. Protect only a separate admin/status endpoint with Access.
5. Test the independent GET verification and negative signature/token cases. Subscribe the QA app to minimum Webhook Page fields and verify Page-level subscribed_apps and granted permissions.
6. Use Test > Send to My Server on the QA App, one event field per request. The same action in the original App sends to the original callback, not the isolated Worker.
7. Capture only sanitized event type, timestamp, request outcome, signature verification and QA run ID. Never record Page ID, PSID, raw request text, token, signature or customer data.
8. For a real Messenger event, use a role-authorized tester and an independent test Page subscribed to the test app. The dashboard sample alone does not prove entitlement to deliver real customer events.
9. Any unknown, invalid or unauthorized event must fail closed and must never reach AI, Sales Core, Commerce database or Send API.
10. Rollback: disable isolated QA Worker/route, and adjust only the test Page/app after approval. Do not delete or rotate existing production credentials.

## M3 acceptance matrix
- VERIFIED: existing Messenger signed POST via Page changes[] messaging_postbacks at execution #5533; no send node observed in selected nodes.
- IMPLEMENTED: v27 changes[] classifier candidate and sanitized synthetic fixture, GitHub offline negative QA.
- PENDING QA: exact HEAD GitHub Actions result after code update.
- BLOCKED: independent Meta QA App creation; separate QA Page subscription; test secrets; hosted isolated Worker; actual Meta QA App delivery; true end-user Page message test.
- BLOCKED: real Auth A/B/C and Store-level RLS. These are governed by separate Store Authority drafts.
- NO GO: provider sends, order writes, production release.

Rollback is closing this Draft PR. No external credentials, routes, meta app or Published n8n resources were changed by this candidate.
