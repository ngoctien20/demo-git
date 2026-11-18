# TIEN404 V18.0-P0U — Protected Origin Admission × Server Session Verification × Authorized Owner A/B UAT

**2026-11-18 JST · SOURCE-ONLY CRYPTO QA / REAL OWNER UAT NO-GO / PRODUCTION NO-GO**

Parent checkpoint: Draft PR #385, P0T SHA 130302444ec4976583ffcbf5cd0fdce7cc3a6b81. This phase continues the current workflow without rebuilding backend or modifying Messenger/Zalo.

## 1. Fresh independent baseline (read-only)

- Render \`tien404-data-staging\` (srv-dbphtas9v7es73bursrg) remains LIVE at deploy dep-dbqj9plg1s2s73egr30g, source ab940a95dae8afdff426bc6ac71693833d5348ce, Auto Deploy OFF, public origin 0.0.0.0/0. No P0U file is loaded or deployed. Current FastAPI tenant data endpoints remain unchanged.
- Cloudflare Access inventory lists **4** existing applications, none protecting the direct Render origin. A Cloudflare proxy or CORS does NOT prevent direct origin bypass; any real endpoint would need origin-side signature verification and separately approved gateway/private origin controls.
- Supabase staging read-only aggregate: one tenant with two eligible owners, **only one owner with an auth.sessions record** (also one with unexpired-looking not_after). Distinct user accounts were confirmed earlier; no new account provisioning. No independent signed JWT pair or Owner A/B consent evidence has been received.
- Read-only schema inspection confirms auth.sessions has id UUID, user_id UUID, not_after timestamptz (nullable); this is a viable *lookup target design*, NOT authorization evidence. A database session row alone is NOT signed bearer possession, and session deletion/revocation must be rechecked at decision time.
- Canonical public.stores / store_memberships and Commerce store_id columns remain absent in prior/current audits; zero live Store authority granted. 31 actual signed JWT Store A/B UAT scenarios remain **NOT_RUN**.

## 2. Source-only P0U implementation

- qa/v180-p0u/pinned_jwks_verifier.py: cryptographic RS256 signature verification for Cloudflare Access and RS256/ES256 for Supabase with pinning to an operator-trusted JWKS set, unique kid, signed issuer and audience, exp, iat, nbf, maximum token lifetime, Supabase session_id, subject and role. Only asymmetric verification is supported. **Legacy Supabase HS256 is intentionally NOT accepted**, pending explicit security key migration/compatibility review.
- qa/v180-p0u/server_session_snapshot.py: fail-closed, pure Python assessment of EXACTLY ONE server-trusted auth.sessions row matching independently verified session_id and sub, with UTC expiry verification. This module does NOT connect to Supabase, issue privileged API calls, prove JWT possession or guarantee revocation after the snapshot. A separately approved minimal-privilege backend adapter is still missing.
- qa/v180-p0u/nohost_origin_gate.py: isolated FastAPI origin path, **NOT mounted on Render**. It rejects missing/forged Access assertions even if Host or Origin headers are impersonated. Even if a locally generated *valid signed synthetic* Access token is presented, the path returns 503 PRIVATE_VERIFIER_NOT_DEPLOYED. It never reads or authenticates a real Supabase bearer.
- qa/v180-p0u/test_p0u_protected_origin.py: offline tests generate synthetic RSA/EC signing keys and synthetic identity/session records. They exercise genuine cryptographic signature verification without any real Cloudflare/Supabase tokens or network access, and integrate with the P0T candidate engine purely in QA.
- .github/workflows/v180-p0u-signed-jwt-origin-nohost.yml: pinned direct Python dependencies, isolated QA and no-host static gate. Actions run without secrets and do not access hosted Auth or change provider configuration.

**Limits:** JWKS injection here is a test seam, NOT a secure public JWKS fetcher. Before real use, implement strict server-side pinned-origin HTTPS JWKS retrieval, timeouts, bounded caching, rotation, trusted config and independent review. Never accept a client-supplied JWKS URL or arbitrary JWK as authority; never log raw JWTs. A successful offline signed test is NOT a live Cloudflare Access integration. Live clients might use legacy HS256 Supabase tokens, which need separate review before enabling any real verifier.

## 3. Acceptance gates that remain blocked

| Gate | Current |
|---|---|
| Dedicated approved Access application + policy for a narrow QA-only host/path | BLOCKED — absent |
| Direct Render origin deny and signed Access verification on actual host | BLOCKED — no hosted integration |
| Independently confirmed Owner A/B consent | NOT VERIFIED |
| Two independently verified real signed Supabase JWT sessions | NOT RUN |
| Server-side narrowly scoped auth.sessions lookup with revocation recheck | DESIGN / OFFLINE TEST ONLY |
| Durable atomic one-use consent transaction and short-lived signed receipt | NOT IMPLEMENTED |
| Canonical Store A/B owner registry and scoped RPC/RLS | NOT DEPLOYED |
| 31 real JWT Store A/B negative no-send UAT | 0/31 NOT_RUN |
| Hosted rollout, production, Messenger/Zalo cross-channel order reads | NO-GO |

## 4. Operator path and change approval

User has already confirmed two different existing QA accounts. Do NOT request new accounts or ask this again. To gather a **non-authorizing local precheck**, each authorized Owner can use a separate browser profile at https://tien404-auth-staging.onrender.com/auth-evidence.html. Report only LOCAL_COMPARE_PASS or a non-sensitive BLOCKED_REASON. Never paste passwords, raw JWT, nonce, receipt handles, Auth IDs or customer data into chat/GitHub.

Any live private Access application, policy, backend environment credential, Render deploy, Auth revocation read privileges, multi-instance receipt store or Store migration requires separate scoped approval and security review. Owner A cannot consent for Owner B without verified delegation. If second Owner has no valid session, STOP rather than inventing proof.

For a later hosted session verifier, require that the Auth session backend return a current row for a signed JWT session_id and sub through a dedicated least-privilege private role, with correct revocation/expiration behavior. The backend may need security-definer or privileged access: do not expose an Auth-session accessor in public schemas, do not grant anonymous/regular users arbitrary Auth session reads, and never reuse a service secret in a frontend.

Before real Store DDL/RLS/grants/data changes, separately prove M0 backup-and-restore and rollback; the previous waiver remains for source-only/disposable work exclusively.

## 5. Evidence and rollback

- **VERIFIED:** Render live deployed baseline, Cloudflare Access inventory, aggregate Supabase Owner session distribution, auth.sessions column metadata.
- **IMPLEMENTED:** offline signed JWT verifier candidate, pure server session snapshot assessor, unmounted FastAPI nohost origin probe, offline QA workflow.
- **TESTED:** ONLY synthetic credentials and signed JWTs. [GitHub Actions #44232158560](https://github.com/ngoctien20/demo-git/actions/runs/44232158560) SUCCESS on prior source HEAD e94c5c45d6c5a877a37fc460e410a4c325ffea75; logs independently read: **47/47 PASS, 0 FAIL, 1 non-blocking library warning**, static `P0U_SOURCE_SCOPE_NO_DEPLOY_NO_DB_KEYS_NO_SEND_PASS`. No real Owner JWT or signed private receipt has been tested.
- **HOSTED CHANGES:** NONE. No Render deploy, Cloudflare policy, Supabase DDL/DML/grant/credential change, n8n, Meta/Zalo or customer-data operation. No PR merge or production release.
- **ROLLBACK:** Git revert P0U source files/commits inside existing Draft PR #385; no runtime rollback required.

**Decision: P0U_OFFLINE_SIGNED_CRYPTO_QA_TESTED_47_OF_47 / LIVE_ORIGIN_NO_GO / REAL_OWNER_A_B_NOT_VERIFIED / STORE_NO_GO / PRODUCTION_NO_GO.**
