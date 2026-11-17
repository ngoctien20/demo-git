# TIEN404 AI — V17.4P-HOSTED.4B.4
## Independent Operator/Finance Authorization × Private Hosted Ledger Approval × First Inactive Upload Go/No-Go

**Date:** 2026-11-17 JST
**Parent:** [Draft PR #312](https://github.com/ngoctien20/demo-git/pull/312), exact `53dda238068039e1cc45336239eada7b0eacb9ad`. Verified parent QA: **380/380 PASS** (343 source, 16 local Workerd SQLite, 21 Chromium).
**Scope:** SOURCE ONLY / NO HOSTED RESOURCE CREATION / NO CUSTOMER DATA.

### 1. Cloudflare READ-ONLY reconciliation
At **2026-11-17T10:47:45.998Z**:
- `GET /workers/scripts`: **29 scripts**
- `GET /workers/workers?page=1&per_page=100&order_by=name&order=asc`: **29/29 Workers** (page_info total_count 29); includes unrelated `tien404-rpc16-merchant-evidence-inactive-staging`
- `GET /workers/durable_objects/namespaces?page=1&per_page=100`: **2/2** namespaces, each V17.5-owned (ReplayBucket and RunnerResults)
- Access applications: **2/2** (Pages staging and RPC16 Merchant Evidence Staging — DENY ALL); reusable Access policies: **0**; unrelated Worker domains: **1**.
- V17.4P target `tien404-v174p-private-qa-issuer` not found. Dedicated proposed ledger `tien404-v174p-private-permit-ledger` not found in this snapshot.
- Prior 28-Worker/1-Access inventory is **not eligible** for approval. All future signatures bind **a newly collected full resource inventory** at signing time; this one is already time-limited. No Cloudflare write, deploy, Access, secrets, DNS, subscription or billing change made in this phase.

### 2. Important architectural correction: TWO separate possible billed resources
1. `tien404-v174p-private-permit-ledger` (PROPOSED only): independently owned protected private ledger, future `V174PPermitLedger` SQLite Durable Object class, no public worker.dev/preview/routes, no public QA canary, exact operator-to-ledger service binding only after separate signed security approval. Local `V174PPermitLedgerLocal` is NOT a hosted gateway or private identity service.
2. `tien404-v174p-private-qa-issuer` (PROPOSED only): standalone candidate with `V174PReplayGuard` SQLite Durable Object, first upload **inactive** with no worker.dev, no preview, no routes, no triggers or provider sends. It does NOT receive binding to a real Commerce, production Messenger/Zalo or V17.5 namespace.

**Do not infer ledger approval from QA Worker approval** or share credentials/roles. Separate USD allocations required for both; finance must approve exact total and account-wide billing risks. No true hard cost cap per Worker/DO is available via Cloudflare account-wide spend limits. DO stored data fees and shared Workers Paid subscription may be excluded from limits.

### 3. Added source-only independent Finance and Ledger security gate
`qa/v174p-private-hosted/hosted4b4-independent-finance-ledger-gate.mjs`:
- Requires an existing valid **owner + security reviewer** Ed25519-signed parent permit for exact Git source SHA-256, immutable manifest digest, private operator email and an independently evidenced fresh full Cloudflare inventory.
- Requires an authenticated private broker **RS256/MFA operator JWT** bound to exact SHA-256 of the parent permit, correct subject, role and scope. Test broker keys are ephemeral and do not prove a real operator.
- Requires **two additional independent Ed25519 signatures**: Finance Approver and Ledger Security Reviewer, both over the same canonical finance packet. Finance signer must be separate from owner and original security signer; finance reviewer distinct from ledger security reviewer, **both by key ID AND actual SPKI public key bytes**. Matching identities hidden behind renamed key IDs are rejected.
- Signed packet must include account, TWO exact proposed Worker names, ledger class, Git SHA, parent permit digest, inventory digest, exact admitted operator subject hash, independent change window, positive QA Worker USD allocation, positive private ledger USD allocation, combined USD budget **<= 25** and QA allocation **<= parent owner permit's USD**.
- Explicit acknowledgement: account-wide spend risk, excluded DO storage charges, no hard invoice ceiling. Never modify account spending limit or billing plan automatically.
- Explicit denial of new public URL, `workers.dev`, preview, Access policy, secrets, model/provider sends, real Commerce, unrelated Worker or DO changes, auto-deployment, and public requests before Access = **zero**.
- Requires a short-lived <=15m signed finance approval with nonce and private out-of-band owner/finance/operator/reviewer authority, RBAC, rollback and isolation reviews. Caller-supplied `registered_out_of_band:true` is NOT actual authority; only an independent secured identity registry may supply records and logs.
- Even with all synthetic verification passing, the function returns `can_upload_qa_worker:false`, `can_create_hosted_ledger:false`, `mutations_executed:false`. It is not a deployer. No API clients/network in the module.

`qa/v174p-private-hosted/hosted4b4-independent-finance-ledger-gate.test.mjs`: 42 positive/negative source tests for signer separation, delegated funds, tampering, stale inventory, RTC expiration, ledger collisions, operator forgery, unsafe budget changes, provider sends and auto deployments.

`qa/v174p-private-hosted/hosted4b4-finance-ledger-approval.pending.example.json`: unsigned placeholder, no real identities, budget, tokens or private keys; flags always false.

### 4. Genuine GO/NO-GO matrix
**SOURCE/LOCAL GO (if exact SHA CI passes):** source-only Draft, 4-signer math and JWT synthetic tests, LOCAL real Workerd SQLite ledger and replay tests, local Chromium simulated Access, independent read-only Cloudflare inventory.

**HOSTED LEDGER FIRST UPLOAD NO-GO** until all:
- Owner account authority, independent finance, separate security reviewer, exact QA operator and rollback operator verified out of band with MFA and revocation by trusted systems.
- Owner+security and independent finance+ledger security signatures over fresh source, manifest, 29+ resource snapshot at signing, resources and separate cost/risk allocations.
- Dedicated ledger's **own** code, private access topology, mTLS/Access/Service Binding model, managed secrets policy, least-privilege RBAC and hosted security/rollback reviewed. Existing local code is only proof of SQL behavior, **not proof hosted ledger security**.
- Manual approved private deployment window; no public route/URL; no GitHub token or private key recorded; no change to RPC16/V17.5.
- Finance confirms whether uncertainty around uncapped stored-data charges is acceptable, and a way to monitor/stop exposure without disrupting other workloads. If strict dollar ceiling is non-negotiable, use a separate billed test account; **do not claim Cloudflare shared-account spend management provides strict per-resource enforcement**.

**QA WORKER FIRST INACTIVE UPLOAD NO-GO** until the ledger is independently deployed/protected/accepted, private MFA operator attested and owner/finance consent reissued for the **actual** current Cloudflare inventory. Never reuse a consumed nonce or invent a missing signature. An approval for hosted ledger does not implicitly authorize this Worker.

**HOSTED ACCESS + REAL BROWSER QA NO-GO:** Separate later approval for Worker-level Access All Traffic, exact permitted operators, negative unauthenticated and revoked tests. A URL must not go public to test it.

**PRODUCTION / PROVIDER / COMMERCE NO-GO:** No customer data, sends, payment or multi-tenant writes at this stage.

### 5. Rollback and parallel safety
- Current: close/revert this child Draft only. No Cloudflare rollback because no Cloudflare mutation was made here.
- A future authorized first upload must save signed preflight and independently fetched postflight Worker UUID/namespace IDs. Any unexpected addition, mutation, deletion, route or Access change => BLOCK further action and initiate independently approved rollback; do not delete existing V17.5 or RPC16.
- **Do not** publish `V174PPermitLedgerLocal` as an authenticated hosted service. The raw local SQLite class accepts internal HTTP without authenticating a real operator; it is safe solely under the dedicated *local-only* Wrangler config. Hosted gateway must enforce private identity and origin before invoking a durable claim.

### 6. Official sources
- https://developers.cloudflare.com/durable-objects/platform/spend-management/
- https://developers.cloudflare.com/workers/platform/spend-management/
- https://developers.cloudflare.com/workers/configuration/cloudflare-access/
- https://developers.cloudflare.com/durable-objects/examples/testing-with-durable-objects/
