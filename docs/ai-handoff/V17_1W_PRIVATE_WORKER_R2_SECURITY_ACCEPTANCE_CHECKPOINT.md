# TIEN404 AI — V17.1W Existing Private Worker Security Acceptance × R2 Retention/Replay Gap Review × Disposable QA Identity Admission Gate

**Date:** 2026-11-17 JST  
**Parent:** V17.1V Draft PR #331 at `e119d0a5cba8f9484ff860500b7a0c10af330c17`  
**Lifecycle:** Read-only actual inventory VERIFIED; source-only security review gate IMPLEMENTED; real private Worker/tenant admission BLOCKED; PRODUCTION NO-GO.

## 1. Real hosted inventory: read-only connector-backed evidence

The team read current Cloudflare account data using GET-only API calls; **no public endpoints were probed and no configuration was modified**.

| Component | Verified result | Decision |
|---|---|---|
| Existing Worker | `tien404-rpc16-merchant-evidence-inactive-staging` present | Reuse rather than recreate |
| Worker workers.dev and preview | both disabled | Config isolation observation, not an external Access test |
| Worker custom domain | no matching domain in account route listing | No known active custom route from this endpoint |
| Worker settings | existing `R2_QUARANTINE` R2 bucket binding; no Durable Object binding listed | Object replay **not** accepted |
| Access app | `TIEN404 RPC16 Merchant Evidence Staging — DENY ALL` exists, self-hosted | 0 policies returned; external deny proof still needed |
| R2 | `tien404-merchant-evidence-quarantine-staging` exists; r2.dev disabled; 0 custom domains | Private exposure configuration partially VERIFIED |
| R2 lifecycle | one enabled default multipart-abort rule | **No verified object-expiration/deletion retention rule** |
| R2 object lock | zero rules | Object immutability/retention guarantee NOT proved |
| Durable Object namespaces | three names corresponding to separate QA replay/runner experiments | Namespaces exist, but evidence Worker is **not proven** bound to any |
| Scanner/CDR | no genuine verified file scanner/CDR receipt | BLOCKED |
| Access external 401/403 | not executed | BLOCKED |

CORS GET remained unverifiable in prior audit. No actual object keys, file bodies, customer records, secrets, app tokens, signed URLs or emails were accessed. Lack of object lock alone does not prove publicly exposed evidence, and an abort-multipart rule is **not** a file-retention guarantee.

The existing R2/Worker/Access resources were **created before this milestone**, not created or redeployed by V17.1W. A Worker having a bound bucket does not, by itself, establish a safe upload route or malware scanner.

**Supabase staging** `ifxlvrhyjhbzbrkdsida`: two mapped QA Stores in **two different Tenants**, zero eligible pairs of distinct Store owners under same Tenant, zero same-Tenant active member/session pairs, zero legacy Commerce Store-specific RLS policies on `public.products/orders/customers`. Actual JWT owner/Store RLS acceptance cannot run.

**Published n8n:** Messenger `Z7FdV7uDvApfbURQ` V17.17 `1064b1b3-d3f1-4a6b-a367-2414ba691522` with all original four V17.15 nodes remains, Zalo `yIJk8LvJoLF40Z62` V17.19 `2d912cb0-007f-452f-9536-b92ba12a03e6` remains, V17.1P QA `p5OsIaB0NkMDFMw7` INACTIVE. No workflow edit or publish.

Separate high-risk read-only audit finding: `public.qa_shop_b_zalo_claim` is a SECURITY DEFINER RPC with `anon` EXECUTE; P0 **review candidate** only, not proof an exploit exists. No RPC was invoked or grants changed.

## 2. Architecture decision and acceptance criteria

**Priority:** keep existing inactive Worker, Access app and private R2 bucket. Do not create duplicates. Promote staging security only after individual infrastructure, operator and finance authorizations and an independent hosted canary.

