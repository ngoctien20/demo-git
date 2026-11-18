# TIEN404 AI — V17.2C.40B CHECKPOINT: Owner-Approved Store A/B Authority Registry × Alias Conflict Matrix × No-Write Migration Plan

**Date:** 2026-11-18 JST. **Base:** V17.2C.40A HEAD `4654d7c2455d4103a6ec3443e2cabf35113567fa`. **Tested implementation commit:** `ecb63c51e195fa1d5adbf891b382f612e1b303c5`. **PR:** #392, OPEN DRAFT. **Authority decision:** `NOT_APPROVED`, **migration NO-GO**.

## 1. VERIFIED actual evidence
Supabase `tien404-staging` `ifxlvrhyjhbzbrkdsida`: Postgres 17 `ACTIVE_HEALTHY`, no development branches. Read-only inspection only:
- Actual `public.tenants` has 2 tenants, 3 active Auth owner users in total. One Tenant has 2 distinct active owners, but only **1 QA Store** in the QA mapping; this does NOT establish two distinct same-tenant Stores.
- Supabase R1 QA: 2 bot fixtures, both `dry_run/synthetic_qa`. QA owner binding 2 records `paired` and unexpired; **only 1/2** has a current confirmed claim/consumed challenge + active real Auth owner requester chain. No unapproved binding was promoted.
- Production `public.stores`/`store_memberships` absent. Orders, OrderItems, Products, Customers have no `store_id`, Orders RLS is tenant-wide. `app_private.channel_secrets`: zero rows and no `store_id`. Real Order idempotency lacks Store scope and Product uniqueness is Tenant-only.
- Protected QA V17.5 `channel_identity`, `auth_customer_binding`, `order_ownership` contain zero records. Neither QA schema establishes a real signed provider/owner Store membership.
- The n8n Commerce tenant registry has 4 Tenant aliases; all 6 channel rows map internally (6/6). **0/4** n8n Tenant aliases directly equal Supabase `public.tenants.id` UUIDs; **0/6** channel `tenantId` values directly equal Supabase tenant UUIDs (3 enabled sandbox/not_connected). Two n8n R1 bot tuples have **0/2** exact match to two Supabase R1 QA bot tuples. This may be intended namespace/alias translation, but there is **no verified trusted resolver**.
- n8n G05 trusted-installation fixtures: 7 `QA_SYNTHETIC_NO_REAL_OWNER` records, 0 exact tenant/store tuple matches to the separate R1 QA Bot registry; cannot assume these two QA labs share the same alias namespace. V17.1C/V17.2 QA profiles and bindings are read-only synthetic and none have `owner_authority_verified=true`.
- The existing Messenger→legacy Google Sheets Published tools remain separate. No real protected Store Order Writer exists.

## 2. TESTED live SELECT-only admission
`qa/v172c-rpc-closure/v172c40b-live-authority-registry-readonly-gates.sql` was **executed against real staging** and yielded **15** rows:
- **3 VERIFIED_PASS**: same-Tenant two owner candidates; QA bot `dry_run/synthetic_qa` integrity; QA bot reference to existing tenants.
- **8 VERIFIED_BLOCKED**: second Store under owner-pair Tenant, complete owner-binding chain, canonical Store schema, Store-scope columns, Store-scope RLS removal of tenant-wide read, protected channel Store installation, Store idempotency and Store SKU uniqueness.
- **4 NOT_TESTED**: signed private owner approvals, independently verified n8n↔Supabase alias crosswalk, real Auth A/B sessions, approved backup/release review.
This is a **metadata admission test**; it is not real JWT A/B session UAT or a production write.

