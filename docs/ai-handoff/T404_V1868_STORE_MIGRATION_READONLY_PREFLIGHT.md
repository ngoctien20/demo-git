# TIEN404 AI — V18.6.8 Canonical Store migration read-only preflight

**Checkpoint:** 2026-11-18 JST. **Stage:** CANDIDATE / SOURCE ONLY / SUPABASE STAGING READ-ONLY AUDIT / NO DDL, NO DML, NO HOSTED UAT, NO PRODUCTION.

## 1. Verified baseline and scope

This handoff is based on live read-only introspection of staging Supabase `tien404-staging`, PostgreSQL **17.11**, `ACTIVE_HEALTHY`, plus the last verified n8n Published workflow topology (V18.6.7). The latest migration recorded by `list_migrations` at inspection time is `20261117074559 v175e2b_private_auth_customer_binding_intake_no_grants`; **no canonical Store migration is present**. Do not silently add any separate `stores` representation from experiments in private QA schemas.

| Verified check | Current | Target candidate | Verdict |
|---|---:|---:|---|
| `public.stores` / `public.store_memberships` | 0 / 2 | 2 / 2 | BLOCKED |
| Commerce tables with `store_id` | 0 / 6 | 6 / 6 | BLOCKED |
| Public restrictive Store RLS policies | 0 | ≥6, independently tested | BLOCKED |
| Product SKU key | `UNIQUE (tenant_id, sku)` | D-02 **UNDECIDED**: Store-local or Tenant-global | OWNER DECISION |
| Product data | 2 rows, across 2 Tenants | Reviewed legacy mapping per row | NO AUTOMATIC MAPPING |
| Order data | 2 rows, across 2 Tenants | Reviewed legacy mapping per row | NO AUTOMATIC MAPPING |
| Customers, order_items, conversations, messages | 0 rows at read | Still require new Store-aware FK/policies | BLOCKED |
| Non-internal triggers on six Commerce tables | 0 in inspected live snapshot | Scope immutability guard requires design/review | NOT DEPLOYED |
| Real Owner A/B same-Tenant Store RLS | Not verified | Independent protected sessions + RLS evidence | BLOCKED |

Counts are aggregates, not evidence that the two QA Tenants contain two Stores within one Tenant. The snapshot contains no customer details, UUIDs, tokens, secrets, SQL migration or private records.

## 2. Live privileged product RPC: critical compatibility finding

`public.save_merchant_product(uuid,text,text,bigint,boolean,integer,timestamptz)` is owner `postgres`, `SECURITY DEFINER`, `search_path=''`, with `authenticated` EXECUTE. Its source has **two real write branches**:

- **Create**: INSERT into `public.products(tenant_id,sku,name,price_vnd,is_active,stock_on_hand)`; **no `store_id`**.
- **Edit**: UPDATE `public.products` by `tenant_id + sku + expected_updated_at`; **no `store_id`**.
- It checks `auth.uid()` and active Tenant owner/manager membership on a two-QA-Tenant allowlist, with optimistic timestamp conflict handling; it also inserts into `app_private.audit_events`.
- This is not proof of exploitability and does not justify blindly revoking EXECUTE. It **is** a real writer compatibility blocker before introducing `CHECK (store_id IS NOT NULL) NOT VALID`, a restrictive Store policy, new SKU uniqueness or altered product route.
- No real RPC calls were made. Full caller inventory is still incomplete. Authenticated direct table writes are not currently granted, but this does not eliminate privileged RPC writes or service-role paths.

