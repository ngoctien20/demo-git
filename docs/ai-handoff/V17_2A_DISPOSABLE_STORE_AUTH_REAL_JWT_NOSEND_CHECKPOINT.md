# TIEN404 AI — V17.2A Disposable Store Authority Migration Approval × Real JWT Store A/B No-Send UAT

Date: 2026-11-17 JST. Parent: V17.1Z Draft PR #375, HEAD ab2a7421d9e7bf13636760f127e6c0179e9ad9d9.
Lifecycle: VERIFIED actual read-only baseline / IMPLEMENTED source-only migration candidate and private UAT adapter / REAL JWT BLOCKED / PRODUCTION NO-GO.

## 1. Actual live staging audit (read-only)
- Supabase staging project ifxlvrhyjhbzbrkdsida still has two mapped QA Stores in two DIFFERENT tenants; zero same-Tenant distinct-Store owner pairs and zero same-Tenant distinct active member/Auth session pairs. Auth users count: 3 (aggregate only, no email or secrets read).
- The old tien404_r1_qa.tenant_identity_map enforces UNIQUE(auth_tenant_id) and PRIMARY KEY(tenant_key). It cannot represent two separately mapped legacy Stores under one Auth Tenant. public.tenant_memberships has PRIMARY KEY(tenant_id,user_id) — tenant-level authority, not individual Store authority.
- Existing public.products/orders/customers use FORCE RLS and tenant-level read policies. Their direct Store-scoped policies count is ZERO. It is incorrect to call existing Commerce Store A/B isolated.
- Existing tien404_v175_qa customer_identity, channel_identity, order_ownership and auth_customer_binding are separate cross-channel/customer identity infrastructure. DO NOT recreate, drop, or repurpose them as store owner authority.
- Proposed tien404_v172a_qa schema and public.tien404_v172a_qa_catalog view DO NOT exist. The authenticated DB role already has SELECT on public.tenant_memberships and USAGE on public. No migration was applied.

## 2. Migration candidate: PREPARED, NOT APPROVED, NOT APPLIED
Source: qa/v172a-store-auth/migration-candidate.NOT-APPLIED.sql. It is intentionally outside the Supabase migration directory and is protected by BEGIN ... ROLLBACK. It is a review artifact, NOT a deployable production migration.

Four private QA tables are proposed: qa_tenants (one approved disposable new tenant), qa_stores (two Store keys in that tenant), qa_store_memberships (specific Auth user + Store authority, FK to parent tenant membership) and qa_catalog (synthetic QA-only Products). All tables have ENABLE/FORCE RLS, client writes have no policies, and only a self-membership and Store-owner-specific SELECT policy exists. No old Commerce tables, old owner claims or current tenant map constraints are changed. No user_metadata or SECURITY DEFINER function is trusted for authorization.

A deliberately narrow read-only public.tien404_v172a_qa_catalog view uses PostgreSQL security_invoker=true. Only authenticated SELECT is granted, with anon/PUBLIC explicitly revoked, and the underlying private tables still enforce caller-specific RLS. THIS PUBLIC DATA API VIEW IS A NEW SECURITY SURFACE REQUIRING SPECIFIC INDEPENDENT APPROVAL BEFORE ACTUAL DEPLOYMENT. No real business Orders or customer records are exposed by the candidate, only synthetic QA catalog entries.

### Migration approval gates
1. Confirm exact existing schema, identity provider, and available backups. Capture grants, RLS definitions, session state and migration SHA in a private audit registry; preflight no pre-existing target QA schema/view and separate recovery test.
2. Independently review security_invoker view, auth.uid usage, complete permission chain and RLS. Do not modify original tenant_identity_map UNIQUE constraint, old Commerce policies, Merchant ownership or v175 cross-channel identity tables.
3. Get scoped owner/operator authorization to create one NEW disposable QA Tenant, two Store authority rows and two separate real QA Auth users, each with an independent session and least-privilege membership. A single founder operating two test accounts is valid only for technical isolation, NOT two independent merchant humans consenting.
4. Create an official migration only after approval using current Supabase CLI workflow, pin commit and independently verify a disposable stage. Keep genuine JWTs, MFA and credentials in private operator tooling, never public Github, workflow logs or chat.
5. After verification, revoke disposable sessions and restore only the newly created objects with independently approved rollback. Never delete pre-existing Merchant data or assume a restored RLS policy revokes still-valid JWTs.

