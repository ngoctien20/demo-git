# TIEN404 — RPC12 Owner Instruction: DEFER Local Real Backup, Continue Safe Commerce Work

**Recorded:** 2026-11-17 JST  
**Owner instruction:** "bỏ qua bước backup thật trên máy tiếp tục công việc"  
**Exact meaning:** Stop spending development cycles requesting or doing the **real local-machine backup** in the current iteration. Continue source-only/API-contract QA, published caller audit and disposable PostgreSQL 17 tests.

This **does NOT** mean that owner accepted a missing backup as a passing restore, authorized loss of customer/auth data, waived rollback, or approved a hosted migration. Do not change \`CURRENT_M0_RECOVERY\` to VERIFIED/TESTED/APPROVED.

## Stable checkpoint

- **DEFERRED_BY_OWNER:** Local-device real backup export, local backup hash/TOC recheck, local actual restore, and operator-directed backup execution in this iteration.
- **KEEP:** Historical \`H11R_PARTIAL_APPLICATION_ARCHIVE_LOCAL_QA_OWNER_ACCEPTED_WITH_LIMITATIONS\`. Do not repeat prior work.
- **UNDECIDED:** New M0 source-consistent recovery scope; no independently recovered current Auth users and settings, Storage object/service settings or selected restoration path.
- **BLOCKED:** M1 hosted schema expansion; M2/M4 Store data/RLS cutover; M3 hosted FK; privilege REVOKE; paid environment changes; real JWT/Order cross-Store UAT with real customers.
- **PERMITTED WITHOUT NEW APPROVAL:** Audit present metadata READ ONLY, add a source-only draft Store resolver contract, offline QA, synthetic PG17 rehearsal, verify no-send candidate tests, documentation and owner checkpoint.

## Next deliverable: prioritize commerce integration without touching hosted

1. Inventory the actual Published Commerce Tenant Resolver/Catalog/Cart/Business Core and legacy Messenger node/query versions. Mark all Tenant-only, and preserve what works.
2. Version the required server-trusted \`provider + verified installation\` → \`canonicalTenantUuid + canonicalStoreUuid\` contract, ensuring no client-submitted or AI-inferred Store can authorize reads.
3. Verify deny-by-default caller compatibility, Store-scoped catalog and cart reads, Store-scoped pricing/policies, same-Tenant A/B and revoked/inactive binding negative cases **offline**, with no customer rows, live messages, Order writes or credential reads.
4. Reuse independent Owner/Store origin ledger from RPC11/12 when real documents and authorized Operator are available; do not invent legacy row ownership.
5. Keep Hosted M0/M1/M2M4/M3 gates closed until a separately accepted recovery/release plan exists, despite deferring local backup now.

## Privacy & rollback

No local database dump, actual restore, production SQL mutation, Supabase branch, GitHub merge, n8n Published edit, real Meta/Zalo Send, Auth/JWT export, credential operation or billable services were carried out by recording this decision.

**Rollback:** Delete this source-only Draft note on review if the owner changes instructions; no operational rollback needed.

**Checkpoint:** \`RPC12_OWNER_DEFERRED_LOCAL_BACKUP__COMMERCE_SOURCE_WORK_CONTINUES__HOSTED_M0_NO_GO\`.
