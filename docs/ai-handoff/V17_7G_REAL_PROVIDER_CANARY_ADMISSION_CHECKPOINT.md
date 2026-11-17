# TIEN404 AI — V17.7G Authorized Private Provider Canary × Real Owner Consent × External No-Send UAT

Date: 2026-11-17 JST.
Stage: IMPLEMENTED SOURCE-ONLY / REQUEST-LEVEL LOCAL WORKER CRYPTO QA / REAL HOSTED PROVIDER UAT **NO-GO**.

## 1. Prior checkpoint, lineages, collision avoidance

Parent V17.7F Draft PR #337 HEAD 8950e0000ee8ec910519e3fbabeea69b69d63730 (353/353 synthetic, 6/6 CI).
Older V17.7A–E PRs #317, #321, #326, #330, #334 remain Draft and untouched; existing inactive n8n QA workflow MQcbjLWZ5QUTJW0k, manual execution 5026 12/12 synthetic PASS, remains inactive.
Do not overwrite RPC16 Merchant evidence Worker/access from PR #313 or RPC17.1/17.2 ledger + scanner code from #327/#332. Canonical Commerce Store/RLS PR #247 and security #246, recovery #251 remain owners of their respective migration and rollback.
No real Meta Page, Zalo Bot webhook, native secret, OAuth token, merchant document, published workflow, Supabase schema or Cloudflare account configuration is edited in this phase.

## 2. VERIFIED READ-ONLY current hosted state

- Cloudflare: existing RPC16 Merchant evidence Access app f994d4b2-d4f9-419b-8585-5d33be506f13 named DENY ALL; inline Access list has 0 Allow and 0 Bypass. RPC16 Worker remains separate. No dedicated V17.7G provider canary Worker existed in current account inspection. Configuration listing does NOT demonstrate an independently tested unauthenticated edge deny or complete route isolation.
- n8n: Zalo Bot yIJk8LvJoLF40Z62 active and contains QA marker UPSERT; Messenger TEST Z7FdV7uDvApfbURQ active and includes HTTP reply SEND; neither may be used directly for an absolute zero-write/no-send pilot. V17.7E manual-only fixture MQcbjLWZ5QUTJW0k still inactive, 2 nodes and no credentials.
- Supabase staging: tien404_r1_qa.tenant_identity_map has 2 Tenants, max one Store per Tenant, no same-Tenant A/B. Public Commerce Store-qualified RLS and real Store owner JWT acceptance remain unverified. No customer row/merchant evidence or token was read.

## 3. P1 native Zalo Bot fixture mismatch found AND corrected

Official Zalo Bot webhook documentation: https://docs.zaloplatforms.com/docs/BOT/webhook
- HTTP POST, application/json, header X-Bot-Api-Secret-Token (a shared secret token, NOT the Meta raw-body HMAC).
- Documented message envelope is { ok:true, result:{ event_name:'message.text.received', message:{ message_id, date, from, chat, text } } }.
- V17.7F SOURCE fixture had assumed a root event_name/message envelope. **Inherited 353/353 success did not test the official Bot envelope**.
- Child V17.7G modifies BOTH inherited v17-7f-provider-crypto-fixture-offline.mjs and its test file: uses nested ok.result and embedded message.date, refuses the old incorrect root form, non-text and non-private group messages. Parent PR #337 is unchanged; only child PR contains the fix.
- Zalo OA X-ZEvent-Signature/OAuth remains an entirely different provider adapter; no fallback from Bot token is permitted.

Meta source: https://developers.facebook.com/docs/graph-api/webhooks/getting-started/
- Messenger POST X-Hub-Signature-256 sha256=HMAC-SHA256(app-secret, EXACT raw request bytes). Verify before JSON parse, exact Page/recipient and MID. Never reinterpret raw body or trust customer-provided tenant/store fields. GET Meta verify handshake is NOT implemented; must be separately reviewed for a new dedicated QA Page callback after owner consent.

## 4. NEW SOURCE-ONLY V17.7G deliverables

- qa/v17-7a-oa-independent/v17-7g-provider-canary-local-worker.mjs:
  Cloudflare WebCrypto-compatible Request/Response handler. Enforces exact localhost-like test hostname canary.invalid, QA_ONLY secrets, OFFLINE_FIXTURE_ONLY mode, separate Meta/Zalo paths, raw Meta HMAC verify, Bot secret header digest compare, official nested Zalo payload, Page/recipient and per-installation registry binding, text-only, fresh timestamp, injected quota+replay hooks. No external fetch/DB/AI/send/Order/Stock operations; returns 204 ONLY after a synthetic event with local injected test dependencies.
  The exported default Worker fetch always has NO trusted test dependencies and returns 404 for every request — accidental Cloudflare upload will NOT activate real provider callbacks.
  The injected reserveOnce/ratePermit test doubles are NOT a real Durable Object, not distributed rate enforcement, and not sufficient for hosted replay integrity. Real hosted use requires a separate reviewed adapter using RPC17.2 durable ledger after staging authorization.
