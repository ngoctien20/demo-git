# TIEN404 AI — V17.1Z Scoped Private UAT Authorization × Existing Worker Access Admission × Disposable QA Auth Provisioning Preflight

**Checkpoint:** 2026-11-17 JST
**Parent:** V17.1Y Draft PR #367; HEAD `8569b0a926656908a979a0d6bcddb97e28b6d679`.
**Scope:** external infrastructure/Supabase **READ ONLY** + source-only Draft child PR. No Auth account, Tenant, Store, RLS, Worker route, Access policy, R2 lifecycle or credential mutation. Production **NO-GO**.

## 1. VERIFIED: live preflight, not a source-asserted acceptance

### 1A — Cloudflare Worker / Access

- Existing evidence Worker `tien404-rpc16-merchant-evidence-inactive-staging` is present with exactly the observed `R2_QUARANTINE` binding. `workers.dev` and preview are disabled. **Zero** matching custom Worker domain registrations and **zero** matching zone Worker routes were returned when querying the account's one visible zone. This means **no externally reachable protected QA URL was verified**: we cannot carry out a real Access deny/allow canary without a separately approved route change or discovery of another authorized private entrypoint.
- Cloudflare Access app `TIEN404 RPC16 Merchant Evidence Staging — DENY ALL` exists and has one self-hosted domain configured in app metadata. Its policies endpoint returned **ZERO** policies, including zero Bypass; no authorized operator allow or anonymous denial HTTP canary ran. **Access app association is not evidence that it currently protects this Worker.**
- Worker bindings listed only R2 quarantine; no durable replay binding was found. Existing namespaces in the account remain separate from evidence of a Worker-level atomic cross-restart service.

### 1B — R2 quarantine inventory and lifecycle

- Bucket `tien404-merchant-evidence-quarantine-staging` has `r2.dev` public development endpoint disabled and 0 custom R2 domains.
- Direct Cloudflare **GET list objects**, constrained to exact prefix `qa-v171x-disposable/`, returned **0 objects and no further page**. No object key or object payload was fetched. **This evidence is a point-in-time empty-prefix observation**, not consent to delete data, not a guarantee the prefix remains empty and not a substitute for a fresh read while writes are fenced prior to any R2 PUT.
- Lifecycle currently contains one enabled `Default Multipart Abort Rule`, aborting unfinished multipart uploads after 604800 seconds/7 days. No verified completed-object expiration rule exists; zero bucket-lock rules were returned. R2 object TTL, scanner/CDR and replay are still unproven.
- **No R2 lifecycle PUT**, upload/download/delete, lock or Access policy changes occurred. V17.1X proposed 24h object-expiration rule remains disabled and limited to disposable prefix, not authorized.

### 1C — Supabase Auth / Store authority: newly confirmed hard blocker

Staging project `ifxlvrhyjhbzbrkdsida`:
- Two mapped QA Stores are under **two different tenants**; 2 owner bindings, **zero** distinct two-Store/two-owner same-Tenant pairs, **zero** Tenants with two different currently active member/Auth sessions.
- **Schema constraint proof:** `tien404_r1_qa.tenant_identity_map` has **PRIMARY KEY (tenant_key)** and **UNIQUE (auth_tenant_id)**, plus `UNIQUE (store_key,bot_key)`. Therefore this legacy mapping cannot store a second distinct store mapping row for the same `auth_tenant_id`, and its primary key additionally limits one row per `tenant_key`. **Do not drop or relax any of these on the deployed existing schema to manufacture a QA success.**
- `public.tenant_memberships` is keyed **PRIMARY KEY (tenant_id,user_id)**, role in owner/manager/staff, with FKs to `public.tenants` and `auth.users`; it represents *Tenant membership*, not store-specific authority. No canonical `public.stores` or `public.store_memberships` table was found in this inspected scope.
- `public.products`, `orders`, `customers` are `RLS ENABLED` and `FORCE RLS` with one tenant-scoped SELECT policy each, **zero Store-scoped predicates**. Tenant-scoped membership within a multi-Store Tenant is insufficient to prove Store A/B isolation.
- `tien404_r1_qa.owner_bindings` and `tenant_identity_map` have RLS enabled but no direct policies and are not evidence of two real independently verified Auth owners.
- `public.qa_shop_b_zalo_claim` remains a **SECURITY DEFINER** RPC callable by `anon`, P0 security review candidate; no exploit or mutation is claimed.
- Messenger Published `Z7FdV7uDvApfbURQ` version `1064b1b3-d3f1-4a6b-a367-2414ba691522` remains active with all four original V17.15 nodes; Zalo Published `yIJk8LvJoLF40Z62` version `2d912cb0-007f-452f-9536-b92ba12a03e6` remains active; V17.1P test `p5OsIaB0NkMDFMw7` inactive with 0 credentials. No workflow edits.

