# Config Core v1 — QA Acceptance Matrix (Phase 1)

Environment for every TESTED row: local PostgreSQL 16.15 (container) + Node 22, V20 replica stack,
simulated Supabase roles/JWT claims. Not hosted. Workflow version: n/a (no n8n change).
Evidence: `node --test config-core/test/*.test.mjs` (67/67) and `qa/config-core/offline-pg-uat.sh`
(`T404_CONFIG_CORE_OFFLINE_UAT_PASS=120`). CI: `.github/workflows/tien404-config-core.yml` (PG17).
Rollback for all rows: `db/config-core/90_config_core_rollback.sql` (tested in the same UAT).

| ID | Matrix | Goal | Evidence (assertion) | Result |
|---|---|---|---|---|
| CC-A01 | A | Owner A creates Assistant from template | `A_DRAFT_FROM_TEMPLATE` | PASS (offline) |
| CC-A02 | A | Rename button | `MANAGER_RENAMED` | PASS (offline) |
| CC-A03 | A | Reorder | sort_order change saved; renderer order test | PASS (offline) |
| CC-A04 | A | Hide button | `order_lookup.enabled=false` saved; renderer hides | PASS (offline) |
| CC-A05 | A | Update action data / reject bad data | `INJECTED_TOOL`, 52 `PARITY_*` cases | PASS (offline) |
| CC-A06 | A | Preview per channel | renderer unit tests (messenger/web/text) | PASS (unit) |
| CC-A07 | A | Save draft with concurrency | `STALE_SHA`, `CONCURRENT_EDITOR` | PASS (offline) |
| CC-A08 | A | Publish / immutability | `PUBLISH_V1`, `PUBLISHED_IMMUTABLE_EVEN_FOR_ADMIN`, `PUBLISHED_UNDELETABLE` | PASS (offline) |
| CC-A09 | A | Rollback | `ROLLBACK_TO_V1_AS_V4`, `ROLLBACK_CONFIG_EQUALS_V1`, `OPEN_DRAFT_UNTOUCHED` | PASS (offline) |
| CC-A10 | A | A cannot read/edit B and vice versa | `B_CANNOT_SEE_A*`, `B_SAVE_A`, `B_PUBLISH_A`, `B_ROLLBACK_A`, `A_CANNOT_SEE_B` | PASS (offline) |
| CC-A11 | A | Staff read-only, anon nothing, direct writes blocked | `STAFF_*`, `ANON_*`, `AUTH_DIRECT_*` | PASS (offline) |
| CC-A12 | A | Real GoTrue JWT login on hosted | — | NOT RUN (needs approved apply) |
| CC-B01 | B | Templates contain no invented price/stock/bio/schedule | unit `no prices…` | PASS (unit) |
| CC-B02 | B | One action reused, label change keeps action | unit `one action reused…` | PASS (unit) |
| CC-B03 | B | Experimental action cannot be published | `PUBLISH_EXPERIMENTAL`, parity | PASS (offline) |
| CC-B04 | B | Shop answers correct product/price; artist answers configured profile | — | NOT RUN (Phase 2, needs bot wiring) |
| CC-C01 | C | Override doesn't change base config/action | unit `channel override…` | PASS (unit) |
| CC-C02 | C | Unsupported channel → explicit, OA flagged unverified | unit `unknown channel`, `verified:false` | PASS (unit) |
| CC-C03 | C | Page bound to one tenant only; cross-tenant binding refused | `PAGE_BOUND_TWICE`, `CROSS_TENANT_ASSISTANT_BINDING` | PASS (offline) |
| CC-C04 | C | Resolver returns only active+published, channel-scoped | `RESOLVER_*` | PASS (offline) |
| CC-C05 | C | Payload cannot pick action/tenant; legacy payloads kept | unit `resolver…`, `legacy…` | PASS (unit) |
| CC-C06 | C | Live Messenger renders new menu | — | NOT RUN (Phase 2, needs publish approval) |
| CC-X01 | — | SQL and JS validators agree | 52 `PARITY_*` | PASS (offline) |
| CC-X02 | — | Rollback 90 leaves no objects; V20 functions unchanged; re-apply works | `ROLLBACK_NO_*`, `V20_*_UNCHANGED*` | PASS (offline) |
