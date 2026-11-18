# TIEN404 V19.0-B6 — Private Hosted Worker Binding Acceptance Plan

**Date:** 2026-11-18 JST
**Status:** PROPOSED acceptance contract; NOT an executed hosted Worker Binding UAT.

## 1. Existing verified baseline and no-change rule

- Existing Cloudflare Worker under audit: tien404-v1723u-qa-inbound-locked-staging.
- Deployment ID: 8a43101c-39fa-40a0-a022-2528e54b2102.
- Version ID: 1d2666ac-3b4d-4fd2-9cba-0f05b65dd195.
- workers.dev=false, previews_enabled=false.
- Binding names observed: QA_CALLBACK_PATH, QA_CANARY_MODE, QA_CHALLENGE, QA_END_MS, QA_EVENT_DB (D1), QA_EVENT_PEPPER, QA_HEADER_SECRET, QA_START_MS. **Values were not exported.**
- Existing disposable QA D1 is tien404-v1822-zalo-qa-once-disposable, already contains B3 rate/claim tables and B4 synthetic registry; zero B5/B6 tables at the preflight.
- **Do not deploy over, change bindings of, or expose the existing Worker during B6.** Keep the V17.23U source snapshot unchanged.

Prior evidence: B4 tested D1 hosted SQL through REST, B5 tested D1 Binding through LOCAL workerd/Miniflare. Neither proves a Cloudflare-hosted Worker Binding request path.

## 2. Hosting and protection choice (requires approval)

Preferred *future* acceptance design: a private test-only Worker with no workers.dev, no preview URL, no public route and no provider callback. It is callable only by a verified operator over a pre-approved Cloudflare Access/application or a locked service binding whose invoking service identity is independently authenticated and allowlisted. An internal service binding is not, by itself, proof that a random caller is permitted.

The operator, account, Worker name, exact version, D1 binding/database ID, approved URL or service binding, allowed time window and rollback must be approved explicitly in the change request. The test must have its own budget caps, unique QA table prefix, no provider credential and no Commerce credentials.

Never treat only an Access header, browser-supplied JWT, Origin, Host, QA role, store ID, installation ID, or client IP as verified identity. For Cloudflare Access, validate the signature of the Access JWT, issuer, audience, expiration and operator allowlist through a trusted verifier; do not merely test for a header's presence.

## 3. Minimum observed evidence for hosted acceptance

H01 Read-only deployment/version before change matches the snapshot.
H02 Private hostname/route and Access policy verified: no unauthenticated public ingress.
H03 No workers.dev or Preview URL, no Zalo callback or Messenger route, no provider send permissions.
H04 Wrong/missing Access JWT rejected before D1 work.
H05 Wrong audience, issuer, expiry or operator allowlist rejected.
H06 Worker Binding connects to the exact approved disposable D1 database.
H07 D1 Binding .prepare().bind().first() returns the expected **synthetic** QA row from protected internal call.
H08 Worker Binding .prepare().bind().all() returns exactly one synthetic QA registry binding from a trusted server-side fixture.
H09 Duplicate event is idempotent per installation; concurrent claims yield one lease.
H10 Encrypted QA fixture can be replayed after simulated crash when a new valid lease exists; old lease cannot ACK.
H11 Failed D1 operation returns controlled 5xx/NO_ACK and does not claim success.
H12 Cross-installation and wrong provider/Store spoofing denied, without any Commerce read.
H13 No real customer text, identity, token or order data is logged or persisted.
H14 Logs, traces, D1 rows and Cloudflare deployment history inspected; no provider sends and zero order writes.
H15 Cleanup/rollback plan tested on disposable-only candidate, with no impact on old canary or published Worker.
H16 Test cost metering and limits verified, with no uncontrolled usage or automatic resource creation.

**All H01–H16 are NOT TESTED as hosted acceptance in B6.** They are proposed acceptance criteria, not evidence.

## 4. B6 current test vs hosted claims

- Current B6 source-only Worker always returns 423 and never connects a real provider.
- Local Miniflare D1 binding with synthetic fixture encrypt/decrypt is a good proxy test but cannot validate Cloudflare-hosted Access, WAF, TLS, Worker Binding routing or permissions.
- Previous B4 hosted REST SQL proves D1 database behavior, not the private Worker-to-D1 path.
- No hosted Worker URL, token, private session or credentials were requested/exposed in this workstream.

## 5. Explicit approval payload for future use (no secret values)

Approval should name:
- Exact QA Worker and account, and whether a new QA-only Worker may be created.
- Exact existing disposable D1, or approved new isolated database if necessary.
- Exact binding name, test window, operator Access policy and trusted caller.
- No public route or provider registration, no production traffic.
- Backup of current deployment/settings and table counts before any change.
- QA fixture names and expected row counts, request budget, timeouts.
- Allowed rollback resources and precise safety stop triggers.
- No expense or access/credential changes beyond the explicitly approved scope.

Without these details and approval the hosted Worker's status remains **BLOCKED_NO_EXACT_TARGET_APPROVAL**.

## 6. Stop and rollback criteria

Stop immediately on unknown Cloudflare version, unexpected route, unauthenticated access, wrong D1 binding target, cross-store response, production data access, missing lock/lease, any provider send, or any migration outside the approved QA schema.

Rollback must disable the QA test admission path and restore the prior Worker deployment/bindings; no customer records or old QA fixture tables may be deleted without additional approval. Source-only PR can be closed without cloud rollback.

**B6 current release decision:** PRIVATE_HOSTED_BINDING_UAT_BLOCKED / REAL_STORE_AUTH_BLOCKED / PRODUCTION_NO_GO.

Cloudflare official docs:
- https://developers.cloudflare.com/d1/worker-api/
- https://developers.cloudflare.com/workers/runtime-apis/bindings/
- https://developers.cloudflare.com/cloudflare-one/identity/authorization-cookie/validating-json/
- https://developers.cloudflare.com/workers/platform/limits/
