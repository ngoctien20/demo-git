# TIEN404 V17.20 — Zalo Bot Webhook Provenance × Atomic Replay Admission Candidate

**Checkpoint date:** 2026-11-17 JST. **Release verdict:** `SOURCE_IMPLEMENTED` + `54_OF_54_NODE_TESTED` + `CI_STATIC_GUARD_PASS`, **NOT** Published Zalo replay enforcement, **NOT** verified Zalo OA provider signature, **NO GO** for Zalo commercial customer replies.

## 1. Actual system verification before/after work

Rechecked via connected n8n after source/QA changes. No n8n credentials, workflow nodes, webhook routing or data were modified in V17.20.

| Workflow | ID | PUBLISHED version preserved |
| --- | --- | --- |
| Zalo Bot staging | `yIJk8LvJoLF40Z62` | `2d912cb0-007f-452f-9536-b92ba12a03e6` |
| Staging Customer Router | `sIPs6egzIwOY1GNv` | `8d91d23c-cd87-462f-a112-9cca2340bec8` |
| Technical Zalo/Website shared Core Shadow | `4ycmVzaNzVRulBjQ` | `76bbb4e9-7ad2-45a6-8188-260523ced57a` |
| Central Commerce Core sandbox | `iyfGUiEsZlNTBWOR` | `456862c9-e5ee-4bfa-9931-47dbc39ab73d` |
| Messenger LIVE DEMO QA route | `Z7FdV7uDvApfbURQ` | `1064b1b3-d3f1-4a6b-a367-2414ba691522` |

Prior V17.19R non-Owner Zalo Bot EXT03 correctly emitted `CUSTOMER_ROUTE_ELIGIBLE`, Owner gate denied for nonowner, central Core shadow #5014 → #5015 rejected unbound merchant Store with zero model, Catalogue or provider sends. Do not repeat user messages or reinterpret customer-route acceptance as commercial Store ownership.

## 2. Source of truth: Bot Header Auth is not OA body signature

Consulted Zalo Platform official docs as of 2026-11-17:

- https://docs.zaloplatforms.com/docs/BOT/apis/setWebhook — Bot `secret_token` (8–256 characters) is sent as `X-Bot-Api-Secret-Token`. It is a **shared header secret**, not a cryptographic MAC over every body.
- https://docs.zaloplatforms.com/docs/BOT/webhook — method POST, JSON, Bot secret header and `message.message_id`, sample `message.date` in milliseconds. Existing V1 staging acknowledges the webhook after headerAuth, but does **not** implement an independently verified durable atomic replay claim in the current ingress path.
- https://stc-developers.zdn.vn/docs/v2/official-account/webhook/tin-nhan/su-kien-nguoi-dung-gui-tin-nhan — merchant OA webhook uses **different** `X-ZEvent-Signature` and requires separately trusted App/OA binding and OA OAuth. It is incorrect to reuse Bot Creator header authentication as signed OA authority.

Limits: If the Bot shared secret leaks, header authentication and a simulated timestamp check alone are **not** independent provider-origin proof. Bot token handling and secret rotation remain governed by separate owner approval; do not read or print credentials or invoke `setWebhook` against the live vendor.

## 3. IMPLEMENTED in GitHub Draft PR #243 only

Files added in `qa/v1720-zalo-replay/`:

- `zalo-bot-replay-gate.mjs`: `admitBotEvent` shadow-only admission API. Requires server-owned proof that incoming Header Auth was checked, trusted allowlisted installation `STAGING_ONLY`, read-only/no-send mode, validated human private text, numeric millisecond `message.date`, 5-min past / 2-min future window, HMAC-keyed replay identity and payload digest without storing raw chat/customer fields, and mandatory atomic claim adapter. Returns `ACCEPTED_SHADOW_ONLY`, `DUPLICATE_NOOP`, or `DENY`; all outputs disable sending, Commerce writes and model calls, with provider/merchant authority unverified.
- `zalo-bot-replay-gate.test.mjs`: **54** native Node.js built-in tests including identical replay, same-ID conflicting text/recipient/sender/time, 25 concurrent same-event submissions, forged Store/bot/admin authority, clock skew, missing event date, invalid Bot/route authorization and backend failure. In-memory Map is **QA ONLY**, not durable across processes or nodes.
- `README.md`: contract, official protocol references, no-send scope, proposed durability/storage/rollback gates, at-most-once crash caveat.
- `.github/workflows/v1720-zalo-bot-replay-nosend.yml`: bounded Node 22 unit tests and static code/no-secret/no-outbound guard; hosted-release job intentionally **SKIPPED**. CI triggers are limited to PR path changes to avoid running the same test twice on push + PR.

## 4. TESTED evidence, including QA remediation

