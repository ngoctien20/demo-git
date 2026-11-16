# TIEN404 AI V15.2 ADV.3 — Presentation Intelligence & Secure Action Registry

Date/checkpoint: 2026-11-16 JST
Lifecycle: **EXPERIMENTAL → DRAFT / NO-SEND / NO HOSTED WRITES / NOT Sales Lite Default**.

## 1. Verified baseline
- PR #144 OPEN DRAFT, exact head \`ebc29571c389e982bdc670a85df08157b3106133\`, 4/4 GitHub Actions SUCCESS. Source-only ADV.1 Vietnamese presentation lab and ADV.2 4-channel × 13-component capability matrix with deterministic TEXT downgrade.
- Parent PR #134 and V14.7 #118 remain unmerged and are preserved. Sales Lite PR #128 and Store Owner Security PR #131/#133 are separate. Hosted Store RLS, independent Owner evidence and real Commerce still have NO-GO gates.
- n8n existing Zalo intent staging \`uGesZLvNkhY4ZO6l\` inactive; no paid inference, Published mutation or provider sends authorized.

## 2. Implemented in ADV.3 child Draft (not production)

### Presentation Intelligence contract
- \`qa/v147-custom-studio/advanced-ai-intelligence.js\`: strict 2-key structured proposal \`{schema_version, intent}\`, 8 presentation intents + ABSTAIN. Allows only semantic intent; model may NOT pass price, stock, store, arbitrary text, action payload, color, URL, or output HTML. Unknown or suspicious requests abstain.
- Existing V15.2 Presentation Policy continues to independently derive trusted scoped prices/stock/low-stock warning from synthetic V14.7 fixtures. Channel registry selects supported preview or deterministic text fallback; no arbitrary HTML, real order reads/writes or price inference.
- \`advanced-presentation-corpus.json\`: 76 **hand-authored synthetic Vietnamese** labels: 64 normal (8 intents × 8) and 12 adversarial. This is an offline smoke/evaluation set; not the user's existing 96 single/36 multi Sales dataset and not customer chat data.
- \`advanced-offline-evaluator.cjs\`: reports exact-match, confusion, unsafe negatives, abstentions, mistakes, and a machine-readable artifact. Can ingest externally obtained model JSON predictions under controlled approval. Default is **heuristic baseline**, not model training or accuracy.
- \`advanced-ai-intelligence.test.cjs\`: 40 negative/schema/semantic/scoping and 3 Shops × 4 Channels × 8 intents no-send validations.

### Secure Action Receipt (DISPOSABLE QA ONLY)
- \`qa/v147-custom-studio/advanced-secure-actions.cjs\`: allowlisted actions VIEW_CATALOG, REQUEST_QUOTE, ORDER_REQUEST_DRAFT, TRACK_ORDER, ASK_STAFF, VIEW_POLICY, OPEN_VERIFIED_LINK.
- Node crypto HMAC-SHA256 signatures use a **runtime-injected >=32-byte ephemeral test secret**, never hardcoded or sent to the browser.
- Receipt is audience-limited to \`TIEN404_ADV3_DISPOSABLE_QA_ONLY\`, cryptographically binds Tenant, Store, Channel, Actor, Session, Role, Action, Resource ID, issuance/expiry and cryptographic nonce; max TTL = 120 seconds.
- QA verification performs constant-time signature comparison, strict fields, expiration, **re-auth on every attempted click**, Store/role/channel/consent/subscription checks, order resource matching and ownership, explicit draft confirmation, approved link ID matching, and in-memory nonce replay refusal.
- **NO execution endpoint**: \`execute()\` always throws; every accepted receipt has \`canExecute:false\`. Never represents authenticated real merchant or real Customer proof. Map ledger is **not durable/atomic across workers**; not suitable for production or webhook concurrency.
- \`advanced-secure-actions.test.cjs\`: 53 positive/negative tests, including cross-Tenant, same-Tenant Store A/B, Messenger→Zalo replay, OTP-like expiry, revoked role, consent, entitlement, tampered signatures, cross-order reference, link reference, duplicate event and over-capacity fail-closed.

### Advanced Lab UX
- \`advanced-preview.html\` updated (additive) with Vietnamese intent explanation, strict JSON proposal tester and security constraints.
- \`advanced-intelligence-view.js\` presents local **heuristic-only** intent; never loads the QA HMAC secret/client-side signer. Text-only dynamic insertion; CSP \`connect-src 'none'\`.
- \`advanced-intelligence-browser.test.cjs\`: Playwright 320,390,768,1280 px, good/malicious JSON and Shop/Channel isolation; no network or writes.

### CI
- \`.github/workflows/v152-adv3-intelligence-actions-nosend.yml\`: QA Node 22, 40 intelligence tests, 53 signed-action tests, 76-label offline evaluator, ADV.1/ADV.2/V14.7 regressions, static safety, local Chromium and screenshot + JSON artifact.
- CI must be checked at the exact final HEAD SHA. Until verified, classify **IMPLEMENTED, not TESTED**.

## 3. Key explicit limitations / anti-overclaims
- No real LLM call/fine-tuning/model routing executed in this PR; model evaluation is a separately gated follow-up. Heuristic scores on authored labels must not be presented as generalization to real merchant traffic.
- No customer/Owner verified JWT, real Meta/Zalo provider entitlement, Store-level hosted RLS, cross-channel order continuity or real order lookup here.
- No signed **live** action possible from QA module; server-issued durable event idempotency/nonce ledger + JWT + RLS + native provider channel ownership checks required before any production adapter.
- No Meta/Zalo SEND, no n8n Publish, no Supabase Auth/RLS/GRANT/DDL/Orders changes, no Cloudflare deploy, no credentials, no real paid AI, no billing, no merges. Sales Lite scope not changed.

## 4. Gates
G0 — Independent source/evidence baseline and offline tests PASS.
G1 — Client/browser smoke PASS; separate Owner synthetic UAT.
G2 — Independent verified hosted Store RLS, real merchant/Owner binding and provider permissions.
G3 — Authorization-backed transactional replay/idempotency datastore (NOT in-memory), key custody/rotation, observability, tool policy and rollback.
G4 — Real low-cost LLM evaluation on **approved budget** and privately held labeled cases. Compare accuracy, unsafe structured outputs, latency, token cost; no hallucinated costs.
G5 — No-Send payload adapter integration, separate limited actual provider approval and release candidate.

## 5. Developer QA / rollback
- GitHub child Draft PR (base #144), all artifacts staged only.
- Run \`node --test qa/v147-custom-studio/advanced-ai-intelligence.test.cjs\` and \`node --test qa/v147-custom-studio/advanced-secure-actions.test.cjs\`.
- Run \`node qa/v147-custom-studio/advanced-offline-evaluator.cjs\` for a synthetic-only JSON report.
- Use workflow \`v152-adv3-intelligence-actions-nosend.yml\` for exact-head CI and Playwright.
- Rollback: close/revert child PR. PR #144, #134, #118, Sales Lite, published workflows and hosted data unaffected.

**Next: V15.2 ADV.4 — Advanced Studio Configuration Versioning + Signed Action Backend Design + Provider No-Send Payload Contracts** (Approval gate for migration/live sign/send and budget).
