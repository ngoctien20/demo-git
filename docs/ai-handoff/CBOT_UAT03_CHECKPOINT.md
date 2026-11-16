# TIEN404 CBOT-UAT-03 — Hosted Store Recovery × RPC Cutover × Messenger Commerce Adapter
Checkpoint: 2026-11-16 JST | Candidate SOURCE-ONLY / NO SEND / NO HOSTED WRITE.
Parent: CBOT-UAT02 PR #204 at cae493b5665deca9f15fa2ee12871cf3657612b2.
Security reference: H11R.11 PR #205 at 8df7b9b30f26906091340dc95531d4e422c8196b; H11R.10 PR #200; private backup PR #198; Meta/Zalo ownership PR #196.

## Verified direct read-only audit (not E2E evidence)
- Supabase tien404-staging ifxlvrhyjhbzbrkdsida ACTIVE_HEALTHY PostgreSQL17. 2 Tenants, 2 Products, 2 Orders, 0 Customers. public.stores and store_memberships absent; Orders has no store_id. Existing RLS is Tenant-membership based, not Store-based.
- public.qa_shop_b_zalo_claim is SECURITY DEFINER owned by postgres and anon EXECUTE remains true. Supabase Security Advisor reports the same warning. NO REVOKE until caller inventory and cutover.
- Active Zalo ingress yIJk8LvJoLF40Z62 to active Zalo V2 Shadow OgDZNSAvKEvhnAvn, configured HTTP POST to the old public RPC. Unknown external callers are NOT disproven.
- Published Messenger Z7FdV7uDvApfbURQ active, 27 nodes, version d5c96b6b-d790-4270-8b0f-d0ebdd8bbd92. Its AI tools still invoke AI_SALES_DEMO Google Sheets and Create/Manage/Update/Status workflows: KrSn4DNR9ALX5ng4, fDB9dvs1qPPVt9Sp, BkAi6TVUKAjCnI7v, 4DFFCk60exrzaIl6. NEVER share DEMO credentials, Orders or Products with Commerce.
- H11R.11 PR #205 CI run 43853584230 SUCCESS with synthetic signed metadata and disposable PostgreSQL17 recovery mechanics, NOT real independent full hosted recovery.

## Implemented in CBOT-UAT-03 candidate (SOURCE ONLY)
1. qa/cbot-uat03/messenger-commerce-adapter.mjs: reuses UAT02 synthetic identity / order scope, strict read-only lookup, unified unauthorized response, no PII leak, mutation denied, event dedup candidate and draft phone policy fix (reject 9-digit unprefixed instead of auto-prefix 0).
2. qa/cbot-uat03/hosted-recovery-rpc-gates.mjs: read-only baseline snapshot, missing six caller domains and six recovery domains, operator handoff. Even fabricated all-green metadata never authorizes hosted migration, backup export, RPC revoke or publication. Reuse H11R11 independent signer instead of inventing a competing attestation system.
3. qa/cbot-uat03/pg17-disposable-readonly-store-rls.sql: PostgreSQL17 test in ephemeral CI database: Owner A/B different Stores in one Tenant, Owner C separate Tenant, inactive owner blocked, anon no SELECT, no write grants. Uses a user-controllable test GUC, not a real signed JWT, so THIS CANNOT certify hosted JWT/RLS. All test schema/roles ROLLBACK.
4. CI: 35 adapter + 20 recovery/rpc safety = 55 new source tests, inherited 38 UAT02 + 22 UAT01 + 65 V16.7 = 180 source/synthetic test assertions, plus PG17 disposable. Exact HEAD CI evidence must be separately checked.

## P0-01 Operational recovery and Store cutover (NO HOSTED APPLY)
- Private proof is still missing: legal Controller authorization, independent Security Reviewer, Backup Operator, actual complete encrypted offsite Auth/Storage/roles/app backup and off-host restore receipt. Prior selected-schema archive is NOT whole platform recovery.
- Independently identify actual Store ownership of every legacy Product, Order and relevant OrderItem, with private proof; never assign by tenant or display name.
- Reuse H11R.10 PR #200 migration compatibility and H11R.11 PR #205 evidence intake. Only then review expand-only migration exact diff, legacy SKU and composite foreign-key compatibility, rollback, independently authenticated Owner JWT same-Tenant Store isolation under real non-privileged roles.
- No Supabase hosted DDL/GRANT/RLS change in this PR.

## P0-02 RPC cutover (NO REVOKE)
- Preserve existing live n8n Zalo V1→V2 caller. Need six-domain external independent caller inventory, not just workflow names.
- Propose private gateway proving provider signature, authorized provider account, tenant/store binding, replay/idempotency and minimum permissions; do not trust user-supplied tenant/store/role or unsigned identity.
- Perform shadow comparison with safe QA metadata, verify all known callers migrated, rollback path and independent security review, then request separate authorization for exact ACL transaction. Post-change Supabase Advisor and provider QA required.
- No public RPC call, new privileged service, permission edit or actual cutover performed.

## Messenger Commerce adapter target
- Reuse signature validation, Page filtering, dedup, AI UX and fallback patterns from Messenger Published, never import its active credentials nor use DEMO data.
- Proposed chain: Native signed Messenger Page → Trusted Channel/Store Gateway → verified customer binding → Shared AI intent router → Store scoped Commerce READ ONLY lookup → reviewed reply adapter.
- Synthetic code alone DOES NOT prove Meta Page ownership, Zalo OA App authorization, hosted identity, signed gateway, hosted lookup, order persistence, or production reliability.
- P1 9-digit phone normalizer is only corrected in Candidate. Published Order Status unchanged.

## QA status and rollback
- Existing CBOT-UAT02 n8n inactive manual QA workflow 6IMJj5xdCGC2b5ll exec #4175 PASS 10/10 synthetic, not hosted.
- XCH01..XCH06 real hosted E2E BLOCKED pending actual provider ownership, private recovery and same-Tenant Store JWT.
- Close this Draft PR to roll back source-only. NO hosted DB changes, Auth/Storage export, credential edit, n8n Published edit, Meta/Zalo send, paid model request or real customer Order write.
