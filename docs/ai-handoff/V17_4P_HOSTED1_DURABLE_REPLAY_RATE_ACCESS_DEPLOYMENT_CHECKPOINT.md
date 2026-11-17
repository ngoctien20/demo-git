# TIEN404 AI — V17.4P-HOSTED.1
## Durable Replay Hardening × Rate Limit × Access Deployment Admission
**2026-11-17 JST · SOURCE CANDIDATE · NO DEPLOY · NO LIVE CUSTOMER DATA**

### Origin / coexistence
- Parent: Draft PR #271, verified head `f0e22e4406091a82c17f28de0b35ba09b8336a22`.
- This child remains isolated from main, gh-pages, Cloudflare BIO, existing Workers/Pages, Published Messenger/Zalo/n8n, Supabase and real Commerce.
- **Cloudflare read-only verified**: 23 Worker scripts, no dedicated `tien404-v174p-private-qa-issuer`; 1 old Pages self-hosted Access app; 0 **reusable** Access policies; 0 Durable Object namespaces. Legacy app-scoped policies not counted as reusable.
- Existing V17.4P-HOSTED parent has 98/98 checks (77 offline source +21 simulated HTTPS Chromium). This is **not hosted UAT**.

### Scope source changes / behavior
- `hosted-issuer.worker.mjs`: session issuance and message handling now **require** a Durable Object admission request. All decisions fail closed; missing DO => 503, missing secret/JWT => previous denial, excessive requests => HTTP 429 with Retry-After: 60. QA token TTL remains 300s; no real Shop owner proof, no service provider/network calls or Commerce mutations.
- DO selection is per independently verified **Cloudflare Access subject**, after HMAC, not a globally shared object or a browser-provided tenant/store/bot. DOs are operator-scoped for QA only.
- `V174PReplayGuard`: atomic transactional rate counter + duplicate event key. Fixed 60-second buckets, **64 QA session issuances/min/operator** and **120 authorized QA message attempts/min/operator**, including duplicate attempts. No dynamic rate-limit override from browser or untrusted headers.
- Replay event keys include time-ordered expiry prefixes for bounded storage cleanup, event fingerprint, and HMAC event key. JWT message expiry must be in (now, now+300s]; stale/future claims rejected. Repeated same-body event => duplicate no action; changed-body event => conflict. Storage errors => fail closed.
- DO alarm scans no more than **128 keys/prefix/invocation**, deletes expired message and rate keys, reschedules for the next expiration or backlog. One alarm per operator DO; no periodic unnecessary alarm when no records remain. New SQLite-backed DO migration / hosted storage is **NOT** created.
- Existing `release-gates.mjs` now requires **4 additional hosted QA gates**: Worker Access all routes/previews, no Bypass/Everyone, actual hosted DO TTL alarm, actual hosted 429 rate limit. Source-only assertions never grant deployment.
- `access-deployment-admission.mjs`: pure **read-only** normalized Cloudflare evidence comparator. Requires separate Worker and dedicated Worker-target Access app/audience, reusable explicit-operator Allow policy (no Bypass/Service Auth/Everyone/implicit broad domain), protected workers.dev/preview and negative edge checks, secret bindings, SQLite DO, independent hosted concurrency/rate/TTL/browser evidence, cost and rollback approvals. Always returns `deploy_authorized:false` and `real_commerce_authorized:false`, even on synthetic all-true evidence.

### Tests added (offline only)
- `durable-replay-hardening.test.mjs`: 18 simulated transactional-storage checks, concurrency bursts, caps, conflict, expiry, bounded cleanup, alarm and store-failure negatives.
- `access-deployment-admission.test.mjs`: 19 Access admission / bypass / wildcard / authorization negative checks.
- `release-gates.test.mjs`: 2 additional gate regression tests, 18 total.
- `hosted-issuer.test.mjs`: 4 additional Worker-to-DO mapping/HTTP 429 and missing-DO negatives.
- Existing 21 local HTTPS Chromium assertions remain, with fake DO adapter compatible with new private protocol.
- GitHub Actions on this child branch runs new source tests while **real external hosted browser and public Commerce release stay SKIPPED**.

### Mandatory host admission & remaining risks (NO GO)
1. Create one dedicated QA Worker and verify Access scope **All traffic** on Worker itself, including all workers.dev, custom domain and previews. No Pages wildcard as proxy proof, no path bypass. Enforce exact Access audience / signed RS256 JWT.
2. Create reusable Access Allow policy for explicitly approved private QA operators only (not everyone/email-domain wildcard), with independent revocation and negative checks.
3. Create separate managed Secrets Store bindings and rotation plan for HMAC and pinned Access JWKS; confirm zero secret leakage.
4. Provision SQLite-backed DO namespace and `V174P_REPLAY_DO` binding, then independently test actual Cloudflare transaction/atomic replay under contention, alarm retention, 429, concurrent instances, restart/durability and cost.
5. Ensure upstream edge/WAF request controls for unauthenticated/high-cardinality attempts, trace/log redaction, alerting and bounded spends. Per-subject DO alone does not replace account-level abuse controls.
6. Perform real Access-authorized external TLS Browser Canary with synthetic Store A only and private operator session; test revoked operator, no alternate bypass and no external provider sends. Save redacted evidence, then delete operator browser state.
7. Never advance to real Shop A/B or cross-channel identity/orders without independent merchant domain owner challenge, Store owner/membership JWT-RLS, identity proof and explicit commercial release authorization.

### Status classification
- **IMPLEMENTED**: source logic, direct Worker rate gate, deterministic per-subject DO routing, TTL alarm cleanup, read-only admission comparator.
- **TESTED**: only when the child exact-head GitHub Actions test confirms all local cases; no real Cloudflare DO runtime evidence yet.
- **BLOCKED**: hosted Access, Worker/Secret/DO provisioning, actual browser canary, merchant Store-RLS.
- **PROPOSED**: cost-limited, owner-approved hosted rollout with isolated secret binding and reversible route.

### Rollback
Close or revert this child Draft; the parent #271 remains unchanged, and no Cloudflare resource has been mutated. Once separately deployed in future, operator must disable the QA Worker route, ensure Access protection remains until traffic ceases, then rotate/revoke secrets with scoped approval; do not delete persisted DO data without separate approval.

Sources:
- https://developers.cloudflare.com/workers/configuration/cloudflare-access/
- https://developers.cloudflare.com/durable-objects/api/alarms/
- https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/
- https://developers.cloudflare.com/cloudflare-one/access-controls/policies/
- https://developers.cloudflare.com/durable-objects/platform/pricing/
