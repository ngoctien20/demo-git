# TIEN404 AI — V14.4.1 Hosted Security Readiness & PR Dependency Reconciliation

**Checkpoint:** 15 Nov 2026 JST — verified live GitHub, Supabase, n8n, CI
**Lifecycle:** EXPERIMENTAL / DRAFT / NO SEND / NO HOSTED SCHEMA CHANGE
**Repository:** https://github.com/ngoctien20/demo-git
**PR:** https://github.com/ngoctien20/demo-git/pull/101
**Branch:** work/v1441-hosted-security-pr-reconciliation-staging-20261115
**Base:** PR #97, HEAD at branch creation 67ccf9334e81f346f2aebdc1fbf1bf7ec0275e32
**Migration permission:** BLOCKED by missing restore, ownership and owner acceptance.
**User intent:** Continue implementation without changing production, RLS, credentials, price plans, real customer records or provider sends.

## 1. VERIFIED live PR dependency graph

| PR | Purpose | Verified HEAD at audit | Base | State | CI |
|---|---|---|---|---|---|
| #86 | V14.2 Store/RLS + Onboarding | 635e1d8e634556887eb35fd318b892c740177a9e | V14.1 #85 | OPEN DRAFT | 43718874247 SUCCESS |
| #94 | V14.3 Unified Channel & Widget | 02c480d6925234631a94c9ad1c5b705b07c4128d | Messenger #92 | OPEN DRAFT | 43716550115 SUCCESS |
| #95 | V13.6M.7 Hosted replay evidence | ad35baec097a7e8289518ec66ff74b1a19f1b3d3 | Messenger #93 (off #92) | OPEN DRAFT | 43716811550 SUCCESS |
| #97 | V14.4 Secure Widget source | 67ccf9334e81f346f2aebdc1fbf1bf7ec0275e32 | V14.3 #94 | OPEN DRAFT | 43720672744 SUCCESS |
| #101 | V14.4.1 release evidence review | See latest GitHub PR HEAD | V14.4 #97 | OPEN DRAFT | New V14.4.1 CI (below) |

Verified GitHub compare endpoints:
- #94 is ancestor of #97. #95 and #94 diverge at Messenger #92 commit 9aa08520525d746121194143e521a89393cd3988.
- #86 and #97 are divergent with remote merge base 2ddf0138e57bf65b458786271e3a39591b26b0d7. This is a much broader Git history divergence, not evidence of conflict-free functionality.
- PR changed-file lists #86/#94/#95/#97 are concentrated in separate paths. A textual conflict-free merge is plausible but does NOT validate API/DB behavior.

**PR #101 DIAGNOSTIC ONLY:** GitHub Actions uses git merge-tree and commit-tree in its disposable runner to combine V14.4.1 + #95 + #86. It NEVER moves a GitHub ref, pushes a commit, opens any provider gateway or edits the real database.

## 2. VERIFIED live Supabase staging — read-only

Project tien404-staging (ref ifxlvrhyjhbzbrkdsida), PostgreSQL 17.11.
- public.products=2 and public.orders=2. Nothing changed or assigned to a store.
- No public.stores / public.store_memberships / app_private.shop_knowledge_releases / app_private.messenger_event_claims / app_private.widget_installations.
- All SIX Commerce tables products, customers, orders, order_items, conversations, messages have tenant_id but NO store_id.
- All six have tenant-level PERMISSIVE SELECT policy. Adding a Store SELECT policy without removing the old tenant policy allows access by OR.
- products_tenant_id_sku_key enforces UNIQUE(tenant_id,sku), preventing the intended same-tenant two-Store same-SKU differentiation.
- SECURITY DEFINER RPC checks (review, NOT exploitation proof):
  - qa_shop_b_zalo_claim has anon EXECUTE=true, no store_id reference.
  - qa_owner_pairing has authenticated EXECUTE=true, references auth.uid, no store_id reference.
  - save_merchant_product has authenticated EXECUTE=true, references auth.uid, no store_id reference.
- No RLS, grants, functions, migrations, customer data, or credentials changed in this task.

## 3. Backup and restore — existing blocker (not silently waived)

