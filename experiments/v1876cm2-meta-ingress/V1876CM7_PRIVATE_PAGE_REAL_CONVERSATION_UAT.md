# TIEN404 AI — V18.7.6C-M3-H7 Private Meta Page Installation × Real Conversation Event UAT × NO-SEND Guard

Date: 2026-11-20 JST • **CANDIDATE OFFLINE ONLY** • No Meta Page install, Page token, Cloudflare hosted change, provider send, customer data, Commerce write or production change by this PR.

## Starting evidence / rollback inventory
- Verified H6 at independent QA Meta App `2366045790814059`: signed redacted receipts from Meta Dashboard samples `message_deliveries`, `message_echoes`, `message_reads` all `verifiedHmac=true`, `httpStatus=200`; H6 synthetic CI 143/143 PASS.
- QA Worker `tien404-meta-messenger-qa-canary-v1876cm3`, callback: `https://tien404-meta-messenger-qa-canary-v1876cm3.tienmobi208.workers.dev/meta-qa/webhook`.
- Active deployed QA Worker before H7: `e9bbe823-417c-40cc-8831-6b63efbb0bda` at 100%; Inspector `ISOLATED_QA_ONLY` enabled; both Meta QA credentials `secret_text`; `REDACTED_RECEIPTS_ENABLED=false`, expiry=0, Workers Observability off; preview URL disabled. Previous pinned known-good Worker source version `edbfa125-b852-4fc2-91c4-b73eac022a91` retained as fallback candidate.
- Main Messenger n8n workflow `Z7FdV7uDvApfbURQ` active version `1064b1b3-d3f1-4a6b-a367-2414ba691522`, 0 executions after 2026-11-20T13:35Z at H7 read-only audit. Production `gh-pages` commit `ff2daf970e8209399a28b2d0cade8a33b9fa71c6` unmodified.
- Main Meta App `1637989744444198` is specifically OUT OF SCOPE.

## Distinct authorization layers — do not conflate
1. **App-level Page Webhook fields**: H6 Meta Dashboard fields (`message_reads`, `message_deliveries`, `message_echoes`, `messaging_postbacks`) were tested as **provider-generated samples**. For H7 real inbound conversation, also check `messages` in the independent QA App.
2. **Page-level app installation**: an app must be installed/subscribed for that specific Page; check via **GET `/{page-id}/subscribed_apps`** from a Meta-controlled authorized Graph API Explorer session. Record only `[qa_app_match_present: boolean, subscribed_fields: allowlist]` in checkpoint, not token, Page ID or owner identity. Meta reference: https://developers.facebook.com/docs/graph-api/reference/page/subscribed_apps/ . A POST changes Page installation and requires a separate explicit owner action/approval; never do it automatically.
3. **Page admin and tester authority**: owner uses own Page with required task and a Facebook account with app test/developer/admin role while the app is in Development. Verify app mode/permissions; do not claim public-customer availability or App Review approval. Reference: https://developers.facebook.com/docs/messenger-platform/getting-started/quick-start .
4. **Store/tenant authority**: cannot be inferred from any Page ID, PSID, claim, HMAC event or successful Meta dashboard test. This H7 does NOT install a trusted Page-to-Store association or authorize order read/write.
5. **Hosted owner consent**: owner approval to run one private real conversation UAT is distinct from Page subscription/installation. Never treat generic consent strings as independent attestation.

## Candidate module `src/h7-page-uat-guard.mjs`
- **Fail closed**: `assessH7Admission()` evaluates evidence completeness but returns `stage=CANDIDATE_REVIEW_ONLY`, `livePageInstalledVerified=false`, `conversationReadAuthorized=false`, `providerSendAllowed=false`, `orderWriteAllowed=false`, `productionReady=false`, even when all inputs CLAIM VERIFIED. This prevents untrusted input from manufacturing entitlement.
- `classifyH7ConversationForQA()` classifies after an upstream verified HMAC; returns only bounded event type/count, no Page ID, PSID, MID, message text or address. A real inbound `messages` event is merely a candidate, and `message_echoes` is not treated as inbound; no AI reply, no order write, no access to private Commerce.
- `noSendDecision()` is deliberately non-escalating, independent of claimed owner/store data or even confirmed HMAC. This policy is an **offline candidate** and is NOT wired to live routing.

