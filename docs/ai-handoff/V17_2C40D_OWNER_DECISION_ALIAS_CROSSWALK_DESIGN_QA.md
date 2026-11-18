# TIEN404 AI — V17.2C.40D Protected Owner Decision Contract × Canonical Alias Crosswalk Design

**Date:** 2026-11-18 JST. **Parent:** V17.2C.40C source-only checkpoint. **Draft PR:** #392. **Code/test commit:** 8b144682771032eef37c593aac34c41638300ec9. **Status:** DESIGN + SYNTHETIC CONTRACT QA PASS / REAL OWNER DECISION AND AUTHORITY NO-GO.

## 1. Purpose and scope

V40D defines two separate, non-authorizing contracts:
1. A private owner business-boundary decision: S1, S2 or S3.
2. A namespace-qualified source-alias crosswalk proposal.

A business decision is **not** a Store membership grant. A crosswalk is **not** a tenant resolver until its private evidence, source provenance, signature, owner scope and revocation are verified by a protected server. Passing synthetic validation does not authorize real Auth, reads, writes, migrations or provider messages.

No real owner IDs, Store UUIDs, provider account IDs, alias values, JWTs, tokens, credentials, emails, phone numbers or customer data are present in the new source templates.

## 2. Explicit S1 / S2 / S3 decision model

| Scenario | Meaning | Permitted conclusion | What remains prohibited |
|---|---|---|---|
| **S1** | Two people co-own one Store | One Store ownership boundary can be reviewed; collect each co-owner's separate consent | Does not prove two-Store isolation or admit same-tenant Store A/B |
| **S2** | Two distinct Stores under one Tenant | Two separate Store boundaries can be reviewed; each Store must have its own verified owner scope and separate authenticated actor for A/B negative tests | Does not create Stores, memberships, canonical mappings or migration approval |
| **S3** | Relationship unresolved / not decided | Keep no Store assignments and no grants | All Store grant, cross-channel, migration, real Auth UAT and writer gates stay BLOCKED |

**Default state is S3.** Do not infer S1 or S2 from two active Tenant owners, a paired QA flag, a Store label, matching names, phone numbers, provider sender IDs, or model inference.

The live Supabase read-only recheck for this checkpoint remains:
- 1 Tenant with at least two active owner candidates; only 1 QA Store mapped to that Tenant.
- 2 QA owner bindings marked paired/unexpired; 1/2 complete confirmed-claim + consumed-challenge + active real tenant owner requester chain.
- public.stores and public.store_memberships absent; zero store_id columns across Orders, OrderItems, Products and Customers.
- app_private.channel_secrets, protected QA channel identity, customer binding and order ownership row counts are zero.
- No Supabase development branches exist.

These are metadata/aggregate checks, not proof that the two people are owners of two different stores.

## 3. Owner decision and consent evidence envelope

The public GitHub template qa/v172c-rpc-closure/v172c40d-owner-decision-NOT_APPROVED.json is intentionally S3, empty of Store/owner consent rows, and has authority_effect=NONE.

A future separately approved private service must require, for each owner and Store boundary:
- Server-resolved authenticated user identity and current session; never accept client-supplied auth_user_id, role, Tenant or Store as authoritative.
- Current server-side Tenant membership and explicit Store membership evidence. A Tenant-level owner role alone is not proof of membership in every Store.
- A one-time challenge bound to the intended Tenant, Store, decision version, owner session and exact operation; confirmed and consumed atomically. Reject replay, expired, revoked, wrong-scope or reused challenge.
- Separate explicit owner consent for each Store boundary and each Store-owner grant. S1 requires both co-owner consents for the same Store. S2 requires separately scoped owner evidence for both Stores and distinct authenticated actors for A/B negative isolation UAT. S3 carries no Store grants.
- Cryptographic signature verification performed by the trusted private server against a versioned trusted key profile; record only opaque evidence references and a SHA-256 payload digest in audit metadata. The synthetic boolean signature_verified_by_trusted_server is a test fixture only, never an actual proof.
- Independent reviewer identity, evidence issuer, verification time, expiry, revocation status and immutable change-ticket reference. Reviewer must not be the owner whose claim is being reviewed.
- A current-session and revocation check at the time of every sensitive admission. Do not authorize from a stale token or from user-editable user_metadata. Supabase's docs note that raw_user_meta_data is user-editable, JWT claims may be stale until refreshed, and a sensitive application can correlate session_id to auth.sessions for strict post-signout checks.

**Identity is not permission:** successful login only authenticates a person. It does not authorize that person to read or write a Store's products, customers or Orders.

## 4. Canonical alias crosswalk contract

The second template qa/v172c-rpc-closure/v172c40d-alias-crosswalk-NOT_APPROVED.json has an empty mappings list, S3 owner decision and every release gate false.

Every future private mapping is revisioned and scoped by:
source_system + namespace + alias_kind + alias_ref + source_revision
→ canonical tenant_id + store_id (where applicable) + provider installation.

Required provenance:
- Exact source system and registry, declared namespace and source schema/version.
- Opaque source alias and source revision; no string coercion or automatic join across namespaces.
- Canonical Tenant/Store target resolved server-side, with Tenant↔Store consistency.
- Owner decision reference, per-Store owner approval reference and independently verified source evidence.
- Provider installation proof, when the mapping concerns an installation/channel; signed provider source, webhook route binding, allowed operations, active status and replay protection.
- Trusted verifier, independent reviewer, signature/key-profile reference, signed-payload digest, validity interval, explicit revocation state and append-only revision history.

