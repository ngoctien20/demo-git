# TIEN404 AI — V17.1L Bot Zero-Trust Authority × Security Acceptance × Offline Tool QA

Date: 2026-11-17 JST
Parent: V17.1K-S1 Draft PR #270, source HEAD b10376374dca70518c9c71a1c680fdd56cbc9930.
State before first CI: SOURCE IMPLEMENTED / OFFLINE QA PENDING / HOSTED RELEASE NO-GO.

## 1. Evidence: n8n published state independently read

Read-only n8n connector inspection, no execution nor changes:
- TIEN404_MESSENGER_TEST workflow Z7FdV7uDvApfbURQ ACTIVE; version ff7a57d2-519a-4283-933c-37a854df92d2, 28 nodes. Contains Webhook rawBody option, conditional/signature validation nodes, Messenger AI Agent, Send Messenger Reply HTTP node, DataTable dedupe/record, create_order, update_order_address, manage_order, get_order_status, create_support_ticket toolWorkflow nodes, and a newer V17.13 NO-SEND Central Core shadow route. **P0 attack surface is tool authorization at execution time**. The existence of signature guard is not proof that customer-to-Store mapping and per-action authorization are secure.
- Messenger recent execution IDs from read-only metadata: 4431 SUCCESS, 4430 SUCCESS, 4429 ERROR (2026-11-17 UTC 03:54:04; 50–60 ms). Error root cause unverified and must not be described as a confirmed vulnerability.
- TIEN404_ZALO_BOT_LAB_V1_STAGING ID yIJk8LvJoLF40Z62 ACTIVE; its graph has webhook, normalized event, private router, and QA marker upsert nodes. Not safe to classify every active path as NO-WRITE.
- TIEN404_ZALO_V123_PRIVATE_CUSTOMER_ROUTER_STAGING ID sIPs6egzIwOY1GNv ACTIVE, read-only DataTable catalog/registry nodes; no real native OA owner challenge verified.
- AI_SALES_DEMO - Main Agent ID v6PBwcqSapVzACMW ACTIVE; has create_order / update_order_address / manage_order direct tool workflows.
- G06 Signed Channel QA FqEcdmc8PRRMNUEb INACTIVE, G07 Provider Authority QA mmt3ToandWrLAcjH INACTIVE, Messenger Shadow 6ZWYRBKieTKQMzoQ INACTIVE. No hosted UAT admission proof.
- Never execute security attack payloads against these active workflows. A test refusing an attack in source fixture does not prove the active n8n workflow blocked that same attack.

## 2. Threat model and acceptance matrix

P0: fake Meta Page/Zalo OA signature; fake tenant/store/bot role in webhook, IDOR store A->B, spoofed order ID and phone, customer-cross-channel identity bypass, unauthorized create/update/cancel/paid/refund/stock/price/debt tool, model-driven SEND/notification, API key exfiltration, prompt injection from text/catalog/media/OCR/RAG, fake expected_total and customer confirmation.
P1: replayed Meta event/MID, self echo loops, duplicate messages/order idempotency, webhook flooding/DoW/token spikes, fake signature/body decoupling, memory poisoning between stores/users, malicious product image/URL (V17.1K-S1), forged staff role, unauthorized AI tool extensions, excessive model output, overly broad logs with phone/credentials.
P2: malicious HTML/markdown in reply, impersonation/phishing, benign customer false positives, unsupported language code switch, suspicious hyperlinks, malicious prompt stored in catalog, staff handoff misuse and incident telemetry.

Core principle: untrusted natural language never grants authority, and bot tool invocation is a server-enforced policy decision. OWASP: AI Agent Security Cheat Sheet, LLM Prompt Injection Prevention Cheat Sheet, API1 Broken Object Level Authorization.

## 3. Implemented, source-only tool guard