## 3. IMPLEMENTED source-only Draft artifacts
1. `qa/v172c-rpc-closure/v172c40b-live-authority-registry-readonly-gates.sql` — reusable **SELECT-only** live admission.
2. `qa/v172c-rpc-closure/v172c40b-owner-authority-registry-NOT_APPROVED.json` — immutable candidate, **zero Store/owner/alias/channel mappings**, six `false` release gates, no IDs, real proofs or credentials.
3. `qa/v172c-rpc-closure/v172c40b-static-deny-default-gate.py` — standard-library validation of immutable NOT_APPROVED, empty mapping lists, source/approval requirements and all release gates disabled.
4. `docs/ai-handoff/V17_2C40B_ALIAS_CONFLICT_MATRIX_READONLY.md` — specific counts, scoped namespaces, severity and conflict handling.
5. `docs/ai-handoff/V17_2C40B_OWNER_APPROVAL_AUTHORITY_PACKET.md` — owner S1 co-owners/one Store vs S2 two distinct Stores decision, protected provenance and separate consent/reviewer requirements.
6. `docs/ai-handoff/V17_2C40B_NO_WRITE_STORE_AUTHORITY_MIGRATION_PLAN.md` — G0–G7 no-write phased plan: approval → signed alias evidence → backup/rehearsal → additive schema → atomic RLS cutover → real A/B read-only → compatible writer → independent release; STOP and rollback at each stage.
7. Existing `.github/workflows/v172c15-ephemeral-postgres-qa.yml` now includes the static registry DENY source guard. It does not use remote DB or any Auth sessions.

## 4. GitHub CI verification
At source/test commit `ecb63c51e195fa1d5adbf891b382f612e1b303c5`, **3/3 CI SUCCESS**:
- [PostgreSQL 17 regression & new V40B static NOT_APPROVED gate — #44255947440](https://github.com/ngoctien20/demo-git/actions/runs/44255947440) — SUCCESS, verified new step explicitly concluded SUCCESS.
- [RPC privilege source security — #44255947383](https://github.com/ngoctien20/demo-git/actions/runs/44255947383) — SUCCESS.
- [Protected consent source regression — #44255947393](https://github.com/ngoctien20/demo-git/actions/runs/44255947393) — SUCCESS.
These are **static/no-write source tests**, not real Store membership or hosted JWT proof.

## 5. Security, approvals, rollback and future work
- **VERIFIED:** actual Supabase Owner/Tenant/QA provenance, live SQL 3 PASS/8 BLOCKED/4 NOT_TESTED; n8n 6/6 internal, 0/4 UUID, 0/2 cross-QA tuple exact equality; CI static deny PASS.
- **IMPLEMENTED:** all source-only documents, empty fail-closed registry, SELECT gate and CI static check on Draft PR.
- **TESTED:** only read-only metadata checks and source static denial, not migration/backup/JWT/protected provider.
- **PROPOSED:** exact, owner-signed canonical Store source-of-truth and alias crosswalk in a private protected server; additive migration with strict rollback and RLS cutover after approvals.
- **BLOCKED:** owner-approved Store A/B boundary, one incomplete owner QA proof chain, cross-system alias translation, actual Store schema/RLS and Auth A/B.
- **NO-GO:** production Orders writes/reads across Stores, real Provider sends, n8n Published changes, Supabase schema migration, privilege change or subscription/billing updates.
- **APPROVAL needed:** the next owner decision is **S1 (two owners of one Store) vs S2 (two different Stores within same Tenant)**. No other approval is implied by naming this version.
- **Rollback:** revert Draft-only documentation, JSON, Python and CI workflow changes; disposable PostgreSQL service ends with workflow, no hosted writes to undo.
- **Issues:** #399 real Auth A/B admission, #402 canonical Store scope, #403 protected writer compatibility remain OPEN.
- **Next proposed:** V17.2C.40C — Private Owner Consent Evidence × Namespace Translation Admission Preflight, still NO WRITE. Do not issue real Auth sessions before canonical membership is verified.

**Source references:** previous checkpoint V40A and official Supabase RLS documentation https://supabase.com/docs/guides/database/postgres/row-level-security .