- qa/v17-7a-oa-independent/v17-7g-provider-canary-local-worker.test.mjs:
  Node 22 request-level WebCrypto test that constructs POST Request objects with raw bytes and authentic QA_ONLY crypto (not merely static metadata). Positive fixture 204, negative 404 for header mismatch, tampered raw body, wrong Page, old Zalo root event, group, nontext, stale/future, replay, Store claims, invalid/expired gate, wrong host, default Worker deny-all.
- qa/v17-7a-oa-independent/v17-7f-provider-crypto-fixture-offline.mjs and .test.mjs are FIXED in the child to prevent inherited wrong structure.
- qa/v17-7a-oa-independent/v17-7g-hosted-safety-redacted-evidence.json:
  Account metadata and explicit false for real Page/Bot owner grant, external edge deny, actual provider messages, hosted DO, Store JWT and hosted resources. No secrets/PII.
- .github/workflows/v17-7g-provider-canary-local-e2e-nosend.yml:
  All inherited A–F tests, new request-level local WebCrypto tests, source syntax check, default Worker 404 and no-send/no-write/no-deploy gate.
- This checkpoint. CI only becomes TESTED once exact final PR HEAD GitHub Actions is SUCCESS.

## 5. STRICTLY SEPARATE trust zones

Zone A: Merchant Owner evidence stays RPC16 private Access DENY ALL; no Merchant upload/read or independent owner authenticated acceptance yet.
Zone B: Meta/Zalo Bot native callback needs its own dedicated (currently NOT deployed) Worker/hostname, with least-privilege provider secret, raw signature verifier, server-owned Page/Bot → Tenant/Store installation, mandatory DURABLE replay/rate gate and no external outbound/Commerce binding. A browser-oriented Cloudflare Access login is not a substitute for Meta/Zalo webhook-native auth; do not share human Access route with provider POSTs.
The source-only Worker uses canary.invalid ONLY. Do not bind live provider webhook to it; this code is a safe offline test artifact, NOT a hosted production adapter.

## 6. Operator acceptance plan — REQUIRE SEPARATE APPROVAL, NOT EXECUTED

A. Merchant proof G0: private authenticated owner, independent issuer/reviewer, correct original four Product/Order→Store records and readback. Do not paste JWT, raw rows, credentials, customer names, addresses or tokens in chat/GitHub.
B. Restore M0: approved bounded staging backup/restore evidence for any affected Auth/DB/Storage and canonical Store migration #247/#251. No unreviewed RLS changes.
C. Dedicated QA provider ownership: obtain legitimate Zalo Bot owner or Meta QA Page admin consent and independent operator; record scope/expiry and which single QA Bot/Page. Do not borrow real customer Page or repoint existing webhook.
D. Cost/rate/rollback consent: approve specifically new inactive isolated callback Worker with workers.dev=false/previews=false and NO route on first upload, no credential, no R2/DB/send binding; determine external route and limits only in separate later canary authorization. Cloudflare Access human/private operator distinct from eventual signed-provider callback.
E. Hosted no-send native UAT: only after C+D, supply managed secret privately, provision durable ledger/rate guard, verify external unauthenticated operator deny and malicious provider signature deny, then ONE bounded authorized test message to disposable Bot/Page. Provider-origin signed receipt, correct Page/Bot and Store binding, replay rejection and actual zero provider sends, orders and stock writes MUST be independently observed in provider/n8n/DB logs.
F. Undo/rollback: revoke new dedicated secret/grant, disconnect ONLY disposable QA callback and restore its previous webhook, disable private route/Worker and reconcile replay ledger; preserve existing RPC16 Merchant evidence, user bot workflow and customer production channels.
G. Real Commerce Store A/B JWT/RLS remains independent NO-GO; signed ingress DOES NOT grant Commerce reader/writer. Zalo OA awaits legitimate OAuth owner.

## 7. QA result and go/no-go

- VERIFIED: current Cloudflare, n8n, Supabase read-only states; official Meta and Zalo webhook contract.
- IMPLEMENTED: real Request + WebCrypto LOCAL QA, official Zalo payload correction and regression gate.
- TESTED: only when exact-head CI returns success; local tests prove implementation in Node 22, NOT provider delivery and NOT Cloudflare hosted Workerd acceptance.
- BLOCKED: independently authenticated Merchant/QA Page/Bot owner, external provider signature, actual hosted Durable Object/rate gate, independent external edge denial, hosted same-Tenant Store A/B JWT and Commerce cutover.
- NO-GO: production routing, webhook re-pointing, provider sending, Merchant data intake, Cloudflare Worker deployment, credential creation, database changes and costs.

Rollback now: close V17.7G child Draft PR. No hosted V17.7G mutation or runtime restoration required; keep RPC16/17 and n8n V17.7E workflow unchanged.

Proposed next gate: V17.7H — Scoped Inactive Worker Consent × Independent Owner Operator Admission × One-Message Native Provider UAT (subject to separate approval).
