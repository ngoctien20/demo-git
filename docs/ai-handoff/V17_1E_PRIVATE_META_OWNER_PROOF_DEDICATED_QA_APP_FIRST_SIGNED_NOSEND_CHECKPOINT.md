# TIEN404 AI — V17.1-E Private Meta Owner Proof × Dedicated QA App/Page × First Real Signed No-Send Event

Checkpoint date: 2026-11-17 JST.
Status: IMPLEMENTED SOURCE-ONLY SECURE CONTRACT; REAL DEDICATED QA APP/PAGE AUTHORITY AND GENUINE META EVENT NOT VERIFIED / BLOCKED.

## 1. Verified current facts (READ ONLY)
- Existing real Messenger Published workflow Z7FdV7uDvApfbURQ remains active, 27 nodes, version d5c96b6b-d790-4270-8b0f-d0ebdd8bbd92. Past execution #4176 was a successful actual webhook with native signature verification true.
- Existing V17.1-C Data Table cnSZ6hT7WCbNwGl5 remains a three-row SYNTHETIC QA-only Page→Store→Bot registry; cannot authorize real merchant owner, customer or Commerce data.
- V17.1-D isolated locked callback workflow 6ZWYRBKieTKQMzoQ remains INACTIVE, three nodes, no active version, version 732d376f-2cef-4ba7-bc3e-80136055dc56. Previously manual test #4347 succeeded with SHADOW_LOCKED/HTTP403 configured, but not an actual real Meta HTTP request.
- Historical user Page Full Control and Meta Developer App Admin statements/screenshots are kept as OPERATOR-ATTESTED; they are not proof that another distinct QA Meta App and QA Facebook Page exist or have independent rights.
- Connected Browser has no authenticated Meta Business Manager or Meta Developer portal tab; existing n8n channel registry does not independently demonstrate current private Page owner authority. We have not accessed any Page/App token, created/changed Meta app subscriptions, or sent real Messenger traffic.

## 2. Implemented safe V17.1-E changes
- Source module qa/v171e-meta-real-event/isolated-meta-no-send.mjs:
  - No server, no network client, no send/model/order APIs. Imports crypto only.
  - Requires private QA App ID + production App ID to differ; private QA Page ID + production Page ID to differ.
  - Requires explicitly operator-attested QA App/Page isolation, Page control, callback approval, production callback unchanged, private evidence reference; these fields are private policy inputs and DO NOT independently prove Meta business ownership.
  - Requires a private QA tester sender and scoped Page ID, private App Secret and verification token.
  - Requires injected asynchronous claimOnce returning 'claimed' or 'duplicate'; no default in-memory replay for a real deployment.
  - GET verifies hub.mode, hub.verify_token in constant time, numeric challenge; never changes subscriptions.
  - POST verifies HMAC-SHA256 over raw Buffer with timing-safe compare, then Page+recipient+tester, text message, MID, timestamp and no client-supplied Tenant/Store/Bot authority claims.
  - Only a safe hashed event receipt (HMAC using private App Secret), MOCK_ONLY and zero send/model/Commerce-write values are returned. Real provider account ownership and receipt provenance are explicitly NOT certified by the module itself.
  - Batches/multiple Page entries and unsupported events rejected to restrict first single-event pilot.
- 50 source unit tests in qa/v171e-meta-real-event/isolated-meta-no-send.test.mjs (fabricated test identities and secrets only).
- CI workflow .github/workflows/v171e-meta-real-signed-nosend.yml runs tests and no network/send static check; live provider release job intentionally SKIPPED.
- qa/v171e-meta-real-event/README.md explains private operator evidence, distinct QA App/Page setup, and bounded one-event no-send acceptance.

## 3. Meta documentation / protocol constraints
- Webhook verification requires HTTPS GET challenge validation, Event Notification POST with X-Hub-Signature-256 computed from exact raw body and App Secret; accepted notifications need HTTP 200 to avoid repeated delivery. Message webhook permissions and Page App installation must be valid.
- Subscribing a Page using the existing production App, or changing the existing app callback, can affect live traffic. Not authorized in this track. Prefer separate independent QA Meta App + separate QA Page with App role/test sender.
- Official docs: https://developers.facebook.com/docs/graph-api/webhooks/getting-started/ and https://developers.facebook.com/docs/graph-api/webhooks/getting-started/webhooks-for-pages/ ; https://developers.facebook.com/docs/apps/managing-development-cycle

## 4. QA status (source vs actual live)
- Implemented: handler contract and strict no-send barriers in GitHub Draft PR #243; 50 offline tests, subject to exact HEAD CI check before final acceptance report.
- Not done: actual private read-only Meta owner/subscribed_apps check on new QA app/page, separate App/Page creation, HTTPS public ingress deployment, real Meta GET challenge, actual Meta POST signed by real QA App, real n8n shadow execution, owner-backed Store bot resolution, durable hosted event claim.
- No real Page ID, PSID, token, App Secret, PII or personal message copied to public source/CI. No production systems changed, no Commerce writes, no paid LLM call.
- Source-only simulated signing success must NOT be called real Meta delivery. A successfully signed historical Messenger webhook #4176 on the original Published route does NOT prove the new shadow path.

## 5. Production GO/NO-GO conditions and next human action
- Source-only QA: GO only when CI is green.
- Real Meta QA App/Page independent ownership and subscription: BLOCKED until operator confirms private proof and dedicated resources exist.
- Separate QA callback: BLOCKED until independent registration approval and a safe actual deployed GET/POST endpoint; never activate the V17.1-D locked shell as a real Meta callback.
- One-event signed Meta acceptance: BLOCKED until explicit one-event consent, designated QA tester, private App Secret, owner-backed unique Page→Store→Bot mapping, durable atomic dedupe, privacy controls and no-send outbound circuit. Real signed POST success must be proven by new hosting/n8n execution ID.
- Hosted Store A/B JWT/RLS, live Commerce reads/writes, Messenger sends, credentials and model replacement remain separate NO-GO gates.
- Operator should create or identify a separate QA Meta App and QA Facebook Page in private Meta portal with proper role/control, then run existing V17.1-D GET-only private operator proof. Do not share tokens or raw PSIDs, and don't reuse live production App Page as QA.

## 6. Change log, rollback, checkpoint
- Reused PR #243, did not create competing PR.
- No n8n workflow changes, Page subscription changes, credentials, Supabase writes or real messaging.
- Rollback: close PR #243; leave V17.1-C/V17.1-D QA workflows inactive and QA Data Table untouched, unless explicitly approved otherwise.
- CI SHA and run links should be inserted in the PR description after verifying the exact final HEAD; never claim CI pass from a previous commit.
