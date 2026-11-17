# TIEN404 AI — V17.4P-HOSTED.4B.6
## Private Authenticated Evidence Intake Admission × Real Owner/Finance Authority Review × Hosted No-Deploy Control-Plane UAT

**Date:** 2026-11-17 JST.  
**Parent:** Draft [#320](https://github.com/ngoctien20/demo-git/pull/320), HEAD `497bc81a3aedc669b1052b85e59a0aa17ea2634a`, prior **467/467 PASS**.
**Decision:** `SOURCE/LOCAL IMPLEMENTED`, `LIVE CLOUDFLARE GET-ONLY VERIFIED`, `REAL PRIVATE INTAKE / OWNER + FINANCE / HOSTED UPLOAD NO-GO`.

### 1. Actual Cloudflare READ-ONLY UAT results (no deploy)
Cloudflare connector completed **GET only** at **2026-11-17T11:44:08.360Z**:
- Workers entities: **30/30** fully paginated; 30 scripts.
- Durable Object namespaces: **3/3**: two protected parallel V17.5 namespaces (ReplayBucket and RunnerResults) plus third parallel Zalo `tien404-v1721h2-zalo-replay-private-nosend-staging_ZaloBotReplayBucketV2`. No V17.4P namespace.
- Access apps: **2/2** (separate RPC16 Merchant Evidence Staging — DENY ALL and Cloudflare Pages); reusable Access policies: **0/0**.
- `GET /members?page=1&per_page=100`: **1 of 1 account members**; membership status `accepted`, role `Super Administrator - All Privileges`.
- `GET /roles?page=1&per_page=100`: first 100 of **200** role definitions. **NOT** an exhaustive role catalog and **not** evidence of a particular person.
- `GET /billing/spend-policies`: **FORBIDDEN** by current Cloudflare connector's authorization. We have **not** verified account spending policies, remaining balance, actual approved budget, or independent Finance role/consent.
- Target V17.4P QA Worker `tien404-v174p-private-qa-issuer` and prospective separate hosted ledger Worker `tien404-v174p-private-permit-ledger` both **ABSENT**.
- `mcp__Cloudflare__whoami` proves the current connector has an authenticated principal but **does not** attest that the caller is the independent real Owner, finance signatory, or operator for this exact change window. Connector principal data and raw Cloudflare member identity **were not written to this PR**.
- This is **real hosted Cloudflare control-plane read-only UAT**, not a successful **private authenticated HTTP intake** UAT, not a hosted Worker/DO acceptance and **not** any release approval.

**Inventory alert:** Previous 29/2 (Workers/DO) snapshot is stale. Some other team deployed the Zalo replay staging Worker/DO. This PR does not delete, reuse or interfere with it. No resource names or current counts should be hardcoded into future permits; refresh immediately before any independently authorized operation.

### 2. Source-only independent authority review
New `qa/v174p-private-hosted/hosted4b6-private-authority-readonly-uat.mjs`:
- Normalized **GET-only** Cloudflare snapshot contract, complete pagination, 60s freshness, exact Worker/script parity, distinct namespace names, and continuity of **three** protected V17.5/Zalo DO ownership class/script identifiers.
- Requires sanitized Member references as opaque **SHA-256**, accepted member status and **Super Administrator** membership for the principal an external private broker later attests to. **One Super Administrator alone is not Owner human proof or Finance approval**.
- Binds separate Owner, Finance, Operator, Rollback principal hashes, distinct subjects, separate positive QA and ledger USD risk allocations, exact owner and finance permit digests and current Cloudflare inventory digest into a **root-signed private authority witness** with 15-minute maximum validity and one-use nonce.
- Root key in TESTS is ephemeral: a caller-provided public key or JSON `registered:true` is never accepted as actual authority. Only an **independently provisioned private trust root and authenticated registry** outside GitHub/ChatGPT would ever establish real verified identity.
- Refuses `FORBIDDEN` billing spend policy checks and missing real spending evidence. Read-only Cloudflare billing permissions do **not** themselves equal explicit Finance consent.
- Even when all synthetic signatures pass: returns `SIGNED_READONLY_EVIDENCE_CONSISTENT_NOT_REAL_AUTHORITY` and permanently `can_provision_ledger:false`, `can_upload_qa_worker:false`, `can_deploy:false`, `mutations_executed:false`.
- No network client, no Worker create, DO create, secret, Access, production n8n/Supabase/Commerce, public URL or billing permission write in the module or CI.

New `hosted4b6-private-authority-readonly-uat.test.mjs`: 40 Node synthetic tests including forged root, no real billing visibility, stale/non-GET inventory, missing member page, fake user identity fields, reused principal, forged budget, target collision, missing or tampered V17.5/Zalo namespace owner/class and signed public-write prohibition.

New `hosted4b6-real-authority.pending.example.json`: **sanitized point-in-time** Cloudflare GET count/status with all actual approvals null, URLs/credentials absent and create/upload permissions false. Not a deploy manifest.

### 3. Real authorization limitations and GO/NO-GO sequence
**Real owner evidence** requires:
- Independently verified Cloudflare account member identity and binding from actual human principal/IdP login to signed Owner permit for exact repository source SHA, scoped Worker, target account, change window and rollback.
- Cloudflare Super Administrator is a **role**, not proof of ownership of the shop, Finance independence, or approval for resources with cost.

**Independent finance authority** requires:
- A separate verified Finance individual or legally authorized delegate with independent registration and out-of-band MFA; signed positive risk amount for **each** future resource and actual expected billing period.
- Either grant Finance an independently reviewed **read-only billing/spend-policies view** through authorized channels, or provide a finance-attested invoice/charge assessment through a restricted private process. Current spend-policy endpoint 403 => **NO-GO**.
- Cloudflare Workers/DO spending controls are shared-account and do **not** guarantee a per-resource hard cap; DO stored bytes can continue incurring charges outside some limits. No budget or subscription changes in this PR.

**Hosted private intake UAT:** still `BLOCKED` because no dedicated authenticated intake endpoint, private root registry, real MFA identities or active signed Finance approval has been provisioned. Do not re-label the control-plane GET UAT as the private intake UAT. A future approved intake must use verified Access all-traffic protection, explicit owner/finance roles, no raw Merchant documents or URL fetches, malware isolation and private evidence references only.

**Future sequential release (not permitted here):** (A) independent private owner+finance+reviewer approval of isolated ledger => separate inactive upload and independently reviewed postflight; (B) independently renewed consent and fresh inventory => separate QA Worker inactive upload. No public routes, previews or provider/Commerce sends.

### 4. QA, rollback and reporting
- Source/local CI must pass on exact current SHA, preserving 16 actual **LOCAL** Workerd SQLite Durable Object tests and 21 local Chromium simulated Access tests. Real hosted private intake browser and customer Store-RLS tests remain intentionally skipped.
- A negative test failed => fix and rerun; retain failed-run audit record. Never turn a synthetic signed test into an authority claim.
- Rollback: close/revert only child Draft; no Cloudflare or customer rollback required because this work made **GET only** and GitHub source commits.
- Evidence template, source and tests intentionally contain no real identity emails, invoice details, Access JWT, Cloudflare tokens, customer files or PII.

### Sources
- https://developers.cloudflare.com/billing/understand/billing-permissions/
- https://developers.cloudflare.com/fundamentals/manage-members/manage/
- https://developers.cloudflare.com/workers/configuration/cloudflare-access/
- https://developers.cloudflare.com/durable-objects/platform/spend-management/
- https://developers.cloudflare.com/workers/platform/spend-management/
