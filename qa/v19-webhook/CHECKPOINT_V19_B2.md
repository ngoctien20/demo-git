# TIEN404 AI — V19.0-B2 Verified Checkpoint

**Date:** 2026-11-18 JST  
**Status:** SOURCE SNAPSHOT VERIFIED × STRICT ZALO CONTRACT IMPLEMENTED OFFLINE × 105/105 QA PASS  
**Release decision:** HOSTED PROVIDER INGRESS NO-GO / PRODUCTION NO-GO.

## Source evidence

- Cloudflare Worker: tien404-v1723u-qa-inbound-locked-staging.
- Current audited deployment: 8a43101c-39fa-40a0-a022-2528e54b2102.
- Deployed Worker version: 1d2666ac-3b4d-4fd2-9cba-0f05b65dd195.
- Exact source copied to source-snapshot/v1723u-worker-deployed.mjs; after upload, source fetched from Cloudflare again and matched GitHub content exactly.
- Git source blob SHA: 11affa7658b46ae7c411eed7877d7ccdce61bbad.
- Worker had workers.dev disabled; Preview URLs disabled.
- QA_EVENT_DB bound to an existing disposable D1. The read-only count of its qa_canary_once table was zero at audit.
- Source declares version V17.23S while deployment annotates V17.23U-DIAG9F; this discrepancy is preserved.

## Offline QA evidence

- GitHub Actions run: https://github.com/ngoctien20/demo-git/actions/runs/44278188125
- Head SHA at successful run: 42461acbbe4f9ee89f5727f8f16aaed46e8251ae.
- Node.js 22: 105 tests PASS, 0 FAIL, 0 SKIPPED.
- Syntax checks PASS.
- Original deployed Worker Git blob immutability check PASS.
- No npm third-party packages or secrets needed.
- All fixtures and D1 state synthetic; no live provider, Cloudflare D1 mutation, n8n execution, customer data, orders or outgoing messages.

## Known gaps that MUST remain visible

1. Original Worker also accepts flat Zalo event objects, despite canonical official wrapped envelope.
2. Original Worker permits missing from.id and chat.id.
3. One global D1 claim is a QA canary, not per-installation multi-event durability.
4. No 429 rate limit or bounded stream read timeout in deployed source.
5. Shared header auth is not a body signature; no real provider identity proof from offline tests.
6. No trusted Store binding, no customer link, no Store RLS proof, no Commerce AI Core ingress.
7. No real provider Webhook / TLS / WAF / callback / replay / rollback test.
8. Strict candidate is review-only, never an authorization decision.

## Scope control

Changed only the new GitHub branch qa/v19-webhook-worker-snapshot-contract-offline-20261118:
- Source snapshot, immutable Git blob SHA and metadata manifest.
- Strict shape reviewer source, with no network or caller privileges.
- Synthetic test suites and CI workflow.
- QA documentation and checkpoint.

Explicitly unchanged:
- Cloudflare Worker deployment, bindings, secrets, routes, Access and WAF.
- D1 database schema/rows.
- n8n Published and Draft workflows.
- Supabase, Render, website, Messenger, Zalo Bot/OA, provider webhook registration, customer data, billing and production.

## Next recommended gate (separate approval)

Source-only bounded body timeout/rate limit + scoped idempotency candidate; run isolated negative tests. To enable a real staging callback or call setWebhook on an explicitly identified QA Bot, require a separate exact-target approval, existing callback snapshot, rollback plan and evidence of Worker-level and provider-level authentication. Production and full Commerce Store-read/write cutover remain blocked.

**Checkpoint:** V19_B2_SOURCE_VERIFIED__OFFLINE_QA_105_OF_105__REAL_INGRESS_BLOCKED__NO_PRODUCTION.