1. **Worker surface and Access:** ensure no public `workers.dev`/preview/custom-domain exposure. Independently perform denied unauthenticated GET/POST probes against an explicitly owner-authorized, no-send, disposable QA route; prove no Access Bypass or unintended Allow, verify Access JWT audience/signature and expiry for allowed operator sessions. A 0-policy app is not automatically proof that every Worker entrypoint is protected. No hostname is opened by source QA.
2. **R2 quarantine:** preserve disabled `r2.dev` and 0 custom domains. In a separately authorized change, define and verify a scoped *actual object deletion* retention schedule and immutable digest/version checks. Consider object-lock requirements based on audit/legal hold, with deletion approvals, not automatic deletion of existing records. A multipart abort rule is not document TTL. Independently confirm private object cannot be fetched or uploaded anonymously.
3. **Malware and CDR:** do not mark a file `CLEAN` based on MIME/extension, client metadata or a signed claim alone. A separately approved external scanner/CDR must attest the exact SHA256 and object version after handling PDF/image payloads in quarantine. Treat hidden URLs, path traversal, malicious archives, polyglots, fake headers, network callback links and prompt injection in documents as negative cases. No genuine Merchant file has been handled.
4. **Durable replay:** three unrelated DO namespaces in account do not prove that this Worker has a durable replay binding. Require least-privilege atomic reserve-once at the same admission gateway with no second-key replay across instances/restarts. Missing binding/service, eventual-consistency KV, inconsistent TTL or backend outage must fail closed. Verify **hosted** restart/replay before accepting.
5. **Disposable QA Tenant/Auth:** separate explicit permission to create a **new** isolated QA Tenant with Store A + Store B and two distinct verified Supabase Auth users. Never reassign existing Merchant ownership or copy DEMO Products/Orders. Ensure real signed JWT, fresh active session, verified owner binding and Store-scoped least-privilege RLS. Run A→A allow, A→B deny, B→B allow, B→A deny, anon deny, revoked-session deny, with synthetic disposable rows and independent QA. Do not use `service_role` or a SECURITY DEFINER bypass as proof.
6. **Cost and rollback:** zero new spend authorized in V17.1W. Document budget ceiling, evidence retention/deletion approval, session revocation, backup, exact created QA resource IDs in a private ledger, staged test window and safe rollback before granting new resources. Never delete pre-existing customer data or shut down live Messenger/Zalo.

## 3. IMPLEMENTED source-only security acceptance review

New `qa/v171w-private-worker-security/private-worker-security-gate.cjs` exposes `createPrivateWorkerSecurityGate().review()`. This is an independent review and **does not** connect to Cloudflare APIs, Supabase, Auth, R2 or n8n. The only client input is an opaque private collector snapshot reference, opaque QA plan reference and nonce. Callbacks are required to fetch independently trusted, server-owned observations.

- Exact field allowlists prevent request/proof smuggling, raw JSON credentials, object URLs and extra metadata.
- Snapshots must be fresh, bound to a private project and Git commit. Independent security and Auth/RLS reviewers each sign a domain-separated canonical Ed25519 digest of *both* private records and nonce, using public JWKs retrieved from a separate trusted registry. Two signers must be distinct, enrolled and active.
- Atomic private replay callback must return boolean `true`. An in-process nonce is consumed **before the first await** even if later validation fails. Cross-instance duplicates are stopped by the separately supplied durable backend. Stale/deleted signer keys or a changed snapshot/plan after initial verification fail closed.
- The review output lists grounded categories of missing hosted proof: external Access deny canary, real object deletion, object immutability, scanner/CDR, Worker-level atomic replay, two real same-Tenant owner Auth sessions and actual Store-level RLS. Although cryptographically verified QA snapshots can be *synthetically* all green, this source result **never** grants hosted admission.
- Even synthetic `gapCount=0` returns `release: HOSTED_NO_GO`, `allowAuthProvision:false`, `allowWorkerDeploy:false`, `allowR2Changes:false`, `allowStoreRlsChanges:false`, `allowCredentials:false`, `allowProviderCalls:false`, `productionReleaseApproved:false`. The module has no network, shell, real file, database or credential I/O.

This is a **design-ready testing adapter**. The actual trusted collector, reviewer keys, operational service and hosted user-owner proofs **are not connected**.

