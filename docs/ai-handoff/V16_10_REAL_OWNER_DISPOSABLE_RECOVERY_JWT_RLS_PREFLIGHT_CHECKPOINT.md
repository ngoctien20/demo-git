# TIEN404 V16.10 — Real Store Authority Evidence × Disposable Backup/Restore × JWT-RLS Preflight

**2026-11-16 JST**
**Release status: DRAFT / SOURCE ONLY; real hosted Store/JWT-RLS, real Owner/Provider identity, hosted backup and merchant pilot: BLOCKED.**
**Base:** V16.9 PR #207 \`ac42e70fde909900c19f869e77d860cd5efa9c43\`. Stacked child only; no merges.
**Security distinction:** This milestone adds an actual PostgreSQL 17 engine in GitHub Actions ephemeral service to test synthetic Store RLS and a synthetic database backup/restore. It DOES NOT perform a hosted backup/restore or verify Supabase Auth signatures, real users or Production Owner permissions.

## A. Read-only audit before changes
- PR #207 OPEN DRAFT at exact HEAD; V16.8 #203, V16.7 #199, V16.3 #194, V16 Hybrid #190 parent chain retained. Custom Bot Studio #117 and security RPC.3 #186 independent Drafts untouched.
- Supabase staging \`ifxlvrhyjhbzbrkdsida\`: \`public.products\`, \`orders\`, \`customers\` still lack Store-scoped \`store_id\`; public \`stores\`, \`store_memberships\` still absent. Tenant-level access cannot establish same-Tenant Shop A/B JWT rights. Existing unique \`(tenant_id,sku)\` prevents same-tenant multi-Store SKU reuse and must be reviewed for migration.
- Security Advisor: 1 anonymous-executable SECURITY DEFINER RPC, 2 authenticated-executable SECURITY DEFINER RPCs, leaked password protection WARN; private schema no-policy INFO requires context. No privilege, RLS or migration change performed.
- n8n Published Messenger \`Z7FdV7uDvApfbURQ\` version \`d5c96b6b-d790-4270-8b0f-d0ebdd8bbd92\`; Tenant Resolver \`5Eeh8hbpsoNhuiVo\` version \`a99c7350-7aea-446d-bdc5-4b10f52c3ad1\` unchanged. Legacy DEMO order and Google Sheets must not be treated as Shop transactional writer.
- Supabase authoritative technical references: https://supabase.com/docs/guides/database/postgres/row-level-security and https://supabase.com/docs/guides/api/securing-your-api .
- Because the hosted data schema is not ready, **do not call hosted JWT testing as PASS** even if temporary Postgres RLS tests are green.

## B. NEW: disposable PostgreSQL 17 test, not a hosted migration
Source-only folder: \`qa/v1610-disposable/\`.
- \`postgres-fixture.sql\`: executable test-only PG SQL; first checks database name **exactly** \`t404_v1610_disposable\`, creates QA schemas \`qa\`, \`qa_auth\` and t404 test roles (NOLOGIN, NOBYPASSRLS). This is **NOT** a staged Supabase migration. One tenant with two Stores A/B and one additional tenant C; SKU \`SAME01\` appears across A/B/C with price 159000,209000,259000. Only generated UUID fixtures and dummy labels.
- \`qa_auth.uid()\` reads an artificially set \`request.jwt.claim.sub\` in the test transaction. **It is not Supabase auth.uid(), not signed/authenticated JWT and not a legitimate bearer credential.** Test uses \`SET LOCAL ROLE t404_authenticated\` instead of executing all permission cases as privileged postgres, proving RLS enforcement by PostgreSQL engine for the proposed policies.
- Store scoped RLS \`USING\`/\`WITH CHECK\` on products; customer/order read policies and orders insert. Composite FKs require order and customer to belong to the same Store, independently of API code. Membership table RLS exposes only a user's own memberships. No service-role bypass added.
- \`test-store-rls.sql\`: repeatable asserts for real PostgreSQL role-vs-row enforcement: Owner A own A price, deny B products/customers/orders and write; Owner B own B and deny A; owner C cross tenant deny; missing claim denies; revoked membership denies; prevent moving product Store IDs; cross-Shop order insert and cross-store customer FK failure. Each write-test uses transaction rollback.
- \`run-disposable.sh\`: **double host guard**: GitHub-hosted \`GITHUB_ACTIONS=true\`, repository \`ngoctien20/demo-git\`, explicit \`T404_DISPOSABLE_QA_ONLY=YES\`, \`PGHOST=127.0.0.1\`, \`PGPORT=5432\`, \`PGUSER=postgres\`. Fail if either synthetic DB name already exists; do not drop any preexisting database. Creates local synthetic DB, tests it, pg_dump custom on ephemeral runner, SHA-256 verify, pg_restore into **another** local database, re-run same RLS tests, compare Store/Product/Customer/Order counts and total synthetic price sum.
- Dump contains **ONLY fake data**, is not encrypted by this test, stays in ephemeral runner and is deleted by trap. Do **not** claim encrypted hosted backup, restore RTO/RPO, recovery of real customer data or actual Supabase schema compatibility.

## C. Actual private human/hosted authority evidence: MISSING
\`docs/ai-handoff/V16_10_PRIVATE_OPERATOR_AUTHORITY_EVIDENCE_MANIFEST.json\`: 11 required gates initialized \`MISSING\` (authority, Page/OA owner, actual JWT A/B, cross-store read/write, legacy mapping, hosted encrypted backup digest, private disposable restore, RPC caller attestations, signed DPA, n8n SaaS license, no-dual-writer canary). No real names, IDs, credentials, backup paths, fingerprints or PII in GitHub. A machine-authored or self-reported PASS is NOT independent validation.

### Operator handoff — order matters
1. Authorized business owner proves ownership of Shop and Page/OA in a provider-native private flow, signs scoped service/DPA. Operator records opaque private evidence reference, **not raw evidence publicly**.
2. DBA + independent security reviewer obtain the **exact hosted** schema, ACL, dependency and external caller map (including \`qa_shop_b_zalo_claim\`, \`qa_owner_pairing\`, \`save_merchant_product\`). Approve conditional backfill and same-tenant Shop ownership mapping for every existing row. Any unknown mapping => quarantine; never guess.
3. Separate backup/recovery operator, after a specific written host/back-up authorization, creates encrypted real hosted backup using approved operator tooling; records SHA-256 of encrypted artifact, encrypted key custody, database identity, timestamp, LSN/PITR considerations, storage retention and restricted restore target. Keep secrets and files outside public logs/GitHub. Restore to an isolated disposable **private** project, validate row hashes/constraints and reversible rollback; record independent reviewer acknowledgement.
4. Only after Store schema migration on explicitly approved nonproduction host, authenticate genuine Shop A and Shop B **Supabase Auth JWTs** and assert read and write cross-Shop denial (same Tenant) including unrelated Shop C; sign-out, suspension, role change, forbidden support access, and stale JWT checks. Do not use SQL Editor postgres in place of Owner JWT.
5. Independently certify Page/OA account ownership, cross-store channel mapping, actor entitlements, provider send restrictions and n8n Cloud SaaS license terms.
6. Verify true atomic order writer, single writer cutover, idempotency and no dual deduction; hard-fail if not done.
7. Only an explicitly authorized release owner can approve hosted cutover/pilot, after evidence 1–6 completed; this source-only milestone does not grant any such approval.

### Evidence not available in this chat
- No real Owner A/B Supabase user authorization or private provider proof; no ability to responsibly claim proof.
- No independent backup/restore operator/approved recovery access and no real backup file; CI disposable pg_dump is *not* a substitute.
- No hosted Store schema to audit same-Tenant RLS; need approved migration plan, backup and separate authorization.
- No signed DPA/n8n commercial permission and no confirmed Page/OA authorized binding.

## D. Security and failure acceptance criteria
- PostgreSQL role used for tests must be \`NOBYPASSRLS\`; no broad auth role or provider token leaks.
- RLS must deny A reading/writing B even though Tenant is the same; same SKU prices differ.
- No user or LLM provided tenant/store/session value used as authority in production; auth_sim is fixture only.
- Product \`(tenant_id,store_id,sku)\` composite uniqueness and order-customer same-Store FK.
- Expired or revoked membership causes query denial. Real JWT revocation still requires separate hosted tests.
- Backup SHA verification, restore onto separately named empty ephemeral DB, re-check RLS after restore.
- Dry-run restore must not drop or alter real databases, public Supabase or n8n.
- CI green on exact PR HEAD => \`TESTED_EPHEMERAL_PG\` only, not \`HOSTED_SECURITY_CERTIFIED\`.
- All new scripts require no paid model/production credentials, no Meta/Zalo messages and no customer data.

## E. Rollback
Close stacked Draft PR. No hosted DB schema/data, Supabase auth, credential, Cloudflare, n8n Published or merchant import changes. GitHub runner disposable containers are ephemeral; no production rollback to execute.

## F. Next decision
**V16.11 (PROPOSED):** Private merchant owner evidence and hosted backup/restore authorization request — specify operator, project reference, exact SQL/backup scope, sealed evidence location, recovery window, cost, rollback and independent Security Reviewer; **do not apply** until separate explicit user approval. Separate n8n SaaS license legal gate remains open.

**CI result:** Pending exact-head GitHub Actions. Any CI failure => BLOCKED until fixed and rerun.
