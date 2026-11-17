# V17.23U-DIAG3 — Historical Worker Invocation Aggregate Audit

**Time / evidence provenance:** 2026-11-18 JST, read-only Cloudflare SQL Analytics API scoped to the user's own account. Verified separately against the official Zalo Bot webhook contract. **No raw webhook payload, token, client IP, chat ID, user ID, message content, or secret callback suffix was queried.**

## Historical result

Worker script: `tien404-v1723u-qa-inbound-locked-staging`

Analysis range: **2026-11-17 19:20:00–20:05:00 UTC** (2026-11-18 04:20–05:05 JST), overlapping prior owner-authorized test periods.

SQL dataset: `events.workersInvocations` (adaptive sampling). Aggregate by `httpResponseStatus`, not by URL/header/payload or client identifiers.

| Response | Observed sampled rows | Weighted `sum(sampleInterval)` | Interpretation |
|:--|--:|--:|:--|
| 403 | 4 | 4 | Rejected due to absent/incorrect webhook secret header at the receiver auth stage |
| 405 | 1 | 1 | Non-POST method at the receiver; **sender unknown** |
| 410 | 1 | 1 | Receiver outside its accepted time window or invalid runtime clock |
| 200 | 0 | 0 | No accepted webhook HTTP 200 observed in range |
| 422 | 0 | 0 | No event-shape/challenge rejection recorded in range |

**Caution:** This is adaptive-sampling analytics; these observations are **not** a packet trace, nor proof that a particular request originated at Zalo. Cloudflare Workers invocation metrics do not expose the sender or HTTP method in the queried dataset. Requests denied earlier by edge security products also might not count as Worker invocations.

### Aggregate five-minute bins

| UTC five-minute bin | JST five-minute bin | Status | Weighted count |
|:--|:--|--:|--:|
| 2026-11-17 19:30 | 2026-11-18 04:30 | 410 | 1 |
| 2026-11-17 19:40 | 2026-11-18 04:40 | 403 | 1 |
| 2026-11-17 19:40 | 2026-11-18 04:40 | 405 | 1 |
| 2026-11-17 19:45 | 2026-11-18 04:45 | 403 | 1 |
| 2026-11-17 19:55 | 2026-11-18 04:55 | 403 | 2 |

**High-confidence result:** The Worker received some requests and rejected all sampled invocations in the historic test range. Separate read-only D1 checks still showed **zero durable accepted event receipts**.

**Unknown:** Which requests came from the owner's PowerShell probes, a browser/user action, Zalo's webhook registration verification, or real webhook deliveries. In particular, **HTTP 405 must NOT be asserted to be a Zalo GET** merely from the status.

## Independently checked official contract

Official docs: https://docs.zaloplatforms.com/docs/BOT/webhook — Zalo Bot webhook events are delivered via HTTPS POST with `X-Bot-Api-Secret-Token` and `application/json`; text message event is `message.text.received`, payload documented as `{ok:true,result:{event_name,message}}`.

The GitHub draft source also accepts a separately observed flat payload form, but this fallback does not independently establish live provider delivery.

## Redacted reproducible approach (DO NOT query sensitive event fields)

Account-scoped SQL API / GraphQL analytics if existing access allows, with SQL such as:

```sql
SELECT httpResponseStatus,
       count() AS sampledEvents,
       sum(sampleInterval) AS estimatedRequests
FROM events.workersInvocations
WHERE scriptName = 'tien404-v1723u-qa-inbound-locked-staging'
GROUP BY httpResponseStatus
ORDER BY httpResponseStatus
LIMIT 20
FORMAT JSON
```

Apply approved account-only scope and UTC `time_range` filter at the analytics API, e.g., 19:20–20:05 UTC on 2026-11-17. No raw logs, request-body fields, or URL path.

For a time-window comparison, group by `toStartOfFiveMinutes(timestamp)` and `httpResponseStatus`, keeping the same account scope. Aggregate values are potentially sampled and delayed.

## Admission decision & next probe

**DIAG3 RESULT: HISTORICAL REQUEST EVIDENCE VERIFIED / PROVIDER ATTRIBUTION BLOCKED / REAL ZALO ACCEPTANCE NOT PROVEN.**

Before any more bot messages:
1. Remain LOCKED: no webhook registered on new QA bot per owner attestation; `workers.dev=false` and previews disabled; D1 has zero accepted receipts.
2. Without sending a new request to Zalo, independently verify the **new QA Bot** webhook's registered/removed status in trusted owner Bot Creator UI or **private read-only getWebhookInfo**. Never expose the Bot API token or the randomized callback path in GitHub/chat.
3. Review privacy and cost of a diagnostic retry. If the core question is only “did Zalo POST?”, first prefer historical/real-time aggregate Worker invocations by response code with a clearly marked single send, or Zalo provider delivery status if available. Don't infer identity from a 403 or 405 alone. An authenticated-error diagnostic additionally requires explicit approval for a D1 schema write, QA_DIAG_MODE, rate-limit binding, retention and rollback.
4. When separately approved, tightly coordinate one new exact challenge and one time-bounded attempt; compare pre/post aggregate request metrics and Zalo registration status. No Zalo send or live webhook re-enrollment until then. Require one D1 acceptance, independent no-send check and rollback.
5. Production/Commerce remains NO-GO; do not merge the Draft PR to main or change the original staging Bot.

**Safety note:** HTTP 403 without header is expected and does not prove the configured Zalo Secret Token is correct; header comparison requires actual authenticated provider delivery or authorized controlled tests, not public disclosure.

**References:** Cloudflare Workers invocation analytics and sampling: https://developers.cloudflare.com/workers/observability/metrics-and-analytics/ and https://developers.cloudflare.com/cloudflare-for-platforms/workers-for-platforms/configuration/observability/ ; Zalo webhook: https://docs.zaloplatforms.com/docs/BOT/webhook .
