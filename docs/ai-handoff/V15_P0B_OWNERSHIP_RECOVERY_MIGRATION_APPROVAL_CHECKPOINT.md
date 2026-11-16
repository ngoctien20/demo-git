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

- `qa/v15-sales-lite-p0b/ownership-evidence-gate.cjs`: metadata-only strict private proof packet validator. One independent ticket for each of the 13 evidence categories below. No PII/credential field accepted in the proof packet. **Even a syntactically complete packet has `approved_migration=false`, `can_change_rls=false`, `can_write_real_order=false` and `can_send_provider=false`.**
- `ownership-evidence-gate.test.cjs`: negative cases for fake PASS, no Store proof, missing independent consent, duplicate evidence, privacy, restore omission and attempted hosted writes.
- `docs/ai-handoff/V15_P0B_HOSTED_OWNER_EVIDENCE_PREFLIGHT_READ_ONLY.sql`: aggregate/schema/RPC privilege metadata SELECT-only preflight, wrapped in read-only transaction. Do not use it for actual owner certification.
- `qa/v15-sales-lite-p0b/preflight-contract.test.cjs`: rejects DDL/DML/RPC and unauthorized data outputs in the preflight source.
- A dedicated offline GitHub Actions test workflow, no service role/hosted credentials or provider API calls.

## 3. Owner evidence required — PRIVATE repository, never public GitHub

For one candidate pilot Store, independent reviewer must reconcile all the following using real authenticated read-only evidence:

1. **Auth user:** merchant's live session and auth account verified via Supabase Auth, not user metadata or self-declared user ID.
2. **Tenant membership:** active `tenant_memberships` for that Auth user and exact Tenant.
3. **Canonical Store:** approved Store row under that exact Tenant — currently missing.
4. **Store membership:** explicit active record for that user, Tenant and Store — currently missing.
5. **Provider owner consent:** independent signed/native proof for Page/Bot/OA or Web Widget binding and authorization to operate/send; Zalo G2.3 is not certified.
6. **Legacy products attribution:** independently determine each of the 2 existing Products' correct Store, or quarantine unassigned rows; no default-backfill.
7. **Legacy orders attribution:** independently determine each of the 2 existing Orders' correct Store, or quarantine unassigned rows; no default-backfill.
8. **Private backup snapshot:** authorized backup with timestamp, retention, location, scope, integrity evidence and security controls.
9. **Isolated restore drill:** successful restore of the authorized snapshot into an isolated target; confirm schema, counts, RLS, functions, extensions, encryption/Vault dependencies and safe control of outgoing jobs. No actual restore was executed in P0-B.
10. **Rollback plan:** explicit migration reverse strategy that does not DROP/DELETE data blindly and includes a go/no-go condition.
11. **Privileged RPC review:** independent review of `SECURITY DEFINER` and role `EXECUTE`, with specific owner-approved change plan.
12. **Hosted JWT RLS QA:** fresh signed-in actual Auth tests for A/B same Tenant and C across Tenants, anon, revoked, read/write, Store foreign keys and service_role bypass. Currently **BLOCKED** until canonical Store migration approval.
13. **Merchant pilot approval:** explicit consent for real pilot scope, allowed communications and data use, independently verifiable.

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

**Gate M1 — private evidence intake:** BLOCKED until merchant ownership and row attribution independently reviewed. Cannot be satisfied by synthetic fixture-only HMAC/Zalo mapping.

**Gate M2 — private backup and independent restore:** BLOCKED; must have snapshot checksum, tested restore, side-effect prevention and written rollback.

**Gate M3 — reviewed migration candidate:** PROPOSED. Reuse `docs/ai-handoff/V15_09_CANONICAL_STORE_EXPAND_REVIEW_ONLY.sql` as input, **not** as executable migration. A new reviewed migration must account for composite FK, legacy SKU uniqueness, data mapping, tenant membership recursion risks, RPCs, RLS permissive/restrictive interactions, app_private idempotency/outbox and all callers.

**Gate M4 — separate owner approval for each hosted change:** NOT APPROVED. Request explicit permission for: (a) creation of canonical Store/StoreMembership schema, (b) backed-up legacy row backfill, (c) changes to hosted RLS/GRANT/RPC and dependent app code, (d) live provider send & real Orders writes (independently later). **P0-B task name is not authorization** for these operations.

**Gate M5 — hosted authenticated QA:** BLOCKED. After specifically approved staged migration, verify real JWT A/B/C, negatives and rollback. Never treat disposable PG17 PASS as hosted proof.

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