**Decision:** Provisioning two QA Auth users first would be premature. A separate disposable Store authority model and tested migration plan are needed. No authenticated Store A/B JWT acceptance has occurred.

## 2. Proposed isolated QA Store authority — prepared, NOT APPLIED

`qa/v171z-private-uat/store-authority-proposal.NOT-APPLIED.sql` is NOT in the Supabase migration directory. It is a design-only SQL script enclosed in `BEGIN;` ... `ROLLBACK;`. **Do not run it against live Supabase without its own approval, backup and verification.**

The draft creates a standalone private `tien404_v171z_qa` schema (without changing any existing constraints), containing:
1. `qa_tenants` — approved disposable QA tenant only, with a preauthorized change receipt hash.
2. `qa_stores` — two distinct QA Stores sharing that tenant, composite PK `(tenant_id,store_key)`.
3. `qa_store_memberships` — individual user-to-Store authority; composite FK into QA Stores and the existing Tenant membership, preventing cross-Tenant user/store references. No user_metadata trust.
4. `qa_products` — **synthetic-only** store-scoped items; sample least-privilege SELECT policy explicitly matches both Tenant and Store and verified `auth.uid()` membership.

All four tables enable/force RLS; no INSERT/UPDATE/DELETE policies. No public grant is conferred and schema is not exposed to Data API. This is a **proposal**, not a tested live migration or real JWT admission. A separately authorized protected private reader and Data API exposure/grant decision are prerequisites for actual JWT Store A/B testing. **Never test via service_role or a privileged SECURITY DEFINER bypass and call it accepted**.

### Required acceptance cases once separately approved
- Real QA JWT subject A + session A, same new QA Tenant, Store A owner → A synthetic rows allowed and B denied.
- Real QA JWT subject B + session B, same Tenant, Store B owner → B allowed and A denied.
- Anon, expired/revoked Auth session, wrong Tenant, forged user_metadata/admin flag and cross-channel account switch → denied.
- Demonstrate DB policy, API reader, Auth membership revocation and source commit binding. Record private PII-free evidence with independent reviewer.
- Never alter real merchant accounts, production workflows or DEMO Products/Orders.

## 3. Exact scoped authorization packets — NOT GRANTED

**P1: Protected private Worker UAT route**
- Operator explicitly identifies an existing Access-protected test-only hostname+path. **Currently none was verified**. If none exists, opening/connecting a private route is a **distinct infrastructure change**, separate from permission to send four test GET/HEAD requests.
- Only isolated diagnostic handler, 4 GET/HEAD requests at most, no send/Commerce/customer data, no bypass and no new spend without approval. Prove both anonymous deny and authorized MFA operator allow. Have restoration route/settings checkpoint and independent reviewer sign off.

**P2: Disposable same-Tenant QA identities and Store authority**
- Separate approval to create a **new QA Tenant**, two Store entries in private isolated QA schema, and two **real distinct Auth identities** with independent sessions; membership/roles and RLS scope specified. Creating two accounts controlled by the solo founder is valid only for **technical isolation**, not proof of **two independent Merchant humans** consenting.
- Back up current schema/constraints, pin migration SHA, collect real Auth session owner binding privately and prepare targeted rollback for newly created QA records only; never reassign existing merchant/Store ownership.

**P3: R2 lifecycle and replay**
- Quarantined empty prefix can be reused only after a fresh full inventory and write fence. Existing lifecycle rule must be preserved verbatim. Any enabling of the 24h disposable-object expiry, scanner/CDR, durable replay binding or budget requires its own signed and scoped change request; the rollback cannot undo already deleted objects.

**Independent security review:** required before any real hosted acceptance. A GitHub source pass, fake signer keys or a request phrased as a milestone does not constitute this approval.

## 4. Source-only admission preflight and QA

`qa/v171z-private-uat/readiness-assessor.cjs` validates an exact-shaped *read-only snapshot*, checks absence of Worker route and Access policies, empty-prefix/freshness obligations, existing hard Store mapping constraints, lack of Store-level RLS and missing operator/signer/cost approvals. Returns a list of blocking codes. **Even a forged all-green input never grants any hosted action**: `HOSTED_NO_GO`, `allowCreateUsers:false`, `allowChangeRls:false`, `allowModifyR2:false`, `allowDeployWorker:false`, `allowNewSpend:false`.