## H7 authorization and execution plan
**Gate A — Owner & App readiness (HUMAN+READ ONLY, current)**
- In Meta for Developers open ONLY QA App ID `2366045790814059` → Messenger API settings → check Page connection and that `messages` is subscribed. Verify Page name/selection visually. **Never copy access token, App Secret, Verify Token, long-lived token, Page ID, PSID, real customer data, permissions debug response or sensitive URLs into the chat.**
- In Meta Graph API Explorer using own authorized session, owner (or a supported connector with explicit permission) performs read-only `GET /{page-id}/subscribed_apps`. Confirm QA App ID is listed for the Page and `messages` is in allowed fields. Other App subscriptions and active production integrations must remain unchanged.
- If QA App is not installed on that Page, STOP: request separate owner approval for QA-Page-only Page installation/field subscription; do not change main Page, primary App or install anything by assumption.
- If the Page access token does not have read permission or the App is in incompatible mode, record BLOCKED, do not guess missing permissions.
- Obtain owner consent to one private conversation from an authorized tester account. No unsuspecting customers, no production chats or real orders.

**Gate B — Instrumentation and real conversation observation (NOT STARTED)**
- Only after Gate A VERIFIED, temporarily enable the existing QA Worker's redacted receipt logging with a 10–15 minute deadline, invocation logging off, traces off, query string redacted; preserve secrets by strict inheritance. Do not enable Send API/AI/store writes.
- Owner sends exactly one harmless test message such as `TIEN404 H7 QA` from an authorized test account to the QA Page. Do not add a bot reply or another write. Keep confidential Page/PSID/message content out of logs and reports.
- Accept inbound `messages` only if a redacted receipt shows `verifiedHmac=true`, `httpStatus=200`, `eventTypes.messages=1`, and Page app installation/Owner consent separately VERIFIED. A POST with a message but no installed Page evidence is NOT authorization.
- A `message_echoes` receipt (if any) must remain no-send and not be counted as a customer message. No real Meta Send API, no order write.
- On completion/error, immediately set `REDACTED_RECEIPTS_ENABLED=false`, expiry=0, observability OFF; independently read back settings. Do not leave logs on indefinitely. Previous log records may persist until retention expires.
- Verify no executions on the original Messenger workflow and no unexpected side effects on Commerce, customers, Orders or billing.

**Gate C — Approval (NOT STARTED)**
- Real inbound event acceptance is **not** Page-to-Store authorization, external customer rollout, permissions approval or channel release.
- Future supervised owner/store consent and cryptographic installation registry requires separate design+approval and migration guard. Keep EXPLICIT `NO SEND` and `NO WRITE` until security sign-off.

## QA matrix
| Case | Expected acceptance | Status |
|---|---|---|
| App-level `messages` subscribed | QA App view/sanitized metadata only | NOT VERIFIED |
| Real QA Page installed subscribed_apps | Authorized Graph read-only and owner evidence | NOT VERIFIED |
| Owner/Page role verified | Separate human/backend attestation | NOT VERIFIED |
| Real tester role verified | Real role, not self-asserted payload | NOT VERIFIED |
| One actual authorized tester `messages` event | Redacted HMAC=true, HTTP200, messages=1 | NOT VERIFIED |
| Echo is not incoming, no Send API | Offline negative tests | CI PENDING |
| Page ID / Store ID payload cannot grant Store access | Offline fail-closed regression | CI PENDING |
| Rollback logging/any window | Re-verify config after actual UAT | PENDING (currently OFF) |

## Rollback and blockers
- Code rollback: close this Draft PR; it changes no hosted Worker, no Meta, no n8n. Closing a PR never rolls back hosted deployments.
- If a separate authorized QA Page installation is performed, that is an external mutation and requires an owner-approved documented reversal (uninstall QA App from QA Page). Do not invoke unsubscribe without approval.
- If QA logs are enabled later, disable receipt flag/Observability and verify; emergency block QA Worker `INSPECTOR_ENABLED=false` only by specific operator approval; never touch production.
- Security: Never read/upload/copy/paste/print tokens, secrets, message payload or personal identifiers. Keep test account/page consent explicit.

**Checkpoint**: `M3-H7 | OFFLINE PAGE ADMISSION CANDIDATE | REAL PAGE INSTALL NOT VERIFIED | REAL CONVERSATION PENDING | TELEMETRY OFF | NO SEND | NO WRITE | PRODUCTION NO-GO`
