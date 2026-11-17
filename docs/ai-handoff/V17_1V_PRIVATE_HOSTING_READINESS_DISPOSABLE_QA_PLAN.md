# TIEN404 AI — V17.1V Private Evidence Registry Hosting Readiness × Disposable QA Tenant/Store Authorization Plan

**Checkpoint:** 2026-11-17 (JST) · parent V17.1U Draft PR #325 (HEAD `d4f4070baa46f779481aa61914436fdc3072ce4b`).
**Lifecycle:** PROPOSED isolated hosting + QA identity workflow / IMPLEMENTED source-only signed design admission / REAL AUTH, EVIDENCE AND HOSTING BLOCKED / PRODUCTION NO-GO.

## 1. Verified facts from live read-only audit
- Supabase staging `ifxlvrhyjhbzbrkdsida`: **2 mapped QA Stores across 2 DIFFERENT Tenants**, 2 owner bindings; **0** same-Tenant two-Store/two-owner pairs and **0** Tenants with two separate active member/Auth session users. No real signed JWT was retrieved.
- Legacy `public.products`, `public.orders`, `public.customers` lack `store_id` and direct Store-level RLS predicates. Actual Commerce Store A↔B isolation cannot be certified.
- `public.qa_shop_b_zalo_claim` remains `SECURITY DEFINER` and executable by `anon`: independent P0 review candidate, **not a confirmed exploit**. No RPC invocation, permission change or function update.
- Messenger `Z7FdV7uDvApfbURQ` Published V17.17 `1064b1b3-d3f1-4a6b-a367-2414ba691522`: 32 nodes; all four V17.15 guard nodes retained. Zalo `yIJk8LvJoLF40Z62` Published V17.19 `2d912cb0-007f-452f-9536-b92ba12a03e6`: 12 nodes. V17.1P QA `p5OsIaB0NkMDFMw7` INACTIVE, no credentials. All preserved.

