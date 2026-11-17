# TIEN404 AI — V17.23U Dedicated QA Bot Private Ingress

**Do not set the Zalo QA Bot webhook yet.** This milestone separates safe staging deployment from authenticated provider admission and one real event.

## Starting state (verified)
- Parent V17.23S: [Draft PR #388](https://github.com/ngoctien20/demo-git/pull/388), HEAD `8e116aa78d5fb187496c1375089baf6658b6f457`.
- The owner confirms they created a distinct Zalo Bot QA and its local Windows preflight returned `QA_BOT_GETME=PASS`. Their subsequent authenticated Zalo Bot Creator view shows this Bot has **no configured webhook**; `getWebhookInfo` returned HTTP 200 with API `ok=false`, `error_code=404`, so that API alone is inconclusive.
- Existing staging Bot remains on its prior n8n callback: do not use its credential or overwrite any callback.
- V17.23S receiver: source-only and 411/411 synthetic CI. It was NOT a deployed Worker and had no D1 binding.
- Official Zalo Bot webhook docs document the envelope `{ok:true,result:{event_name,message}}`; an independently reported live Zalo Bot integration observes flat `{event_name,message}`. V17.23U refines the existing receiver to permit exactly these **two** shapes, rejecting malformed/ambiguous wrappers, preserving header verification, challenge, private chat, time bounds, single-slot atomic D1 insert, no send, and no Commerce access.
- Zalo Bot webhook header `X-Bot-Api-Secret-Token` is a bearer-style shared secret — **not** a payload HMAC or independent customer identity proof.

## Deployment and admission gates

Track U-A (**safe, inert staging Worker only**):
1. Upload a new dedicated Worker `tien404-v1723u-qa-bot-inbound-locked-staging` as **inert 404** with no secrets, no routes, no D1 binding, no domain.
2. Disable `workers.dev` and preview exposure. Independently read deployment metadata and verify this script is NOT attached to a zone route or Worker Domain.
3. Upload/test vetted source to same Worker only while no public route, credentials, binding or active admission mode exist. With missing `QA_CANARY_MODE` it returns 404 for all methods and paths.
4. Log only checksum and nonsecret deployment metadata; never issue token-bearing requests or enable public routing in this phase.

Track U-B (**explicit independent approval required before provider receive**):
1. Verify the **new** QA Bot's owner through a separate private trusted UI, with distinct identification vs existing staging Bot and scoped one-message consent. Bot IDs and credentials stay outside public GitHub/chat.
2. Approve creation of a **new isolated D1** database, region/cost/usage cap, schema, retention and a tested rollback; do not share any of three existing D1 staging databases.
3. Approve QA-only Worker route exposure, WAF/rate limits, independent no-send monitor, private `QA_HEADER_SECRET` (Bot Creator webhook Secret Token **not** Bot API token), `QA_EVENT_PEPPER`, random `QA_CALLBACK_PATH`, `QA_CHALLENGE`, `QA_START_MS` and `QA_END_MS` (max 30 minutes). No service role, no customer tables, no n8n Commerce link.
4. Verify one negative request does not get ACK before registration; test D1 atomic single-slot and use no logs of raw payload before opening.
5. Change **only new QA Bot's** webhook in its Bot Creator UI with explicit owner consent, observe its callback setup read-only; never edit the existing staging Bot.
6. Authorized test person sends **one** challenge to new QA Bot; verify incoming event via independent Worker/D1/Provider logs without raw message or user ID in GitHub. Check wrong-secret, replay, duplicate, expiry, forbidden nonprivate sender and no outgoing send.
7. Close receiver mode and revert QA-only callback via owner-approved rollback. Keep short-lived redacted receipt in approved private vault.

Track U-C (**Commerce JWT**) remains NO-GO: M0, canonical Store A/B ownership, Store-scoped RLS and real Auth issuer/session proof are absent. No Order reads.

## Safety and rollback
- No new credential, provider webhook change, customer data, order write/send, production workflow modification or real event until U-B.
- Source PR rollback = close Draft PR. If an inert Worker was created, it should remain disabled until separately approved cleanup rather than attempting an unapproved destructive delete.
- Cloudflare D1 has a Free allowance but account plan/usage and all future costs must be verified before any provisioning. Do not assume the next database cannot incur fees.

## Sources
- Official Zalo Bot webhook (wrapper & header): https://docs.zaloplatforms.com/docs/BOT/webhook
- Third-party live observed flat Zalo event: https://github.com/dderek0/quest/blob/main/zalo-bot-docs/api-reference.md
- Cloudflare D1 limits and pricing: https://developers.cloudflare.com/d1/platform/limits/ and https://developers.cloudflare.com/d1/platform/pricing/


## Actual hosted checkpoint — 18 Nov 2026 JST (operator read-only verified after writes)

**IMPLEMENTED (Cloudflare staging only):**
- Created new Worker `tien404-v1723u-qa-inbound-locked-staging`, initially an inert 404. Fixed Cloudflare compatibility-date validation by selecting `2026-11-17` UTC-compatible date.
- Set `workers.dev=false` and `previews_enabled=false` BEFORE uploading the candidate full receiver.
- Uploaded exact GitHub `qa/v1723s/isolated-qa-webhook.mjs` source at blob SHA `8a508bac76ad4dde64dd88789b8b8e654ac51a8b`; Cloudflare response script ETag `8e1b26e0e28dcd90543225a4477aa14a9a44b12a2947dff45e85eb2de993e1d4`; verified Cloudflare content/v2 includes identical GitHub source.
- Created a **new** isolated APAC D1 `tien404-v1723u-qa-bot-once-disposable`, applied the single-slot `qa_canary_once` table schema and bound it as `QA_EVENT_DB` to this NEW Worker only.
- Read-only postflight: `workers.dev=false`, preview=false, **0 zone routes**, **0 custom domains**, exactly **1 D1 binding**, **0 credential bindings**, D1 **0 event rows**. No configured `QA_CANARY_MODE`, so the deployed receiver is inert 404 and **cannot accept provider traffic**.
- No change to existing Zalo staging webhook, n8n Published, Supabase Commerce/Auth, Meta/Zalo credential, Order or customer.
- D1 creation/schema are a scoped isolated QA infrastructure write. D1 pricing is usage/storage based, with Free included quotas; account subscription details were not available. No paid resource upgrade was initiated. **Recheck billing before any public route, message test or sustained D1 use.**

**NOT TESTED:** Cloudflare Worker request runtime through actual ingress, real D1 write via a live Worker invocation, native Bot Secret Token verification, real single Zalo event, independent operator/Owner no-send evidence. Github source CI is not equivalent to these hosted checks.

**BLOCKED:** public/QA-only callback exposure and webhook enrollment until explicit scoped Owner approval, approved private secret handling, time-bounded variables, callback test and rollback. Never use existing staging Bot; avoid exposing the random callback path or shared secrets in public GitHub/ChatGPT.

**Rollback plan:** leave this QA Worker with workers.dev/preview off and no routes; no provider rollback needed because no webhook was changed. Deletion of the isolated D1/Worker is a separate destructive step requiring authorization. Closing Draft PR reverts only source changes, not these new hosted QA resources.


## DIAGNOSTIC_POST_WEBHOOK_DELETION — 18 Nov 2026 JST

**Observed and bounded checkpoint**
- Owner confirms the webhook was removed from the **new QA Zalo Bot** through Bot Creator. This is OWNER-ATTESTED, not independently provider-API-VERIFIED.
- Cloudflare read-only postflight: dedicated `tien404-v1723u-qa-inbound-locked-staging` has `workers.dev=false`, previews disabled; isolated D1 `qa_canary_once` has **0 receipts**. No new provider requests, no network exposure, no Commerce.
- An earlier no-token POST returned HTTP 403, proving the exact QA path reached an active Worker and failed secret-header auth. This **does not prove** any Zalo request arrived.
- Source regression identified and fixed a Cloudflare entrypoint `ExecutionContext`/clock confusion that caused false HTTP 410. Fixed Draft PR #394 source passed the V17.23U and V17.23S GitHub synthetic workflows; source tested != real webhook acceptance.
- Zalo Bot's official example uses `X-Bot-Api-Secret-Token`, event `message.text.received`, `message.date` as 13-digit milliseconds, `message.chat.chat_type=PRIVATE`, and a string message ID. See https://docs.zaloplatforms.com/docs/BOT/webhook. Do not substitute Zalo OA event contract.
- The first owner-sent message was not the exact challenge; a subsequent owner-reported exact challenge still produced zero D1 receipts. Unknown whether the latter request reached Cloudflare, failed header authentication, failed a strict event check, or was sent outside the live admission window.

**PROPOSED — private no-content diagnostic before any further provider send**
1. Keep `workers.dev` and preview **OFF** and Zalo QA webhook **removed** until an independently approved narrow diagnostic is reviewed. Do not send new messages yet. **No** mutations to the old Bot, n8n Published, Commerce, customers or production.
2. Offline verify all negative QA statuses at the actual Worker runtime entrypoint, including 404 path/mode, 405 method, 410 expired clock, 403 absent/wrong header, 415 content type, 400 malformed JSON, 422 schema/challenge/timestamp, 503 dependency and 200 one-slot-only accepted. Keep test payloads fully synthetic.
3. For real retry observability, choose *minimally sufficient* Cloudflare aggregate request counters (no URL path / query / request header/body). If further diagnosis is necessary, review a new **opt-in** diagnostic design: only after successful shared-header authentication, store a **bounded fixed-category rejection reason** in an isolated disposable QA table, with no raw payload, timestamp finer than required, token, chat/user ID, message text, Bot API credential or IP address; do not write any diagnostic event for unauthenticated traffic. Use one-slot/strict per-category bounds to prevent uncontrolled usage. Independently review retention, cost and anti-flood before any deployment.
4. Current endpoint's response codes alone are not a durable audit log: `qa_canary_once=0` says no accepted record, not whether there were rejected requests. Never equate 403 from an operator probe with Zalo's live delivery.
5. Review Zalo QA webhook registration and token sameness only within private owner UI, without revealing the callback random suffix or tokens. Verify the app's *new QA Bot*, not existing published Bot. Do not activate the webhook or a new 20-minute canary until the diagnostic plan, QA owner, read-only counters and rollback are approved.
6. After any approved retry, collect exactly one challenge, independently confirm receipt vs rejection category, verify no-send and no Commerce. In all cases disable workers.dev, preview, and test mode, and delete QA Bot webhook; recheck D1. Keep release/prod **NO-GO**.

**State:** `CLOUDFLARE_INGRESS_OFF VERIFIED / D1_ZERO VERIFIED / ZALO_QA_WEBHOOK_DELETED OWNER-ATTESTED / REAL_EVENT_ACCEPTANCE BLOCKED / DIAGNOSTIC_ONLY PROPOSED`.


## V17.23U-DIAG1 — Authenticated Rejection-Only Diagnostic Candidate

**Status: IMPLEMENTED in Draft PR source + synthetic tests only; NOT DEPLOYED; QA webhook REMOVED per owner confirmation; endpoint OFF.** This is an optional, fail-closed diagnostic for the **new dedicated QA Zalo Bot**, not Zalo OA or the old staging bot.

### Contract and security properties

- The code introduces optional plain-text flag \`QA_DIAG_MODE=OWNER_SCOPED_AUTH_REJECTION_ONCE\`. **This flag is ABSENT on hosted Worker and must remain absent until separately reviewed and approved.** Existing 8 bindings, Commerce and source-only real event intake are unaffected when it is absent.
- A diagnostic write is attempted only after: correct random callback path, POST method, bounded active time window, required QA-only env and D1, and **successful constant-time comparison against the Webhook Secret Token header**. Wrong/missing token (403), wrong path (404), wrong method (405), expired window (410), missing prerequisites (503) never issue diagnostics SQL or read/write any diagnostic record.
- The only stored value is one **fixed reason code**, with eight possible values: \`CONTENT_TYPE\` (415), \`BODY_SIZE\` (413), \`BODY_PARSE\` (400), \`ENVELOPE\` (422), \`EVENT_KIND\` (422), \`MESSAGE_SHAPE\` (422), \`CHALLENGE\` (422), \`EVENT_TIME\` (422). **No** request body/text, sender, chat/user/message ID, token, IP, URL, event HMAC, timestamp or raw exception is stored for rejected events.
- One row per unique reason globally; \`INSERT OR IGNORE\` and D1 schema CHECK cap storage at eight rows. The accepted one-event table \`qa_canary_once\` stays independent and unchanged.
- The diagnostic records are never sent to Zalo or returned in HTTP responses. Original response codes, empty-body ACK and valid event semantics remain unchanged. A diagnostic SQL failure is swallowed, preserving original rejection status.
- **No provider header HMAC verification:** the Zalo Bot Webhook Secret Token is a bearer-style shared header, not cryptographic attestation of an incoming payload. This helper does not independently prove Zalo generated a request.
- A persistent fixed-row schema bounds **stored rows, not total query attempts**. Repeated bad requests from anyone possessing the header can consume D1 queries. **Independent rate-limit/WAF, spend cap, tenancy scope, test retention and rollback review are mandatory** before any hosted opt-in.
- Since unauthenticated delivery is intentionally not logged, the diagnostic table **cannot prove** whether a webhook was delivered with a missing/wrong Secret Token; use provider delivery status or approved aggregate Cloudflare metrics without sensitive data for that question.

### Proposed QA-only D1 migration — **DO NOT EXECUTE without a separate deployment decision**

\`\`\`sql
CREATE TABLE IF NOT EXISTS qa_auth_rejection_once (
  reason TEXT PRIMARY KEY CHECK (reason IN (
    'CONTENT_TYPE','BODY_SIZE','BODY_PARSE','ENVELOPE',
    'EVENT_KIND','MESSAGE_SHAPE','CHALLENGE','EVENT_TIME'
  ))
) WITHOUT ROWID;
\`\`\`

Query for authorised read-only acceptance (after migration, in private operator UI):

\`\`\`sql
SELECT reason FROM qa_auth_rejection_once ORDER BY reason;
\`\`\`

No extra D1 instance is required: use **only** the already-isolated disposable QA D1 if separately approved; never Supabase, customer data, Orders or a shared staging database. Lifecycle and explicit cleanup/retention approval are outstanding. **No D1 schema has been modified in this milestone.**

### Test / independent pre-deployment admission

- New synthetic suite: \`node --test qa/v1723u/qa-auth-rejection-diagnostic.test.mjs\`. It exercises each of eight categories; no-write on unauthenticated/wrong-path/wrong-method/expired/inactive; disabled/missing flag; diagnostic table error; duplicate and concurrent requests; zero PII persisted; preserved one valid receipt.
- GitHub Actions workflow \`.github/workflows/v1723u-qa-bot-wrapper-locked-staging.yml\` is extended to execute this suite beside prior no-send regression tests. CI results must be checked on the **latest** commit before claiming TESTED.
- Independent QA reviewer must verify exact source SHA, D1 migration preview, a bounded/no-content staging read/write test in an offline or disposable environment, negative bearer-header behavior, provider registration state, rate-limiting protection, no-send, no-PII storage, retention and a documented rollback.
- Deployment sequence after explicit approval: keep Worker OFF; apply only the approved QA-only schema; verify preflight + baseline 0; configure optional QA_DIAG_MODE; run negative synthetic Worker requests **without provider credentials**; open a fresh ≤20-minute QA-only window; verify one real challenge; immediately disable workers.dev + QA mode and remove new Bot webhook; inspect only fixed reason codes and qa_canary_once receipt; purge diagnostics under separately approved retention procedure.
- **Current GO/NO-GO: NO-GO for any webhook re-enrollment, network exposure, hosted diagnostic mode or production merge.** Owner's prior approval for the earlier one-event receiver does **not** automatically authorize this new diagnostic data processing or schema migration.


## V17.23U-DIAG2 — Independent Rate-Limit and Disposable SQLite Admission

**Scope as of this checkpoint:** GitHub Draft PR #394 only. Cloudflare production/staging-hosted Worker remains **OFF**, no QA webhook, and no hosted schema changes. This milestone does not authorize Zalo sends, live webhook registration, paid resources, credential changes, or changes to Commerce.

### VERIFIED independent constraints

- The deployed source currently has **no** D1-backed diagnostic table, no \`QA_DIAG_MODE\` flag, and no \`QA_DIAG_RATE_LIMITER\` binding. The operator reported deleting the new QA Bot webhook (owner-attested, not verified via Zalo provider API).
- Cloudflare Workers native Rate Limiting binding (\`env.MY_RATE_LIMITER.limit({key})\`) is **approximate/per location** and can exceed the configured threshold; it is **not** an exact global quota. Cloudflare explicitly recommends Durable Objects for strict global limits. Source: https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/ (document updated Nov 12, 2026).
- D1 Workers Free daily read/write quotas are enforced by errors once exceeded, beginning Sept 1, 2026; that does **not** replace prevention of abusive database queries. Source: https://developers.cloudflare.com/changelog/post/2026-09-01-d1-free-tier-limit-enforcement/.
- Eight permitted reason rows limit **persistent storage** but not attempted queries or failed authentication traffic. **Do not claim rate-limit acceptance** from row-count tests.

### IMPLEMENTED on PR only (unhosted)

- Optional diagnostics now additionally require \`QA_DIAG_RATE_LIMITER.limit({key:'qa-v1723u-auth-diagnostic'})\` to return \`{success:true}\` **after the Webhook Secret Token header is authenticated** and before issuing any diagnostics D1 query. When limiter is absent, unavailable, or exhausted, the Worker keeps the original denial HTTP status/body and attempts **zero** diagnostics D1 queries.
- This is **diagnostics-write admission only**. It is not a blanket request throttle; valid events still follow the original single-slot contract, unauthorized requests are rejected without rate limiter calls, and it does not make rate limits globally strict. The key is a fixed QA bucket containing no token/IP/user/customer identity or callback path.
- \`QA_DIAG_RATE_LIMITER\` is **not attached to Cloudflare** and \`QA_DIAG_MODE\` remains **absent**. No hosted changes are allowed automatically.
- New disposable-only SQL preview: \`qa/v1723u/sql/qa_auth_rejection_once_preview.sql\`; SQLite \`CHECK\` and \`WITHOUT ROWID\` constrain entries to eight fixed categories. **Do not apply it to live/hosted D1**. The original one-event table is independent and remains unchanged.
- New independent Python standard-library SQLite tests: \`qa/v1723u/qa_d1_disposable_schema_test.py\` runs only \`sqlite3.connect(':memory:')\` and tests idempotent migration, a strict reason allow-list, NOT NULL, primary-key replay prevention, malicious input, transaction rollback, and preserved one-slot acceptance schema.
- The diagnostic Node suite now covers missing/error/exhausted limiter, wrong header (no limiter call), one PII-free key, no persistence when limiter is absent, and unchanged failure responses. GitHub Actions runs this alongside earlier receiver and envelope negative QA and offline SQLite tests.

### NO-GO / remaining approval gates

1. Verify exact **latest CI result and independent test logs**. Passing local/synthetic tests does not prove the hosted Cloudflare runtime or a real Zalo delivery.
2. Select and separately approve a *strict* global request/query budget if guaranteed upper bounds are necessary (e.g., reviewed Durable Object architecture) **or** explicitly accept a more limited test scope with provider-side status evidence and Cloudflare request metrics, without implying native rate limiting is exact. Evaluate availability, cost, extra resources, reset semantics and fallback.
3. Confirm the actual existing Cloudflare WAF/rate rules and free plan limits; do **not** create billable rules, Durable Objects, a new database or worker routes automatically.
4. Specify the diagnostic records' expiration/deletion retention and make rollback fail-closed: remove QA Bot webhook, disable Worker \`workers.dev\` + preview + diagnostic mode, verify D1 rows and cost, and only clean up D1 with separately authorized destructive approval.
5. Obtain explicit scoped approval for **hosted diagnostic schema writes, monitoring, and another one-message Zalo QA test**, then take a snapshot and stage acceptance evidence. The earlier one-message authorization did not imply these new changes.
6. Maintain **REAL ZALO ACCEPTANCE BLOCKED, Commerce/JWT Store A/B PRODUCTION NO-GO**. No promotion from EXPERIMENTAL to RELEASED.

**Status:** \`DIAG2_SOURCE_IMPLEMENTED / RATE_LIMIT_GUARD_SOURCE_ONLY / SQLITE_MIGRATION_PREVIEW / QA_CI_PENDING_FINAL_CONFIRMATION / HOSTED_OFF / D1_UNMODIFIED / BOT_QA_WEBHOOK_REMOVED_OWNER_ATTESTED\`.
