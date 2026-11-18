# V18.3.6D — Open Design Decisions

These are business/architecture choices surfaced by the live audit. The default recommendation is shown, but no schema change is authorized.

| ID | Decision | Recommended default | Impact if not decided |
|---|---|---|---|
| D-01 | Tenant Owner reads Store data without explicit membership? | No. Tenant Owner manages Store registry but must be explicitly added to each Store for Commerce data. | Tenant Owner could become an implicit cross-Store superuser. |
| D-02 | SKU uniqueness | Store-local SKU: `UNIQUE NULLS NOT DISTINCT (tenant_id, store_id, sku)`; preserve legacy NULL uniqueness. | Current `UNIQUE (tenant_id, sku)` blocks the same SKU in two Stores. |
| D-03 | Customer identity shared across Stores? | No automatic deduplication; customer rows are Store-scoped. | Phone/email matching could leak customer history across Stores. |
| D-04 | Store Owner multiplicity | Allow multiple active Store Owners; require at least one active owner for an active Store. | Owner transfer and account deletion could orphan a Store. |
| D-05 | Staff order operations | Create/limited status transitions through atomic commands; no broad direct UPDATE. | Broad table grants could allow changing totals, prices or ownership keys. |
| D-06 | Tenant Owner Store access | Explicit per-Store memberships for every Store whose Commerce data they need. | Existing tenant-level owner policy would otherwise continue to grant cross-Store reads. |
| D-07 | Provider account binding | One active provider account/installation maps to one Store; verified and revocable. | One page/OA could route to multiple Stores ambiguously. |
| D-08 | Legacy records without evidence | Keep NULL/quarantined and invisible to Store actors. | Auto-mapping risks cross-store data disclosure. |
| D-09 | Service-role use in n8n | No unrestricted table writer; use trusted gateway and narrow Store-aware operations. | Service role bypasses RLS. |
| D-10 | Shared catalog / cross-Store reporting | Out of scope; design later as explicit shared-resource/reporting capability. | Accidental Tenant-wide access could be introduced to simplify reporting. |

## Recommended decision set for first rollout

Adopt D-01, D-03, D-04, D-05, D-06, D-07, D-08 and D-09 as least-privilege defaults.

D-02 (SKU uniqueness) needs explicit business confirmation because it changes the existing live uniqueness rule. D-10 remains out of scope.

No decision in this document changes the live system.
