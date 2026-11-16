# TIEN404 AI — H11R.9 Checkpoint
## Verified RPC Caller Evidence × Private Recovery Consent × Same-Tenant Store Disposable QA
**2026-11-16 JST · READ-ONLY HOSTED METADATA / SOURCE-ONLY DRAFT / NO SEND**

### Evidence examined directly
1. Hosted project ifxlvrhyjhbzbrkdsida PostgreSQL 17.11: qa_shop_b_zalo_claim remains SECURITY DEFINER owned by postgres and callable by anon; qa_owner_pairing and save_merchant_product callable by authenticated. These are permissions and static source evidence, not proof of exploit.
2. n8n published active Zalo V1 yIJk8LvJoLF40Z62 version 8ca4a6f6-ab3f-42f1-8637-d4f5db790a3e executes published active V2 Shadow OgDZNSAvKEvhnAvn version f00ba506-c52a-4340-9a0c-809fd9c6ea9a with enabled HTTP POST /rest/v1/rpc/qa_shop_b_zalo_claim. Execution #2858 (13 Nov UTC) is MANUAL. No provider-signed event or complete external/dynamic caller inventory proven. Never revoke on this evidence alone.
3. PR #131 exact head 6e249b593f669655303983db6630114702d4ab7c; GitHub run #43789911150 has two successful jobs, including synthetic PostgreSQL17 SAME Tenant Store A/B/C SELECT/write, FK/outbox/replay checks. This is verified prior CI and a Draft PR, not hosted Store or signed JWT proof.
4. H11R.8 read-only baseline: 3 Auth, 3 memberships, 2 tenants, 2 products, 2 orders, no canonical stores/store_memberships or store_id core fields. No merchant attribution authorized.
5. Local V14.2 archive selected-schema restore to isolated PG18 shown by operator is application-only; Auth users, full roles/ACL and external services remain unverified for complete recovery.

### New H11R.9 narrow scope
- SQL qa/h11r9/pg17-same-tenant-role-gap.regression.sql includes parent #133 inherited PG17 fixture. Its synthetic orders_tenant_read + orders_store_restrict allow active Staff Store member to view Orders; unlike current hosted orders_manager_read which checks Owner/Manager. Detect baseline overgrant in disposable PG17, then tighten with Owner/Manager condition inside a transaction, add explicit active tenant membership to Store policy, assert Staff/no-order + inactive owner/zero + Owner A/B valid, and ROLLBACK.
- This is a SOURCE-ONLY PARITY GAP in an unmerged QA schema, not a confirmed hosted data leak or authorized production migration.
- No existing source files are edited and no hosted migration is published.
- Static GitHub Actions gate checks missing approval metadata and uses ephemeral PostgreSQL17 service only. Verify CI on exact H11R.9 head; old PR #131 PASS does not mean H11R.9 PASS.
- Private recovery template lists required human Controller/Reviewer/Operator and all-Tenant legal/data scope. All NOT VERIFIED and NOT AUTHORIZED.
- Separate PR #186 is not inherited by this branch: it stays Draft. Synthetic caller signature framework cannot certify real external caller completeness.

### Remain blocked
- Real provider signature and complete six-domain caller inventory, replacement private RPC canary, observer evidence, per-operation approval and rollback.
- Hosted Auth/roles/ACL backup and full isolated encrypted restore with Controller/Reviewer/Operator consent and approved retention, measured RPO/RTO.
- Same-Tenant Store hosted JWT/REST Owner/Manager/Staff negative proof, legacy row ownership, idempotent Order/Outbox and canary.
- Hosted SQL write, Auth export, GRANT/REVOKE, n8n Published, provider send, credentials, budget change, merge and production.

**Decision: H11R9_SOURCE_ONLY_CANDIDATE; RPC_REVOKE=NO_GO; RECOVERY_CONSENT=BLOCKED; STORE_HOSTED_RELEASE=NO_GO.**

References: PR #131, run #43789911150, PRs #133, #168, #186.