## 3. Real-JWT NO-SEND adapter: CODE READY, REAL UAT NOT RUN
Source: qa/v172a-store-auth/real-jwt-no-send-contract.cjs.

The adapter accepts only callbacks installed by a separately approved PRIVATE runtime:
- verifySupabaseClaims: should call Supabase auth.getClaims(jwt) or another trusted cryptographic verifier to prove the JWT signature. The code enforces exact staging issuer, authenticated audience/role, is_anonymous=false, distinct Auth subject IDs and session_id values, and unexpired JWT.
- lookupCurrentAuthSession: protected read that proves both session_id records still match each Auth subject in auth.sessions before AND after the read sequence. JWT signature validation alone does not prove session revocation. The protected collector must fail closed and never expose privileged credentials.
- readCatalogUsingEndUserJwt: real HTTPS PostgREST GET using each genuine end-user JWT and only the publishable key against the protected QA view, not service_role. Must not write business data or put bearer tokens in GitHub Actions, logs or the output receipt.

Required five read assertions: A→A one expected QA SKU, A→B zero, B→B one expected QA SKU, B→A zero, anon zero or HTTP 401/403. Also deny same user, same session, wrong issuer, wrong audience, revoked session, wrong tenant, expired JWT, fabricated response, unexpected cross-Store SKU, query outage or injected owner metadata.

The adapter has NO built-in network call, credential storage, Auth Admin write, Commerce mutation or provider send. Unit tests provide FAKE callbacks and fake JWT claims; these do NOT establish that any real Supabase Auth signer or REST API was used. Even complete synthetic acceptance returns HOSTED_NO_GO and no production permission.

## 4. CI and QA design
- New synthetic security contract suite: 35 QA cases; inherited V17.1Z–earlier source suite: 1255 cases. Candidate source total: 1290 (actual GitHub CI must independently confirm).
- New independent disposable PostgreSQL17 job must compile the exact NOT-APPLIED candidate, test public security_invoker view with synthetic Auth-role identities, A-own/B-own allow, A-cross/B-cross deny, owner Store membership revoked, parent Tenant membership revoked, anon no read grant, client no INSERT, and full transaction ROLLBACK.
- Prior V17.1Z and V17.1T disposable PG17 Store/RLS rollback suites remain intact.
- The actual trusted Supabase JWT, live session check, live PostgREST user-scoped read, owner approval and cross-channel Messenger/Zalo native signed no-send UAT remain untested and MUST make the hosted release gate FAIL CLOSED.

## 5. Change scope / risk / rollback
Only Draft child GitHub PR sources, tests, CI, report, and read-only staging SQL audits. No staging Auth/Tenant/Store/RLS/trigger/view changes, no Cloudflare Worker/Access/R2, no n8n Published edits, no real files, live order, payment, provider event or extra spend.

For V17.2A source milestone, rollback = close Draft PR. For any future authorized migration, independent rollback must restore original snapshots, revoke ONLY newly-created QA identities and remove ONLY explicitly tracked QA objects, with customer data untouched.

Remaining approval items: schema + public invoker view, new disposable Tenant/Stores, two real Auth QA identities, private runtime credentials/consent, independent review and budget. They are NOT implicitly granted by the milestone title.

Supabase docs: https://supabase.com/docs/guides/auth/sessions ; https://supabase.com/docs/reference/javascript/auth-getclaims ; https://supabase.com/docs/guides/database/postgres/row-level-security ; https://supabase.com/docs/guides/database/views
