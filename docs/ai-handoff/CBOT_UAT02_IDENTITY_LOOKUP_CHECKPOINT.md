# TIEN404 CBOT-UAT-02 — Trusted Customer Identity × Cross-Channel Read-Only Lookup
Date: 2026-11-16 JST | Status: CANDIDATE / NO SEND / NO HOSTED WRITE
Parent: Draft PR #201 at HEAD 5c5d78a716da8d9f342192bcc027a166a58d43ed.
Related: V16.7 PR #199; H11R10 PR #200; backup RPC.7 PR #198; provider ownership proof PR #196.

## Owner authorization
User authorized remediation effort for P0-01 Store isolation, P0-02 privileged RPC, inheritance of Messenger AI into central Commerce Core. This does NOT establish independently verified offsite backup, full Auth/Storage recovery, Store ownership, provider account consent, customer identity, real JWT/RLS or existing caller cutover. DO NOT change hosted grants/schema, Published workflow, credentials, paid API or real customer Orders without prerequisite evidence.

## VERIFIED on 2026-11-16 via live connectors
- Supabase staging ifxlvrhyjhbzbrkdsida ACTIVE_HEALTHY PG17. public.products/orders/customers have tenant_id but not store_id. No public.stores or store_memberships. RLS currently tenant membership based, not Store based.
- public.qa_shop_b_zalo_claim is SECURITY DEFINER and callable by anon. Zalo V1 yIJk8LvJoLF40Z62 → V2 shadow OgDZNSAvKEvhnAvn contains HTTP POST to that function. Immediate REVOKE breaks an active caller; evidence of other external callers incomplete.
- Published Messenger Z7FdV7uDvApfbURQ is active, 27 nodes, version d5c96b6b-d790-4270-8b0f-d0ebdd8bbd92. Current tools still use AI_SALES_DEMO Sheets catalog/Create/Manage/Update/Order Status; not Store-scoped Commerce. Preserve DEMO isolation.
- Zalo protected ingress yIJk8LvJoLF40Z62 active and synthetic Shop B read-only; not native Zalo OA proof.
- Existing PR #198 and #200 establish pre-M1 full recovery/ownership and unknown caller gates as NO-GO.

## IMPLEMENTED — isolated source-only synthetic lab
- qa/cbot-uat02/crosschannel-core.mjs is a runnable in-memory functional synthetic core with Shop A fashion and Shop B materials in same synthetic Tenant, Shop C grocery in separate Tenant.
- Fixed QA Messenger + Zalo OA channel-account mappings, never from LLM/free-form tenant_id or store_id.
- Messenger synthetic order creation only after explicit confirmation, inventory and unit-price snapshot, idempotency; NO real persistence or stock deduction.
- Origin Messenger issues a six-digit single-use code, salted/hashed for 300 seconds and max three failed attempts; Zalo OA redeems in same Store. Expiry/replay/wrong owner/wrong Store fail closed.
- Zalo lookup returns only safe order fields once linked; order ID alone gives uniform NOT_FOUND_OR_UNAUTHORIZED. Messenger original owner can also read. Revocation invalidates access.
- 38 source synthetic cases; CI must complete at exact HEAD before marking TESTED.
- Provider sends, hosted writes, paid inference and privileged RPC changes are hard-disabled.

## P0-01 remediation sequence (DO NOT DUPLICATE PR #200 MIGRATION)
1. Collect full encrypted private offsite app/Auth/Storage/roles backup and independent real restore evidence under bounded operator authority.
2. Prove real Owner→Tenant→Store mapping for each legacy row; never silently backfill first Shop.
3. Reuse H11R.10 disposable PostgreSQL 17 compatibility migration to plan nullable expand, composite tenant/store FKs, legacy preservation, SKU uniqueness and rollback.
4. Independently prove same-tenant two-Store Owner JWT isolation, negative cross-Store reads/writes, correct GRANT/RLS under invoker role (not service-role).
5. Only after 100% attributable rows and downstream callers reviewed, plan explicit hosted migration and strict store_id enforcement.

## P0-02 remediation sequence
1. Inventory n8n Published/Zalo shadow, Workers, Supabase Edge, Page/OA clients and unknown callers of public.qa_shop_b_zalo_claim.
2. Implement private trusted caller gateway + real verified event provenance, per-Store ownership, bounded retry and replay protection; no direct public privileged RPC.
3. Run shadow tests, audit real request IDs without storing secrets, verify no remaining legacy callers.
4. Only after independent restore, caller cutover, exact-rollback/maintenance approval, apply planned REVOKE/grant changes; re-run security advisor.
5. Do not assert fixed until public anon EXECUTE is false and native integrations remain operational.

## Messenger central Core
Inherit conversation and HMAC/event dedup behavior in distinct INACTIVE Candidate only. Do NOT repoint existing published Messenger bot to new Commerce until Store RLS, trusted gateway, customer proof, QA order writer, and release approval. Correct current order-status phone heuristic (9-digit auto-prefix) on Candidate and verify with negatives.

## E2E acceptance provenance
Existing n8n sandbox 64/64 exec 4044/4045/4054 is NOT proof of cross-channel order read.
This PR's 38 synthetic tests prove functional candidate only, NOT real Meta/Zalo provider and hosted database.
XCH-01..06 hosted still BLOCKED until real native Meta Page/Zalo OA ownership, private restore, real Store JWT, disposable/hosted migration authorization, Order QA receipt and verified user consent.
Use one owner-approved QA order, verify its DB receipt, then same-store Zalo OA read-only lookup. No production Send or paid model API without separate consent.

## Rollback
Close Draft PR to discard additive source without touching production. No hosted database / workflow change performed in this checkpoint.