## 4. Independent CI and rollback

- New synthetic SHA-bound Ed25519 tests (44 new) check independent signer identity, valid/invalid signatures, replay, race, stale/malicious snapshot and QA plan, broken Access/R2, missing scanner/retention/replay, unsafe Auth/tenant plan and false approval.
- Inherited V17.1V source 58 + V17.1U 25 + V17.1T 150 + earlier 855 = **1088 inherited**, target **1132 source** total, pending actual CI confirmation.
- Independent disposable PostgreSQL 17 synthetic same-Tenant Store A/B RLS transaction rollback continues, **not** real Supabase Auth/JWT.
- Real hosted Access/R2/owner/replay gate intentionally **FAILS NO-GO** in CI. This is a release guard, not an unexplained failure.
- GitHub Draft child PR only: no Cloudflare API write, Worker deployment, Access policy edit, bucket retention/lock edit, R2 object read/upload, Supabase Auth/tenant/Store/RLS change, n8n workflow publication, provider webhook, customer message or paid action.

**Rollback:** close this V17.1W child Draft PR. Parent V17.1V and all existing infrastructure/workflows remain intact.

## 5. Specific approvals still required

**Separate operator/owner authorization** for (A) protected external no-send Worker denial test on specified QA route; (B) adding retention/lock and durable replay binding to existing R2/Worker; (C) approved scanner/CDR and cost budget; (D) creating new same-Tenant QA Store owners and test rows; (E) real Meta/Zalo signed owner canary. Do not infer these permissions from naming a milestone.

Documentation: https://developers.cloudflare.com/workers/configuration/cloudflare-access/ · https://developers.cloudflare.com/r2/buckets/public-buckets/ · https://supabase.com/docs/guides/auth/sessions


## 6. Independent QA verified — 2026-11-17 JST

**Tested commit:** `6a3ec1d313f4318c9536e87dfbc445199c2c98af`. GitHub Actions: https://github.com/ngoctien20/demo-git/actions/runs/44090788818

- **Job `134065032237` — SUCCESS:** **44/44 new V17.1W** signed FAKE Cloudflare observation, R2 retention/replay and disposable QA identity tests; **1088/1088 inherited** V17.1V (58) + V17.1U (25) + V17.1T (150) + earlier (855) tests; **1132/1132 source tests PASS**. Static fail-closed checks verify no real external API request, database I/O, credential import, Auth mutation, file read or provider send in the source gate.
- **Job `134065032689` — SUCCESS:** disposable PostgreSQL17 same-Tenant synthetic Store A/B RLS fixture with a ROLLBACK. This is NOT real Supabase Auth JWT or production Commerce RLS.
- **Job `134065577632` — FAILURE BY DESIGN:** real independent hosted Access deny UAT / R2 actual retention / Worker durable replay / real two-owner JWT store isolation is not yet accepted. Overall GitHub workflow is deliberately RED as a **hosted release guard**, not a regression-suite failure.
- The CI uses **ephemeral TEST-ONLY Ed25519 reviewer keys, fake Cloudflare observations and fake QA tenant records**. It does not attest that the actual hosted Worker is reachable or blocked from anonymous access. Current real Cloudflare/Supabase reads were separate and read-only.
- No Worker or R2 configuration was changed, no Access app/policy was altered, no hosted test identities, files, costs, customer data or messages were generated.
- The remaining security decision is **NO-GO**. To perform the first real external denied/allowed canary or modify retention/replay/identity, obtain independent scoped owner/operator approval for the exact existing QA route and any budget impact. The in-progress Draft PR is not such approval.

**Disposition:** VERIFIED READ-ONLY EXISTING RESOURCES / IMPLEMENTED SOURCE-ONLY AUDIT GATE / TESTED 1132 SOURCE AND DISPOSABLE PG17 / REAL HOSTED SECURITY AND STORE AUTH BLOCKED / PRODUCTION NO-GO.

This checkpoint documentation changes Git HEAD; require exact-final-SHA CI confirmation before claiming final release checkpoint.
