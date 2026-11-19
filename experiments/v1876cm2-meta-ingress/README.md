# TIEN404 AI V18.7.6C-M2 — Isolated Meta Webhook v27 Ingress Candidate

Date 2026-11-19 JST. Status: CANDIDATE / NO DEPLOY / NO SEND / NO WRITE / NO REAL STORE AUTH.

## Continuity and safety
- Parent Draft PR #453: offline event inspector (45/45 QA), n8n manual-only workflow sPI4f2lN9Aj2bIQS, execution #5534 SUCCESS.
- Existing Meta App Page callback points to **https://ngoctien20.app.n8n.cloud/webhook/tien404-messenger-qa**. Preserve it and the current Verify Token. Do not send arbitrary Meta Dashboard samples to the active bot merely to collect executions.
- Meta's Send to My Server delivers to the **configured Page callback**, NOT an arbitrary new Worker. One Page-object callback does not let this QA endpoint receive events without separate App configuration. Prefer a separate Meta test app and an authorized test Page after owner approval.
- Owner reported subscribing more Meta fields, but exact new field subscriptions and Page-level subscribed_apps have not been independently confirmed.

## Source (not hosted)
- src/worker.mjs: Fetch-handler for Cloudflare Workers, **disabled by default** unless INSPECTOR_MODE=ISOLATED_QA_ONLY and INSPECTOR_ENABLED=true.
- GET /meta-qa/webhook: challenge+Verify Token checks with no raw token in output.
- POST: bounded original request bytes (64 KiB), JSON content type, HMAC-SHA256 X-Hub-Signature-256 using a private binding, Page object/event structure, fail-closed errors.
- Produces event type counts and NO-SEND flags only; strips all Page IDs, PSIDs, message text/IDs, attachment content, credentials. No external fetch, n8n, AI, database, logs, order/customer reads or provider sends.
- src/dashboard-sample.mjs: strictly offline conversion of Meta test-modal sample field/value envelope to a synthetic Page fixture after stripping its IDs and payload. The actual ingress rejects the modal wrapper because the delivered wire format is unverified.
- No deployment configuration, route, credential or infrastructure created by this PR.

## Test and owner gates
Run locally: node --test experiments/v1876cm2-meta-ingress/tests/*.test.mjs

1. Verify actual App subscribed fields and Page-level subscription separately in Meta UI or a protected read-only API session.
2. Obtain owner approval for a separate Meta test app/Page and a dedicated private staging deployment. Do not change the existing Page Callback.
3. Use independent secrets for the test app; never copy production App Secret or Verify Token into GitHub, logs, n8n or ChatGPT.
4. Test signed GET and POST one event type at a time; record redacted event counts, status and test execution references. No Page IDs, PSIDs, token or customer content.
5. Durable idempotency, security/abuse controls and Store Authority are required before any downstream side effects. This candidate intentionally has no persistence.
6. Real Owner A/B/C JWT Store-RLS and real Commerce read remain BLOCKED.

## Rollback
Close the Draft PR. No real Meta subscription, Supabase, n8n Published, Cloudflare deployment or customer data was changed.

Checkpoint: V18.7.6C-M2 | CANDIDATE NO DEPLOY | OFFLINE QA | LIVE META UNVERIFIED | STORE AUTH NO-GO | NO SEND | NO WRITE.