Operator-controlled local backup file E:\pgadmin\tien404_backup\TIEN404_V142_PRE_RLS.backup, Explorer screenshot 212 KB, pgAdmin pg_dump successful, pg_restore --list exit code 0, TOC contains app schemas, public products/orders TABLE DATA and RLS POLICY. Operator computed local SHA256. **The file bytes are not accessible to this GitHub CI environment.**

The user deferred the full isolated restore drill to keep developing. That permission does NOT mean the archive was successfully restored. Need real restore to isolated PostgreSQL 17, object/count/policy checks and owner-accepted rollback before staging schema/RLS changes.

## 4. VERIFIED n8n baseline (read-only)

- Messenger Published Z7FdV7uDvApfbURQ ACTIVE version d5c96b6b-d790-4270-8b0f-d0ebdd8bbd92.
- Zalo staging ingress yIJk8LvJoLF40Z62 ACTIVE version 8ca4a6f6-ab3f-42f1-8637-d4f5db790a3e.
- Private router sIPs6egzIwOY1GNv ACTIVE version 8d91d23c-cd87-462f-a112-9cca2340bec8.
- V14.2 QA FIE7nl2vgLXQI7mT INACTIVE version b24c7a86-66bf-45a2-b48b-a81c54e375bb (execution 3833 SUCCESS).
- V14.3 QA KjcnFcdg3lDQcZyW INACTIVE version 6bc45697-9541-4894-bac8-577b4e5fd499 (execution 3839 SUCCESS).
- No n8n workflow, credential or provider send modified in V14.4.1.

## 5. IMPLEMENTED in PR #101 — source-only safety evidence

1. qa/hosted-readiness-v1441/release-evidence-gate.cjs
   - Pins a READ-ONLY audit snapshot of four independently reviewed PR HEADs and CI, flags changed refs/lifecycles/non-green CI.
   - Checks a schematic Supabase audit against six Commerce tables, old policies, SKU uniqueness, RPCs and 2+2 row count baseline.
   - Lists 20 independent hosted release evidence gates, including isolated restore, owner-approved mappings, two distinct real JWT sessions, same-tenant negative tests, restricted staff, Meta Page permission, Widget domain proof, replay, signed owner acceptance.
   - **Always returns HOSTED_RELEASE_BLOCKED and ALL mutation flags false**. Even a full set of forged/synthetic positive claims cannot authorize migration or send.
2. qa/hosted-readiness-v1441/release-evidence-gate.test.cjs: 26 negative/positive Node.js tests. Test data contain no JWT, PII, credentials or Supabase service_role.
3. qa/hosted-readiness-v1441/EPHEMERAL_PG17_CI_ONLY.sql and ci-pg17-rls.sh:
   - Guard exact CI database tien404_v1441_ci, user postgres and session GUC marker V1441_DISPOSABLE **before any DDL**.
   - Disposable real PostgreSQL 17: same-tenant two-store, cross-tenant third store; UNIQUE(tenant,store,sku), different price/stock, FKs for order-items, store membership and FORCED RLS under a NO-BYPASSRLS role.
   - Tests positive/negative SELECT, INSERT, UPDATE, revoked membership, unknown actor. Demonstrates old permissive tenant policy leaks both stores until dropped.
   - Session actor is a SYNTHETIC GUC, **not a cryptographically verified Supabase JWT**. This test database is discarded after CI.
4. qa/hosted-readiness-v1441/ci-merge-tree-audit.sh:
   - Fetches four reviewed remote branches by name and compares exact immutable HEADs.
   - Confirms V14.3→V14.4→V14.4.1 ancestry, and verifies #86/#95 are NOT inherited.
   - Creates two anonymous Git tree/commit objects in the disposable CI Git object store, never pushes/merges actual PRs.
   - Extracts the exact three-lineage synthetic merged tree, tests its inherited Store/Knowledge/Onboarding/Widget/Messenger Node suites, and deletes scratch files.
5. .github/workflows/v1441-hosted-security-readiness-qa.yml: three jobs (contract regression, disposable PostgreSQL 17, Git tree reconciliation); no deploy credentials, customer data, actual Supabase connection or provider network send.

