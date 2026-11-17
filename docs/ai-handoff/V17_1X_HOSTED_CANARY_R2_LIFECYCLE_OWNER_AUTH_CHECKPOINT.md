# TIEN404 AI V17.1X — Existing Worker Private Hosted Security UAT × R2 Lifecycle Approval × Real QA Owner Admission Readiness

**Date:** 17 November 2026 JST
**Parent:** V17.1W Draft PR #349 HEAD `67de04f16cfb31d05c02bafe357dd870cc023249`
**Classification:** VERIFIED cloud read-only / IMPLEMENTED source-only approval package / HOSTED and real Auth UAT NOT RUN / PRODUCTION NO-GO

## A. What was actually verified (READ ONLY)

Cloudflare GET queries verify the existence of pre-existing Worker `tien404-rpc16-merchant-evidence-inactive-staging` with public workers.dev/preview disabled, 0 matching Worker custom domains, and existing R2_QUARANTINE binding. The existing R2 bucket `tien404-merchant-evidence-quarantine-staging` has managed public dev URL disabled, 0 custom domains and 0 bucket-lock rules. The Access application `TIEN404 RPC16 Merchant Evidence Staging — DENY ALL` exists but has **0 policies returned**. No independent unauthenticated Access request or authorized operator login has been tested against this Worker.

**Exact original R2 lifecycle (API GET read-only):**
```json
{
  "rules": [
    {
      "id": "Default Multipart Abort Rule",
      "enabled": true,
      "conditions": {},
      "abortMultipartUploadsTransition": {
        "condition": { "type": "Age", "maxAge": 604800 }
      }
    }
  ]
}
```
This cancels unfinished multipart uploads after **7 days**, not completed-file deletion. No lifecycle rule for actual object expiration was observed; no existing object listing, download or raw file contents were performed. Do **NOT** describe this bucket as enforcing 24-hour retention.

The Cloudflare account lists three other TIEN404 QA Durable Object namespaces, but **none is confirmed bound to this evidence Worker**. No atomic cross-instance/restart replay test performed. No real malware scanner or CDR receipt independently verified.

Supabase `ifxlvrhyjhbzbrkdsida`: 2 mapped QA Stores across **2 different Tenants**, 0 qualifying two-Store two-owner pairs in same Tenant, 0 distinct active Auth session/member pairs within same Tenant, and 0 direct legacy Store-scope policies for `products/orders/customers`. No Auth JWT read or created, no membership granted and no RLS changed. Published Messenger V17.17 with four V17.15 nodes and Zalo V17.19 were untouched; V17.1P QA remains inactive.

## B. Private Worker hosted security UAT admission request — NOT EXECUTED

**No safe externally reachable QA Worker route is currently verified** (workers.dev/preview disabled, no matching custom domain). An Access app named DENY ALL with zero policies is not an external negative-test receipt. Do not create/open a public route solely for testing.

Before any independent hosted UAT:
1. Explicitly approve an **existing or new disabled-by-default protected private QA route**, scoped to the exact test request, limited number of requests, maintenance window and non-customer handlers. Configure Worker-level Cloudflare Access and least-privilege operator MFA. Keep all production routes and callbacks unchanged.
2. Verify anonymously denied GET/POST and unauthorized service-token/user scenarios; verify legitimate authenticated operator can access a **read-only/no-send** endpoint. Ensure bypass policies are absent and failure logs carry no secrets or PII.
3. Only after consent, test fake uploaded file rejected without scanner/CDR, external URL/path traversal rejected, replay atomic across two workers and after restart; validate no customer data is touched.
4. Collect independently signed, PII-free acceptance, control revert plan and bounded cost; do not interpret HTTP status alone as proof of all access paths.

**Any unapproved external request or Access app/routing modification stays BLOCKED**. No public development URL or custom R2 domain may be enabled in this milestone.

## C. R2 lifecycle approval package — PROPOSED, DISABLED BY DEFAULT

Propose a **new, exclusively disposable QA prefix**: `qa-v171x-disposable/`. The following object is a review artifact and MUST NOT be sent as an API PUT without an additional, separate owner-signed change request and independent operator review:

