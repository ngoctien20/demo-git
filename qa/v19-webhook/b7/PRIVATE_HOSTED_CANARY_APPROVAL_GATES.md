# TIEN404 V19.0-B7 — Private Hosted Canary Authorization & D1 Binding Evidence Gate

**Date:** 2026-11-18 JST
**Classification:** PROPOSED hosted runbook / NO CLOUD MUTATION / no user-scoped approval yet.
**Release:** NO-GO. This document is a contract, not an already executed hosted test.

## 1. Separate permission and actual hosted execution

The phase name contains "Approved", but no exact QA Worker, operator principal, approved D1 binding, private invoking service, route, test window or cost ceiling has been specified and approved. No hosted Worker canary is authorized solely by a phase title.

Do NOT reuse/modify/expose the existing deployed V17.23U Worker:
- Worker: tien404-v1723u-qa-inbound-locked-staging
- Deployment: 8a43101c-39fa-40a0-a022-2528e54b2102
- Version: 1d2666ac-3b4d-4fd2-9cba-0f05b65dd195
- workers.dev and previews disabled
- Binding QA_EVENT_DB currently mapped to an existing D1; do not change it
- B2 deployed source snapshot Git blob: 11affa7658b46ae7c411eed7877d7ccdce61bbad

## 2. Preferred future architecture (still needs exact approval)

A dedicated, isolated QA-only Worker can be invoked through a private Cloudflare Service Binding from a separately authenticated caller Worker, with public workers.dev, preview URLs and routes disabled on the target. Service Binding avoids a public target URL but **does not automatically prove an end-user's identity or authorization**. Verify and allowlist an actual internal caller principal, service identity or signed authentication assertion BEFORE D1 access. Do not accept arbitrary caller-provided Store IDs or tokens.

Alternatively, a separately approved Cloudflare Access-protected QA URL may be considered, but only after verifying issuer, audience, expiry, JWKS signature, principal allowlist and revocation behavior. A bare Access JWT header is not sufficient. These alternatives must NOT be combined casually or used to change a live provider callback.

Current B7 has ONLY a synthetic HMAC permit that simulates a signed internal caller, generated with a public test-only key. **It is not production authentication, a Cloudflare Access JWT verifier or proof of a hosted Service Binding.** Its exported Worker handler is locked at 423; the fixture harness must not be deployed.

## 3. Hosted admission H01-H16 (inherited from B6)

| ID | Required actual evidence | Current B7 status |
|---|---|---|
| H01 | Snapshot target version before changes | VERIFIED READ-ONLY for existing Worker; no new hosted target |
| H02 | Private route/Access policy and external rejection | BLOCKED: no approved target |
| H03 | workers.dev/previews disabled, no provider callback/send | VERIFIED for old Worker only, future target BLOCKED |
| H04 | Unauthenticated caller denied before D1 | LOCAL SYNTHETIC TEST, HOSTED BLOCKED |
| H05 | Wrong issuer/aud/expiry/operator rejected by trusted verifier | LOCAL SYNTHETIC TEST, REAL ACCESS BLOCKED |
| H06 | Worker D1 Binding points to approved disposable DB | LOCAL MINIFLARE TEST, HOSTED BLOCKED |
| H07 | Hosted Binding .first() correct synthetic fixture | BLOCKED |
| H08 | Hosted Binding .all() isolated registry lookup | BLOCKED |
| H09 | Duplicate/replay and concurrent claim | LOCAL TESTED; hosted BLOCKED |
| H10 | Encrypted fixture recovery/lease and stale ACK | B6 LOCAL TESTED; hosted BLOCKED |
| H11 | Hosted D1 failure returns fail closed | LOCAL NEGATIVE TESTED; hosted BLOCKED |
| H12 | Wrong installation/provider/store denied | LOCAL TESTED, real Store BLOCKED |
| H13 | PII/secret log and data audit | Local synthetic-only; hosted BLOCKED |
| H14 | Hosted traces, D1 rows, route and send audit | BLOCKED |
| H15 | Hosted rollback rehearsal with exact resources | BLOCKED |
| H16 | Cost budget and request cap evidenced | BLOCKED |

**No H01-H16 aggregate hosted PASS may be claimed.**

## 4. Precise approval required BEFORE hosted write/deployment

1. Cloudflare account ID, exact proposed NEW isolated QA Worker name and destination D1 database ID; either reuse preexisting disposable QA D1 with new namespaced tables or approve a newly priced resource.
2. Verified invoking principal/service, protected binding name/Access app, no public ingress, and method of independently checking caller identity.
3. Bounded one-time test window, maximum 20 synthetic calls, maximum 5 synthetic rows and budget; approval of any incurred charges.
4. Exact version SHA/source Git commit and dedicated nonproduction environment; no real provider token, no n8n credentials, no Commerce credentials.
5. Before-state D1 table inventory and deployment history, protected logs and rollback snapshot.
6. Explicit approval for which DDL/row mutations are permitted. No old canary/B3/B4 table rewrite.
7. Independent security reviewer and fail-stop conditions.
8. Who may execute rollback and whether deleting disposable rows is separately approved.

Without these fields, status remains **BLOCKED_NO_EXACT_TARGET_APPROVAL**.

## 5. Fail-stop and rollback

Stop immediately for wrong target DB binding, unexpected public route, missing auth, invalid principal, an actual provider event, any Commerce read/write, real customer data, wrong execution version, or insufficient cost budget.

Never call setWebhook or change Messenger/Zalo/Webhook URLs in B7. Rollback source-only B7 by closing/reverting the Draft PR; hosted rollback is undefined until resources are specifically approved.

Cloudflare documentation:
- https://developers.cloudflare.com/workers/runtime-apis/bindings/service-bindings/
- https://developers.cloudflare.com/d1/worker-api/prepared-statements/
- https://developers.cloudflare.com/cloudflare-one/identity/authorization-cookie/validating-json/

**Final gate:** HOSTED_CANARY_BLOCKED / PRODUCTION_NO_GO.
