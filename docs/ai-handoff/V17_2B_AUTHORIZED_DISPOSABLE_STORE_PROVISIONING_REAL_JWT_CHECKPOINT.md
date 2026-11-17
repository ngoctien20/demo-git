# TIEN404 AI — V17.2B Authorized Disposable QA Store Provisioning × Real Supabase JWT A/B No-Send Acceptance

**Date:** 2026-11-18 JST
**Parent:** V17.2A Draft PR #379, baseline HEAD `33153e819e2b7d2ac209a2e1dc6e589579d22bf2`.
**Security scope:** GitHub child Draft PR plus READ-ONLY live Supabase/n8n audit, no changes to production or staging Auth/RLS/data.

## 1. VERIFIED ACTUAL INFRASTRUCTURE, not synthetic QA

Direct Supabase connector checks against existing staging `ifxlvrhyjhbzbrkdsida`:
- Project `tien404-staging` is `ACTIVE_HEALTHY`, PostgreSQL 17. No Supabase development branch exists; do not create a paid duplicate project/branch without a separate price and owner approval.
- `auth.users` = **3** existing users, aggregated without reading identities or emails. There are **zero** qualifying same-Tenant two distinct active Auth sessions for two Store QA owners and **zero** eligible two-Store distinct owner pairs in the legacy QA bridge.
- `tien404_v172a_qa.qa_catalog` and `public.tien404_v172a_qa_catalog` do **NOT** exist. No staging migration or public view has been applied.
- Tenant-level membership policy is `memberships_self_read`, `TO authenticated`, `user_id=(select auth.uid()) AND active`. This is necessary but insufficient for Store-granular owner authorization. Existing public Products/Orders/Customers are tenant scoped, with **zero** direct Store RLS predicates.
- `tien404_v175_qa` has four separately existing cross-channel identity tables. No customer identity / order ownership records were modified.
- The legacy `tien404_r1_qa.tenant_identity_map` has `UNIQUE(auth_tenant_id)` and `PRIMARY KEY(tenant_key)`. Do not remove these constraints or move Stores/owners between tenants to fake a test.
- Published Messenger `Z7FdV7uDvApfbURQ` version `1064b1b3-d3f1-4a6b-a367-2414ba691522` preserves four V17.15 nodes; Published Zalo `yIJk8LvJoLF40Z62` version `2d912cb0-007f-452f-9536-b92ba12a03e6` unchanged. V17.1P QA `p5OsIaB0NkMDFMw7` is inactive.

The previous V17.2A SQL candidate had **1,290/1,290 source** and 3 disposable PostgreSQL17 RLS/rollback suites successful. This is NOT real Supabase Auth or PostgREST JWT verification.

## 2. EXACT OPERATOR EXECUTION PLAN — ALL MUTATIONS BLOCKED

The existing rollback-only V17.2A migration source is `qa/v172a-store-auth/migration-candidate.NOT-APPLIED.sql`; **do not run on the hosted staging** before explicit scoped owner permission. This candidate is not an official Supabase migration file.

### Authorization packet to admit *technical* QA personas

**Scope target:** current staging project ONLY; do not create a new Supabase project/branch. Use one **new disposable QA Tenant**, two **new QA Stores** in a private Store Authority schema, two **distinct new QA Auth users** (not customers), two scoped owner memberships and exactly two synthetic QA catalog entries. No live Orders/Products, no Merchant customer data/PII, no existing Store reassignment or subscription changes. No Messenger/Zalo provider send, no webhook edits, no new paid resources and no credential export.

**Critical approvals, ALL pending:**
1. **Founder/operator signed consent** explicitly approving this exact resource-count/scope, private MFA identity verified (a chat phrase or `approved=true` is not a private signature receipt).
2. **Independent security reviewer** approves RLS policy, Data API exposure of public `security_invoker` QA view, user session checking, and rollback. This is not claimed to exist simply because the founder runs a solo project.
3. **Backup/restore evidence** for the currently deployed tenant/membership schemas plus public view/grants baseline. Confirm a tested restore plan before any Auth/SQL write; do not destroy existing records.
4. **Secure Auth provisioning capability** using an approved Supabase Auth Admin workflow in a private operator context; never use direct inserts into `auth.users`, expose service_role to frontend/CI, put QA JWTs in GitHub issues/PRs, or ask ChatGPT for passwords.
5. **Explicit public Data API view approval:** new views in `public` may not be automatically admitted by recent Supabase Data API settings; test exact PostgREST endpoint and least-privilege `GRANT SELECT`/RLS, not project-wide broad exposure.
6. **Budget and rollback:** no new paid branch/project permitted. Existing staging usage may incur ordinary metered costs; any extra spend requires separately agreed limit. Record ONLY new QA IDs in a protected ledger, with exact session revocation and objects-only rollback.
7. **Independent no-send admission:** two real QA Auth JWTs under the same new QA Tenant, two distinct active sessions. A single solo founder controlling both accounts is valid for a technical isolation check ONLY, **not** proof of two independent Merchant humans.