Collision and lifecycle rules:
1. One (source_system, namespace, alias_kind, alias_ref) may resolve to only one active canonical target. A second target or duplicate active mapping is DENY.
2. The same alias text in two different namespaces is **not** a join. Do not merge or coerce it.
3. Many distinct, independently proven aliases may point to one canonical Tenant/Store; each requires its own evidence and review.
4. One provider installation maps to one Store by default. A multi-Store provider account requires a separately designed and approved routing/authorization model; never let an incoming message choose its Store.
5. A Tenant alias alone does not infer a Store.
6. Unknown source, unknown revision, expired/revoked proof, missing revocation state, missing provider proof or unresolved owner decision is DENY.
7. Historical Orders without Store provenance remain quarantined; do not infer Store from phone, sender ID, SKU, text, or AI.
8. Revocation is append-only and immediately invalidates future admissions; never overwrite history to make a stale mapping appear current.

## 5. Supabase Auth / RLS design guardrails

Before any future SQL/RLS implementation:
- Resolve request identity from verified Auth context (auth.uid()) and current server-side membership records; do not use user-editable user_metadata as an authorization source. app_metadata is server-controlled but JWT claims can remain stale, so current membership and revocation state must still be checked for sensitive operations.
- Use explicit policy role targets such as TO authenticated; authentication alone is not authorization. Enforce both Tenant and Store membership.
- For updates, pair USING with WITH CHECK; test that a caller cannot reassign a row into another Store.
- Prefer SECURITY INVOKER. If a narrowly scoped SECURITY DEFINER helper is proven necessary, keep it in a non-exposed private schema, pin search_path = '', schema-qualify every relation, revoke EXECUTE from PUBLIC/unneeded roles, grant only to the precise caller role, and independently review owner privileges and function body.
- Use current active session verification for sensitive owner approval and Store membership changes. Supabase exposes a session_id claim and documents checking it against auth.sessions when post-signout invalidation must be strict.
- On PostgreSQL 15+, any exposed view that must obey caller RLS should use security_invoker = true; independently audit functions and views because they can bypass expected RLS behavior.

References:
- Supabase Row Level Security: https://supabase.com/docs/guides/database/postgres/row-level-security (updated Nov 3, 2026).
- Supabase User sessions: https://supabase.com/docs/guides/auth/sessions (updated Oct 19, 2026).
- Supabase Database functions: https://supabase.com/docs/guides/database/functions.

These are design guardrails only; no policies or functions were changed in V40D.

## 6. IMPLEMENTED and TESTED source artifacts

- qa/v172c-rpc-closure/v172c40d_owner_decision_crosswalk_contract.py: pure Python validator for synthetic S1/S2/S3 decisions and namespace-qualified alias crosswalks. It performs no I/O and never grants authority.
- qa/v172c-rpc-closure/v172c40d_owner_decision_crosswalk_contract_test.py: synthetic positive/negative tests for S1/S2/S3, explicit consent, signature metadata, session reuse, expiry/revocation, reviewer independence, alias collisions, namespace separation, provider installation conflicts, missing provider proof and secret-field rejection.
- qa/v172c-rpc-closure/v172c40d-owner-decision-NOT_APPROVED.json: safe default S3 template, no owners/Stores/consents.
- qa/v172c-rpc-closure/v172c40d-alias-crosswalk-NOT_APPROVED.json: empty alias map, all release gates false.
- .github/workflows/v172c15-ephemeral-postgres-qa.yml: new synthetic V40D test step. This uses no remote database, real Auth session, provider or secret.

Maximum positive state is SYNTHETIC_REVIEW_ELIGIBLE_ONLY; every output remains authority_granted=false, store_membership_granted=false, real_auth_uat_admitted=false, real_ab_uat_admitted=false, migration_admitted=false, and production_send_admitted=false.

## 7. QA evidence and remaining gate

At code/test commit 8b144682771032eef37c593aac34c41638300ec9:
- PostgreSQL 17 + V40B/V40C/V40D source preflight run #44259999210: V40D step SUCCESS, log: Ran 41 tests ... OK.
- Full PR check suite still needs final independent recheck after the checkpoint report commit; do not treat a pending job as PASS.
- V40D tests are synthetic and prove contract behavior only, not signature validity, live identity, RLS isolation, or a private backend implementation.

## 8. Status, rollback and next

- **VERIFIED:** Supabase SELECT-only aggregate facts; n8n 4 Tenant aliases and 6 Channels, 6/6 internal tenant-alias references, 3 enabled but only sandbox/not_connected statuses; no real cross-system mapping established.
- **IMPLEMENTED:** S1/S2/S3 contract, private evidence design, namespace collision rules, empty NOT_APPROVED templates and synthetic tests.
- **TESTED:** V40D CI step 41/41 PASS; no real Auth/provider/database interactions.
- **PROPOSED:** a private owner approval service and server-verified alias crosswalk; not built or deployed.
- **BLOCKED:** actual S1/S2 decision, signed per-Store approvals, complete owner provenance 1/2, provider installation proof, canonical Store schema/RLS, real Auth A/B.
- **NO-GO:** Supabase migration, real Store grants, real Order reads/writes, n8n Published changes, provider send, production release.
- **Rollback:** revert V40D Python/test/JSON/workflow/doc commits from Draft PR #392. No hosted rollback is required.
- **Next:** only after owners complete the private S1/S2/S3 decision, review each signed Store boundary and the missing owner-binding provenance. If S3, remain blocked. If S1, design co-owner tests and use a separate independently approved Store/Tenant for isolation testing. If S2, verify two Store owners, then perform private crosswalk collision review and authenticated read-only A/B admission. No schema migration or writer until those steps pass.

**Checkpoint:** V17.2C.40D is a source-only design and QA milestone, not an authority or production milestone.
