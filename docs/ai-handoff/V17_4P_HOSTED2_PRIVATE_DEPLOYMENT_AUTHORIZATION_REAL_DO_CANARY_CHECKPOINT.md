# TIEN404 AI — V17.4P-HOSTED.2
## Private Cloudflare Deployment Authorization × Real Durable Object Acceptance × External Access Canary
**Date:** 2026-11-17 JST  
**Status:** SOURCE/ADMISSION PREPARED · HOSTED NOT APPROVED OR DEPLOYED · NO LIVE CUSTOMER DATA

### 1. Baseline and live read-only control plane
- Parent: [Draft PR #273](https://github.com/ngoctien20/demo-git/pull/273), reviewed head `e97b837db5cd7ce7390923485cb724b72ece8134`. It had 120/120 offline security assertions plus 21/21 real Chromium over **local synthetic HTTPS**, total 141/141, **not hosted UAT**.
- Cloudflare read-only connector: **23** script names via `/workers/scripts`; **10** modern Worker entities with UUIDs via `/workers/workers`; proposed `tien404-v174p-private-qa-issuer` absent; **1** existing legacy Pages Access app, whose target is a Pages public URL; **0** reusable policies under `/access/policies`; **0** Durable Object namespaces.
- Real API shape matter: `/workers/scripts` identifies scripts by name (its `id` is not a Worker UUID). Worker UUID must be taken from `/workers/workers`. `/access/apps` includes **embedded `policies`**; reusable policy evidence comes from `/access/policies`. The child fixes a false-positive/false-negative-prone comparator: Worker UUID and app-embedded/reusable policies must corroborate before admission.
- Existing Pages, BIO Workers, production Cloudflare settings, GitHub main/gh-pages, n8n Published Messenger/Zalo, Auth/Render, Supabase and Store data remain unchanged.

### 2. Source-only deliverables
- `wrangler.inactive.example.json`: **phase A disabled-route candidate** — `workers_dev:false`, `preview_urls:false`, `routes:[]`, new SQLite-backed `V174PReplayGuard` Durable Object via `new_sqlite_classes`. Deliberately lacks Access issuer/audience, signing key, pinned JWKS and public origin; Worker would deny missing configuration. No commerce/provider/LLM bindings. DO creation and uploading the Worker are **not** authorized just by this config file.
- `hosted2-authorization-request.example.json`: all owner, operator, cost, Access and real test approval fields default **pending/false**; no real identity, secret or API token.
- `hosted2-inactive-admission.mjs`: local pure checker rejects route leakage, preview exposure, real Commerce bindings, any secret value in source vars, non-SQLite migrations, missing DO and automatic deployment. Even success returns `can_deploy:false`.
- `access-deployment-admission.mjs` updated to require real Worker UUID, **embedded app policies matching the reusable policy IDs and decisions**, not guessed `policy_ids`. Existing Access apps with legacy/non-reusable policies cannot qualify.
- `hosted2-real-do-behavioral-probe.mjs`: **manual only**, not called by CI. Requires existing real private Cloudflare Access login, ephemeral authorized operator Playwright state stored OUTSIDE Git, declared bounded-probe approval, actual Worker/DO binding independently attested and rollback already tested. The probe sends at most **96** QA-only HTTP requests and checks an unauthenticated Cloudflare Access redirect, 16 concurrent same-event claims (1 first, 15 duplicates), conflicting replay 403, per-subject session rate 429 and zero provider/model/order writes in response. All synthetic Store A. It **cannot** independently prove SQLite alarm deletion, crash recovery, exact Access revocation or Cloudflare billing.
- New offline tests for no-route source config and operator authorization/preflight; CI only runs offline/source and prior synthetic HTTPS Chromium suites; hosted UAT and real Commerce CI jobs stay SKIPPED.

### 3. Explicit deployment authorization gates (none satisfied)
1. **Named owner approval:** explicitly authorize one isolated QA Worker, one SQLite DO namespace/class, one dedicated reusable Access Allow policy and app, two managed secret bindings, operator-specific browser Access session, real DO bounded probe and a future public QA route — separately identify account and intended hostname. Authorization must be recorded privately; the editable JSON file never substitutes for a human approval.
2. **Spend approval:** choose monthly QA budget, maximum QA requests, operational alert contacts and whether this existing Cloudflare account's production Workloads can tolerate an account-level spending limit. As of November 13, 2026, Workers and Durable Objects spending limits exist but are **account-wide, not per Worker or per namespace**. DO stored data and subscription fees are excluded; metering/enforcement lag can exceed limits. Applying a low account limit could interrupt existing Workers. Prefer separate QA account or explicit operational risk acceptance. This project never modifies billing limits without permission.
3. **Phase A — disabled-route upload after approval only:** with an authorized operator, review `wrangler.inactive.example.json` and source SHA; upload isolated QA Worker **with workers.dev, preview URLs and custom routes all disabled**, then verify there is truly no public alternate route. This may create a billable DO namespace. Verify script ID, Worker UUID, new SQLite migration, binding class and safe-deny config. Revert without deleting data automatically.
4. **Phase B — Access before route:** attach an application to the **Worker entity UUID** with destination `worker`, not `preview_worker` or Pages wildcard. Choose **All traffic** and exact private operator allowlist via reusable Access policy; no `bypass`, `everyone`, `email_domain` broad access or service authorization fallback. Independently check Access audience/JWT; configure backend HMAC/JWKS via managed Secrets Store (never source/GitHub), verify rotation/revocation runbook, and enable only the approved private QA hostname/route.
5. **Phase C — real hosted UAT with operator:** prove negative unauthenticated request is blocked **at Cloudflare edge**, wrong audience/signature denied inside Worker, authorized QA can get a 300-second session, Store B and order operations denied, 16-way replay test produces exactly one first claim, changed replay rejected, rate 429. Verify no outbound provider send/model/Commerce and independent revoked-operator denial. Keep only aggregate/redacted evidence; dispose of private browser state immediately afterward.
6. **Phase D — real DO alarm/TTL evidence:** independently inspect the SQLite-backed object in an authorized Cloudflare development/QA observability context. Prove expired `e:` and `r:` records are removed by alarms, an interrupted worker can restart without changing replay decisions, and cleanup continues after backlog. **This is not performed by the manual browser probe.** Record DO resource UUID, deployment/version, dated evidence and recovery/rollback protocol. Do not expose raw Access subject IDs or stored fingerprints.
7. **Final review:** independent QA and security reviewer attests exact deployed SHA, all-route Access, spending risk, findings, negative edge cases and rollback. Even private QA GO **never** authorizes merchant Shop A/B customer/order access or provider send. Those still require trusted Store owner mapping, Store RLS and separate customer identity verification.

### 4. Running only the approved probe in the future (not executed here)
Operator prerequisites: Node.js, Playwright Chromium, a temporary local browser storage-state file from an **authorized private QA** Cloudflare Access login, and independently verified Access/DO deployment. Set these variables **locally** without committing credentials or displaying the state file:
```text
T404_V174P_ISSUER_ORIGIN=https://<approved-dedicated-private-qa-host>
T404_V174P_CANARY_APPROVAL=QA_NO_SEND_ONLY
T404_V174P_ACCESS_INDEPENDENTLY_VERIFIED=YES
T404_V174P_OPERATOR_CONFIRMED=YES
T404_V174P_NO_REAL_DATA=YES
T404_V174P_OPERATOR_STORAGE_STATE_FILE=<absolute-private-path-outside-repo>
T404_V174P_DO_ACCEPTANCE_APPROVAL=BOUNDED_REAL_DO_NO_SEND
T404_V174P_QA_MAX_REQUESTS=96
T404_V174P_REAL_DO_HOSTED_BINDING_ATTESTED=YES
T404_V174P_QA_ROLLBACK_VERIFIED=YES
```
After separate explicit approval, run:
```bash
node qa/v174p-private-hosted/hosted2-real-do-behavioral-probe.mjs
node qa/v174p-private-hosted/browser-hosted-canary.mjs
```
The probe intentionally stops if a rate-test minute boundary makes results inconclusive. This is safer than reporting a false pass. It never writes customer records or contacts a provider API. It **does** consume real QA Worker/DO requests, so execution requires its own approval and cost scope. Do not run in CI or with customer cookies. Prefer transient storage-state under restrictive filesystem permissions (0600 on Linux/macOS, restricted ACL on Windows).

### 5. Risks / QA / rollback
- **P0 external exposure:** no Access app means **NO GO**. An Access app for Pages does NOT secure a new Worker. Even signed Access JWT check inside Worker does not replace edge Access gate; protect **all traffic and previews** before enabling URLs.
- **P1 spend/account coupling:** a Workers spending cap can block existing production scripts. A DO cap does not cap stored data charges. A spend cap does not guarantee invoice total.
- **P1 DO alarm:** source/local simulation did not prove real Cloudflare alarm, crash recovery or storage cleanup. Manual evidence required.
- **P1 policy evidence:** live Access API may hide reusable policies depending on resource-scoped roles; missing read scope means BLOCKED, not presumed allowed.
- **P1 operator state:** browser cookie and storage state are private; never commit, log, email or upload to CI.
- **Rollback:** before any authorized hosted change snapshot current Cloudflare resource metadata and Git SHA. If private QA exposure suspected, disable the **QA route only** and preserve Access protection until traffic stops; then revoke/rotate scoped QA secrets with approval and retain redacted forensic evidence. Do not delete DO storage or change existing Pages/BIO/Commerce settings without separate explicit permission.
- **No actual deployment, new Access policy, Worker, namespace, secret or billing limit has been performed by this branch.** Draft PR alone grants no operator permission.

### 6. Documentation checked
- Cloudflare Worker-level All traffic Access: https://developers.cloudflare.com/workers/configuration/cloudflare-access/
- Durable Objects SQLite migration and alarms: https://developers.cloudflare.com/durable-objects/
- Workers spending limits: https://developers.cloudflare.com/workers/platform/spend-management/
- Durable Objects spending limits: https://developers.cloudflare.com/durable-objects/platform/spend-management/
- Secrets Store bindings: https://developers.cloudflare.com/secrets-store/integrations/workers/
