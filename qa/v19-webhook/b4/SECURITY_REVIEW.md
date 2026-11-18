# V19.0-B4 — Independent Security Desk Review (Candidate, NOT signed off)

Date: 2026-11-18 JST.
Scope: V19.0-B2 immutable deployed-worker snapshot; V19.0-B3 source-only ingress candidate; V19.0-B4 synthetic installation registry and disposable D1 hosted REST SQL.
This is a separate evidence-driven review package, **NOT an independent human approval** and NOT authorization to open real webhook ingress.

## Threat model
External attacker: sends forged POST and headers, guesses Bot secret or payload, spams quota, repeats event IDs, swaps installation/Store identifiers, modifies text, tries cross-Tenant/Store BOLA, or sends slow body.
Compromised provider Bot token / rogue webhook: shared header secret alone does not sign the body.
Internal caller: mistakenly uses environment installation ref as verified merchant Store authority.
Faults: D1 timeouts/unknown commit, Store mapping missing, rapid retries, provider retries after expiry, nonce collision, double send.

## Findings and release relevance

| Finding | Severity | Evidence | Required disposition |
|---|---|---|---|
| No verified real Store authority | P0 | Supabase public Orders/Products/Customers/Conversations lack store_id; V18.3.6D still design-only | BLOCKED. Do not read or write Commerce; finish canonical Store schema + memberships/RLS and real JWT A/B |
| No durable downstream processor / outbox | P0 for live ingress | B3 writes QA_ADMITTED_NO_SEND but responds HTTP 200; no n8n dispatch, state machine or replay worker | NEVER connect real customer events until durable processing + recovery/acks defined |
| Header secret is not payload signature | P1 | Zalo Bot uses shared X-Bot-Api-Secret-Token; B3 checks equality, not signed body | Least privilege secret per installation, rotation/compromise plan, authenticated installation registry; separate OA validator |
| No live provider account binding proof | P1 | B3 fixed env installation ID; B4 registry is synthetic | Obtain provider read-only account identity evidence and merchant-approved binding, never trust request IDs |
| Unauthenticated requests not rate limited by B3 | P1 | Quota statement runs after shared header validation | Configure scoped Cloudflare WAF/rate defenses after Security Events analysis; don't disable WAF wholesale |
| Fixed minute windows allow boundary burst | P2 | B3 fixed 60, one statement per bucket | Accept only as QA, use stronger algorithm/provider edge rules if necessary |
| Legitimate duplicate consumes rate budget | P2 | B3 quota applied before event dedupe | Define retry exemption with abuse protection; verify provider retry behavior before production |
| D1 claim rate and event are separate operations | P1 | Rate increments even when subsequent event insert fails | Define desired retries and partial-failure accounting; no exactly-once acceptance claim |
| Late provider retry rejected by context timestamp window | P1 | B2 strict 180s date skew; B3 reuses strict reviewer | Confirm real provider retry horizon; distinguish delivery replay from actual new event |
| Conflicting event ID responds HTTP 409 | P2 | B3 event UPSERT returns no row | Check provider retry/ACK contract to avoid infinite retries; log bounded admin evidence |
| Body timeout does not bound D1 I/O duration | P1 | B3 readBoundedBody only guards request stream | Add separate overall ingress budget and upstream fault handling if hosted |
| No expiry cleanup for D1 event/rate tables | P2 | B3 SQL no TTL/deletes | Retention, cost, backup and non-PII cleanup plan requiring approved migration |
| Cloudflare Worker body cancellation semantics | P2 | Test Node ReadableStream; no real Worker binding/runtime test | Hosted isolated Cloudflare Workers/Miniflare test gate |
| B4 registry is QA only | Safety control | D1 status check QA_LOCKED, proof SYNTHETIC_FIXTURE_ONLY; default handler 423 | Never infer merchant consent, Store role or provider account verification from QA_REGISTRY_MATCH_ONLY |
| D1 REST != Worker Binding | Validation scope | B4 exercises D1 real hosted SQL over REST, not Worker .first() runtime | Separate Worker Binding integration test before rollout |

## Positive controls verified
- Exact deployed B2 source snapshot and immutable blob guard preserved.
- B3 default Worker HTTP 423, bounded body and fail-closed negative tests.
- Real Cloudflare D1 hosted REST recognized candidate atomic rate/Event UPSERT RETURNING SQL in disposable database.
- Parallel six rate calls with quota three: three accepted, three rejected, final hits=3.
- Parallel six identical event claims: one row with attempts=6.
- B4 server-source registry reviewer returns **NO** real provider identity, Store, customer, read/write or send grants.
- Registry requires source-controlled installation ref, provider, environment, synthetic proof level, fingerprint match, revision and validity window.
- B4 disposable D1 schema CHECK constraints preclude production status/proof and ensure unique (installation_ref,provider,environment).
- Existing qa_canary_once row count remained zero after D1 tests; no original table mutation.

## Scope / approvals
No real Bot credentials, JWT, customer data, provider sends, setWebhook, WAF/Access changes, published n8n edits or Commerce writes.
Cloudflare D1 REST writes occurred **only to v19_b3_* and v19_b4_* tables** in existing V18.2.2 disposable QA database. Do not describe these writes as source-only. No new D1 database or Worker created.
The exact existing database schema before additive QA changes was _cf_KV + qa_canary_once, which had 0 rows. Snapshot preserved in the review records; rollback is to drop B3/B4 QA tables **only on explicit approval**, never automatically.
No independently signed security acceptance obtained; live ingress and production remain NO-GO.

## Sources
- Cloudflare D1 API query: https://developers.cloudflare.com/api/resources/d1/subresources/database/methods/query/
- D1 Worker Binding: https://developers.cloudflare.com/d1/worker-api/prepared-statements/
- D1 quotas: https://developers.cloudflare.com/changelog/post/2026-09-01-d1-free-tier-limit-enforcement/
- OWASP API1 BOLA: https://api-security.owasp.org/editions/2023/en/0xa1-broken-object-level-authorization/
- Supabase canonical Store design: https://github.com/ngoctien20/demo-git/pull/417

Security release decision: B4_CANARY_REGISTRY_QA_TESTED / AUTH_REAL_BLOCKED / OUTBOX_UNIMPLEMENTED / NO_GO.