The V18.3.6D design from [PR #417](https://github.com/ngoctien20/demo-git/pull/417) is the canonical *candidate*, and PG17 pgTAP full DML [PR #421](https://github.com/ngoctien20/demo-git/pull/421) is the synthetic testing *reference* (61/61 previously verified). Neither is deployed or owner-approved. Do not create an additional canonical schema or silently map fixture role `owner` to `store_owner`.

## 3. Writer boundary is deliberately divided

- Supabase: `save_merchant_product` writes staging products. Its future replacement must derive verified actor + exact active Store membership **server-side**, constrain `(tenant_id,store_id,sku)` as appropriate, enforce ownership immutability, and retain audit/optimistic concurrency. A migration with NULL guards before replacement can break it.
- n8n Messenger Published: `Z7FdV7uDvApfbURQ` invokes the DEMO Google Sheets order append/update flows `KrSn4DNR9ALX5ng4`, `fDB9dvs1qPPVt9Sp`, `BkAi6TVUKAjCnI7v`. Those three published versions differ from Draft versions. Preserve DEMO Google Sheets / Commerce isolation; do not repoint these calls as a shortcut and do not claim Store RLS protects Google Sheets.
- Cloudflare: `tien404-widget-gateway-v144-staging` has Access protection and operator bindings, but the real Supabase Auth session -> Store membership bridge has **not** been verified on the hosted Worker.
- Render: connector requires explicit user workspace choice. The available workspace was not selected, so **deployed Render source is uninspected**. Historical GitHub source is not equivalent to deployed evidence.

## 4. Deliverables

- `qa/store-authority-v1868/read-only-preflight.sql`: seven SELECT statements over public catalogs only, no customer data access. **Not a migration**. It is intentionally not executed against staging by CI; read-only Supabase inspection already supplied source facts.
- `qa/store-authority-v1868/staging-metadata.snapshot.json`: explicit, bounded read-only findings and unresolved approvals. It is a *dated observation*, not an independent signed attestation.
- `qa/store-authority-v1868/preflight-gate.cjs`: source-only fail-closed check. Even a crafted snapshot with all fields switched to true cannot authorize migration, real UAT, service-role changes, provider sends or Production.
- `qa/store-authority-v1868/preflight-gate.test.cjs`: validates metadata, SQL SELECT-only contract, fail-closed behavior and source integrity; runs offline, no Supabase credentials.
- Existing PG17 CI workflow is extended with the new preflight tests; earlier suites remain unchanged.

## 5. Phased owner-approved migration **PLAN ONLY**

### Phase 0: evidence / safety before *any* staging change

1. Freeze exact deployed Render source and n8n Published writer graphs with version/commit evidence. Render user selects the workspace explicitly; do not select it on the user's behalf.
2. Inventory **all** privileged writer callers: `save_merchant_product`, API routes, background jobs, service-role code, Cloudflare/Render, n8n, Google Sheets. Flag any unknown as BLOCKED.
3. Choose Store-local vs Tenant-global SKU D-02 **explicitly**. Store-local requires changing the existing `UNIQUE(tenant_id, sku)` only after verified code/API compatibility and collision QA.
4. Approve canonical `store_owner`/manager/staff role contract, and explicit per-Store membership requirement for any Tenant owner Commerce access; no global Store read by inference.
5. Verify backup/PITR availability and **restorability**; store rollback evidence outside this Git repo and do not disclose credential values.
6. Approve a private per-row legacy ownership manifest: no inferring Store from SKU, Tenant, Page, address, phone or channel; preserve unknown rows as NULL/quarantined.
7. Independent security review signs the exact schema/permissions and migration sequence; record separate staging DDL approval before execution.

### Phase 1: add, don't cut over

- After separate approval, introduce exactly the PR #417-reviewed registry / membership schema, restrictive grants, immutability and minimal non-exposed auth helpers. No automatic Owner A/B seeding.
- Prepare a **disposable PG17** replay of the exact migration from the approved source. Use PR #421's pgTAP regression and additional narrow RPC compatibility tests.
- Add nullable `store_id` to Commerce in a separately reviewed step. Be careful: `CHECK (store_id IS NOT NULL) NOT VALID` rejects *new and updated* NULL rows, despite leaving existing rows unvalidated. Do not add until legacy writer cutover/quarantine is ready.
- Keep existing Tenant foreign keys intact until validated composite Tenant+Store constraints; do not drop legacy constraints prematurely.

### Phase 2: switch authority, not the DEMO bot

- Create a narrow Store-aware privileged product command and verify it against actual owner membership and concurrency under separate approval. Ensure no old RPC caller can create unscoped rows.
- Test at least two real Stores **within one Tenant** and independent Owner A/B protected sessions in a private canary, using no JWT or identifiers in chat, screenshots or GitHub output. Assert same-Tenant A->B, B->A, revoked/missing membership, service-role bypass, and zero data mutation from negative probes.
- Cut over one previously approved staging writer at a time only after dual-path reconciliation, alerts and bounded rollback. DEMO Messenger workflows remain untouched until a separate explicit product decision.
- In failure, **fail closed** and disable the new writer; never relax Store RLS to Tenant-wide just to make pages or APIs work.

### Phase 3: release gate

- Recheck every deployed runtime, actual Store RLS, private Auth, published workflow versions, backup, monitoring, roll-forward and rollback.
- Separate approval required for real Meta OAuth, channel credentials, protected UAT, billing or production deployment. **No part of this PR grants approval.**

## 6. Known decisions / risks

| Risk | Category | Owner / next evidence |
|---|---|---|
| `save_merchant_product` writes tenant-scoped product | P1 compatibility | Backend/security: exact caller inventory and replacement staging draft |
| Store RLS missing | P0 isolation gate | DB/security: owner-reviewed schema & full pgTAP regression |
| Legacy SKU constraint conflicts with Store-local catalog | P1 policy | Product owner: explicit D-02 approval |
| Unknown Render deployed source | BLOCKED | User must identify/confirm workspace; then read-only source/deploy audit |
| Cannot prove same-Tenant Owner A/B | BLOCKED | Private real Auth/RLS protected acceptance, no token export |
| No backup/restore attestation | BLOCKED | Independent restore evidence, approved window |
| Messenger DEMO Google Sheets published writers | ISOLATION RISK | n8n team: keep split, audit current Published/Draft, approval before cutover |

## 7. Rollback and checkpoint

Current change is **GitHub source-only Draft**; rollback: close the Draft PR and optionally archive this snapshot. There are no Supabase DDL/DML, n8n, Cloudflare, Render, provider, production or customer changes to revert. A future live schema migration needs its own transactional/verified rollback plan and explicit approval; **do not run any SQL from this document**.

**Checkpoint:** `V18.6.8 | LIVE_METADATA_VERIFIED | READONLY_SQL_7 | SOURCE_PREFLIGHT_QA | CANONICAL_SCHEMA_BLOCKED | RPC_CUTOVER_BLOCKED | RENDER_SOURCE_BLOCKED | REAL_AB_BLOCKED | NO_SEND | NO_WRITE | PRODUCTION_NO_GO`.

References: https://supabase.com/docs/guides/api/securing-your-api ; https://supabase.com/docs/guides/database/postgres/row-level-security ; https://github.com/ngoctien20/demo-git/pull/417 ; https://github.com/ngoctien20/demo-git/pull/421 ; https://github.com/ngoctien20/demo-git/pull/434 .