- Initial workflow YAML parsing failed because a `Blocked:` string in a bare scalar was parsed as YAML syntax. Fixed without executing real service calls.
- A subsequent workflow run proved the full Node test suite **54/54 PASS**, but its static guard mistakenly treated the intentional literal `fetch(` inside a test assertion as a real network API. Fixed to inspect the implementation module for forbidden outbound APIs and restrict test module imports separately.
- **GitHub Actions run [#44059983581](https://github.com/ngoctien20/demo-git/actions/runs/44059983581), SHA `4d5919d556a01d4df0ad587642185baf4b046593`: SUCCESS.** Verified job logs: **54 tests, 54 pass, 0 fail**, static source-only/no-provider-client guard PASS, hosted release SKIPPED.
- Independent current-source CI runs [#44060361845](https://github.com/ngoctien20/demo-git/actions/runs/44060361845) (pull_request) and [#44060347467](https://github.com/ngoctien20/demo-git/actions/runs/44060347467) (push) on README commit `225a06d8eda41221d4f2d47ab75af8bcb9f27a8e`: both **SUCCESS** (54-unit test and no-send source guard verified on the PR run), host-release job SKIPPED.
- After these successes, only the workflow CI triggers were changed to avoid duplicate push and PR runs; no module logic or tests changed. Do not attribute the earlier CI run to a newer head SHA without its own run evidence.

## 5. Blockers / high-priority next work

1. **BLOCKED hosted replay** — the candidate only defines `claimAtomic` interface and a QA Map. Do NOT place that Map in Cloudflare Workers/n8n production. Inspect and reuse any independently approved existing TIEN404 Durable Object replay service or a transactionally unique PostgreSQL claim, not a new parallel backend. Require crash/retry, key expiration/rotation and cross-instance concurrency evidence.
2. **BLOCKED actual provider-time compatibility** — official sample includes `message.date` in milliseconds, but current live Zalo Bot staging normalizer does not retain/verify it, so actual fields cannot be independently read back from PII-free markers. Before live enforcement, collect a private, non-PII `has_date_ms` acceptance with owner approval; do NOT assume every event has the field or block real traffic blindly.
3. **BLOCKED native Zalo OA** — independently verify OA owner/admin authorization, app ID, OA ID, webhook body signature with the documented exact bytes, OAuth v4 and Store ownership; no real OA installation exists in this acceptance.
4. **BLOCKED merchant Store** — real Supabase Store/RLS/owner proof, live merchant Catalog and binding all remain separate from `STAGING_ONLY` Zalo Bot.
5. **PROPOSED** a staged integration canary using a private dedicated ingress/runner once atomic service and real non-PII event-time compatibility have passed. Keep production Bot webhook unchanged until independently reviewed.
6. **At-most-once caveat** — atomic event claim alone does not guarantee downstream completion if a worker crashes between the claim and business action. Any future order/notification action requires a transactional outbox and per-business-event idempotency. Not part of this source-only QA.

## 6. Approval, rollback, checkpoint

- NO additional owner approval required for source-only additive code and synthetic GitHub QA already authorized in the project. **Fresh scoped approval required** to deploy a real replay ingress proxy, modify vendor webhook routes/secrets, change hosted Store DB permissions/production traffic, enable Zalo outbound, or alter business Orders/stock/payment.
- Rollback: close Draft PR #243 or revert V17.20-only files/CI. **No n8n Published version rollback required** because none was touched.
- PR remains **DRAFT / UNMERGED**. Next action: audit an existing hosted atomic replay asset with read-only connector and require compatibility gate, rather than create a duplicate service or falsely declare production anti-replay complete.


## 7. Additional VERIFIED read-only Cloudflare asset reuse audit

The connected Cloudflare account was queried using read-only GET on Worker script listings, settings and deployments after the V17.20 source-only CI; **no deployments, route changes, secret reads/updates, provider sends or Durable Object writes** were made.

**Existing private/QA staging chain VERIFIED via deployed Worker service bindings:**

1. `tien404-v175e2a-private-hosted-runner-nosend-staging`: service binding **`QA_GATEWAY` → `tien404-v175e2-ab-gateway-nosend-staging`**; also `RUN_STATUS` Durable Object class `RunnerResults`.
2. `tien404-v175e2-ab-gateway-nosend-staging`: service binding **`REPLAY_LEDGER` → `tien404-v175e2-durable-replay-nosend-staging`**, plus `INSTALLATION_REGISTRY` service binding → `tien404-v175e2-installation-registry-nosend-staging`. Secret bindings exist but neither their values nor raw keys were retrieved or reproduced in this report.
3. `tien404-v175e2-durable-replay-nosend-staging`: **`REPLAY_DB` durable_object_namespace** binding to class `ReplayBucket`. Worker and deployment metadata present. The candidate therefore has **existing coordination infrastructure** to investigate before creating another replay service.

**Important limits:** The presence of Durable Object and service bindings is **NOT** proof that `ReplayBucket` exposes the V17.20 `claimAtomic({key,digest,expiresAtMs})` contract, uses durable unique claims, enforces stale/duplicate/conflict exactly once, or accepts the correct Zalo Bot ingress identity. Source/API, authenticated request path, namespace separation, TTL and concurrency/crash tests have NOT yet been independently matched to this candidate. There is no direct connection from the current n8n Bot V1 webhook to this Worker chain, and no such connection was introduced.

**Reuse priority:** Audit the existing `ReplayBucket` contract and published routing under a separate private no-send UAT; build only a narrow adapter if that contract is compatible. Do not create a new DO namespace/service or change the live `setWebhook` callback prematurely.
