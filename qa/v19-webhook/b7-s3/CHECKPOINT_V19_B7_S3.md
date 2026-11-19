# TIEN404 AI — V19.0-B7-S3 Checkpoint

**Date:** 2026-11-19 JST
**Phase:** Complete Writer Caller Inventory × Versioned RPC Security Review × Real Owner A/B Admission Evidence.
**Truthful stage:** BOUNDED INVENTORY VERIFIED / RPC NEGATIVE QA TESTED / REAL OWNER A/B NOT VERIFIED / STORE AUTH BLOCKED / HOSTED CANARY BLOCKED / PRODUCTION NO-GO.

## 1. Baseline
- Parent Draft PR #446, exact head 6efb7eda5883be8436d624d8461806b481d883f1 at start; B7-S1 #440, B7 #436, Store design #417.
- Supabase staging reference ifxlvrhyjhbzbrkdsida. No Store IDs on six Commerce tables and policies still Tenant-scoped.
- V1 public.save_merchant_product: SECURITY DEFINER owned by postgres, fixed search_path, auth.uid() and Tenant membership checks, no Store scope.
- V19.0-B7-S2 versioned V2 is synthetic PostgreSQL17 b7s2 only; not deployed.
- Existing V17.23U Worker Cloudflare deployment and public-route lock are unaffected by this work.

## 2. Actual S3 inspection
- GitHub gh-pages commit ff2daf970e8209399a28b2d0cade8a33b9fa71c6: **all 37 matching HTML/JS/CJS/MJS source blobs read**, zero direct V1 RPC route matches; this is one exact branch/snapshot, not all deployed services.
- n8n: 17 selected workflow IDs across Commerce AI Core, Messenger, Create Order DEMO, Catalog, Cart, Onboarding, Zalo Router, Store Auth/Adapter QA checked via connector with draft/published where present; no direct literal V1 call found in selected parameters. Not an exhaustive account-wide scan.
- Supabase: one active Edge Function tien404-r1-owner-preflight, v2, verify_jwt=true, source checked; uses auth.getUser and Tenant memberships, not Store memberships or product RPC.
- GitHub repository code search found no indexed direct V1 calls (non-authoritative).
- Render: connector requires explicit user workspace selection; no Render service read or modified.
- External apps/service callers and authoritative per-request RPC call log inventory: UNKNOWN. **Do not mark caller inventory complete**.

## 3. IMPLEMENTED — new GitHub Draft QA branch only
- b7-s3/caller-inventory.json: machine-readable bounded coverage, unknown surfaces and no-go statuses.
- b7-s3/owner-ab-admission-gate.mjs: permanent deny of any real Store, product write, provider ingress based solely on evidence flags; checks six Store-scoped tables and ten real Owner A/B tests.
- b7-s3/tests/owner-ab-admission-gate.test.mjs: forged evidence, incomplete caller surface, false VERIFIED flags, missing policies/store_id and source security flags all rejected.
- b7-s3/tests/pg17_synthetic_claim_spoof_proof.sql: disposable-only adversarial test proves custom GUC role claim in b7s2 test shim can be forged without a signed JWT, while no product/audit data changes.
- B7-S3 CI workflow: PostgreSQL17 disposable, Node.js22, B7-S2 versioned RPC + rollback and B7-S1 six-table FK/RLS regression; prior deployed Worker blob pinned and hard NO-GO guards.
- REAL_OWNER_AB_ADMISSION_PROCEDURE.md and WRITER_CALLER_AND_RPC_SECURITY_REVIEW.md provide token-safe evidence checklist and release blockers.

## 4. TESTED evidence
- Initial GitHub Actions #44506643915 SUCCESS on source commit ca821e4a6dcf42da2bc8293371541b9194ccc43b:
  - Node.js S3: 13 tests PASS, 0 FAIL, 0 SKIPPED.
  - B7-S2 versioned product RPC fixture PASS.
  - B7-S3 synthetic GUC impersonation adversarial proof PASS (documented TEST SHIM limitation, **not** real Auth success).
  - B7-S2 rollback transaction PASS.
  - B7-S1 six-table FK/restrictive RLS regression PASS.
  - Immutable deployed Worker snapshot check PASS.
- CI after final checkpoint/PR head must be inspected independently before reporting final verification.

## 5. Real security blockers
- No actual Store schema/membership or real JWT Owner A/B cross-Store positive/negative evidence.
- Owner preflight Edge Function only proves Tenant-level checks in source, not Store authorization.
- B7-S2 test GUC is client-settable; NEVER copy into a live Supabase function.
- Live V1 is postgres-owned SECURITY DEFINER; authorized manual checks and caller inputs need privileged-function threat review before a versioned cutover.
- SKU uniqueness decision D-02 remains open.
- Render/service caller inventory and actual RPC invocation tracing incomplete.
- No approval for hosted Cloudflare Worker D1 Binding, real Zalo webhook, Commerce Core writes or credential changes.

## 6. Changes / backup / rollback
- All S3 files are in GitHub Draft QA branch only. No Supabase DDL/DML, tenant membership edits, JWT reads, payment, Cloudflare D1, Worker, WAF/Access, n8n publish, real Zalo sends or Order writes.
- Rollback: close/revert this Draft PR; temporary CI PostgreSQL service is deleted with the workflow. No cloud rollback required.
- V1 deployed function untouched. Existing Worker source and deployment preserved.

## 7. Next
- Obtain explicit Render workspace selection to finish read-only service caller inventory.
- Inspect actual production/staging frontend backend builds and dynamic RPC callers; add non-sensitive per-request RPC instrumentation under approved privacy scope.
- Reconcile PR #417 canonical Store migration, D-02 SKU policy, auth.uid()/session verification and least-privilege SECURITY DEFINER/INVOKER design.
- Once separately approved, perform real Owner A/B token-safe UAT on authenticated synthetic QA Store rows, recording test receipts only.
- Hosted Worker Binding and actual provider ingress remain a separate authorization workstream.

**Checkpoint:** V19_B7_S3_BOUNDED_CALLER_AUDIT__GUC_SPOOF_LOCAL_PG17_TESTED__REAL_OWNER_AB_BLOCKED__RPC_V1_UNCHANGED__PRODUCTION_NO_GO.
