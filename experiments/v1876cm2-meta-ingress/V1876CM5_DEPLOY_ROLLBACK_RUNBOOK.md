# TIEN404 AI — V18.7.6C-M3-H5 Private Redacted Telemetry Canary

Date: 2026-11-20 JST. Approval: owner requested "Private Redacted Telemetry Canary × Real Meta HMAC Acceptance × Controlled Rollback".
**Scope: isolated QA Worker only, not Messenger production, not Supabase, not Commerce.**

## Preflight (read-only verification)
- Stacked on Draft PR #464 (M4 offline redacted receipt), HEAD `62cdc9e620980ddc4064cd8656e0cfad40f55a71`. That branch passed **111/111** Node offline tests.
- Cloudflare Worker: `tien404-meta-messenger-qa-canary-v1876cm3`.
- Existing active deployment: `57089fde-6a66-4d2f-85fa-25ad1ed3b242`, 100% version `edbfa125-b852-4fc2-91c4-b73eac022a91` (prior to H5).
- `INSPECTOR_ENABLED=true`, `INSPECTOR_MODE=ISOLATED_QA_ONLY`, `META_APP_SECRET` and `META_VERIFY_TOKEN` both `secret_text`, `workers.dev` enabled, Preview URLs disabled, Observability off.
- Meta QA App ID `2366045790814059`, Callback URL `https://tien404-meta-messenger-qa-canary-v1876cm3.tienmobi208.workers.dev/meta-qa/webhook`.
- The 2026-11-19 22:32:40 JST Meta sample coincided with one Cloudflare invocation and 0 Worker execution errors but did not provide POST status, HMAC or field. Historic evidence CANNOT be upgraded to HMAC VERIFIED retroactively.
- Cloudflare Workers Free tier was verified from owner's plan screenshot. Cloudflare docs (20 Nov 2026) list Workers Logs Free quota 200,000 events/day and up to 3-day retention. Do not upgrade or change account-wide spend controls.

## Deployment gates
1. This PR is DRAFT; do not merge to `gh-pages`.
2. Upload an **undeployed version** first, using the exact checked GitHub files `src/worker.mjs` and `src/receipt-worker.mjs` and setting the module entrypoint to `receipt-worker.mjs`.
3. Inherit both **existing secrets by name**, strictly; never read, log, print, export or reset secret values. Preserve `INSPECTOR_MODE=ISOLATED_QA_ONLY` and `INSPECTOR_ENABLED=true`.
4. Initial receipt flag `REDACTED_RECEIPTS_ENABLED=false`. Deploy only to the same QA Worker after checking the prior active version/deployment ID has not drifted.
5. Verify on hosted endpoint: GET invalid verify token =403; POST invalid or missing HMAC=401; invalid path=404; bad Content-Type=415. **No retry or real Meta send before the negative suite passes.**
6. Use the Cloudflare setting on **this one QA Worker only**: `observability.enabled=true`; `observability.logs.enabled=true`; `observability.logs.invocation_logs=false` (do not persist URL/headers); `observability.logs.head_sampling_rate=1` for a very small controlled QA sample; `observability.logs.persist=true`; `observability.redact_query_string=true`; `observability.traces.enabled=false`; `observability.issues.enabled=false`. Do not enable Logpush or third-party export.
7. Enable `REDACTED_RECEIPTS_ENABLED=true` only after hosted negative suite succeeds and QA logging configuration has been verified by metadata. The wrapper emits ONLY an allowlisted, redacted `TIEN404_QA_REDACTED_RECEIPT` on signed Page POST accepted with HTTP 200. Logger failure must not change Meta reply.
8. Query Workers Logs **only for our QA script and our receipt marker**, return from tool only sanitized receiptId, eventTypes, count, HMAC boolean, HTTP status. Never copy raw request/response, PSIDs, Page IDs, IP addresses, tokens or content into chat.
9. Owner sends **one new sample** in the QA Meta App after live deployment, first `messaging_postbacks`, then `message_reads`, `message_deliveries`, `message_echoes` individually. Do not ask Meta App main to send; do not enable provider Send API.
10. If a signed receipt with matching event class is observed, mark that specific class TESTED REAL (Meta QA sample), not customer/live Page subscription. If no log or signature rejects, mark BLOCKED and do not invent acceptance.
11. **Close testing promptly.** Set `REDACTED_RECEIPTS_ENABLED=false` and `observability.enabled=false` after evidence capture. Do not leave persistent logging running after QA. Existing Cloudflare Free retention of already written log events may last up to 3 days; stopping new logs is not deleting old logs.

## Rollback plan
- Preferred: return `INSPECTOR_ENABLED=true`, `REDACTED_RECEIPTS_ENABLED=false`, `observability.enabled=false` on QA Worker; verify HTTP negative responses again.
- Full binary rollback: deploy the previous pinned Worker version `edbfa125-b852-4fc2-91c4-b73eac022a91` at 100% (only if source/version retention verified), preserving current QA App secrets and endpoint.
- Emergency isolation: `INSPECTOR_ENABLED=false` and disable QA Worker's `workers.dev`. This also halts Meta QA delivery and must be reflected in checkpoint.
- Closing this Draft PR **does not** roll back hosted Worker changes. Do not delete Cloudflare resources or rotate secrets without a separate owner decision.
- No action above may touch original Meta App `1637989744444198`, Published Messenger n8n `Z7FdV7uDvApfbURQ`, production `gh-pages`, Supabase real Auth/RLS, Commerce orders, billing or live credentials.

## Success criteria
- CODE TESTED on exact commit SHA.
- SENSITIVE BINDINGS INHERITED, names/types verified read-only.
- HOSTED NEGATIVE HTTPS REGRESSION PASS after deployment.
- REDACTED LOG OBSERVABILITY CONFIG VERIFIED; no invocation logs, no raw payload logs.
- REAL META SAMPLE ACCEPTANCE only after signed receipt + safe HMAC confirmed and matching allowlisted field.
- CONTROLLED ROLLBACK evidence captured (flag OFF and/or old-version restoration).
- Store Authority REAL AUTH A/B/C still blocked, unrelated to this M5 test.
