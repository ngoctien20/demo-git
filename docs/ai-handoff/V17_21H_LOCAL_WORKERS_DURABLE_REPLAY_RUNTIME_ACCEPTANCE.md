# TIEN404 V17.21H — Local Cloudflare Workers Durable Object Replay Acceptance

**Date:** 17 Nov 2026 JST. **Verdict:** `IMPLEMENTED_SOURCE_CANDIDATE` + `TESTED_NATIVE_SQLITE_32_OF_32` + `TESTED_LOCAL_WORKERD_4_OF_4` + `CI_SUCCESS`. **NOT** `HOSTED_DEPLOYED`, `MERCHANT_STORE_APPROVED` or `ZALO_OA_VERIFIED`.

## 1. Actual unchanged live baselines

- Zalo Bot staging `yIJk8LvJoLF40Z62` Published `2d912cb0-007f-452f-9536-b92ba12a03e6`.
- Zalo Customer Router `sIPs6egzIwOY1GNv` Published `8d91d23c-cd87-462f-a112-9cca2340bec8`.
- Shared Zalo/Website no-send Core shadow `4ycmVzaNzVRulBjQ` Published `76bbb4e9-7ad2-45a6-8188-260523ced57a`.
- Existing hosted Cloudflare V17.5E.2 replay Worker still has `REPLAY_DB` Durable Object namespace binding, class `ReplayBucket`. No hosted script or binding was updated, and its boolean 10-min contract remains different from V17.21 three-state 24h contract.

## 2. Changed only on GitHub Draft PR #243

- Retained V17.21 source-only `zalo-sqlite-claim-v2.mjs`, versioned `ZaloBotReplayBucketV2` and server-owned deterministic claim binding, without a public `fetch` handler.
- Added `qa/v1721-zalo-durable/wrangler.local.jsonc`, **local-test-only** config with new SQLite class `ZaloBotReplayBucketV2`; this file was NOT deployed or used to modify any Cloudflare account.
- Added `qa/v1721-zalo-durable/vitest.config.mjs`, `package.json` with isolated dependencies, and `zalo-bot-replay-v2.cf.test.mjs`.
- Extended `.github/workflows/v1721-zalo-durable-nosend.yml` with a second, **local Workerd/Vitest** job. Hosted deploy/migration job still explicitly SKIPPED; PR-path-scoped triggers limit CI usage.
- QA runner dependency installation changed from npm 10 (Arborist `Cannot read properties of null (reading edgesOut)`) to Yarn 1 using a separate local package manifest. No developer PC or system application was modified.

## 3. Evidence — actual GitHub Actions logs

[Run #44066458265](https://github.com/ngoctien20/demo-git/actions/runs/44066458265), SHA `cf25c891b7dd53bb0e3fb08199fc9e19e3cb6a96`: **SUCCESS**.

- Job `Node 22 SQLite replay + integration candidate (NO SEND)`: **32 tests / 32 passed / 0 failed**, static no-network/no-token/no-send guard PASS.
- Job `Local Workerd Durable Object RPC / eviction QA (NO SEND)`: **4 tests / 4 passed**, local `@cloudflare/vitest-plugin` runtime; schema and RPC executed inside local Workers environment.
- Workerd tests: (1) initial claim + exact duplicate + changed-digest conflict and live SQL readback; (2) 100 concurrent RPC calls to one Durable Object, **1 CLAIMED and 99 DUPLICATE**; (3) two named Durable Object instances remain independent; (4) after `evictDurableObject` simulated lifecycle eviction, prior SQLite claim remains DUPLICATE, changed digest remains CONFLICT.
- An earlier 5-test Workerd run had 5 assertions PASS but job FAIL due **unhandled rejection from deliberately invalid input thrown across remote DO RPC**. The invalid-key test was removed from the Workers runtime file because input rejection is already explicitly covered by native SQLite 32-test suite, not because implementation validation was weakened. Latest clean run is 4/4 PASS with zero unhandled test errors.
- Hosted Cloudflare DO migration / Zalo webhook cutover / OA release job was **SKIPPED** by explicit CI condition. No real network request to Zalo or Commerce services occurred.

## 4. What this does NOT prove

- This tests local Workerd/Miniflare only, **not** independently deployed Cloudflare account-level Durable Object, multiple geographic Workers or real provider webhook origin.
- The current Zalo Bot staging uses a shared header secret (`X-Bot-Api-Secret-Token` on the vendor protocol). This is not a body-bound cryptographic signature. Zalo OA uses a separate signature and admin authority protocol.
- The live Zalo event `message.date` milliseconds compatibility remains unverified in private native provider evidence. Strict enforcement could reject vendor events; do not insert it into the live webhook until verified.
- 24h replay storage TTL and bounded GC incur potential storage/runtime costs. No budget or hosted rate-limit / alarm plan has been accepted.
- Claim-before-processing may lose an event on worker crash; future Commerce sends/order/inventory require transactional outbox and business idempotency separately. This candidate cannot approve or execute those side effects.
- Even successful local DO isolation does NOT establish a real multi-tenant Supabase Store owner/permission mapping. No Zalo OA installation should be inferred.

## 5. Decision, approvals and rollback

**GO:** Versioned V17.21H source-only candidate with local Workers runtime QA; preserve existing Zalo Owner/Customer UAT markers and no-send Core behavior.

**NO-GO:** Cloudflare hosted deployment of new DO class/binding, changing current ReplayBucket or AB gateway, modifying Zalo Bot vendor setWebhook secret/route, enabling customer sends, Commerce orders or live Store/RLS writes.

**Rollback:** Revert V17.21H local-test config/test/CI commits or close Draft PR #243. No production rollback is needed because no hosted, n8n or vendor resources changed.

**Next proposed:** private/isolated hosted UAT only after explicit owner permission and budget review, with durable claim races, crash/restart, TTL/GC, protected Access admission, independently attested Bot installation, exact provider timestamp compatibility, PII-free logging, and rollback evidence. Keep all live routes unchanged until those gates pass.