The current `real-admission-state.json` keeps all above real approval flags FALSE; the word "Authorized" in the milestone name is NOT authorization to make security/identity changes.

## 3. New V17.2B source security admission gate

`qa/v172b-private-provisioning/provisioning-admission.cjs` is a pure, side-effect-free planner requiring server-trusted PRIVATE evidence and consent references bound to the same staging project + source commit and a short TTL. Approvals require two independently enrolled Ed25519 MFA-reviewed signers (staging owner and independent security reviewer), both signing the evidence/approval digests + nonce. A global atomic replay callback and final evidence/key recheck enforce fail-closed behavior, including revoked keys, concurrent nonce reuse, stale snapshots, forged signatures and extra requested resources.

It evaluates **16 readiness checks**, including actual SQL rollback test, empty target QA schema/view, no partially applied or unreconciled Auth/SQL resource, operator MFA, backup, Data API view consent, two distinct real Auth sessions, cross-Store PostgREST negative QA, revoked-session denial and an object-only rollback ledger.

**Even all source-test conditions green:** returns only `DISPOSABLE_QA_AUTH_PROVISIONING_APPROVAL_PREVIEW_ONLY` and `HOSTED_NO_GO`. No `allowAuthUserCreation`, `allowApplyMigration`, `allowLiveJwtUat`, `allowDeleteUsers`, `allowDataApiExposure`, production release or billing changes. Runtime cannot perform these actions by itself; it does not access real Auth/Admin APIs, credentials, messages or paid services. Tests use ephemeral mock Ed25519 keys, *not real humans*.

V17.2A real-JWT contract adapter remains `qa/v172a-store-auth/real-jwt-no-send-contract.cjs`, **not modified or wired to live APIs** by this source PR. Its user-JWT PostgREST transport and active-session lookup need independently approved private runtime bindings.

## 4. QA once separately authorized (hosted tests STILL NOT RUN)

Run exact real Auth API evidence in a protected runner with scoped operation permit, no logs containing tokens:
- Precheck real JWT A and B verified for Supabase issuer/audience/signature, distinct `sub` and distinct `session_id`, current active sessions, their SAME QA Tenant and different QA Store membership.
- **Five GET-only QA view checks**: A→A one synthetic SKU; A→B zero; B→B one; B→A zero; anon zero or HTTP 401/403. Ensure A's customer/order identity cannot be used by B, and no underlying production Products/Orders are accessed.
- Revoked Store membership must immediately deny A; revoked parent Tenant membership must deny A; revoked Auth session must deny A at gateway even if access JWT signature remains valid. Wrong tenant/Store, forged user_metadata, wrong issuer/audience, expired JWT and signed cross-channel mismatch are negative tests.
- NO Messenger/Zalo send, no commerce order write, no subscription/billing change. Document only hashes and pass/fail flags in **private** reviewer receipts.
- Any failure = NO-GO. Real UAT admission and production release are two separate decisions.

## 5. CI/verification, risks, rollback

New 40 source-only private authorization/identity approval regression cases, inherited 1290 V17.2A-and-earlier source QA = **expected 1330 total**, pending independent actual GitHub CI. Inherited disposable PostgreSQL 17 RLS and `security_invoker` tests are retained unchanged. Hosted release job intentionally RED until real consents, Auth sessions and UAT evidence are verified.

**Risk:** Live identity creation or a new public QA Data API view changes the staging security posture. Without a backed-up restore, independent review and controlled session revocation, even "disposable" accounts could be mis-scoped. Use a change-admission window and resource ledger. Never delete pre-existing users, tenants, stores, membership, orders, or expose JWTs in public CI.

**Actual changes of this milestone:** source files and Draft GitHub branch only. **Rollback now:** close the Draft PR. Future approved hosted changes require scoped database/identity cleanup, independent proof and rollback of newly created resources only.

**Next UAT prerequisites:** exact operator/owner consent + independent security review + verified backup/restore + separate approval for two QA accounts and view + secure private runner. Anything absent leaves **REAL JWT HOSTED NO-GO / PRODUCTION NO-GO**.

Official docs: https://supabase.com/docs/guides/auth/sessions ; https://supabase.com/docs/guides/api/securing-your-api ; https://supabase.com/docs/guides/database/views .
