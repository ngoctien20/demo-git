# TIEN404 AI V19.0-B2 — Deployed Worker Snapshot × Strict Zalo Bot Contract × Offline QA

**Status:** SOURCE-ONLY CANDIDATE — NO HOSTED CUTOVER, NO PROVIDER SEND, NO ORDER WRITE  
**Date:** 2026-11-18 JST  
**Source of truth:** Cloudflare Worker tien404-v1723u-qa-inbound-locked-staging.  
**Related work:** V18.2 QA Bot PR #401; V18.3.6C/D Store Authority PRs #414/#417; V18.5.5 read-only Widget adapter PR #415.

## Deliverables

1. Exact source of the currently deployed Worker: source-snapshot/v1723u-worker-deployed.mjs, independently compared against Cloudflare after upload.
2. Snapshot manifest with deployment/version ID, source Git blob SHA and secret binding NAMES ONLY.
3. Node 22 offline tests of actual deployed source using a synthetic D1 fake. Tests faithfully record old behavior and weaknesses; the snapshot itself is never patched.
4. Separate strict-zalo-contract-candidate.mjs to REVIEW canonical official Zalo Bot JSON. It never authorizes a provider, tenant, Store, customer, order, outgoing send or webhook publication.
5. A read-only GitHub Actions QA workflow. No packages, databases, Cloudflare secrets, n8n credentials or real HTTP services are needed.

## Verified source provenance

| Property | Verified value |
|---|---|
| Worker | tien404-v1723u-qa-inbound-locked-staging |
| Deployment | 8a43101c-39fa-40a0-a022-2528e54b2102 |
| Worker Version | 1d2666ac-3b4d-4fd2-9cba-0f05b65dd195 |
| Source Git blob SHA | 11affa7658b46ae7c411eed7877d7ccdce61bbad |
| Source | 5,375 characters, GitHub equals Cloudflare |
| workers.dev | Disabled |
| Preview URLs | Disabled |
| D1 | qa_canary_once, one global slot=ONE |
| Accepted D1 rows at audit | 0 |
| Real provider delivery | NOT VERIFIED |

The source comment says V17.23S, whereas Cloudflare deployment annotation says V17.23U-DIAG9F. This version-label drift is preserved for audit. Do not silently change the snapshot.

## Existing gap inventory

- The deployed snapshot admits both the official wrapped format {ok:true,result:{event_name,message}} and a flat event object. The strict QA candidate rejects the flat format.
- The deployed snapshot does not require from.id or chat.id, while the strict QA candidate does.
- QA candidate additionally requires the private-chat sender ID and chat ID to match. This is an intentionally restrictive QA policy; it is not claimed as a guarantee for all Zalo Bot event types.
- The snapshot writes a single global D1 slot, so an unrelated second message gets an ACK but not a second row. This is one-shot QA behavior, NOT general event ingestion or per-installation idempotency.
- No explicit bounded body-read timeout or 429 rate-limit branch exists in the snapshot.
- The shared header secret is not a signature covering the event body. A matching header does not prove Store authority, customer identity or order access.
- Worker is disconnected from canonical installation-to-Store authority and Commerce Core. No Zalo provider callback, WAF or TLS end-to-end acceptance was conducted.
- Zalo OA is a separate signed raw-body provider contract. Do not reuse Bot validation for OA.

## V19 WB01–WB20 test matrix

| ID | Scenario | Result in this package |
|---|---|---|
| WB01 | GET root | OFFLINE TESTED: 404 |
| WB02 | GET callback | OFFLINE TESTED: 405 |
| WB03 | No secret | OFFLINE TESTED: 403 and zero writes |
| WB04 | Wrong secret | OFFLINE TESTED: 403 and zero writes |
| WB05 | Correct secret | OFFLINE TESTED: synthetic canary, 200 after successful fake D1 insert |
| WB06 | Invalid JSON | OFFLINE TESTED: 400 |
| WB07 | Wrong Content-Type | OFFLINE TESTED: 415 |
| WB08 | Oversize | OFFLINE TESTED: 413 |
| WB09 | Duplicate | OFFLINE TESTED: one-shot fake D1 has one row |
| WB10 | Replay | PARTIAL: same one-shot event not inserted twice, general replay not implemented |
| WB11 | Database failed | OFFLINE TESTED: 503, no false 200 |
| WB12 | Request burst | GAP: no rate limiter/429 |
| WB13 | Java User-Agent | PARTIAL: Worker logic accepts UA, WAF upstream unverified |
| WB14 | Wrong provider | OFFLINE TESTED: Bot rejects OA-shaped event |
| WB15 | Wrong Store | BLOCKED: canonical Store binding absent |
| WB16 | Durable insert | PARTIAL: fake D1 succeeds, hosted D1 write not exercised |
| WB17 | D1 failure | OFFLINE TESTED: 503, no false 200 |
| WB18 | Timeout/retry | PARTIAL: duplicate safe only for global slot, body read has no timeout |
| WB19 | Unsupported event | OFFLINE TESTED: current 422; strict candidate IGNORE for privacy event |
| WB20 | testWebhook | BLOCKED: no provider API invoked |

**Interpretation:** PASS for offline tests never means hosted provider validation or real Store A/B isolation. No exactly-once delivery claim.

## Local QA

Node.js 22, no package installation:

    node --check qa/v19-webhook/source-snapshot/v1723u-worker-deployed.mjs
    node --check qa/v19-webhook/strict-zalo-contract-candidate.mjs
    node --test qa/v19-webhook/tests/*.test.mjs
    git hash-object qa/v19-webhook/source-snapshot/v1723u-worker-deployed.mjs

The hash-object result must match 11affa7658b46ae7c411eed7877d7ccdce61bbad.
All event IDs, tokens, timestamps and challenge strings in tests are synthetic.
GitHub Actions runs only local JavaScript tests with read-only contents permission.

## Future controlled change — not authorized by this QA

1. Review known gaps and provider type separation.
2. Build a separate proposed bounded-body-timeout, rate-limited, installation-scoped event admission design.
3. Prove verified provider installation and owner-approved canonical Store authority independently of caller fields.
4. Run isolated disposable D1 tests and security negatives.
5. Obtain explicit approval before opening a QA callback hostname, publishing a staging workflow or calling setWebhook. Record old callback/rollback without exposing tokens.
6. Verify real provider HTTP, Cloudflare WAF, D1 admission and replay before considering an AI Core connection.

Official Zalo documentation:
- https://docs.zaloplatforms.com/docs/BOT/webhook
- https://docs.zaloplatforms.com/docs/BOT/apis/setWebhook
- https://docs.zaloplatforms.com/docs/BOT/apis/getWebhookInfo

**Checkpoint gate:** SOURCE_SNAPSHOT_VERIFIED / STRICT_ZALO_QA_ONLY / OFFLINE_CI_PENDING / HOSTED_INGRESS_NO_GO / STORE_RLS_NO_GO / PRODUCTION_NO_GO.