`verified-readonly-baseline.json` contains only aggregate observations, not JWT, object keys, owner identifiers, customer files or secrets. It is an **audited point-in-time snapshot** rather than a live private signed evidence receipt. Real-time checks must be repeated prior to any separately authorized operation.

New tests cover actual blockers, no route even if Access app exists, structurally impossible store pairing, hostile payload injection, false all-green, held-open consent, previously empty R2 prefix becoming occupied, changed or partial list, and restrictions on merchant data. Inherit 1,225 parent source regression cases and disposable PostgreSQL17 RLS rollback, not a real Auth JWT test.

## 5. Change scope, risk, rollback, checkpoint

- V17.1Z changed **only new Draft GitHub child source/tests/CI/docs**. All direct Cloudflare and Supabase calls were **GET/SELECT only**.
- No Worker/Access route, R2 policy/bucket/object, Auth user, Tenant, Store, RLS, credential, Messenger/Zalo, order, customer, payment or billing modification.
- **Rollback:** close new V17.1Z Draft PR. Parent V17.1Y, deployed bots and existing staging resources unchanged.
- Source/PG17 QA results must be recorded from exact GitHub CI commit. Hosted real Access, signed consent, two-owner Auth JWT and real Store RLS remain **BLOCKED** until separately authorized and independently verified.
- Public provider docs are for design, not account verification: https://developers.cloudflare.com/workers/configuration/cloudflare-access/ and https://supabase.com/docs/guides/auth/sessions .

**Final admission target, not yet achieved:** REAL PRIVATE ACCESS DENY/ALLOW + ISOLATED NEW QA STORE AUTHORITY + TWO REAL JWT STORE READS/NEGATIVES + INDEPENDENT OWNER/REVIEWER ACCEPTANCE. Production remains NO-GO.


## 6. VERIFIED source and disposable PostgreSQL17 acceptance — 2026-11-17 JST

**Tested SHA:** c63959beba9134bf8c76de7e492000db898ea7f7
**GitHub Actions:** https://github.com/ngoctien20/demo-git/actions/runs/44103204088

- Job 134108454856 SUCCESS: **30/30** new V17.1Z negative/admission/structural preflight tests and **1,225/1,225** V17.1Y→older source regression cases = **1,255/1,255 source PASS**. The checked-in read-only snapshot explicitly has all real approvals FALSE, no actual Access route and no Store-scoped real Auth JWT claim.
- New disposable PostgreSQL 17 job 134108454373 SUCCESS: compiled the **isolated, NOT-APPLIED** tien404_v171z_qa schema design on an ephemeral PostgreSQL database using fake auth.users, public.tenants, tenant_memberships, a mock auth.uid() and two non-real QA identities. Created two QA Stores in one synthetic Tenant and one fake product each. Verified **A→A allow, A→B deny, B→B allow, B→A deny**, then revoked QA_OWNER_A membership and verified A→all deny. Checked anonymous lacks schema USAGE; full transaction ROLLBACK and verified QA schema/tables absent. No live Supabase Auth user, no real signed JWT, no staging RLS applied.
- Inherited disposable PostgreSQL 17 job 134108454858 SUCCESS: earlier same-Tenant Store A/B RLS fixture and full rollback.
- Real external Access route/authorized operator, real Store Authority migration + two real Auth user JWT and private R2 lifecycle/replay release job 134108806687 FAILURE BY DESIGN. Overall workflow red intentionally, while all three independent preflight/source/PG17 jobs green. Hosted/production stays **NO-GO**.
- This is more than a syntactic static migration draft: the future Store data/owner role model passed isolated mechanical RLS behavior. It is less than real hosted acceptance: no actual Supabase real JWT verification, session_id live revocation, real provider ingress or real Commerce Store RLS was tested.
- No actual Worker route, Access policy, R2 lifecycle/lock/object, Supabase schema/identity/membership, n8n Published workflow, provider send, customer order or billing changed. Only new Draft GitHub branch/PR source/test/docs/CI.
- The checkpoint-only documentation update produces a new HEAD; verify CI on the exact final HEAD before reporting this milestone as TESTED.

**Disposition: VERIFIED live structural blocker / IMPLEMENTED safe QA model / TESTED 1,255 source cases and two disposable PG17 suites / REAL ACCESS AND AUTH JWT UAT BLOCKED / PRODUCTION NO-GO.**
