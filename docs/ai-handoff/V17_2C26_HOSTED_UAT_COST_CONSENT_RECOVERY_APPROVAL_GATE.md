# TIEN404 AI — V17.2C.26 Hosted Real JWT UAT Admission / Approved Disposable Recovery Gate

Date: 2026-11-18 JST.
Previous checkpoint: V17.2C.25 SHA `4f1112f955b92cb818b569089dbaba8f0e0b4238`.
Draft PR #392; tracking / approvals: [GitHub issue #399](https://github.com/ngoctien20/demo-git/issues/399).
**Decision: SOURCE/POSTGRES VERIFIED, HOSTED REAL JWT UAT NO-GO.**

## Verified
- V17.2C.25 CI: source security [44229868580](https://github.com/ngoctien20/demo-git/actions/runs/44229868580), protected consent [44229868741](https://github.com/ngoctien20/demo-git/actions/runs/44229868741), ephemeral Postgres [44229868589](https://github.com/ngoctien20/demo-git/actions/runs/44229868589) — all SUCCESS.
- Existing Supabase `tien404-staging` ref `ifxlvrhyjhbzbrkdsida` ACTIVE_HEALTHY, PostgreSQL 17.11, 0 development branches. No isolated disposable branch currently exists for this UAT.
- Latest PR #392 remained OPEN DRAFT at checked checkpoint.
- Supabase official branching docs indicate preview branch is isolated but can incur recurring branch/compute cost and derive schema/config/migrations from source project; confirm account-specific quote before authorization (https://supabase.com/docs/guides/platform/manage-your-usage/branching ; https://supabase.com/docs/guides/deployment/branching). An advertised public rate is NOT a quote or approval for this organization.
- No verified real independent consent A/B, real JWT Auth/session evidence, reviewer acceptance, org cost approval or isolated restore rehearsal.

## Work completed V17.2C.26
- Created GitHub issue #399 with a **concrete, unchecked 11-stage approval/UAT checklist**, named parent PR, evidence, private no-send isolation, owner/role responsibilities and prohibitions.
- No fake consent, JWTs, credentials or billing data were created or committed.
- No Supabase branch creation / payment / schema, Auth/Store permission, live webhook or customer records were touched.

## Authorization required before any hosted operation
1. Authorized org billing owner privately verifies organization ID; query provider-specific branch/project quote, then accept explicit hourly cap and total cap, expiration and cleanup owner. Generic 'continue' is NOT approval of cost.
2. Security owner reviews existing Commerce migrations/privileges and forbids customer data/secret copying; agrees to synthetic-only seed and independent rollback/restore drill.
3. Independent QA Actor A and B each authenticate directly on protected, **approved disposable** Auth instance and voluntarily consent to narrow read-only/no-send Store A/B scope, separate sessions and revocation.
4. Private independent reviewer verifies signed JWT subject/session_id, active session authority, Store A/B owner membership, origin/Access policy, replay registry and actual negative PostgREST reads. The app must not accept client-provided trust booleans.
5. Hosted UAT GO only after detailed security reviewer sign-off and redacted auditable evidence; production remains NO-GO.

## What remains BLOCKED
- Verified organization-specific price and cost cap: NOT APPROVED.
- Dedicated disposable Supabase development project/branch: NONE.
- Independently consented Auth owners and protected HTTPS live intake: NOT DEPLOYED.
- Private actual session proof and negative real JWT/PostgREST UAT: NOT RUN.
- Production Messenger/Zalo/Commerce rollout: NO-GO.

## Rollback and release
This stage changed only GitHub issue/checkpoint metadata. Close issue #399 or revert checkpoint if cancelled. PR #392 remains Draft. No runtime rollback necessary. Do not promote or merge on issue creation alone.
