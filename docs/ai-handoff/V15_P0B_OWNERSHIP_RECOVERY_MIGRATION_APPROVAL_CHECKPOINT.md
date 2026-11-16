# TIEN404 AI — V15 Sales Lite P0-B · Merchant Ownership Evidence × Hosted Migration Approval Gate

**Checkpoint:** 16/11/2026 JST  
**GitHub predecessor:** PR #131 `6e249b593f669655303983db6630114702d4ab7c`  
**Mode:** DRAFT / SOURCE-ONLY / READ-ONLY HOSTED AUDIT / NO SEND  
**Decision:** **HOSTED MIGRATION NO-GO** until a distinct, scope-specific owner authorization.

## 1. VERIFIED — Direct Supabase staging audit (read only)

Project `tien404-staging`, ref `ifxlvrhyjhbzbrkdsida`, PostgreSQL 17.11, ACTIVE_HEALTHY.

| Evidence | Verified observations |
| --- | --- |
| Auth users | 3 |
| Tenants | 2 |
| Active tenant_memberships | 3 |
| Orphaned Auth/tenant memberships | 0 / 0 |
| Products | 2, no orphan tenant FK |
| Orders | 2, no orphan tenant FK |
| public.stores | NOT PRESENT |
| public.store_memberships | NOT PRESENT |
| store_id on Products / Orders / core tables | NOT PRESENT |
| Core RLS | Tenant-scoped; not Store-scoped |
| Supabase DB branches | 0 listed |

No native table can currently prove `auth.users → tenant_memberships → stores → store_memberships`. Current QA `tien404_r1_qa` mapping and owner-pairing rows **do not substitute** an authenticated production-grade Store mapping or merchant consent.

Supabase security advisor still reports:
- `public.qa_shop_b_zalo_claim`: SECURITY DEFINER executable by `anon` — privileged exposure warning, not a demonstrated exploit.
- `public.qa_owner_pairing` and `public.save_merchant_product`: SECURITY DEFINER executable by `authenticated`, no certified per-Store proof.
- `auth_leaked_password_protection`: disabled warning. No changes requested/applied here.

There are **two existing Product records and two existing Order records**. None has Store attribution. Do not publicly include their IDs, prices, contacts or contents in an evidence document.

## 2. IMPLEMENTED in this Draft

- `qa/v15-sales-lite-p0b/ownership-evidence-gate.cjs`: metadata-only strict private proof packet validator. A structured packet for **14 evidence classes**, split into 9 PRE-EXPAND review prerequisites and 5 POST-EXPAND certification prerequisites. There is no circular demand for a Store row before the approved Store-schema expansion. No PII/credential field accepted in the proof packet. **Even a syntactically complete packet has `approved_migration=false`, `can_change_rls=false`, `can_write_real_order=false` and `can_send_provider=false`.**
- `ownership-evidence-gate.test.cjs`: negative cases for fake PASS, no Store proof, missing independent consent, duplicate evidence, privacy, restore omission and attempted hosted writes.
- `docs/ai-handoff/V15_P0B_HOSTED_OWNER_EVIDENCE_PREFLIGHT_READ_ONLY.sql`: aggregate/schema/RPC privilege metadata SELECT-only preflight, wrapped in read-only transaction. Do not use it for actual owner certification.
- `qa/v15-sales-lite-p0b/preflight-contract.test.cjs`: rejects DDL/DML/RPC and unauthorized data outputs in the preflight source.
- A dedicated offline GitHub Actions test workflow, no service role/hosted credentials or provider API calls.

## 3. Owner evidence required — PRIVATE repository, never public GitHub

For one candidate pilot Store, independent reviewer must reconcile the following in a PRIVATE system. The first nine proofs support a **pre-expand review request only**; the remaining five require post-expand certification:

**Pre-expand review — 9 required classes (still NOT owner approval to apply DDL):**

1. **Auth user:** Supabase Auth user/session validated independently; no user-supplied JWT claims as authority.
2. **Tenant membership:** active Auth user → existing Tenant membership (matching user/tenant) verified in a protected channel.
3. **Proposed Store owner intake:** verified merchant submits request to create a new Store under an owned Tenant; **proposed Store identity, NOT a database row**. Prevents a circular dependency.
4. **Legacy Products attribution:** private inventory of the 2 existing Products; each assigned only with explicit independent provenance or remains quarantined/unassigned.
5. **Legacy Orders attribution:** private inventory of the 2 existing Orders, with the same rule; no default-Store backfill.
6. **Private backup snapshot:** independent backup time/location/scope and integrity proof.
7. **Isolated restore drill:** restore and validate the snapshot with outbound actions disabled/contained, documented recovery.
8. **Rollback plan:** versioned, reviewed, migration-specific reversal without blind DROP/DELETE.
9. **Privileged RPC review:** independent review of SECURITY DEFINER/EXECUTE and any grant change plan.

**Post-expand certification — 5 additional required classes before live merchant pilot:**

10. **Canonical Store:** actual Store row exists under exactly the authorized Tenant after a **separately approved** schema expansion.
11. **Store membership:** actual active user/Tenant/Store membership and exact role verified using Auth/JWT; not synthetic QA mapping.
12. **Native provider merchant consent:** authenticated Page/Bot/OA/widget binding and independent owner permission; Zalo G2.3 must pass if using Zalo.
13. **Hosted JWT/RLS QA:** A/B same-Tenant, C other-Tenant, anon, revoked roles, SELECT/INSERT/UPDATE/FK and service_role boundary.
14. **Merchant pilot approval:** separate explicit permission for genuine channel traffic and real business data.

