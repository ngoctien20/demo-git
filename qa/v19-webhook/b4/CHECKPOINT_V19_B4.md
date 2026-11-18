# TIEN404 AI — V19.0-B4 Checkpoint

Date: 2026-11-18 JST.
Status: IMPLEMENTED — source-only registry reviewer; TESTED — hosted disposable D1 SQL + offline synthetic/security suite; BLOCKED — real provider/Store authorization, Worker Binding, production.

## Baseline
- Parent Draft PR #423, head 93e5f2af1526f2a4c5d5d2217caebf094b1b62a1; B2 parent PR #419 remains Draft.
- B2 Cloudflare Worker snapshot Git blob 11affa7658b46ae7c411eed7877d7ccdce61bbad preserved.
- Cloudflare Worker tien404-v1723u-qa-inbound-locked-staging deployment 8a43101c-39fa-40a0-a022-2528e54b2102, version 1d2666ac-3b4d-4fd2-9cba-0f05b65dd195 remained unchanged; workers.dev and previews disabled.
- Real Supabase staging public Orders/Products/Customers/Conversations lack store_id; V18.3.6D canonical Store Authority is design-only (PR #417).

## Source-only implementation
- b4/trusted-installation-gate.mjs: server-input-only synthetic registry read checker; no HTTP routing; default handler 423 LOCKED.
- b4/sql/001_disposable_registry_only.sql: QA_LOCKED + SYNTHETIC_FIXTURE_ONLY D1 registry table schema, no real Store/customer data.
- b4/tests/: negative identity / cross-Store / cross-Tenant / provider / fingerprint / expiry / duplicate registry tests; native SQLite constraint tests.
- b4/SECURITY_REVIEW.md: independent-format P0/P1 evidence review, NOT an external human security approval.
- CI workflow: B4 tests + full B3/B2 regression, no cloud credentials.

## Hosted Cloudflare D1 test (only preexisting disposable QA database)
Database: tien404-v1822-zalo-qa-once-disposable, pre-existing V18.2.2 disposable; no new database created.
Pre-write schema inventory: _cf_KV plus qa_canary_once (0 rows).
Added only:
- v19_b3_rate_windows
- v19_b3_event_claims
- v19_b3_events_admitted_at (index)
- v19_b4_installation_registry

All inserted rows use SYNTHETIC IDs and opaque fixture SHA strings only.
The exact B3 atomic D1 SQLite UPSERT RETURNING statements were executed through Cloudflare D1 REST:
- Rate first/second hit: 1/2, third returns no row; independent installation B and next window each accept.
- Event first: attempts 1; repeat: 2; same ID altered payload: no row; same ID different installation accepted separately.
- Concurrent six rate calls with quota three: 3 accepted, 3 rejected, readback hits=3.
- Concurrent six identical event claims: 1 event row, readback attempts=6.
- B4 registry: three synthetic installations spanning three Stores and two Tenants. Exact matching A/B queries find one row, bad provider/environment/unregistered installation find zero.
Final readback:
- v19_b3_rate_windows: 4 rows.
- v19_b3_event_claims: 4 rows.
- v19_b4_installation_registry: 3 rows.
- qa_canary_once: **0 rows**, unchanged.

IMPORTANT: Hosted SQL through D1 REST proves actual Cloudflare D1 SQL behavior; it does NOT prove D1 Worker Binding .first() semantics, real webhook delivery, runtime integration, WAF, JWT, Store RLS, or durable downstream processing. Registry values are fake, NOT real provider/customer identities.

## CI on B4 QA branch
- GitHub Actions completed successful at source commit 33e7b520fbbd7bdc1f71fd724d9c8c1bfcccf3b3; run 44284981259.
- B4 JS: 30/30 PASS.
- B4 Python SQLite: 10/10 PASS.
- B3 JS: 47/47 PASS.
- B3 Python SQLite: 8/8 PASS.
- B2 JS: 105/105 PASS.
- Total 200/200 PASS, 0 FAILED, 0 SKIPPED. Snapshot guard PASS.
- Final PR-head CI status requires independent verification after checkpoint commit.

## Security review gate
- P0: Store-level authority / real Owner A/B not implemented in Commerce staging.
- P0 for opening ingress: no durable dispatch/outbox; event claim is only a QA receipt and cannot justify acking real customer workflows as processed.
- P1: shared Bot secret is not signed body; no verified provider account binding.
- P1: invalid-secret brute force outside rate gate; fixed-window boundary bursts; no overall D1 I/O deadline; late provider retry policy unknown.
- No real Zalo Bot callback, Zalo OA permission, production Order, message send, credential changes, Worker deploy or published n8n edits.

## Backup/rollback/change record
- BEFORE: recorded disposable DB schema _cf_KV + qa_canary_once; old canary row count 0.
- AFTER: additive namespaced QA tables only; old qa_canary_once still 0. No deletion or modification of old rows.
- Rollback: archive/close B4 Draft PR. Any hosted D1 cleanup (drop B3/B4 tables and QA fixture rows) REQUIRES explicit user approval; no automatic destructive migration.
- No new cloud account resources, Worker, D1 database, webhook, or paid service subscription added. Query usage is nonzero; exact billing not independently established.
- No customer data or credential values read/written.

## Next gate (B5 proposal)
- Independent human security approval of threat matrix.
- Isolated Worker Binding D1 test against a disposable-only binding and canonical installation registry; no public provider ingress.
- Confirm provider account identity using read-only getMe/getWebhookInfo, only with scoped permission, without changing callbacks.
- Complete canonical Store schema, authenticated Owner A/B RLS and installation→Store server-side authority.
- Design durable outbox + replay worker before treating any real event receipt as processed.
- Never call setWebhook, enable workers.dev, alter n8n Published or send messages without exact target approval.

CHECKPOINT: V19_B4_HOSTED_D1_REST_SQL_TESTED__SYNTHETIC_INSTALL_REGISTRY_ONLY__OFFLINE_200_OF_200__STORE_AUTH_BLOCKED__NO_PRODUCTION.
