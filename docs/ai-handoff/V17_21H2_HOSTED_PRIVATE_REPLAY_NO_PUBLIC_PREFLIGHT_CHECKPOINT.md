# TIEN404 V17.21H.2 — Private Hosted Durable Replay Preflight (no deployment)

**Date:** 2026-11-17 JST. **Status:** `IMPLEMENTED_SOURCE` × `TESTED_PREFLIGHT` × `BLOCKED_HOSTED_DEPLOYMENT`. This is NOT a hosted Durable Object acceptance. PR #243 must remain **DRAFT**, unmerged.

## Goal and safety boundaries

Run an isolated Cloudflare Durable Object Zalo replay canary without exposing a public workers.dev URL, preview URL, route, custom domain or customer traffic. Do not change the Zalo Bot webhook, existing `ReplayBucket`, Messenger, shared Core, Store permissions, account credentials, payments or any production data.

## VERIFIED before creating the candidate

- n8n Zalo Bot staging `yIJk8LvJoLF40Z62` unchanged Published `2d912cb0-007f-452f-9536-b92ba12a03e6`.
- Shared Zalo/Website Core Shadow `4ycmVzaNzVRulBjQ` unchanged Published `76bbb4e9-7ad2-45a6-8188-260523ced57a`.
- GitHub PR #243 OPEN DRAFT on `work/v171a-channel-store-bot-vertical-slice-nosend-20261117`.
- Existing Cloudflare account resource inventory after preflight: 29 Worker scripts and two Durable Object namespaces; exact new `tien404-v1721h2-zalo-replay-private-nosend-staging` **NOT present**, new `ZaloBotReplayBucketV2` namespace **NOT present**.
- Cloudflare connection can read Worker scripts, bindings and namespace metadata but GET `/billing/spend-policies`, `/billing/usage` and `/billable-usage/info` all return **HTTP 403**. Current billing spend policy/limits and remaining budget therefore **cannot be independently verified**.
- Official Cloudflare [Spend Management](https://developers.cloudflare.com/billing/manage/spend-management/) documents account-product spending limits for Workers and Durable Objects. A **Budget Alert** only notifies, does not stop usage; a product spending limit is shared across the account and may also pause existing TIEN404/BIO services. Do not change that limit without separate owner consideration.

## IMPLEMENTED, all GitHub Draft branch only

- `qa/v1721h2-hosted-private/wrangler.hosted.NO_DEPLOY.jsonc`: unique Zalo replay staging Worker name, `workers_dev:false`, `preview_urls:false`, `routes:[]`, observability disabled, exactly one **new** Durable Object class `ZaloBotReplayBucketV2` and SQLite `new_sqlite_classes` migration. This is an inactive candidate configuration, not the live account configuration.
- `qa/v1721h2-hosted-private/preflight.test.mjs`: 10 pure Node 22 checks covering no public/preview routes, no custom domains/cron, no credential fields, isolated class and migration name, no public Worker fetch handler, hashed only replay storage source.
- `.github/workflows/v1721h2-hosted-private-preflight.yml`: PR-path-scoped static test + **Wrangler `deploy --dry-run`** bundle validation. No Cloudflare credential is provided, no Worker is uploaded, and hosted upload/DO migration/real Zalo UAT job is permanently `if: false` until separately released.

## Actual QA and checkpoints

- [GitHub Actions run #44072985338](https://github.com/ngoctien20/demo-git/actions/runs/44072985338), SHA `3ead1d12d28606ecc7de77243d1cfd3f567845b3`: **SUCCESS**. 10/10 Node preflight tests PASS, static no-public route validation PASS, Wrangler dry-run bundling PASS, hosted deployment explicitly SKIPPED.
- Initial CI #44072759026: 10/10 Node tests PASS, Wrangler dry-run PASS; static scanner incorrectly matched the forbidden phrase in its own assertion. Corrected the test harness and reran cleanly. This was not a Worker code defect.
- V17.21H local Workerd tests were already completed prior to this task: 32/32 native Node SQLite and 4/4 local Workers runtime PASS in [run #44066458265](https://github.com/ngoctien20/demo-git/actions/runs/44066458265). These have NOT been elevated to hosted evidence.

## Hosted blockers requiring explicit resolution

1. **COST GATE**: Billing Read permission to verify the account's Workers/Durable Objects spending policies and any hard caps; or the owner independently provides the authorized spending envelope. Do not infer a $10 alert is a $10 hard cap. Cloudflare limit scopes **entire product across account**, not only this new Worker.
2. **PRIVATE INVOCATION GATE**: A no-public-URL Worker cannot be invoked via workers.dev. Plan a separately authorized private caller/service-binding or authenticated Cloudflare account-side SQL inspection. Direct SQL inspection through Cloudflare's authenticated Durable Object Query API validates hosted storage but **not** the end-to-end Worker RPC method and must not be mislabeled as such. Do NOT repoint live n8n webhooks or modify the preexisting A/B Gateway / Runner without their independent approval.
3. **DO MIGRATION GATE**: Creating a new SQLite-backed Durable Object class and namespace is an account-changing operation, may incur cost, and requires rollback. Avoid editing the existing `ReplayBucket` class / `REPLAY_DB` namespace.
4. **VENDOR GATE**: Header Auth is a shared secret, not an independent signed Zalo OA proof. Real provider `message.date` ms format, OA owner/admin authorization and Store RLS are still pending.
5. **STORAGE/RECOVERY GATE**: Confirm 24-hour TTL, bounded cleanup in idle instances, race/crash behavior, failure recovery and costs. Claim-before-business-write does not replace transactional outbox.

## Proposed hosted canary once gates are satisfied

1. Approve the named **isolated Worker only**, a small QA budget/call envelope and an internal invoker; verify no existing resources require modification.
2. Upload versioned V2 source without routes/preview, verify script `workers_dev=false`, `preview_urls=false`, no zones/custom domains, and no secrets or customer data.
3. Create the V2 SQLite class migration in the isolated script, snapshot generated class/namespace ID and billing evidence. No real Zalo ingress.
4. With a private authorized caller, execute ≤25 synthetic claims: first/duplicate/conflict, two installation partitions, bounded concurrency, restart/cold-start and expired cleanup. Expect 0 external messages, 0 model calls, 0 order/stock writes.
5. Verify deployed script hash, no public URL, actual durable claim SQL evidence, rollback ability. Keep script inactive or retire when testing completes as approved.
6. Only then propose a separate signed/no-send native provider compatibility test; **never** automatically connect this Worker to the production Zalo webhook.

## Actual changes / rollback

**Changes:** GitHub source/config/unit tests/CI and this checkpoint only. **Cloudflare changes:** none. **n8n changes:** none. **Provider sends and commerce writes:** zero. **Rollback:** revert V17.21H.2-only GitHub files/CI or close Draft PR #243. No Cloudflare, vendor or database rollback is needed for this preflight stage.

**Decision:** `GO_PREDEPLOY_PRIVATE_BUNDLE_CANDIDATE`; `NO_GO_HOSTED_UPLOADED`, `NO_GO_PROVIDER_CUTOVER`, `NO_GO_COMMERCIAL_ZALO_OA` until blockers are resolved.
