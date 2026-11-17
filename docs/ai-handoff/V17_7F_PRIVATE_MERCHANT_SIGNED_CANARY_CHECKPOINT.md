# TIEN404 AI — V17.7F Private Merchant Evidence Consent × Dedicated Signed Provider Canary

Date: 2026-11-17 JST. Status: SOURCE-ONLY IMPLEMENTED / EXISTING HOSTED BASELINE VERIFIED READ-ONLY / NATIVE REAL PROVIDER AND OWNER UAT NO-GO.

## 1. Starting checkpoint and no duplicate infrastructure

Parent Draft PR #334 HEAD 9a4c109342fcdf18f1d17a80e7e7e3557e633e0b, 261/261 offline and 5/5 CI SUCCESS; actual inactive n8n Manual QA workflow MQcbjLWZ5QUTJW0k, execution 5026 12/12 synthetic on hosted n8n. This workflow remains inactive and is not repurposed as a webhook.

Other canonical owned workstreams:
- Private Merchant intake infrastructure: RPC16 Draft PR #313 and hosted INACTIVE Worker tien404-rpc16-merchant-evidence-inactive-staging, existing Access app f994d4b2-d4f9-419b-8585-5d33be506f13 (TIEN404 RPC16 Merchant Evidence Staging — DENY ALL). Reuse as background reference; do not alter or copy to a new public proof upload.
- RPC17 Draft #322 provides offline signed invitation; RPC17.1 Draft #327 provides atomic replay/scanner receipt contract; RPC17.2 Draft #332 provides REAL LOCAL Workerd SQLite durable-object test and offline scanner bridge, NOT a Cloudflare hosted durable object or real antivirus scan.
- Store/Auth migration and recovery: canonical #247, RPC security #246, Commerce Products/recovery #251.
- Zalo OA private owner admission: separate #309; current user has no OA legal owner grant.
- Current V17.7A/B/C/D/E lineage: #317/#321/#326/#330/#334, all remain Draft. No merge, no production or active caller mutations.

## 2. Direct read-only inspection this phase

Cloudflare account ac01685529c0a31fc185335f07648edf:
- 30 Worker scripts were listed during this read-only audit; a single script matching RPC16/RPC17/V17.7F provider-canary naming exists: RPC16 Merchant Evidence inactive Worker. No new V17.7F signed provider script discovered.
- RPC16 Worker settings currently show exactly one binding named R2_QUARANTINE of type r2_bucket. This does NOT authorize reading/writing object contents.
- 2 Access applications currently: dedicated RPC16 Merchant Evidence DENY ALL app, with ZERO inline Allow/Bypass policies in the account Access-app response; existing Pages Access app is separate. No Access app or policy was created, edited or deleted.
- This is CONFIGURATION evidence only; there is NO independent external browser denial proof and no real merchant upload/scanner/retention acceptance.
- Do not assume account-level Access Bypass absence or worker route safety solely from Access inline policy summary. Current RPC16 PR #313 explicitly documents workers.dev=false, preview disabled, no active route and 404 handler at its initial hosted checkpoint; recheck all exact exposure flags before ANY later activation.

n8n Cloud:
- Existing V17.7E workflow MQcbjLWZ5QUTJW0k still inactive, version b8aaf94c-def1-472c-bd92-fccea1d946b8, exactly two nodes ManualTrigger + Code, no HTTP/webhook/credential. Execution 5026 previously passed 12/12 synthetic fixtures.
- Zalo Bot yIJk8LvJoLF40Z62 active staging; contains QA marker UPSERT. Messenger TEST Z7FdV7uDvApfbURQ active, includes real HTTP Send Reply. Neither is a safe *unmodified* independent zero-write/no-send ingress for a real provider probe.

Supabase staging ifxlvrhyjhbzbrkdsida:
- Rechecked current private QA tenant_identity_map: 2 tenants and max 1 Store per Tenant; 0 same-Tenant Store A/B setup.
- Public six Commerce tables remain tenant-only RLS (6/6 RLS and FORCE RLS, 0 store_id, no approved Store RLS cutover). Original four product/order Store owner proof is unverified.
- No customer rows, JWTs, merchant files, source records, tokens, Order/Stock values inspected; only catalog and aggregate metadata.

## 3. Source-only implementation

Files:
1. qa/v17-7a-oa-independent/v17-7f-private-owner-consent-preflight.mjs
   - Synthetic redacted packet scope for exactly four original legacy Store records: T1_PRODUCT_1/T1_ORDER_1/T2_PRODUCT_1/T2_ORDER_1.
   - Challenge/invitation digest, private opaque intake reference, expiry <= 15 minutes, per-source digest, issuer/owner/reviewer digest separation and freshness.
   - Strict field allowlisting excludes phone, name, address, source rows, raw JWT, auth tokens, credentials, file contents and private payloads.
   - JSON shape or SHA digest DOES NOT authenticate a Merchant or reviewer. Independent authenticated actor challenge, original source readback, current Store membership, consent, security reviewer and Service→Store trust are still required.
   - Explicit source-only split plan: RPC16 Merchant Access stays DENY ALL + no upload, future provider canary MUST be separate and currently NOT DEPLOYED. All self-reported approvals ignored.

