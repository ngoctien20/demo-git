# TIEN404 AI — V18.7.6C-M3-H4 | Redacted Webhook Receipts × Event Contract QA

Date: 2026-11-19 JST | **IMPLEMENTED IN DRAFT ONLY / NOT DEPLOYED / LIVE LOGGING OFF**
Parent: Draft PR #462 (M3-H2, hosted HTTPS QA, 84/84 offline + 5/5 hosted negative QA).

## Why H4 is necessary
Owner triggered a Meta QA App v27.0 webhook sample at 22:32:40 JST. Cloudflare GraphQL confirmed three Worker invocations at 22:32:19, :32 and :40 JST, all \`invocation.status=success\`, errors=0. Main Messenger Published workflow had no new execution in the checked window.
Cloudflare **invocation success does NOT prove** HTTP 200, POST HMAC validation, specific Meta field, or Page authority. Existing QA Worker has no durable receipt store, custom telemetry, or enabled Workers Logs.

## Critical privacy discovery: Meta GET verification token in URL
Meta GET setup includes \`hub.verify_token\` in **the URL query string**.
Cloudflare Workers Logs documentation explains that **invocation logs may include the request URL**. Turning on generic logs at default settings could persist the Verify Token in log metadata, even if the Worker only emits sanitized application logs.

See:
- https://developers.cloudflare.com/workers/observability/logs/workers-logs/#invocation-logs
- https://developers.cloudflare.com/workers/wrangler/configuration/#observability

**Safety gate:** Before EVER enabling any live log persistence, independently confirm:
1. \`observability.logs.invocation_logs = false\` on the target Worker (no automatic request URLs).
2. \`observability.redact_query_string = true\` when supported. This is defense in depth, not a substitute for disabling invocation logs.
3. Do NOT enable raw headers/body logging, Logpush, Tail requests or request URL/error object dumps. Traces must be separately reviewed for token exposure.
4. Check Workers Free quotas/usage, sampling and retention; no plan upgrade or extra spend.
5. Restrict log viewing to approved QA operators. Clean log retention and query scope; no export outside the project.
6. Any inability to confirm the settings above => **DO NOT ACTIVATE PERSISTENT LOGGING**.

## Implementation (GitHub Draft only)
- \`src/redacted-receipts.mjs\` builds an allowlisted record containing only:
  - fixed schema \`tien404.meta.qa.receipt.v1\`;
  - locally generated random \`receiptId\` and server-side \`occurredAt\`;
  - fixed \`QA_ONLY\` environment and POST method;
  - HTTP status (known codes only), fixed decision code, HMAC validation boolean;
  - counts per allowlisted event type \`messaging_postbacks\`, \`messages\`, \`message_reads\`, \`message_deliveries\`, \`message_echoes\`, etc.;
  - explicit \`canSend=false\`, \`canWrite=false\`, \`storeVerified=false\`, \`metaDeliveryVerified=false\`.
- **No raw request** is passed to the telemetry module. It never inspects URL, request headers, sender IDs, Page IDs, text, message IDs, App Secret, Verify Token, signature or customer data.
- Worker \`fetch\` calls a response \`finish\` wrapper for POST decisions; **response bodies/status remain unchanged**.
- Both \`QA_TELEMETRY_ENABLED=true\` **AND** \`QA_TELEMETRY_CONSENT=APPROVED\` are required to emit one \`console.info(JSON.stringify(record))\`. Neither flag is present on the hosted QA Worker. Without both, no new application logs occur.
- Logging exceptions are swallowed so they cannot change Webhook acknowledgement, cause duplicate delivery, or trigger AI/Commerce writes.
- Every record is a local QA observation. A valid HMAC only proves possession of the matching App Secret; it does not prove the Page is subscribed or a user is authorized for a Store.

## Offline QA
\`node --test experiments/v1876cm2-meta-ingress/tests/*.test.mjs\`

Test requirements:
- consent disabled, one flag missing, GET with Verify Token never logged;
- signed Postback 200 + HMAC true + one known event;
- signed Read/Delivery/Echo samples counted with no PII;
- invalid HMAC => 401, HMAC false, no events;
- valid HMAC + bad JSON => 400, HMAC true, no events;
- unknown field generalized, injection keys rejected;
- same HTTP behavior when telemetry disabled or logger fails;
- no URL, Verify Token, App Secret, PSID, Page ID, contents or identifiers anywhere in serialized receipt.

## Hosted activation — separate owner authorization REQUIRED
1. Independently review CI and PR diff. Verify no hidden raw logging and no effect on H2 deployed code.
2. Confirm Cloudflare logging config **before** adding live consent flags or deploying revised Worker. Disable invocation logs explicitly and verify query-string redaction; do not use default Workers logging settings.
3. Make a source/metadata backup of H2 Worker, and retain the ability to restore the prior deployed version. Check Worker route, Secret bindings and \`INSPECTOR_MODE=ISOLATED_QA_ONLY\`.
4. Deploy H4 code to **QA Worker only** preserving Meta QA secret bindings without reading their values. Confirm H2 controls still pass from public HTTPS.
5. Only after owner approval, enable the two H4 telemetry flags for a **brief supervised QA window**. Capture only safe receipts; never print full request data.
6. From Meta QA App (ID 2366045790814059) test one sample field at a time, documenting safe receipt ID/type/HMAC/HTTP status/timestamp. The UI's delivery status must be cross-checked separately.
7. Stop immediately on any unexpected log contents, 5xx/retries, errors, request-volume spike or non-QA activity. Revert both telemetry flags; deactivate the QA Worker if necessary.
8. Never alter the main TIEN404 Meta App, original Messenger Published webhook, Supabase real Store data, or provider Send API.

## Current result and limitations
- M3-H3 timestamp-correlated live invocation: VERIFIED, but actual signed postback field and HTTP 200 remain unproven.
- H4 record schema and offline regression: IMPLEMENTED / CI PENDING.
- Hosted H4 telemetry settings, logs, retention, signed Meta POST receipts: NOT DEPLOYED / NOT TESTED.
- Owner A/B/C Auth and Store Authority: BLOCKED, separate workstream.
- No new Cloudflare bindings, routes, secrets, logs or cost were applied in this PR.

## Rollback
Close the Draft PR to discard the candidate (does not change the existing hosted H2 Worker).
If later deployed under a new approval, disable QA telemetry flags, restore the previously checkpointed H2 Worker version and retain redacted QA evidence only according to owner-approved retention. No production rollback required for this PR.

Checkpoint: \`V18.7.6C-M3-H4 | REDACTED RECEIPT CONTRACT CANDIDATE | OFFLINE QA IN PROGRESS | HOSTED H2 UNCHANGED | NO SEND | NO WRITE\`.
