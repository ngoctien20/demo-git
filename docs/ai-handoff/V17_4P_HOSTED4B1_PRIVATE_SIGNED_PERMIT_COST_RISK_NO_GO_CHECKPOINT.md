# TIEN404 AI — V17.4P-HOSTED.4B.1
## Verified Private Owner Approval × Cost-Risk Envelope × Inactive Upload Gate

**Date:** 2026-11-17 JST  
**Status:** IMPLEMENTED SOURCE ONLY; real owner/operator private identity and signature BLOCKED, real Cloudflare inactive upload NOT PERFORMED.  
**Parent:** [Draft PR #287](https://github.com/ngoctien20/demo-git/pull/287), exact HEAD `40682fbc38e63713e3a05d15c27d792bb7bb301a`; 272/272 local + source tests on successful CI.

### 1. Cloudflare READ-ONLY evidence
At 2026-11-17T08:13:35Z, Cloudflare control plane returned:
- 28 Worker scripts, 28/28 complete Worker entities (`?page=1&per_page=100`), all V17.4P target script/Worker absent;
- 1 Pages-only Access app, 0 reusable Access policies, 1 Worker domain unrelated to this QA worker;
- 2 DO namespaces belonging to **V17.5E.2 / V17.5E.2A**: `tien404-v175e2-durable-replay-nosend-staging_ReplayBucket` (`ReplayBucket`) and `tien404-v175e2a-private-hosted-runner-nosend-staging_RunnerResults` (`RunnerResults`). They are **protected**, not interchangeable with V17.4P.
All GET calls read-only. There were no Cloudflare account writes, workers.dev/Access/DO/DNS/secret/billing changes, and no hosted UAT calls.

### 2. Added source-level release admission
New `qa/v174p-private-hosted/hosted4b1-private-signed-permit.mjs` implements a **pure no-network** 2-of-2 Ed25519 signed Phase-A owner/security preflight with:
- exact **inactive** upload scope: target `tien404-v174p-private-qa-issuer`, new **V174P-only** SQLite Durable Object class, fixed Cloudflare account, no Web URL, no Cloudflare Access mutation, preview/workers.dev disabled, no provider/model/customer/Commerce calls, no secrets;
- signed exact Git commit SHA, source SHA-256, **canonical manifest digest**, complete Cloudflare inventory digest, fresh control-plane evidence (5-minute maximum age) and V17.5 resource continuity;
- two independent Ed25519 public trust anchors loaded from a separately secured owner/authorized security reviewer identity registry, **NOT from packet itself**, with identical canonical signed payload;
- exact individually authenticated private deployment/rollback operator emails, signed nonce checked in **external durable private ledger** (no replay), expiry maximum **15 minutes**;
- signed positive **incremental USD risk envelope <= 25**, and explicit understanding that Cloudflare Workers/DO spending limits are **account-wide, not hard spend caps** and do not include all Durable Object stored-data fees; do not modify shared spending limits;
- `max_external_requests:0` for Phase-A inactive upload; a later hosted Access/Browser phase must have its own separate scoped approval and limits.

**IMPORTANT SECURITY LIMITATION:** Offline tests with ephemeral signer keys and synthetic identity/ledger evidence do **not** verify a real human. A JSON field `registered_out_of_band:true` can be forged by someone controlling the input. A production executor must obtain the verified trust anchor, operator identity, inventory provenance, digest, nonce ledger and budget decision from an authenticated *separate trusted service*, never from the same editable PR payload. The module intentionally **always returns `can_upload:false`, `can_deploy:false`, `can_change_access:false`**, even when 2 signatures and all synthetic evidence are mathematically consistent. This cannot be used as a deployment API or authorizer.

New `hosted4b1-private-signed-permit.test.mjs` covers signature tampering, missing independent signer, invalid owner identity source, source/manifest drift, hidden service binding, V17.5 cross-workstream collision, stale inventory, duplicate operator, unsigned cost, wrong spend cap expectation, nonce replay attestation, expiry, no-external-HTTP and no-secret stage-A restrictions.

New `hosted4b1-permit.pending.example.json` is deliberately empty/unsigned, contains no real person or key and cannot give Cloudflare privileges.

### 3. GO/NO-GO and outstanding approvals
**SOURCE QA GO** (subject to exact final CI): source-only Draft, complete Cloudflare READ-ONLY control-plane inspection, local Workerd/SQLite and local HTTPS Chromium tests.

**HOSTED PHASE-A INACTIVE UPLOAD NO-GO** until ALL actual private evidence is collected outside the repository:
1. Independently verify the **real owner identity** against account authority, separate independently named security reviewer, and exact authorized deployment/rollback operator.
2. Owner approves exact target account, dedicated Worker and **new V17.4P-only DO**; scope is first inactive upload only. No production integration.
3. Owner explicitly approves a **positive incremental USD budget envelope** and accepts shared-account risk, possible DO storage charges and nonabsolute cost limit. This cannot technically guarantee a hard invoice cap. If strict hard cap is required, provision in a separately billed test account and review its billing independently.
4. Record private 2-of-2 signatures covering **exact source+manifest+inventory digests** with 15-minute expiry and anti-replay nonce bound to durable independent ledger, not user-editable flags.
5. Confirm rollback ownership, Cloudflare API least privilege and backup snapshots of preexisting V17.5 resources.
6. Immediately before any future authorized change, repeat all Cloudflare GET pages and compare the approved immutable inventory. If target Worker/DO/Access now exists, treat as collision **BLOCKED**; never overwrite another workstream's Worker.

**HOSTED ACCESS + UAT NO-GO** beyond this stage: Only after dedicated worker first-upload and separate Access All Traffic authorization (exact Worker UUID), per-operator allowlist, negative unauthenticated/revoked tests and private endpoint proof. No testing via unauthenticated URL; no provider sends, customer data or Commerce writes.

### 4. QA, operations, rollback
- Dedicated GitHub CI source job tests this new 45-case permit suite alongside prior 243 source tests, 8 local actual Workers/SQLite DO runtime tests and 21 local Chromium tests. Hosted and Commerce jobs MUST remain SKIPPED.
- Do not add automatic Wrangler/cloud CLI upload scripts, repository Cloudflare tokens, Access JWT, Secret Store keys or public hostnames in CI.
- Parent and other workstreams remain untouched; rollback now is **close/revert the new child Draft only**, no Cloudflare deletion.
- If a future private authorized inactive first upload occurs, record Worker UUID, version ID and new namespace ID privately, confirm public routes still disabled, verify exact source digest; separate owner approval required for destructive rollback.

### 5. Documentation
- https://developers.cloudflare.com/workers/configuration/cloudflare-access/
- https://developers.cloudflare.com/workers/wrangler/configuration/
- https://developers.cloudflare.com/workers/platform/spend-management/
- https://developers.cloudflare.com/durable-objects/platform/spend-management/