2. qa/v17-7a-oa-independent/v17-7f-provider-crypto-fixture-offline.mjs
   - Meta MESSENGER: verify synthetic raw request Buffer with HMAC-SHA256 using QA_ONLY test App Secret and exact X-Hub-Signature-256 sha256=... header; no JSON stringify before signature; pin Page/message.
   - ZALO_BOT: compare synthetic X-Bot-Api-Secret-Token with QA_ONLY test secret in constant time. This is a static secret token HEADER, NOT HMAC of message bytes; it is NOT Zalo OA X-ZEvent-Signature or an OAuth grant.
   - Rejection cases: duplicate/missing headers, bad format, tamper, wrong App/Page/Bot binding, stale/future event, malformed JSON, client Tenant/Store claims, replay, no store service.
   - Replay reservation is an injected IN-MEMORY test function; not a hosted Durable Object or rate limiter. EventRef and providerRef are fixture inputs, not trusted authorization or provider proof.
   - Output hides raw body, actor, message content, secret, customer ID; false realProviderVerified and false send/read/write/deploy always. No HTTP, webhook, network or model calls.

3. Two Node test suites covering above boundaries; complete inherited V17.7A-E suites.
4. qa/v17-7a-oa-independent/v17-7f-private-canary-hosted-readonly-evidence.json: redacted verified app/worker/workflow/DB metadata with explicit NOT-TESTED flags, no secrets.
5. .github/workflows/v17-7f-private-merchant-signed-canary-nosend.yml: syntax, full inherited suite, static no-network/no-send/no-DB write and redacted evidence NO-GO.
6. This checkpoint.

Official references:
- Meta native Webhooks raw HMAC SHA256 X-Hub-Signature-256: https://developers.facebook.com/docs/graph-api/webhooks/getting-started/
- Cloudflare Worker-level Access vs hostname Access, preview caveats: https://developers.cloudflare.com/workers/configuration/cloudflare-access/
- Supabase JWT and Store RLS must derive from independently verified auth.uid() + trusted binding, never user_metadata: https://supabase.com/docs/guides/database/postgres/row-level-security
- Zalo Bot header behavior cross-checked using public SDK/channel documentation (not OA), do not confuse Zalo Bot secret header with Zalo OA or Meta HMAC.

## 4. Two distinct ingress trust zones (important)

ZONE A — MERCHANT OWNER EVIDENCE:
Owner browser -> dedicated private Access + verified Supabase Auth session -> RPC16 Merchant evidence Worker.
CURRENT STATE: Access DENY ALL, worker no public routes/preview, handler returns 404; no Merchant documents, signed owner consent or uploaded files. Release remains NO-GO. Real owner verification should use RPC16/17 private admission, durable replay and real scanner only after separately authorized hosted staging.

ZONE B — META / ZALO BOT PROVIDER CALLBACK:
Native Meta or Zalo Bot provider -> separate dedicated HTTPS callback Worker -> native per-channel signature/header verifier -> private installation registry -> durable replay and rate guard -> NO-SEND status.
CURRENT STATE: NOT DEPLOYED. A browser-oriented Cloudflare Access login challenge cannot be blindly placed in front of a Meta/Zalo provider webhook because providers cannot complete a human Access login; instead use separate protected callback, provider-native verification, restricted surface and no Commerce connection. If a private test environment is desired, use an operator-authenticated synthetic harness and treat it only as synthetic until actual provider delivery is confirmed. No published Meta/Zalo webhook URL is repointed.

ZONE A and ZONE B NEVER share Worker, route, R2 object, token, credential, Store owner authority or customer data.

## 5. Required real UAT admission, NOT performed

G0 — independent Merchant/owner proof for four original Product/Order rows using private authenticated issuer, owner consent and separate reviewer, with merchant-source readback and permission checks. No chat/GitHub credentials.

M0 — protected backup and independent restore evidence for affected Auth/Storage/DB and transactional Store schema. Canonical #247/#251 approval required.

G3 — two separate real Supabase Auth sessions, TWO Stores same Tenant, own-store authorized read and cross-Store denied, no service-role bypass or RPC privilege leak; inspect actual hosted results with independent reviewer.

Provider no-send: owner proves dedicated QA Zalo Bot or Meta QA Page and grants scoped staging authorization; allow only dedicated one-shot native event after documented cost/rate cap. Separate Worker/Access approval and native signed receipt; hard deny for wrong Page/Bot/Store, rate and replay, zero outbound and zero Commerce writes independently observed in provider and DB logs. Existing published Messenger/Zalo workflows untouched.

External edge denial: independently test unauthenticated operator with real Access edge and provider callback behavior; mock 302/403 or code-only deny does not count.

OA: no OAuth grant -> remain blocked; do not borrow shared tokens or Zalo Bot credential to fake OA acceptance.

## 6. Decision / approval / rollback

- VERIFIED: read-only current hosted resources + PRs, no new V17.7F provider Worker; previous n8n manual QA 5026 remains intact.
- IMPLEMENTED: owner consent and provider-native crypto compatibility SOURCE ONLY; redacted evidence and CI.
- TESTED: exact HEAD CI result to be filled in after actually successful GitHub Actions.
- BLOCKED: real Merchant auth/consent, scanner and hosted durable ledger, Store AB JWT/RLS, live signed event, external Access denial, provider sends.
- PROPOSED: explicit approval for a **new dedicated inactive** provider-canary Worker with precisely one Operator Access policy and separate native callback path when ready; must first specify names, ports/routes, cost cap, credential source, owner authorizer, rollback and external QA.
- No changes to Cloudflare, Supabase, n8n, production, credentials or customer rows in THIS V17.7F PR.
- Source rollback: close this Draft PR. Preserve existing RPC16 Worker, R2 private bucket, Access app, all older PRs and n8n workflow MQcbjLWZ5QUTJW0k. No hosted rollback needed in this phase.

Checkpoint: V17_7F_PRIVATE_CONSENT_AND_SIGNED_FIXTURE_SOURCE_ONLY__RPC16_REUSE__REAL_PROVIDER_NO_GO.