qa/v171l-bot-security/zero-trust-bot-boundary.cjs:
- fail-closed per-event bound Tenant/Store from an injected server installation registry (not from webhook/LLM). Rejects explicit claimed tenant/store/admin/auth and other trusted fields in the client-supplied envelope.
- requires native event verification adapter bound to exact installation/Page/OA, sender, event and event time; denies echo events, out-of-window events, duplicate/replayed events and quota failures, with **atomic callbacks required at hosted integration**. Source fixture callback is NOT native Meta/Zalo proof.
- opaque WeakSet guards synthetic session objects against user copying/forging/reusing a session from another boundary; important but not a replacement for hosted JWT or RLS.
- every model-proposed tool call must be individually gated. Untrusted image/catalog/RAG/website/tool-response cannot directly authorize any action.
- READ_PUBLIC_CATALOG read plan requires server Store catalog scope; READ_OWN_ORDER_STATUS read plan requires server customer challenge/OrderAccessGrant matching Store/recipient; PROPOSE_ORDER needs integer VND, quantity limits, server-validated price/stock quote and separate customer confirmation. Plans make NO actual database reads/writes.
- default DENY for all high-risk writes/send/admin/credential/cross-channel operations, and any future tool outside the explicit allowlist. This is a source-only shadow proposal, not an integrated production security patch.
- no real Meta/Zalo app secrets, no external HTTP, no webhook, no provider send, no actual model usage, no n8n workflow update, no DB changes.

qa/v171l-bot-security/safe-audit-and-quota.cjs:
- logs only allowlisted decisions, reasons, tenant/store/bot/channel and trace ID. Never raw messages, phone, address, model prompt, image bytes or provider MID.
- proposed small fixed limits for model/tool calls, token budgets, reply size, spend and conversation turns. Does not enforce hosted atomic billing or quota.

## 4. Deployment gates (P0; NOT IMPLEMENTED)

1. Snapshot and independently test actual published Messenger main graph and Zalo ingress graph. Code review real signature timing-safe raw-body HMAC, exact Page/OA installation resolution, trusted credential secret, tenant/store ID mapping. Actual Zalo official signature verified according to current provider docs, not synthetic Meta HMAC. Invalid or replay events must be denied before any AI tool.
2. Secure per-store service JWT/RLS and real tenant/store A/B adversarial tests; ensure malicious merchant with valid paid subscription cannot query other stores or attach arbitrary Bot/Page.
3. Server-side tool gateway: remove direct model write/send permissions until an enforced action verifier validates caller, scoped SKU and quote, quantity, positive integer price, current inventory revision, idempotency, two-step customer confirmation. OrderAccessGrant and cross-channel challenge for order status.
4. Durable atomic rate/replay/order dedup and separate per-store cost ceilings. Timeout/infrastructure failure must DENY, not silently accept. Test concurrent event storms in disposable staging only.
5. Isolate Chatbot knowledge, prompt/memory, image embeddings by tenant/store/session; prevent cross-user prompts/PII and guard against malicious instructions in product media/catalog.
6. Observability: redact credentials, access tokens, phone and customer address. Staff/admin approval with MFA, versioned bot prompt and audited role grants. Separate owner notification from shopper messaging.
7. Signed read-only Meta/Zalo canary on actual isolated QA Page/OA with owner authorization, independent QA/pen test, verified scanner/storage sandbox from V17.1K-S1, hosted restore evidence.
8. No promotion to Core Bot or production until specific approval and evidence. No unbounded model loops or retroactive classification of source QA as hosted PASS.

## 5. QA plan, rollback and change control

New V17.1L deterministic signed fixture, forged scope, replay, rate, tool injection, Store IDOR, price/confirmation, prompt injection, audit and quota tests. Inherit 462 previously verified V17.1K-S1 through V17.1D cases. Only count new tests after CI. Hosted release intentionally RED until independent evidence.
No production send, payment, data write, credential change, workflow publish or repo merge.
Rollback: close child Draft PR, parent #270 untouched and no hosted restore needed.


## 6. VERIFIED acceptance evidence — 2026-11-17 JST

