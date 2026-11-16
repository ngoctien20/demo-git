# TIEN404 V15.0-09B — Hosted JWT/RLS Test Plan (PREPARATION, NO EXECUTION)
Date: 2026-11-16 JST
Scope: PostgreSQL 17 source-level mock-claim rehearsal + live hosted READ ONLY inventory.
No real JWTs, Auth accounts, service role tokens, data writes or migrations were used.
The local harness is not an exact deployment of Supabase Auth/PostgREST and must NOT certify hosted RLS.

## Dependency truth
Current Supabase hosted: 2 Tenants, 3 active memberships, NO public.stores/store_memberships and NO Store columns in business entities. Existing SELECT policies have Tenant member conditions, not per-Store. This means there is currently NO legitimate hosted JWT/RLS test proving A vs B within one Tenant. A same-Tenant A/B isolation gate cannot PASS until Store hierarchy, ownership, policy and data fixtures are separately approved and deployed to an isolated TEST TARGET.

## Test layers
0. Live hosted read-only structural inventory: policy text, grants, Auth/QA row counts, user-store proof readiness (aggregates only). No personal data output or session impersonation.
1. CI disposable Postgres 17: simulated auth.uid() via UNSIGNED request.jwt.claim.sub session variable and synthetically generated A/B/C owners. Test baseline tenant-wide policy reproduces same-Tenant visibility, restrictive Store policy closes this gap, FK and write guards. Database discarded after job. No actual Auth JWT signature check, no Meta/Zalo provider proof, no tenant secrets.
2. Future isolated staging Auth/PGRST UAT: actual verified test user sign-in (no secrets in public CI), real session claims independently matched to owned Store, tenant A/B sharing tenant and C separate tenant. Requires owner authorization and hosted migration first.
3. Future release security review: approved RPC exposure hardening, service-role confusion, credential handling, revoked sessions, replay, outbox, backups/restore and quantitative telemetry. Separate go-live approval.

## Signed real JWT test prerequisites (MUST be independently satisfied)
- [ ] Owner G0 signed four-row evidence, independent provider consent G2.3; no fake Store ID.
- [ ] New Store schema and Store-scoped policies applied ONLY to isolated authorized target.
- [ ] Product/Order/Conversation/Message/Config/Idempotency FK and policy cutover reviewed; no unscoped legacy NULL leak.
- [ ] Backup/restore rehearsal completed and results privately stored (not just dashboard backup claimed).
- [ ] Test users A, B, C with separate genuine Supabase Auth test sessions; no raw token logging.
- [ ] Operator confirms test target, distinct from production, and per-operation approval.
- [ ] Device/browser session expiry and revocation cases prepared.
- [ ] Dedicated QA order fixtures; zero customer or actual merchant data.

## Mandatory negative matrix (expected results)
- Owner A reads Product/Price/Order/Customer from A => allowed by validated A membership.
- Owner A reads/updates/inserts for B (same Tenant) => denied/zero rows.
- Owner B reads/updates A => denied; B reads own => permitted.
- Owner A/B reads C (different Tenant) => denied; Owner C reads A/B => denied.
- Tenant Owner with no Store Membership => denied.
- Expired/inactive Tenant Membership, revoked Store Membership, paused Store => denied immediately.
- Anonymous/no JWT/expired real JWT => denied; client-supplied Store or role claim => no authority.
- INSERT into B, UPDATE to reassign A row to B, UPDATE price in B, DELETE B => denied/zero rows.
- Cross-Store OrderItem references parent Order in A and Product in B => FK denied.
- Identical SKU under A and B must resolve to correct Store price/stock.
- Member views and RPC must not bypass Store RLS; service role bypass must be separately bounded by application/backend authorization.
- Provider binding from wrong Page/Bot/account/tenant, revoked or duplicate event => denied; no real provider call necessary in preliminary local tests.
- Product/Order/Conversation/Memory/Outbox/notification references must never mix Store IDs.
- Subscription lapse, session revoked and owner consent revoked => deny without stale cached role.

## Evidence capture for actual hosted UAT
For each case capture run ID, target environment ID, policy+schema version SHA, test operator, token fingerprint only (NOT JWT), store/tenant reference hash, request ID, exact expected/observed status, DB audit evidence, timestamp, PASS/FAIL, rollback note. Private results only. Avoid revealing PII in public pull requests.
Do not use the real production service_role key to execute arbitrary user-controlled Store queries. Inspect the separate service-role bypass threat on disposable test DB and narrow trusted server routes.

## Disposable CI limits
- It uses ALTER/CREATE/GRANT only inside freshly created ephemeral PostgreSQL 17 container in GitHub Actions. It DOES NOT connect to Supabase and does not run the guarded V15.0-09 migration draft.
- The simulated claim is UNSIGNED; it establishes PostgreSQL policy behavior only. It cannot guarantee future hosted JWT claims, Auth sessions, PostgREST role mapping, RLS schema, or network enforcement.
- CI success should be labeled TESTED_EPHEMERAL_PG, never HOSTED_JWT_CERTIFIED.
- No real Order write, credential test, channel send or cost incurred from providers.

## Preflight / rollback / gates
G0 BLOCKED — Owner proof, private evidence capture, accurate legacy Store attribution, restore rehearsal.
G1 PROPOSED — Review migration design and isolated target, apply only after explicit approval.
G2 PREPARED_NOT_HOSTED — Disposable RLS behavior rehearsed, pending real signed Auth/JWT/Store table test.
G3 BLOCKED — Native provider ownership, shared Commerce Core read-only hosted integration, Owner UAT.
Release NO-GO. Child Draft PR may be closed without runtime rollback; future hosted rollback demands recoverable backups and signed migration cutover plan.