## 2. Target architecture — NOT DEPLOYED
```
Privately enrolled operator + independent security reviewer
  └── Signed Git-commit-bound infrastructure/QA-tenant design receipts
        ├── Isolated INACTIVE QA Cloudflare Worker
        │    └── Worker-level Access (deny by default; MFA; no bypass)
        ├── Managed least-privilege secrets / no public webhook or preview
        ├── Private R2 evidence quarantine bucket
        │    └── No r2.dev / no public custom domain / no signed public URL
        │         └── malware scan + CDR in independently approved service
        │              └── signed metadata (SHA256, immutable version, TTL)
        ├── Durable atomic nonce/replay reservation
        ├── Private PII-redacted review log with short retention
        └── Disposable isolated QA Tenant (PROPOSED only)
             ├── QA_STORE_A -> independently authenticated QA_OWNER_A
             ├── QA_STORE_B -> independently authenticated QA_OWNER_B
             └── same Tenant; dummy rows; explicit Store-level RLS
```
Cloudflare product documentation: [Worker-level Cloudflare Access](https://developers.cloudflare.com/workers/configuration/cloudflare-access/); [R2 private/public domain controls](https://developers.cloudflare.com/r2/buckets/public-buckets/); [R2 data encryption](https://developers.cloudflare.com/r2/reference/data-security/). These describe capabilities, **not verified TIEN404 account configuration**.

## 3. Source-only review admission
New isolated `qa/v171v-hosting-readiness/private-hosting-readiness.cjs` implements `createPrivateHostingReadinessGate` with `reviewBlueprint`. The API accepts **only** two opaque, typed references and a nonce. A future PRIVATE trusted registry returns an exact-schema hosting blueprint and isolated QA Tenant/Store design. It will **never** fetch URLs or files, provision a worker/R2/Auth user, write a database record, send a provider message, or authorize billing.

- Infra design must mandate **inactive isolated Worker**, Worker-level Access deny-default with no bypass, protected previews, disabled `workers.dev` and public callbacks, managed secrets, MFA, PII-safe logs, disabled R2 public development/custom domains, no public object links or direct client upload, immutable object digest/version, quarantine malware scan + CDR, atomic durable replay, 24-hour review retention, deletion with separate approval, and zero approved deployment cost.
- QA design must mandate a **NEW disposable Tenant**, two distinct QA Stores and independently authenticated owners, no production merchant move, no shared DEMO catalog, no real customer rows, no service_role/bypassrls, separate approved Store-RLS migration, backups and authorized rollback. The source does not know real owner IDs or passwords.
- Two **independent reviewer identities** (infrastructure security and Auth/RLS) each sign canonical SHA-256 digests of the exact designs plus commit SHA, scoped project and review nonce using pinned Ed25519 public keys looked up privately. Client keys are never accepted. Keys, signer enrollment and complete registry records are checked once more before returning a *design-only* review plan; replay reservation must be atomic.
- Same-process duplicate reviews are rejected before any asynchronous call, and a durable private replay callback must prevent cross-instance replay. Any changed blueprint/key after signing, expired or invalid signature, client URL/secret, unsafe controls or backend outage fails closed.
- The positive result is strictly `PRIVATE_INFRA_QA_TENANT_DESIGN_REVIEW_ONLY`, with all `allow*` false, `actual*` 0, all real hosted evidence false and `HOSTED_NO_GO`. **A signature for a design is not a verified deployed Access policy, a real R2 bucket, real scanned merchant evidence or a real owner identity.**

## 4. Future disposable QA Tenant/Store provisioning (REQUIRES SEPARATE APPROVAL)
1. Owner and independent operator approve a narrowly scoped, cost-bounded **new QA Tenant**, two QA Stores and **two NEW** Auth QA users with independently verified emails/2FA, without changing any existing merchant ownership, tenant memberships, billing or live workflows. Require backup/checkpoint and chosen revert strategy before first mutation.
2. Allocate tenant/store and owner identities server-side in the staging environment, never from client-provided `user_metadata`, JWT with an arbitrary issuer, or fabricated Store flags. Keep all Auth passwords, JWT, session tokens and secrets within protected private operator channels. No real IDs stored in GitHub source or chat.
3. Independently login both users; verify genuine Supabase Auth JWT signatures, issuer/audience, fresh `session_id` and current server-owned Store membership. Establish **two Store rows within the SAME Tenant**. Create only approved synthetic QA records in isolated Commerce tables once RLS design is independently reviewed and approved.
4. Prove owner A→Store A allow, A→B deny, owner B→Store B allow, B→A deny, revoked owner denied, replay denied, anon denied, service_role never used for acceptance. Migrate legacy Store-level RLS only with approved compatibility/rollback plan; do NOT mutate production tables to manufacture proof.
5. Record signed and PII-free independent acceptance from real owner/operator/reviewer, test SHA, Auth binding snapshots and callback evidence in private vault. Then request a **separate** approval for real Page/OA no-send callbacks and eventual promotion.
6. Rollback (if real QA creation later approved): disable isolated QA runner, revoke QA sessions and newly scoped credentials, validate no production dependencies, remove **only** explicitly enumerated created QA resources after approval; check audit integrity. Never delete or alter existing customer Store or tenant.

## 5. Security + budget gates before any hosted deployment
- Independently verify Access protection of **every Worker entrypoint** including preview/custom domain, test denied anonymous/bypass requests, confirm R2 public development URL/custom domains disabled, and test denied direct object access.
- Dedicated private registry and object store isolation by Tenant/Store; read-only/cost-capped first, managed secrets and short retention, offline-recoverable encrypted audit, disaster-recovery/operator access plan.
- A real scanner/CDR must independently attest actual malicious-file rejection before file metadata could be marked CLEAN; an untrusted upload filename/MIME or signed record alone is insufficient.
- Real durable replay service must atomically reject simultaneous and cross-instance reuse. No eventual-consistency KV substitution for replay reservation.
- **No resources were created in V17.1V**. `maxDeploymentSpendUsd=0` means **zero spend authorized by this source milestone**, not a provider's guaranteed free-tier price. Real Cloudflare/Supabase pricing and budget require a separate cost authorization.

## 6. Independent QA, source and rollback
- New test suite exercises actual Ed25519 signatures over **FAKE**, generated infrastructure/reviewer QA keys, negative controls and adversarial plan changes; inherited V17.1U 25 tests, V17.1T 150 cases and other 855 source regressions remain included.
- Separate PostgreSQL17 disposable same-Tenant Store A/B RLS fixture with explicit ROLLBACK is **not** genuine Supabase JWT/RLS acceptance. Real hosted owner/Cloudflare Access/R2/Meta/Zalo admission remains **NO-GO by design**.
- Only a Draft child GitHub PR may be created; no Cloudflare Worker/Access/R2 policy, Supabase Auth, Tenant, Store, RLS, n8n workflow, credential, customer order, inventory, payment, or message changed.
- Rollback: **close the Draft child PR**, preserving V17.1U parent and both Published bot graphs. No live rollback needed.

## 7. Version/reporting checkpoint
Record exact branch SHA, test suites/jobs, first failures and fixes, residual blockers, release gate and operator approvals with each next change. **Do not mark hosted TESTED or real owner VERIFIED without real independent evidence.**


## 8. VERIFIED actual Cloudflare staging inventory (read-only, 2026-11-17 JST)

The earlier generic architecture did not assume that resources existed. An additional **direct, read-only Cloudflare API inventory** now confirms matching **PRE-EXISTING** resources. They were not created, edited or deployed during V17.1V:

- Account has **30 Worker scripts**, **1 R2 bucket** and **2 Access applications** in the visible account.
- Worker `tien404-rpc16-merchant-evidence-inactive-staging` **EXISTS**; `workers.dev` subdomain `enabled=false`, `previews_enabled=false`; no matching Worker custom domain in the returned domain inventory. The Script Settings response exposes a single binding: `R2_QUARANTINE` of type `r2_bucket`. No Durable Object or managed secret binding appears in that snapshot. That is **not proof they cannot exist elsewhere**; a complete host end-to-end review is still required.
- R2 bucket `tien404-merchant-evidence-quarantine-staging` **EXISTS**, located in APAC. R2 managed public-development domain `enabled=false`, no R2 custom domains attached. The endpoint that would retrieve CORS configuration was **UNVERIFIED** on this account; do not infer CORS controls.
- R2 lifecycle endpoint returns **one enabled default multipart abort rule**, **not an independently verified 24-hour object-deletion rule**. Bucket Lock endpoint returns **zero lock rules**. Therefore evidence retention and object immutability are **P1 readiness gaps**, not proof a file has leaked or malicious content has been accepted. No object contents or names were read.
- Cloudflare Access application `TIEN404 RPC16 Merchant Evidence Staging — DENY ALL` **EXISTS**, type `self_hosted`, 15-minute session configuration, one domain reference and **zero Access application policies** returned. No Allow policy was seen; an independent external denied/allowed route canary is still required to prove Access enforcement. No policy was changed.
- A previously existing inactive Worker+R2+Access footprint should be **reused after independent attestation**, not rebuilt. It cannot yet satisfy V17.1V's exact-source blueprint (no documented real scanner/CDR, atomic durable replay, content retention/locks, private verifier secrets, external Access proof). **HOSTED NO-GO** remains correct.

## 9. VERIFIED source and disposable-DB acceptance

Tested source SHA `441621576fe85aa2856513a7de65feca74a6b4b4`.
GitHub Actions run: https://github.com/ngoctien20/demo-git/actions/runs/44080556950

- Independent source job `134029720766` **SUCCESS**: **58/58** new V17.1V Ed25519/fake hosting design tests and **1030/1030** inherited regression tests = **1088/1088 source PASS**. All test keys, signers, Stores and infrastructure records in this suite are synthetic.
- Disposable PostgreSQL 17 job `134029720457` **SUCCESS**: synthetic same-Tenant Store A/B RLS fixture, full ROLLBACK and cleanup; this is **NOT real signed Supabase Auth JWT or real Commerce Store RLS**.
- Hosted real Cloudflare Access/R2/private evidence and real two-owner Auth JWT admission job `134030013365` **FAILURE BY DESIGN**. Production and live hosted admission remain **NO-GO**.
- Source hardening after first CI: the one-use design review nonce is now bound globally to **all blueprint/plan reference combinations**, not merely one pair, before the first awaited callback. The new adversarial test rejects same-nonce review against a second valid plan; no permit path was relaxed.
- No API POST/PUT/PATCH/DELETE was sent to Cloudflare, Supabase or n8n by this milestone. Only the isolated GitHub Draft branch and PR source/tests/docs/CI were written. Existing staging resources and all Published bot workflows remain untouched.
- Final checkpoint documentation is a new Git commit after the tested SHA; exact-HEAD source+PG17 CI must be rechecked before final signoff.

**Disposition:** EXISTING INACTIVE HOSTING COMPONENTS PARTIALLY VERIFIED / NEW DESIGN SOURCE IMPLEMENTED & TESTED / REAL HOSTED AUTH+FILE SCAN+RLS BLOCKED / PRODUCTION NO-GO.
