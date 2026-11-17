# TIEN404 AI — V17.4P-HOSTED.3
## Isolated Real Workers Runtime × SQLite Durable Replay/Rate/Alarm Acceptance

**Date:** 2026-11-17 JST  
**Status:** IMPLEMENTED + TESTED IN LOCAL CLOUDFLARE WORKERS RUNTIME · NO HOSTED DEPLOYMENT · NO PRODUCTION CHANGE

### 1. Source chain and fixed scope

- Parent Draft: [PR #276](https://github.com/ngoctien20/demo-git/pull/276), HEAD `de46ad2ece36bc67002597e9280c47424c17ec53`, 173/173 source + local Chromium.
- Child Draft: [PR #280](https://github.com/ngoctien20/demo-git/pull/280), `work/v174p-hosted3-workers-runtime-do-replay-qa-20261117`; based exactly on parent SHA, not on main or gh-pages.
- This child adds a test-only package under `qa/v174p-private-hosted/runtime` and one extra GitHub Actions job. Root website package.json, Supabase, Published n8n, customer data, existing Workers, Access, DO and credentials are unchanged.

### 2. Confirmed live Cloudflare account divergence (READ ONLY)

The current control plane now reports **27 Worker scripts** (formerly 23), **10 modern Worker entities**, **1 Access app** (legacy Pages), **0 reusable Access policies**, **1 DO namespace** (formerly 0). Inspecting names and identifiers showed these **new scripts**:

- `tien404-v175e1-private-issuer-nosend-staging`
- `tien404-v175e2-ab-gateway-nosend-staging`
- `tien404-v175e2-durable-replay-nosend-staging`
- `tien404-v175e2-installation-registry-nosend-staging`

The new DO belongs to the **V17.5E.2** replay worker (`ReplayBucket`); **NOT** to V17.4P. Its persisted data, secrets and config were not examined, invoked or altered. An existing parallel workstream is active: avoid collisions, never reuse that namespace for V17.4P, independently reconcile all source/version identifiers before any new production or hosted acceptance.

**V17.4P dedicated issuer Worker still ABSENT**, its Access app and SQLite DO namespace still ABSENT.

### 3. Real Workers local runtime QA design

- `runtime/package.json`: isolated test-only package, directly pins `@cloudflare/vitest-plugin@1.8.3` and `vitest@4.1.0`.
- `runtime/wrangler.jsonc`: dedicated local-only Workerd runtime with `workers_dev=false`, `preview_urls=false`, no routes, SQLite `new_sqlite_classes` migration, no Access keys, no Cloudflare API credentials.
- `runtime/worker.mjs`: reexports the **unchanged actual** `V174PReplayGuard` implementation from `../hosted-issuer.worker.mjs`.
- `runtime/tests/replay.runtime.test.mjs`: 8 tests run with real Cloudflare Workers runtime using SQLite-backed Durable Object storage:
  1. Concurrent 16-way same-key claim results in exactly one first claim + 15 duplicate outcomes.
  2. Same event key with changed fingerprint remains a conflict.
  3. Per-DO 64 session rate gate; request 65 rate-limited; second DO independent.
  4. Persisted replay survives a true local Durable Object eviction and recreation.
  5. SQLite-backed object storage and scheduled alarm exist.
  6. Running a real local alarm removes expired entries and preserves live entries.
  7. Cleanup backlog of 140 entries is bounded to 128 first alarm and 12 second alarm.
  8. Expired direct claim denied before storage mutation.
- Local testing now exercises Worker API compatibility in actual Workerd runtime, **not** an artificial JavaScript in-memory storage class. It still does **not** prove deployed Cloudflare namespace persistence or production latency/cost.

### 4. Exact run QA evidence

On `ea10824ac10b52808567db6aa7aed3534d457e5c`:
- [GitHub Actions run #44035610943](https://github.com/ngoctien20/demo-git/actions/runs/44035610943) — source job **152/152 PASS**; isolated Workerd SQLite DO job **8/8 PASS**; mobile Chromium TLS **21/21 PASS**. **181/181 total**, 3 jobs SUCCESS, 2 intentionally SKIPPED (real hosted Access UAT and real Commerce release).
- A prior CI attempt failed at dependency installation on Node 22/npm 10 because of npm's known peer resolver `edgesOut` error. The isolated test job alone was updated to Node 24/npm 11, and the full runtime QA rerun passed. Original failure remains available in Actions audit history; none of these CI runs deployed any Cloudflare resource.
- No provider sends, real orders, model calls or external hosted Browser session.

### 5. Remaining blocked / approval

**BLOCKED — V17.4P real hosted:** proposed Worker, private operator Access app, reusable Allow policy, Secrets Store bindings, dedicated SQLite DO namespace, verified route, signed Access audience/JWKS, real external browser and actual deployed-alarm retention/recovery/cost acceptance. Current 1 DO namespace is **V17.5E.2**, not a substitute.

Before deploying any Cloudflare resource:
1. Explicit owner approval for exact **V17.4P** script name, account, QA operators, route/host, budget and permissions; confirm workstream coexistence with V17.5E.2 (no shared DO/keys/routes).
2. Decide separate QA account vs current shared account, with awareness account-wide Workers/DO spending limits can block existing services; DO stored data is not absolutely capped by these limits.
3. Add dependency lockfile/reproducible npm CI packaging or attested equivalent for a stronger supply-chain gate. Current direct test dependencies pinned; npm transitive versions are not locked in Git.
4. Test independent Cloudflare-hosted replay/TTL/429, revoked Access operator, edge negative, browser canary; verify rollback operator before enabling a public route.
5. Preserve merchant Store/RLS/Commerce as a separate no-go until independently proven Store ownership and customer identity.

### 6. Rollback

Close/revert only Draft PR #280 or its commits; **zero hosted resources created or modified by this branch**. Do not delete the unrelated V17.5E.2 DO, edit existing Workers, alter account-wide billing limits or promote any QA bot to production.

### 7. Technical references
- Cloudflare testing with real Workerd/DO: https://developers.cloudflare.com/durable-objects/examples/testing-with-durable-objects/
- Cloudflare DO eviction helper: https://developers.cloudflare.com/changelog/post/2026-06-25-durable-object-eviction-test-helpers/
- Cloudflare Worker-level Access: https://developers.cloudflare.com/workers/configuration/cloudflare-access/
- Cloudflare DO spend management: https://developers.cloudflare.com/durable-objects/platform/spend-management/