## 6. TESTED evidence — CI

CI run https://github.com/ngoctien20/demo-git/actions/runs/43726388440 — **3 / 3 jobs SUCCESS** at source checkpoint 7fb31034905a685590d005e5e0f5eb1b59286b0b:
- Node evidence+source regression: **343/343 PASS**, broken down 26 new V14.4.1 + 37 V14.4 + 36 V14.3 + 244 inherited Messenger, 0 fails.
- Disposable actual PostgreSQL 17 (synthetic actors): 22 explicit PASS assertions plus final suite PASS. Tests include same-tenant A/B, cross-tenant C, authorized and denied reads/writes, composite FK, revoked membership, and intentionally reintroducing the old tenant-only policy then dropping it.
- Git exact-head + merge-tree: **CLEAN TEXT** V14.4.1+#95, then synthetic union+#86. The ephemeral composite tree ran **652/652 inherited Node tests PASS**, 0 fails. The tool did NOT merge, publish, deploy or push a branch. These pass results do NOT prove real hosted API/schema compatibility.

Early exploratory run 43726003057 had 1 of 26 contract tests fail due a return-field mismatch (state vs status) in duplicate-PR metadata; this was fixed. The later run 43726115632 was 3/3 SUCCESS. The final run 43726388440 proves the combined source suite also passed. Do not present early failing run as latest evidence.

## 7. Acceptance matrix — release still CLOSED

| Gate | Real-world requirement | Evidence | Status |
|---|---|---|---|
| G0 | Isolated full restore of real 212 KB archive | Only pg_dump/TOC/checksum screenshots | BLOCKED |
| G1 | Canonical Store/Membership/Knowledge schema, old policies replaced, owner-mapped 4 rows | Supabase still missing | BLOCKED |
| G2 | Two authorized real Supabase JWTs in same tenant/2 Stores plus cross-tenant and staff revoked cases | Disposable PG17 GUC actor, NOT JWT | BLOCKED |
| G3 | All three SECURITY DEFINER RPCs reviewed against store scope | pg_proc grants/headers audited, no code patch | BLOCKED |
| G4 | Private Meta Page binding/permissions, distributed event replay, retention/rotation | Source #95+ephemeral atomic tests only | BLOCKED |
| G5 | Private Widget domain proof, replay/quota, hosted signed anonymous session | V14.4 source bridge only | BLOCKED |
| G6 | Real Shared Sales Core readback, verified price/stock/Knowledge and consent/order idempotency | Combined 652 offline source tests only | BLOCKED |
| G7 | Owner approval, staged pilot, cost and release controls | Not granted | BLOCKED |

All test fixtures are synthetic; 0 real messages, 0 customer writes, 0 store backfills, 0 Supabase hosted migrations, 0 payment/credential/production modifications.

## 8. Rollback, ownership and next version

**Rollback:** Close/revert PR #101 source files; no hosted rollback is needed because no hosted change was made. The PostgreSQL 17 container and Git merge objects are discarded by GitHub Actions. Keep PR #86/#94/#95/#97 and published n8n untouched.

**Authority:** Website/Widget Team owns UI and iframe; Integration/SaaS Security Team owns trusted tenant/store resolution and RLS contracts; Messenger Team owns signed Meta Page/payload and replay; n8n Team owns Sales Core and order notifications; QA Team independently owns hosted evidence. Do not duplicate existing channel or order cores.

**Next recommended V14.4.2:** prepare an actual hosted Store/RLS acceptance harness with temporary owner-approved QA sessions (never log token values), verification of old policy removal and RPC privileges, and a phased migration review. The hosted migration may run ONLY after G0 backup/restore and owner-approved rollback, individually verified 2 Products/2 Orders mapping, and separate explicit scope approval. No migration or JWT checks are claimed in V14.4.1.

**Release verdict:** READY_FOR_SECURITY_DESIGN_REVIEW (source+ephemeral PG17); NOT READY_FOR_HOSTED_MIGRATION; NOT READY_FOR_CUSTOMER_PILOT; NOT RELEASED.