### GitHub source QA
- Tested source HEAD: d4ad1e83e98daf59db88af840c58a15cec1e033e.
- Actions run: https://github.com/ngoctien20/demo-git/actions/runs/44017293984
- Source QA job 133818168320 SUCCESS: 103/103 signed ingress / forged trust / replay / tool boundary / prompt-injection tests PASS; 17/17 PII-free security audit and quota tests PASS. New source tests **120/120 PASS**.
- Inherited source regression **462/462 PASS** (31+36 V17.1K-S1; 45 V17.1K; 40+36 V17.1J; 82 V17.1I; 40 V17.1H; 40 V17.1G; 32 V17.1F; 28 V17.1E; 22+25+5 V17.1D).
- Total **582/582 OFFLINE PASS**. Static guard NO_MODEL_NO_SEND_NO_DB_WRITE passed. An initial run of 103 tests had 102 PASS/1 bad test expectation: cross-channel spoof was denied at trusted installation before native signature, not at signature; test assertion was fixed, security guard remained fail-closed.
- Hosted release gate job 133818356867 FAILURE intentionally. Overall GitHub workflow shows FAILURE due NO-GO release policy, not source QA failure.

### Real n8n QA execution evidence — manual read-only
- G06 FqEcdmc8PRRMNUEb execution **4486** SUCCESS. Final assertion: G06_SIGNED_SHAPED_QA_36_OF_36_PASS; 36/36 synthetic cases passed, 28 denied, status HOSTED_NO_GO.
- G07 mmt3ToandWrLAcjH execution **4487** SUCCESS. Final assertion: G07_PRIVATE_REVIEW_20_OF_20_REAL_ADMISSION_DENIED; 20/20 attempted real admissions denied per QA contract, status REAL_SIGNED_NO_SEND_ADMISSION_BLOCKED.
- Before test, both inactive/manual QA workflow graphs were verified to contain manual trigger, local Code nodes and DataTable GET only (no writes, API sends or order tools).
- User's n8n preference was read: keep AI_SALES_DEMO data/credentials separate from Commerce and do not disturb Published. Honored: no workflow definitions, credentials, data tables, Google Sheets or production data were changed. Only QA execution history was added.

### Live n8n drift discovered during audit
- Live Messenger TEST Z7FdV7uDvApfbURQ originally inspected at version ff7a57d2-519a-4283-933c-37a854df92d2 (28 nodes). A later read-only inspection found version 2b869035-fe39-46fb-a253-18fefe4ecbfd (32 nodes), including new V17.15 Core route, PII stripping and reply safety nodes. This V17.1L branch did NOT author those concurrent live changes. Preserve them and reconcile current graph/owner before any merge or cutover; the new nodes have NOT been verified as a complete independent Store-level tool authorization.
- Historical Messenger execution 4429 ERROR on 2026-11-17 at 03:54:04 UTC; only execution metadata checked. Security exploit/root cause NOT established.

### Remaining blockers
**Lifecycle:** IMPLEMENTED SOURCE / OFFLINE TESTED / N8N G06-G07 QA TESTED / REAL MESSENGER-ZALO-COMMERCE RELEASE NO-GO.
- No independent real Meta Page/Zalo OA native signature/installation owner or hosted store JWT/RLS accepted; no real OrderAccessGrant cross-channel customer identity proof.
- No mandatory server-side tool authorizer installed before live Messenger order/send tools. Atomic replay/rate/budget adapters, independent RLS, safe image scanner/bucket are not accepted in real hosting.
- Prompt injection tests validate deterministic tool boundaries with synthetic input. They do NOT prove actual live LLM refusal, live behavior or semantic image safety. Real LLM adversarial tests are separate.
- No real customer message was sent, no order/stock/price/customer data changed, no credential modified.

Rollback: close child Draft PR #274; parent #270 and all hosted data unchanged. No restore required.

Documentation-only checkpoint update needs final HEAD GitHub Actions confirmation.
