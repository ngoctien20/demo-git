# TIEN404 AI — V17.4P-HOSTED.4B.3
## Private Operator Admission × Real LOCAL SQLite Permit Ledger UAT × Inactive Upload Readiness

**Date:** 2026-11-17 JST
**Parent:** Draft PR [#302](https://github.com/ngoctien20/demo-git/pull/302), exact head `b9992731e5878eacb0f0c0cd091439b7ce2a935a`, **345/345** source/local tests PASS.
**Status:** PROPOSED implementation + source/local runtime QA; HOSTED upload NO-GO.

### 1. READ-ONLY Cloudflare inventory changed during parallel work

At 2026-11-17T10:34:48 UTC:
- `GET /workers/workers?page=1&per_page=100` **29 of 29**, `GET /workers/scripts` **29**.
- **2** Access applications: existing TIEN404 Pages staging plus NEW `TIEN404 RPC16 Merchant Evidence Staging — DENY ALL`. Both returned destination type `public`.
- **2** preexisting V17.5 Durable Object namespaces (V17.5E.2 ReplayBucket and V17.5E.2A RunnerResults); **0** reusable Access policies; **1** unrelated Worker domain.
- Dedicated `tien404-v174p-private-qa-issuer` Worker, own Access, own DO namespace **ABSENT**.
- The previous Cloudflare 28-Worker inventory and 1-Access-app snapshot is **STALE** and must NOT be used as current permit evidence. Parallel teams may be provisioning RPC16 resources; do not delete/overwrite them.

No Cloudflare writes were made in this V17.4P phase.

### 2. Private Operator Admission (source-only)
New `qa/v174p-private-hosted/hosted4b3-private-operator-admission.mjs`:
- Verify RS256 signed JWT against an **externally pinned** RSA 2048+ private broker trust anchor; exact HTTPS `iss`, single `aud`, `kid`; reject JWT-supplied `jwk`/`jku`/`crit`/unknown algorithms, forged token or missing pinned independent registry.
- Exact operator `sub` and verified `email` bound to the signed owner's `deployment_operator_email`. Require a **fresh <=5-minute** sign-in, signed MFA claim `amr:['mfa']`, dedicated `qa_deployment_operator` role and `t404:qa:inactive-first-upload` scope, signed immutable permit SHA-256.
- Before calling any permit-ledger adapter, the operator token must pass. Even after passing, result is only `...PRIVATE_REVIEW_ONLY`; never `can_upload:true`.
- **Do not assume a normal Cloudflare Access JWT has these private broker MFA/scope claims.** No real trusted identity broker, real operator mapping, production JWKS or independent owner admission has been provisioned; all JWT acceptance in tests is synthetic and not real human proof.

### 3. DURABLE PERMIT LEDGER — actual local Workers SQLite (not browser mock)
New `qa/v174p-private-hosted/runtime/permit-ledger.local.mjs` exports **`V174PPermitLedgerLocal`**:
- Runs on the **actual LOCAL Cloudflare Workers runtime** via Cloudflare Vitest plugin, backed by SQLite Durable Object storage.
- Enforces SQLite `PRIMARY KEY (nonce_hash)` and `UNIQUE(account_id,worker_name,phase)`, denying **same nonce**, **different nonce/same target**, concurrent claims and reclaims after eviction.
- Dedicated object class and namespace added **ONLY** to `runtime/wrangler.jsonc`, not `wrangler.hosted4b.inactive.example.json`, not the actual `hosted-issuer.worker.mjs`.
- Stores only SHA-256 hashes of nonce/permit/operator subject, account, target, phase, timestamps and receipt; **no credentials, Access JWT, raw email, merchant data or payment details**.
- Receipt is proof of local SQL uniqueness, **NOT** a signed hosted billing/deployment authorization. Binding to a real hosted gateway would be a separately approved new infrastructure/security operation.

QA suite `runtime/tests/permit-ledger.runtime.test.mjs`: 8 local real SQLite DO cases including 20-way race, different permits/same target, surviving DO eviction, tenant/worker field rejection and forbidden routes/methods. It builds on existing 8 Workerd local replay tests. New Node test suite `hosted4b3-private-operator-admission.test.mjs`: 25 negative JWT forgery/MFA/time/scope/operator/permit cases.

### 4. HARD NO-GO for real Cloudflare inactive first upload
Do NOT modify live Cloudflare or claim hosted readiness until independently verified:
1. Real Cloudflare account ownership, separate authorized security reviewer, private identity broker and operator/rollback identity with revocation/MFA evidence; **not user-editable fields**.
2. Exactly signed positive **USD cost risk envelope**, DO data storage fees and shared account limit consequences acknowledged; no hard cap guaranteed.
3. Real **private durable permit ledger** with independent trust, nonce+first-target atomic commit, operator admission, private audit trail and controlled rollback. Local DO tests are not hosted proof.
4. Fresh **29+** Worker/Access inventory collected immediately before upload, no V17.4P name collision, no modification to RPC16 or V17.5 resources. Exact number may change; do not hardcode 29 as future expectation.
5. Single approved operator/manual phase-A upload with `workers_dev:false`, `preview_urls:false`, no route, no public URL, no Access/secrets/notification/model/Commerce bindings. Dedicated new SQLite V17.4P DO class, not shared namespaces.
6. Exact postflight Worker UUID/version, DO namespace, no routes/triggers/previews/public endpoints, no collateral changes independently checked. Live HTTP UAT requires **separate** Worker-level All Traffic Access approval and negative-edge tests.

All source code results still explicitly return `can_upload:false`. No automated deploy commands, Cloudflare tokens or credentials are added to CI.

### 5. QA / rollback / follow-up
- Gate source+local CI at exact child HEAD: Node source tests, Chromium HTTPS with synthetic Access, and actual **LOCAL** Cloudflare Workers runtime DO tests. Hosted/Commerce jobs intentionally SKIPPED.
- Failed tests must be fixed and rerun; preserve the failure in GitHub run history.
- Rollback this source-only child via close/revert Draft without affecting parent #302 or live resources. No hosted Worker from this workstream created.
- Future `V17.4P-HOSTED.4B.4`: Independently Authenticated Private Operator/Finance UAT × Dedicated Hosted Ledger Approval × First Inactive Upload Go/No-Go, **only** with an explicit scoped authenticated owner approval.

### Cloudflare official documentation
- https://developers.cloudflare.com/durable-objects/examples/testing-with-durable-objects/
- https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/
- https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/
- https://developers.cloudflare.com/workers/configuration/cloudflare-access/
- https://developers.cloudflare.com/durable-objects/platform/spend-management/