```json
{
  "rules": [
    {
      "id": "Default Multipart Abort Rule",
      "enabled": true,
      "conditions": {},
      "abortMultipartUploadsTransition": {"condition":{"type":"Age","maxAge":604800}}
    },
    {
      "id": "TIEN404 V17.1X Disposable QA Evidence TTL 24h",
      "enabled": false,
      "conditions": {"prefix":"qa-v171x-disposable/"},
      "deleteObjectsTransition": {"condition":{"type":"Age","maxAge":86400}}
    }
  ]
}
```

The existing rule is preserved **verbatim**; the candidate is disabled until separately approved. If this bucket's lifecycle differs from the exact preflight snapshot, the proposed change must be re-reviewed. The Cloudflare R2 lifecycle PUT updates the rule set; never overwrite existing rules. Avoid broad/empty prefix, all-bucket deletion, deleting customer objects, and enabling without verifying the new prefix contains zero existing objects. The deletion time is an age condition, not a guarantee that Cloudflare physically deletes at the exact second.

**Minimum approval prerequisites:** (1) backup existing lifecycle config and object inventory metadata for the isolated prefix; (2) verify prefix contains no prior Merchant or customer evidence; (3) owner explicitly approves QA-only expiration/deletion and retention duration with legal/compliance review; (4) confirm no bucket-lock conflicts and no required legal hold; (5) signed change SHA and rollback plan restoring the original lifecycle configuration; (6) cost and test window limit; (7) canary written only after upload-specific separate consent. Do NOT lock or delete the existing bucket indiscriminately. Scope beyond disposable QA requires a NEW approval.

Cloudflare documentation: https://developers.cloudflare.com/r2/buckets/object-lifecycles/ and https://developers.cloudflare.com/r2/buckets/bucket-locks/.

## D. Disposable QA Store A/B real Auth admission readiness — NOT PROVISIONED

Use a **new isolated disposable QA Tenant** containing **QA_STORE_A** and **QA_STORE_B**, with two distinct Supabase Auth subjects/sessions bound to separately scoped owner memberships. The current two mapped Stores from different Tenants do **not** satisfy this criterion.

Before creation: separately approve scope, exact operator/user, new resource IDs and owner proof; verify budget ceiling and maintain rollback manifest. Maintain segregation from AI_SALES_DEMO Orders/Products, Zalo/Messenger Live and real merchant data. No real customer PII or copied orders. A sole project founder may administer two QA accounts for a *technical isolation test*, but that is NOT evidence of two independently verified merchant humans or third-party security review; distinguish both acceptance levels.

Gates after explicitly approved setup:
- JWT must be cryptographically verified for the actual Supabase project; ensure valid issuer/audience/signature, active `session_id` and server-owned current Store owner binding. Reject self-supplied `user_metadata` or arbitrary store/role.
- Store A JWT may read only A; Store B JWT may read only B. Check A→B and B→A denial, anonymous denial, revoked sessions, expired subscriptions where applicable and cross-channel Messenger↔Zalo account impersonation. Use disposable synthetic Commerce rows with real Store-level RLS; a `SET ROLE authenticated` simulation does not replace real JWT-based QA.
- Log only hashes of review receipts and test IDs privately; never publish real JWT, token, email, phone number, identity document or credentials.

**No user, tenant, Store, membership, policy, credential or Merchant file was created or modified in V17.1X.**

## E. Source-only implementation and independent CI

`qa/v171x-hosted-uat/hosted-uat-approval-plan.cjs` is a **read-only preview builder**. It consumes server-injected trusted snapshots, not a live Cloudflare request; validates exact project/commit, snapshot age, Worker/R2 Access state, unmodified original lifecycle rule, isolated QA tenant/owner constraints and repeat snapshot consistency. It produces a precise 16-item blocker list and a disabled, prefix-restricted lifecycle candidate preserving the prior 7-day multipart rule.

Even when every fake snapshot flag is set TRUE, the builder still returns `allowR2Put=false`, `allowRealCanary=false`, `allowAuthWrites=false`, `allowStoreRlsWrites=false`, `productionReleaseApproved=false` and `release=HOSTED_NO_GO`. No HTTP, file, database or provider I/O exists in this module. Source alone can never authorize hosted activity.

