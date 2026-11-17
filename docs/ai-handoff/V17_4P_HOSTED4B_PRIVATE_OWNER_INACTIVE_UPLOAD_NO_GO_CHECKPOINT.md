# TIEN404 AI — V17.4P-HOSTED.4B
## Private Owner/Operator Approval × Isolated Inactive Worker Upload Admission

Date: **2026-11-17 JST**  
Status: **PROPOSED, IMPLEMENTED SOURCE ONLY, HOSTED NO-GO**  
Parent: [Draft PR #286](https://github.com/ngoctien20/demo-git/pull/286) HEAD `103341cc547c0ba7b07d13243677877195e26edc`. Parent QA: **240/240 PASS** (211 source, 8 local real Workerd SQLite Durable Object, 21 local Chromium).

### 1. Live control plane inspected (READ ONLY, 2026-11-17 08:03:27 UTC)
- Cloudflare Workers/scripts: **28** scripts, no V17.4P Worker.
- Workers/workers: explicit `?page=1&per_page=100&order_by=name&order=asc` returned **28 of 28**, avoiding earlier page-one-only count bug. No dedicated V17.4P Worker.
- Access apps: **1**, existing Pages app (destination `public`), not a Worker-specific all-traffic Access app.
- Reusable Access policies: **0**.
- Durable Object namespaces: **2**, respectively V17.5E.2 `ReplayBucket` and V17.5E.2A `RunnerResults`; both belong to a separate protected workstream.
- Worker domains: **1** unrelated existing binding.
- These counts are **snapshots**, not durable guarantees. Every future authorized deployment requires a newly retrieved **complete** control-plane inventory, independent comparison, and provenance attestation. Do not act on a stale 10-of-28 page.

### 2. Source-only deliverables
- `qa/v174p-private-hosted/wrangler.hosted4b.inactive.example.json`: minimal exact-key **proposal**, no public route, no workers.dev, no preview URL, no periodic triggers, **observability disabled**, QA-only variables; one dedicated new SQLite Durable Object class and migration; no Cloudflare account token, provider secrets, Supabase/n8n bindings or personal identifiers.
- `qa/v174p-private-hosted/hosted4b-inactive-upload-admission.mjs`: pure no-network/no-execution evaluator. Verifies exact minimal manifest, source SHA-256 against independently reviewed candidate, pinned Git commit SHA, existence of unchanged `V174PReplayGuard` QA fail-closed path, six fully enumerated Cloudflare control-plane collections, separately verified 2-of-2 owner/security Ed25519 signatures and approved cost/operator/rollback gates. Do not call Cloudflare writes, git merges or deployment commands from this source.
- `qa/v174p-private-hosted/hosted4b-inactive-upload-admission.test.mjs`: test fixtures are synthetic, not actual owner authority. Confirms any changed route, binding, secret var, hidden trigger, new external provider endpoint, source drift, missing signatures, missing private budget or incomplete inventory is rejected.
- `qa/v174p-private-hosted/hosted4b-owner-operator-approval.pending.example.json`: **unsigned** approval template that explicitly sets deployed resources, cost allowance and operator rights to false/null; no actual identities or keys.
- Dedicated source CI job extensions; real hosted external Access/browser and real Commerce Store JWT/RLS remain manually blocked and **SKIPPED**.

### 3. Critical phase separation and real deployment conditions
**Preparation (authorized to continue):** GitHub isolated Draft, source review, unit/Workerd/Chromium LOCAL QA, read-only Cloudflare GET. No AWS/Supabase/n8n/Commerce or Cloudflare account changes.

**INACTIVE_UPLOAD_ONLY — NOT YET AUTHORIZED:** Uploading a Worker with `workers_dev:false`, `preview_urls:false` and `routes:[]` can create a new Cloudflare Worker and a new billed SQLite DO namespace and change account-level resource inventory, even with no public route. It requires a separate exact-scope **private authorization** for target name/account/identity, USD envelope and acknowledged storage/spend risks, independently signed by owner and security reviewer. This phase must not attach secrets, public hostname, service bindings, Messenger/Zalo, n8n, Supabase or production routes, and must not reuse any V17.5 resource. Immediately after a future approved inactive upload, verify via control plane that the new Worker and DO are exactly the approved names, no previews or routes exist, and that all preexisting V17.5 resource IDs are unchanged.

**All-traffic Access + private origin — NEW AUTHORIZATION:** A separate approval gate configures Access on the dedicated **Worker UUID** with `destinations:[{type:'worker',worker_id:...}]` (not `preview_worker`, `public` or `all_workers`). Access allows only exact privately verified operators, no bypass / everyone / broad email domain. Validate true Access JWT audience/JWKS, independent unauthenticated/revoked operator negative tests, then and only then expose a QA endpoint. Do not enable public URL before Access protection.

**Real Cloudflare UAT — NEW AUTHORIZATION:** Bounded manual operator test, maximum 96 HTTP requests, synthetic no-send only, real Cloudflare Durable Object persistence, alarm cleanup and Replay/429, independent browser/edge evidence, private redacted logs. No model calls, provider sends, customer data or real Commerce.

### 4. Risk, cost, rollback
- Workers and DO spending limits are **account-wide**, can interrupt unrelated production, do **not** guarantee a hard max invoice, and exclude certain stored DO data charges; never modify them without separate explicit cost approval.
- Capture a V17.4P-specific rollback plan and operator signoff before any resource write; isolate target Worker/namespace. Do not delete existing V17.5 namespaces/scripts for rollback. Owner must specifically authorize destructive rollback of any new QA data if needed.
- GitHub rollback today: close/revert **this child Draft only**. No deployed Cloudflare resource exists from this workstream; no Cloudflare rollback necessary.

### 5. Required private owner decisions before creating ANY resources
1. Confirm **existing shared Cloudflare account** or separate QA account, with acknowledgement that V17.5E.2/A already occupy the shared account.
2. Confirm exact **maximum incremental USD cost exposure** and separate stored DO data charges understanding; default is **no approval**.
3. Provide **precisely authorized private QA operator identity** and an independently verified **security reviewer**, using a private authenticated channel, not this public GitHub repository. Do not share private keys, tokens, identity documents or customer data in the chat/PR.
4. Approve dedicated Worker `tien404-v174p-private-qa-issuer`, *new* isolated `V174PReplayGuard` SQLite DO, and **inactive upload only**. The future QA hostname/Access and actual UAT are separate scopes.
5. Independent review of rollback owner, source SHA-256, exact Git SHA, new DO namespace creation / cost and Cloudflare permissions.

Until these decisions are explicitly confirmed with verifiable records, the admission object always returns `can_deploy:false` and no tool should create Worker/DO/Access/secret/route.

### 6. Developer references (Cloudflare current documentation)
- Worker-level Access All traffic: https://developers.cloudflare.com/workers/configuration/cloudflare-access/
- Wrangler configuration, `workers_dev=false`, routes and environments: https://developers.cloudflare.com/workers/wrangler/configuration/
- Workers spending management: https://developers.cloudflare.com/workers/platform/spend-management/
- Durable Objects spending management: https://developers.cloudflare.com/durable-objects/platform/spend-management/
