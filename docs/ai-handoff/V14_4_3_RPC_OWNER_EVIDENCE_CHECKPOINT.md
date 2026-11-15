# TIEN404 AI — V14.4.3 Security Definer RPC Audit × Four-Row Owner Evidence Pack

**Date:** 16 Nov 2026 JST
**Project:** TIEN404 AI Commerce / Supabase tien404-staging
**Release status:** EXPERIMENTAL / OPEN DRAFT / READ-ONLY STAGING + DISPOSABLE CI, NOT HOSTED ACCEPTED
**GitHub PR:** https://github.com/ngoctien20/demo-git/pull/105
**Head branch:** work/v1443-security-definer-owner-ledger-20261116
**Base:** V14.4.2 PR #104 HEAD 21779d4e3dd0ba10435415bd1a753da09191f509.
**Dependency:** V14.2 PR #86 still on a separate unmerged Store/Knowledge lineage. V14.4.3 does not merge or promote it.

## 1. Actual status — VERIFIED

Read-only queries executed directly against project ref ifxlvrhyjhbzbrkdsida (PG 17.11). Latest post-CI check:
- \`public.products=2\`, \`public.orders=2\`.
- No \`public.stores\`, \`public.store_memberships\`, \`app_private.shop_knowledge_releases\`.
- Six old PERMISSIVE SELECT policies still present on six Commerce tables; no Store RLS migration.
- Operator's local custom-format pgAdmin backup has a successful pg_dump and readable pg_restore TOC; **isolated restore remains DEFERRED/UNTESTED**. No hosted SQL modification may start based solely on archive listing.

**RPC inspection verified via the exact \`pg_get_functiondef\` and ACLs**, without publishing the function bodies or private identifiers:
- All three \`public\` RPCs are postgres-owned \`SECURITY DEFINER\`, locked-empty search_path, with explicit grants and no \`PUBLIC\` EXECUTE.
- \`save_merchant_product\`: authenticated EXECUTE only, \`auth.uid()\` + active tenant owner/manager check constrained to two QA tenant fixtures; inserts/updates Products using \`tenant_id\` + \`sku\`, with optimistic updated_at and tenant audit record. **No canonical store_id** and no \`public.store_memberships\` read. P0 pre-migration.
- \`qa_owner_pairing\`: authenticated EXECUTE only, \`auth.uid()\` + active tenant owner, QA bot identity resolution, \`dry_run\` + \`synthetic_qa\`; no canonical Store membership. Remain QA-only; do not promote to Commerce.
- \`qa_shop_b_zalo_claim\`: anon EXECUTE only; references Vault private gate from request header, HMAC-derived recipient/event identifiers and Shop B synthetic pairing. **Do NOT interpret the existence of a secret header as verified Meta/Zalo origin or distributed replay**. No live-send approval.
- Private helper functions \`issue_owner_challenge\`, \`confirm_owner_pairing_v3_qa\`, \`claim_owner_pairing_v3_synthetic\`: SECURITY INVOKER, postgres-owned and no direct anon/authenticated EXECUTE. They are reached through the definer entrypoints and therefore require call-chain QA before changes.
- These are audit observations, not proof of an actual bypass exploit or of legitimate production use.

**Four-row attribution facts, aggregate and privacy-preserving:**
- Exactly two tenant groups; each has ONE Product and ONE Order.
- One group has TWO active tenant owner memberships; the other has ONE active owner membership.
- Aggregate tenant membership does **not** prove which canonical Store owns either Product or Order. Owner verification remains 0/4 and no backfill is authorized.
- The read-only SQL outputs intentionally exclude tenant UUID, row UUID, SKU, name, phone, address and customer content.

**n8n baseline unchanged, read-only verified:**
- Published Messenger Z7FdV7uDvApfbURQ ACTIVE version d5c96b6b-d790-4270-8b0f-d0ebdd8bbd92.
- Zalo ingress yIJk8LvJoLF40Z62 ACTIVE version 8ca4a6f6-ab3f-42f1-8637-d4f5db790a3e.
- Zalo customer router sIPs6egzIwOY1GNv ACTIVE version 8d91d23c-cd87-462f-a112-9cca2340bec8.
- V14.2 QA FIE7nl2vgLXQI7mT INACTIVE; V14.3 QA KjcnFcdg3lDQcZyW INACTIVE. No modifications.

## 2. Changes — IMPLEMENTED on Draft PR #105

1. \`qa/security-definer-v1443/RPC_AUDIT_READ_ONLY.sql\`
   - Exact catalog grant/owner/empty-search_path/feature-flag extraction for three public RPCs plus three private helper functions; no function-body values, no Vault secrets, no writes; **executed on hosted staging read-only successfully**.

2. \`qa/security-definer-v1443/OWNER_COVERAGE_READ_ONLY.sql\`
   - Count-only by anonymous tenant group; no real record UUIDs, names, SKU, phone or customer data; **executed on hosted staging read-only successfully**.

3. \`qa/security-definer-v1443/rpc-security-review.cjs\`
   - Review-only gate for exact six-function inventory. Detects drift in owner, EXECUTE grants, PUBLIC exposure, SECURITY DEFINER/INVOKER, search_path, auth.uid, Vault/HMAC/QA dry-run evidence, missing Store predicate and undocumented call sites. All grant-change, publish/merge and message-send flags false.
   - \`rpc-security-review.test.cjs\`: **30** synthetic tests.

4. \`qa/security-definer-v1443/four-row-owner-evidence.cjs\`
   - Memory-only private ledger linter for EXACTLY 2 Products + 2 Orders. Requires two original tenant groups (one Product + one Order each), valid row/tenant/canonical Store IDs, source version and snapshot digest, signed merchant Store claim, product-catalog/order-origin evidence and a distinct independent reviewer. All 3 evidence documents per row must bind EXACTLY to the same row/tenant/Store/digest and unique opaque reference.
   - It DOES NOT verify cryptographic signatures or access real customer records. Output is **only generic issue codes and coverage counts**, never row/Store/tenant/user IDs. Even fully valid synthetic data returns \`READY_FOR_MANUAL_PRIVATE_EVIDENCE_INSPECTION\`, 0 independently verified owners, \`canBackfill=false\`, 0 writes.
   - \`four-row-owner-evidence.test.cjs\`: **36** synthetic tests.

5. \`qa/security-definer-v1443/EPHEMERAL_PG17_ONLY.sql\` and \`ci-definer-pg17.sh\`
   - Exact disposable CI database/user/GUC checks BEFORE ANY DDL. Synthetic PostgreSQL 17 demo that a postgres-owned SECURITY DEFINER can bypass RLS for a granted role even when a direct read is denied; after REVOKE EXECUTE, call is denied. **Never run in Supabase.** This does NOT prove an exploit of the actual staging RPCs.

6. \`.github/workflows/v1443-security-definer-owner-evidence-qa.yml\`
   - 3 CI jobs: source review 66 tests, inherited 391 tests, disposable PG17 role tests. No GitHub secrets, service_role, customer data or Meta/Zalo endpoint.

7. \`docs/ai-handoff/V14_4_3_RPC_OWNER_EVIDENCE_RUNBOOK.md\`
   - Complete real audit findings, private four-row evidence checklist, stop/go gates and rollback; no raw record data.

## 3. QA evidence — TESTED

GitHub Actions **run 43731852845**, from source/docs commit 0c0ac4cfa453db413eb7fe6ac314704da26216b2:
- 3/3 jobs COMPLETED SUCCESS.
- **66/66** NEW Node tests: 30 RPC + 36 owner-ledger validation, 0 fails.
- **391/391** inherited Node tests: 48 V14.4.2 + 26 V14.4.1 + 37 V14.4 + 36 V14.3 + 244 Messenger.
- Total **457/457 Node PASS** (66+391, no double counting).
- Actual disposable PostgreSQL 17 fixture: **8 explicit direct PASS checks + 1 overall PASS summary**, demonstrating SECURITY DEFINER privilege/RLS behavior and revoke enforcement.
- Source static checks: SQL audit files are SELECT-only, SQL demo gated by exact disposable DB marker, no hosted writes.
- **No hosted JWT RLS**, real webhook origin, owner attestation or restore drill was run. Mark them BLOCKED, not TESTED.

## 4. Remaining P0, P1 and privacy boundaries

**P0:** \`save_merchant_product\` cannot remain tenant-only when same-tenant multi-store SKU/price is enabled; use a redesigned, separately reviewed Store-bound RPC with canonical Store membership and write predicates, audited grant/owner and log tenant+store+actor. Do not patch existing Published code without rollout and rollback.

**P0:** Two Products and two Orders are not mapped to stores. Real owner evidence must be independently checked by operator + QA, privately and per row. One tenant may have multiple owners and/or stores; nothing permits inferred assignment.

**P0:** Full isolated archive RESTORE remains required before any migration, rollback review included.

**P0:** Hosted authentication, per-store RLS replacements, 6 old permissive SELECT policy removals, combined FK/SKU uniqueness and 3 RPC review/signoff remain blocked. Real Supabase JWT sessions cannot be replaced with \`service_role\` or CI GUC.

**P1:** \`qa_owner_pairing\` stays synthetic QA and cannot become a general merchant authorizer; \`qa_shop_b_zalo_claim\` anon grant, trusted upstream raw signature, Vault key provenance, expiry/replay/rotation, and Page/Store registry must be proven in an approved hosted test before promotion or changes.

**P1:** Audit actual app/n8n/Render website call sites and rollout sequencing prior to any product writer change. GitHub default-branch code search returned no indexed matches for the three RPC names, which does NOT prove no active call sites (Draft branches and hosted configurations may not be indexed).

**Privacy:** No raw UUID, SKU, personal contacts, product/order values, JWT, decrypted Vault data or private ledger was copied into this PR. Operator should keep the filled evidence pack encrypted and outside public GitHub/CI.

## 5. Approval and rollback

**No separate write approval was exercised.** Changes are on an OPEN DRAFT source branch and disposable CI only. No production, Supabase migration/GRANT/REVOKE, real customer records, Pub Website, n8n workflows, credentials, billing, paid API or Meta/Zalo sends changed.

Rollback this release: close/revert PR #105 only. There is no hosted state to roll back. Future RPC migration/RLS replacement needs a separately approved SQL transaction, before/after state capture, post-commit rollback rehearsal and explicit operator owner acceptance.

**Release verdict:** RPC_METADATA_AUDIT_VERIFIED; OWNER_COVERAGE_AGGREGATE_VERIFIED; RPC_REVIEW_CONTRACT_IMPLEMENTED_AND_TESTED; PRIVATE_LEDGER_LINTER_TESTED; OWNER_IDENTITIES_UNVERIFIED; HOSTED_RLS_BLOCKED; PRODUCTION_NOT_AUTHORIZED.

## 6. Next step

Proposed **V14.4.4 — Store-Aware Product RPC V2 Contract × Owner Evidence Intake QA**, source-only first:
- Prepare a backwards-compatible *non-executable* \`save_merchant_product_v2(tenant_id,store_id,sku,...)\` design; server-trusted Store membership; expected updated_at; SKU unique and stock correctness; legacy caller compatibility tests.
- Private owner ledger checklist and two-person review UI/mock that only returns redacted acceptance status; do not write the actual 4 row mapping to public PR.
- Keep restore drill M0 gate and RLS migration unexecuted until separate owner approval.