New synthetic suite `qa/v171x-hosted-uat/hosted-uat-approval-plan.test.cjs` exercises real observed defaults, no broad bucket lifecycle changes, source-only all-green negative test, access and replay gaps, cross-tenant owner qualification, input forgery and TOCTOU rechecks. Parent suite **1,132** source tests and independent disposable PG17 rollback are inherited, with intentionally failing real hosted release gate. Record exact new test count and PASS only from CI.

## F. Required separate approvals and rollback

**Permission requests (none granted in this work):** private Access no-send route and limited canary; enable QA prefix retention only with isolated data inventory, legal consent, saved configuration, cost limit; real durable replay binding/scanner; two disposable QA Auth identities/memberships and Store RLS migration; real Meta/Zalo QA Page/OA event signing.

**Rollback for this milestone:** close new Draft child PR, no operational rollback required. For *future authorized* R2 changes, rollback must restore exact captured original rules, after independent check of unintended prior deletions (which cannot be reversed merely by rollback). For *future authorized* QA identity changes, revoke only those newly created QA sessions/users and their scoped resources, never existing Merchant accounts.

**Release:** SOURCE IMPLEMENTED/TESTABLE; HOSTED SECURITY UAT NO-GO; R2 CHANGE NOT APPROVED; REAL AUTH STORE A/B NOT READY; PRODUCTION NO-GO.

## Access independent acceptance hardening (source review)

A genuine hosted Access acceptance requires **both** anonymous/non-member DENY and successfully authenticated authorized-operator READ-ONLY ALLOW on the exact protected route, with **zero Access Bypass policies**. An app named DENY ALL with zero policy records cannot claim that operator ALLOW has been verified. The source gate checks `policiesReturned>=1`, `bypassPolicyCount===0`, `externalDeniedCanaryVerified` and `externalAuthorizedCanaryVerified` from its trusted injected snapshot. These inputs are FAKE in source tests, not evidence of a real external hosted probe. Three additional tests explicitly prevent an allow-by-bypass, deny-only or zero-policy false positive. Expected new source cases: **53**; expected source total **1185** with inherited 1132, pending actual CI.


## G. VERIFIED independent CI and release gate (2026-11-17 JST)

**Tested code HEAD:** `67160ecffc8de024a35758fcb3f66bb46280b3e6`.
**GitHub Actions:** https://github.com/ngoctien20/demo-git/actions/runs/44094521576

- Source job `134078007991` **SUCCESS**: **53/53 V17.1X** adversarial test cases and **1,132/1,132 inherited** security/Commerce source regression cases = **1,185/1,185 PASS**. CI source-only manifest enforces `HOSTED_NO_GO`, no real R2 settings/Access/Auth/n8n/payment/provider changes, and a disabled candidate lifecycle rule.
- Disposable PostgreSQL 17 job `134078007545` **SUCCESS**: same-Tenant fake Store A/B row-level security and ROLLBACK; **NOT** real Supabase Auth JWT or real production Store-scoped Commerce RLS.
- Real hosted Access/R2 lifecycle/replay and two-owner JWT admission job `134078358630` **FAILED BY DESIGN**: no independent protected route canary, no authorized R2 expiry rule, no genuine scanner/CDR or durable replay acceptance, no two real owner sessions in same Tenant and no live Store-level RLS. Overall GitHub workflow RED intentionally, with both offline jobs GREEN.
- Additional hardened source checks require Access policy count at least 1, zero Bypass policies, a successful **independent denied anonymous canary** and an **independent authorized operator canary**; none has run. A named Access application with zero policy records is not a positive hosted acceptance.
- Cloudflare actual read-only API inventory and Supabase aggregate checks remain separate from the **synthetic** test data and are not cryptographically attested by this source gate. The adapter always returns NO-GO; private actual hosted collection is not wired.
- Change scope is a child Draft GitHub PR only. No Worker host route opened, no R2 lifecycle PUT, no bucket lock or private file upload, no Auth user/tenant/Store/RLS, no n8n change, no provider send and no new spend.
- This checkpoint-only docs update creates a new SHA; recheck final-HEAD CI before final VERIFIED designation.

**Disposition: VERIFIED READ-ONLY CLOUD CONFIG / SOURCE IMPLEMENTED / TESTED 1,185 CASES + PG17 / REAL HOSTED AND AUTH BLOCKED / PRODUCTION NO-GO.**
