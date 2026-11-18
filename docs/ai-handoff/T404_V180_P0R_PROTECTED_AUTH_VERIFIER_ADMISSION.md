# TIEN404 V18.0-P0R — Protected Server Auth Verifier Admission × Real Owner A/B Session Correlation

**2026-11-18 JST · SOURCE-ONLY CANDIDATE / SYNTHETIC QA ONLY / REAL OWNER A/B NOT VERIFIED / HOSTED UAT NO-GO.**

## Verified parent checkpoint

Continue existing Draft PR #385 and Issue #368, direct successor of P0Q at SHA 07480335f1525d16c1e5d60a23b37fdd31a005b6. The existing deployed Render FastAPI \`tien404-data-staging\` (service \`srv-dbphtas9v7es73bursrg\`, deployment \`dep-dbqj9plg1s2s73egr30g\`, deployed commit \`ab940a95dae8afdff426bc6ac71693833d5348ce\`) validates the bearer via Supabase \`/auth/v1/user\`, but current tenant APIs do NOT independently attest JWT \`session_id\` to a current non-revoked server Auth session, Access principal, owner consent, or canonical Store authority. P0Q live anonymous 401 test passed; it was not a real A/B user proof.

Read-only Supabase evidence from P0P/P0Q identified an eligible pair of two existing same-tenant owner accounts, with only one owner having a current-looking session record. The founder already confirmed the two accounts are different. No P0O private local A/B comparison receipt has been received; no real signed A/B JWT pair has been tested. Hosted \`public.stores\`, \`public.store_memberships\` and \`store_id\` on seven Commerce surfaces remain absent. These are separate readiness gates.

## What P0R adds now

- \`qa/v180-p0r/server-auth-verifier-admission.mjs\`: isolated pure contract engine. It is **not imported by the deployed FastAPI backend**, has no route, secret, credential collection, network call, disk persistence or receipt issuer. All Auth/Access/session/consent lookups are injected **trusted server-only ports** with synthetic implementations in tests.
- \`qa/v180-p0r/server-auth-verifier-admission.test.mjs\`: offline negative coverage using fabricated users, JWT-like strings, sessions, consent and Access evidence only. These **do not** constitute a real Auth verification.
- \`.github/workflows/v180-p0r-protected-auth-source.yml\`: fail-closed source safety and native Node unit tests, with no real credentials or hosted API calls.

The contract independently checks for each actor: (1) signed private Access proof and a trusted private Access→Auth identity binding, (2) cryptographically verified Supabase JWT claims with pinned issuer, \`authenticated\` audience/role, expiry, issue time, subject and session ID, (3) live Auth user fetched from the Auth server, (4) current non-revoked \`auth.sessions\` linkage to that exact subject and session, (5) active **owner** membership in the server-pinned tenant, (6) independent unexpired read-only consent. It rechecks active Auth session, owner and consent at correlation time; two candidate handles must refer to distinct subjects, distinct sessions, distinct Access principals, distinct consent handles, and the same server tenant scope and one-time pair challenge.

**Safety boundary:** the successful function returns an ephemeral *in-process opaque handle* and eventually the explicit status \`IN_MEMORY_PAIR_CORRELATION_CANDIDATE\`. It never emits raw identifiers, tokens or email in its public result. It explicitly returns \`serverPortsLiveVerified=false\`, \`signedReceiptIssued=false\`, \`storeAuthorityVerified=false\`, \`storeReadAuthorized=false\`, \`orderAccessAuthorized=false\`, \`providerSendAuthorized=false\`, \`productionApproved=false\`. An injected adapter or synthetic boolean is NOT evidence of real-world signed Auth, real consent, private Access or Store authority. The source must never be used as a standalone public endpoint.

## Remaining independent security/owner gates — all still NO-GO

1. Independently collect the already-planned **P0O private browser** A/B local comparison from the two existing authorized QA profiles, sharing only \`LOCAL_COMPARE_PASS\` or a non-sensitive blocked reason. No password, JWT, nonce, receipt or Auth identifiers in chat/GitHub.
2. Obtain explicit authenticated consent from **each** existing QA owner and an independent reviewer. Approve scope, retention period, revocation and private data protection; do not infer consent from a test flag.
3. Independently review/approve a **private HTTPS Access-protected endpoint**, signed Access assertions, trusted Access↔Supabase owner mapping, user/session backend adapter, a narrowly scoped server-managed privileged session lookup, rate limits, timeouts, audit/log redaction and per-actor consent. The current publicly reachable Render gateway must **not** receive these tokens until this is approved and tested. Avoid using \`service_role\` in browsers, CI, GitHub or n8n.
4. Build a private one-time challenge/receipt store with atomic consumption, TTL and replay protection; in-process handles are not sufficient for multi-request or distributed production. Secure server receipts must carry policy/build version and no-send scope; do not emit signed receipts in the current candidate.
5. Execute protected **real** A/B Auth verification under separate approval and prove current-session revocation behavior; independent Store ownership proof must be obtained from canonical trusted authority rather than tenant role or provider names. The 31 planned real JWT Store A/B negative read-only UAT scenarios are still **NOT_RUN**.
6. Before any hosted Store DDL/RLS/grant/membership/data migration, obtain separately authorized M0 backup/restore evidence and a rollback plan. The founder's M0 deferral applies **only** to source/read-only/disposable scope.

## Source-only QA/rollback

Run \`node --test qa/v180-p0r/server-auth-verifier-admission.test.mjs\` in an isolated environment. PASS means only that the synthetic decision engine behaves as expected. Do not call this \`REAL_AUTH_PASS\` or \`HOSTED_UAT_PASS\`.

No Supabase migration/DML, Auth account change, Render deploy, Cloudflare Access policy modification, credential or billing change, PR merge, n8n publish, Zalo/Messenger send or customer data operation was performed for P0R. To undo, revert the P0R source additions on Draft PR #385; no runtime rollback is required.

**Release decision: P0R_SOURCE_CANDIDATE_IMPLEMENTED / SYNTHETIC_UNIT_QA_TESTED_20_OF_20 / REAL_OWNER_PAIR_BLOCKED / PRIVATE_ENDPOINT_NOT_DEPLOYED / PRODUCTION_NO_GO.**

## Verified source-only QA evidence

- Exact P0R source checkpoint preceding this documentation-only update: `5311fb90a9c38d07e223af2f10dbbe2a56ff1e9c`.
- [GitHub Actions #44227578839](https://github.com/ngoctien20/demo-git/actions/runs/44227578839): SUCCESS; job `offline-admission-only` SUCCESS, static gate `P0R_OFFLINE_ONLY_NO_HTTP_NO_SECRET_NO_PRODUCTION_PASS`.
- Independently read job log: **20 tests, 20 passed, 0 failed** using fabricated objects and offline ports. All prior inherited core/source gates must still be interpreted separately; no real Auth users or JWTs were passed to CI.
- **NOT TESTED**: protected hosted endpoint, independent real Owner A/B signed JWT verification, Auth current-session revocation under live service, any canonical Store A/B RLS access, 31 real signed JWT no-send negative cases.
