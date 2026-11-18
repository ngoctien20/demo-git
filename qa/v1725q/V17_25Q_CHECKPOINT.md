# TIEN404 V17.25Q — Final Checkpoint

**Date:** 18 Nov 2026 JST  
**Status:** `CONTRACT_DESIGNED / DUAL_OWNER_SYNTHETIC_QA_58_PASS / PARENT_SOURCE_REPLAY_28_PASS / LIVE_V1_TENANT_ONLY / M0_NO_GO / HOSTED_NO_GO / PRODUCTION_NO_GO`

## 1. Source lineage

- Child Draft PR: [#413 — V17.25Q](https://github.com/ngoctien20/demo-git/pull/413).
- Base: [Draft PR #411 — V17.25P](https://github.com/ngoctien20/demo-git/pull/411), checkpoint `1a624008c8c0da53d9d0d481fe5248fa083b051f`.
- Parent PR #411 received a CI-only workflow extension at `db0f4907b46bfc5a8333d1a0eef4166ccaa649f0` so the stacked child can run the V17.25Q suite. This is not an app/runtime change.
- Branch: `work/v1725q-store-aware-contract-nohost-20261118`.
- Final source revision at CI: `a04867731b255b8157da7755da9142ed0b6f42f1`.

## 2. CI evidence

- Run: [GitHub Actions #44266464089](https://github.com/ngoctien20/demo-git/actions/runs/44266464089).
- Job: `134672109787`, completed SUCCESS.
- Parent exact deployed-source replay: **28 passed in 0.28s**.
- V17.25Q Store-aware contract suite: **58 passed in 0.42s**.
- JSON contract + legacy matrix parsed successfully.
- Test harness blocks real socket `connect` and `create_connection`; all actors/tokens/Stores/products/orders/customers/conversations/messages are synthetic. No Supabase host, real JWT, customer record, Render host or provider endpoint is contacted.
- An initial test run exposed three simulator permission-denial responses raising an internal exception rather than HTTP 403. The contract simulator was corrected to return explicit 403; the final run passed 58/58. This was a test-harness defect, not a live API change.

## 3. Verified current live baseline

Render:
- Service `tien404-data-staging`.
- Deployment `dep-dbqj9plg1s2s73egr30g`, still LIVE.
- Deployed commit `ab940a95dae8afdff426bc6ac71693833d5348ce`.
- Exact `main.py` blob `a7a11abeffb378b3f9952005ffdd489c54df1c13`.
- Auto Deploy OFF; direct origin allowlist remains `0.0.0.0/0` and needs a separate hardening gate.

Supabase staging:
- PostgreSQL 17.11.
- `public.stores` absent; `public.store_memberships` absent; 0 `store_id` columns.
- Existing relevant Products/Orders/Order Items/Customers/Conversations/Messages/tenant-membership tables have RLS enabled but current policies are Tenant-scoped.
- Current relevant authenticated grants are SELECT only.
- No schema, data, RLS, grant, Auth, credential or project setting was changed.

## 4. Live API deprecation finding

Exact deployed FastAPI has:
- `GET /api/v1/tenants` — keep as tenant directory only.
- `GET /api/v1/tenants/{tenant_id}/products` — live Tenant-only filter; any active tenant member can read through the current contract.
- `GET /api/v1/tenants/{tenant_id}/orders` — live Tenant-only filter; Owner/Manager role required.

V17.25O's legacy guard is a synthetic test adapter and only intercepts Orders; it is not mounted into Render and does not cover Products. Both live business routes remain unchanged and unsuitable for multi-Store data. V17.25Q proposes block 503 before Store-mode admission and sunset 410 after v2 cutover. No automatic single-Store fallback.

Customers/Conversations/Messages exist as database tables, but no corresponding GET routes were found in the inspected deployed FastAPI main module.

## 5. Contract result

Candidate OpenAPI 3.1 contract in `api-contract.json`:
- `GET /api/v2/tenants/{tenant_id}/stores`.
- Store-scoped products, orders, order items, customers, conversations and messages routes.
- Verified Supabase Auth + active Tenant membership + explicit active Store membership on every request.
- Effective role is the least privileged of Tenant and Store roles.
- Tenant Owner without Store membership is denied; a dual-Store Owner must specify the Store per request.
- No authority from client headers/query/body or user-editable JWT metadata.
- Child resources must match the exact Tenant + Store + parent object.
- Order-create contract accepts SKU + quantity only; server derives price, stock, total, status, Store and channel; Store-scoped idempotency key required. It is not implemented.

## 6. Migration and release gates

- Migration preview is non-executable Markdown only; no migration SQL created or run.
- Composite Tenant+Store keys/FKs required for Products, Orders, Order Items, Customers, Conversations and Messages.
- Replace legacy permissive Tenant-only RLS policies atomically; do not leave an old permissive policy alongside new Store policy (OR semantics).
- No guessed backfill; unmapped/ambiguous legacy rows remain inaccessible to Store API until independently verified.
- M0 current backup/independent restore remains NO-GO; owner deferred local backup on 17 Nov.
- Real Owner A/B JWT UAT remains `0/31 NOT RUN`.
- Provider adapters disabled; no sends.
- Hosted Store read/write, RLS cutover, production all NO-GO.

## 7. Rollback / next safe step

Rollback: close/revert Draft PR #413; no runtime rollback required.

Next safe work: V17.25R — disposable PostgreSQL 17 Store schema/composite FK + RLS policy replacement truth table, reusing existing P0D/P0N fixtures. No hosted migration until M0 and owner provenance gates pass.

**Checkpoint:** `V17.25Q_CONTRACT_CANDIDATE / CI_58_PASS / V17.25P_28_PASS / LEGACY_V1_LIVE_TENANT_ONLY / M0_NO_GO / HOSTED_NO_GO / PRODUCTION_NO_GO`.