**Important:** Even if all 9 pre-expand evidence references have valid shape, `inspectOwnershipPacket(packet,'PRE_EXPAND_REVIEW')` returns only `INDEPENDENT_PRE_EXPAND_REVIEW_REQUIRED` — **never** migration authorization. Post-expand packet returns `INDEPENDENT_REVIEW_REQUIRED`; neither status certifies submitted claims or authorizes DB changes.

**Proof packet:** Store ticket IDs only (e.g. `EV-...` and `SEC-...`) and approved source category, always `SUBMITTED_NOT_VERIFIED`. Actual evidence is stored in protected private storage. A public PR MUST NOT contain tokens, Auth IDs, raw JWT, telephone, email, order data, screenshots of secrets or live provider content.

The software never verifies the issuer's actual identity or the evidence content. A structured `INDEPENDENT_REVIEW_REQUIRED` status is **not** authorization.

## 4. Backup and restore — status BLOCKED / NOT VERIFIED

The current Supabase connector has **no backup list/backup verification or restore-drill action**. We did not assume the staging plan includes backups or PITR. We did not access or create backup files.

Official platform guidance: https://supabase.com/docs/guides/platform/backups
- Use the Database > Backups section to verify actual availability and retention. Pro/Team/Enterprise and Free have different backup facilities; do not assume a backup exists.
- For a logical backup, use a trusted private operator with `supabase db dump` or equivalent, keeping credentials and dump files out of ChatGPT/public GitHub.
- Restore only to an isolated, cost-approved target, with verification of actual data and permissions; never restore over the current staging database.
- Supabase physical backup cloning copies sensitive Auth records and can restart background jobs/extensions. Review triggers, cron, webhook integrations, Vault, Storage objects, Edge Functions and charges before choosing clone vs logical restore.
- Require a signed, private, independently reviewed **restore drill**, not merely a backup success notification.

Official clone limitations: https://supabase.com/docs/guides/platform/clone-project

## 5. Migration approval — separate staged gates

**Gate M0 — source-only audit:** PASS once this Draft CI is green. No hosted write.

**Gate M1 — pre-expand evidence intake:** BLOCKED until the nine PRE-EXPAND classes are independently validated. This includes an owner-backed proposed Store request, NOT a requirement that `public.stores` already exists.

**Gate M2 — private backup and independent restore:** BLOCKED; must have snapshot checksum, tested restore, side-effect prevention and written rollback.

**Gate M3 — reviewed migration candidate:** PROPOSED. Reuse `docs/ai-handoff/V15_09_CANONICAL_STORE_EXPAND_REVIEW_ONLY.sql` as input, **not** as executable migration. A new reviewed migration must account for composite FK, legacy SKU uniqueness, data mapping, tenant membership recursion risks, RPCs, RLS permissive/restrictive interactions, app_private idempotency/outbox and all callers.

**Gate M4 — separate owner approval for each hosted change:** NOT APPROVED. Request explicit permission for: (a) creation of canonical Store/StoreMembership schema, (b) backed-up legacy row backfill, (c) changes to hosted RLS/GRANT/RPC and dependent app code, (d) live provider send & real Orders writes (independently later). **P0-B task name is not authorization** for these operations.

**Gate M5 — post-expand hosted authentication QA:** BLOCKED. After separately approved Store schema expansion and explicit Store membership provisioning, collect the remaining five POST-EXPAND proof classes. Verify real JWT A/B/C, negative cases and rollback. Never treat disposable PG17 PASS as hosted proof.

**Gate M6 — real Commerce/pilot:** BLOCKED; provider native identity, confirmed order, transactional idempotent pending+Outbox and verified recipient, merchant UAT and live budget gate.

## 6. Existing production and DEMO safeguards

Messenger workflow `Z7FdV7uDvApfbURQ` remains Published with DEMO Google Sheets and DEMO order tools. Never redirect Commerce to those tables or credentials. Do not edit Published n8n, send provider messages, apply Supabase SQL/migration, change Auth/GRANT/RLS/RPC, write Orders, pay for APIs or merge PRs without separate approval. Keep Enterprise Dashboard, premium-model selection and advanced Custom Bot Studio deferred for Sales Lite.

## 7. Test interpretation and rollback

- GitHub CI PASS = source safety and disposable simulation proof only.
- Auth/Store chain VERIFIED = requires independent hosted evidence and actual canonical Store, not just metadata counts.
- A fully submitted evidence packet is never a release token.
- Rollback for this P0-B Draft: close the child PR; **zero hosted changes**, so no database rollback.
- Any future hosted migration requires proven restore and exact migration-specific rollback.

## 8. Owner signoff request to prepare, NOT to execute yet

A reviewer can prepare an authorization request only when M1/M2/M3 have independently supported evidence. The request should name target Supabase project, migration SHA, tables, exact DDL/GRANT/RLS/RPC effects, legacy row choices, expected downtime, backup reference, restore checkpoint, reviewer, test matrix and reversal procedure. Separate approval is mandatory for each sensitive class.

**Next checkpoint:** `V15 Sales Lite P0-C — Private Ownership Certification × Approved Store Schema Expand` after owner signs off and recovery dependencies pass; otherwise continue offline reviewer evidence work.
