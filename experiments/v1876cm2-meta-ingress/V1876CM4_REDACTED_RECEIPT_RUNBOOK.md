# TIEN404 AI — V18.7.6C-M4 Redacted Receipt × Meta Read/Delivery/Echo QA

Date: 2026-11-20 JST | **CANDIDATE/OFFLINE ONLY** | NO runtime deployment authorized by this commit.

## Verified baseline
- V18.7.6C-M3-H2 Draft PR #462 at SHA `6767d29867872ffb74b955ed491aeeecd4b3d808`, Cloudflare staging Canary `tien404-meta-messenger-qa-canary-v1876cm3` HTTPS on, `INSPECTOR_ENABLED=true`, `INSPECTOR_MODE=ISOLATED_QA_ONLY`, two Meta QA secrets of type `secret_text`; no preview URLs.
- Owner's Meta QA App: `2366045790814059`. Callback verified and `messaging_postbacks` subscribed from owner screenshots. App/Page customer entitlement remains unverified.
- Owner reported Meta v27 `messaging_postbacks` Test at **2026-11-19 22:32:40 JST**. Cloudflare GraphQL script-level analytics between 22:28–22:37 JST returned three invocations at 22:32:19, 22:32:32, **22:32:40**, each `status=success`, 0 worker execution errors. Primary n8n Messenger `Z7FdV7uDvApfbURQ` had no execution during examined window.
- GraphQL invocation `success` is **NOT HTTP 200**, POST HMAC accepted, or proof of postback field. Canary Observability was not configured; no redacted receipt can be recovered for the 22:32:40 request. Do not reinterpret that historical event as HMAC PASS.

## Implemented for isolated candidate only
- `src/receipt-worker.mjs` delegates to the existing M3 ingress `src/worker.mjs` with exact response and no transformation of the original body. It only optionally emits a **redacted structured console receipt** after a POST returned HTTP 200, `signatureValidForSuppliedBytes=true`, no-send/no-write flags and a validated allowlisted event type/count map.
- Default setting: `REDACTED_RECEIPTS_ENABLED` is **unset/false**; therefore **no logging** and no behavioral difference from the existing ingress until explicit separate approval and configuration.
- Receipt schema `tien404.meta.qa.redacted-receipt.v1`: random one-time `receiptId`, HTTP status 200, `verifiedHmac=true`, event type counts, no-send/no-write/no-Store verification flags, `payloadPersisted=false`. It intentionally excludes customer PSID, Page ID, sender, recipient, message ID, text, attachments, referral payload, signature, token, IP and the raw body.
- Only accepts **allowlisted field names** as receipt labels. No attacker-controlled strings echoed. Invalid HMAC or rejected payload never produces a receipt. A logger exception cannot fail Meta acknowledgment.
- No KV, D1, durable event inbox, external HTTP request, AI, private Commerce read, order writer, provider Send API or Page subscription changes.
- **Important:** console receipts become readable and retained **only if Worker Observability is separately enabled**; this Draft does not change Cloudflare logging configuration or deploy code. A receipt ID is not a persistent event ID, replay/idempotency proof or authentic Store authority.

## Offline QA and bounds
`node --test experiments/v1876cm2-meta-ingress/tests/*.test.mjs`

New tests: default-logging-off, successful synthetic `messages`, `messaging_postbacks`, `message_reads`, `message_deliveries`, `message_echoes`, `messaging_handovers`, edit/reaction classes; change-envelope fixtures; wrong HMAC, invalid payload, bad counts, unknown fields, privacy redaction, no-send, unchanged response, logger failure isolation.

**No test in this branch simulates real Meta signing with the user's QA App Secret**. HMAC tests use synthetic values only.

## Next gated stage (not performed)
1. Independent security review of privacy/retention and Worker cost on Free plan. Define maximum receipt retention and avoid logging other environment identifiers.
2. Owner explicitly approves deploying the receipt wrapper as the QA Worker's new entrypoint, adding `REDACTED_RECEIPTS_ENABLED=true` and enabling **limited Worker Observability** for the QA Worker only. Preserve both existing Meta QA Secret bindings by `inherit`; never read/print/replace their values.
3. Before any deploy, snapshot source SHA and settings, document exact rollback to `src/worker.mjs` and `REDACTED_RECEIPTS_ENABLED=false`; check no other Worker or primary Meta App changes.
4. Verify hosted invalid HMAC gives 401, wrong token 403, wrong path 404, invalid content type 415 and **no receipt for all denials**.
5. Run exactly one new Meta QA App test per subscribed field (`messaging_postbacks`, then `message_reads`, `message_deliveries`, `message_echoes`); use sanitized receipt ID + allowlisted event class + 200 response as evidence. The previous 22:32:40 event cannot be replayed from analytics.
6. After test, disable receipt logging and, if no further QA is planned, lock the QA Canary. Do not promote Store Authority or provider sends.

## Admission
- VERIFIED: timestamp-correlated QA Canary invocation, no Worker execution errors.
- IMPLEMENTED candidate: opt-in redacted receipt wrapper.
- TESTED: **pending exact-head CI**.
- BLOCKED: historical HTTP 200/HMAC field proof, separate Meta QA provider event accepted after instrumentation, Store/Owner A/B/C Auth and production releases.

Rollback for this Draft: close PR. The currently live Cloudflare Canary is **not modified** by this branch; closing the PR does not disable the existing public QA Worker.
