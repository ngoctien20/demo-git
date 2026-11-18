# V18.3.6D — Legacy Mapping Manifest Specification

## 1. Purpose

The manifest is the only approved path for assigning a historical Tenant-scoped record to a canonical Store. It is an evidence ledger, not a bulk backfill script and not an authority source by itself.

The real manifest must live in a restricted private schema or controlled encrypted migration workspace. GitHub contains only this specification and an empty header template. Never commit customer names, phone numbers, addresses, order IDs, raw provider IDs, Auth IDs, tokens or row-level evidence.

## 2. Required manifest fields

| Field | Meaning |
|---|---|
| `manifest_id` | Unique immutable mapping decision |
| `batch_id` | Approved migration batch |
| `source_system` | Supabase, n8n DataTable, Google Sheets or other approved source |
| `source_schema`, `source_table` | Exact source location |
| `source_record_key_ref` | Restricted reference to exact source primary key; do not expose in GitHub |
| `source_row_sha256` | Hash of canonical source row at review time |
| `tenant_id` | Existing source Tenant |
| `proposed_store_id` | Proposed canonical Store |
| `proof_type` | Evidence category |
| `proof_ref` | Private evidence reference |
| `owner_approval_ref` | Exact owner approval receipt |
| `owner_approved_by`, `owner_approved_at` | Approving Store Owner / Tenant Owner and timestamp |
| `reviewed_by`, `reviewed_at` | Independent reviewer; must differ from mapper |
| `decision` | `APPROVE`, `REJECT`, `QUARANTINE` |
| `status` | Lifecycle state |
| `migration_version` | Exact applied migration version |
| `applied_at` | Successful application timestamp |
| `target_record_key_ref` | Restricted reference to target record |
| `rollback_batch_id` | Exact reverse batch, if required |
| `evidence_sha256` | Hash of the complete approval/review evidence bundle |

## 3. Status lifecycle

`DISCOVERED → PENDING_OWNER_APPROVAL → APPROVED → REVIEWED → APPLIED`

Alternate terminal or hold states:
- `REJECTED`
- `QUARANTINED`
- `EXPIRED`
- `REVOKED`
- `ROLLBACK_PENDING`
- `ROLLED_BACK`

Only `REVIEWED` rows can be applied. A row must not skip owner approval or independent review. Approval is time-bounded and revocable until apply.

## 4. Accepted evidence

Examples of evidence that may support a proposed mapping:
- a verified provider installation that was already uniquely bound to the exact Store at the time the source record was created;
- a source-system immutable Store key with a verified chain of custody;
- an explicit owner confirmation that names the Store, source scope and exact record/batch scope;
- a signed approval receipt with actor, reviewer, timestamp, expiry, revocation path and evidence hash.

Evidence is evaluated per row or tightly scoped batch. A general statement such as "these records belong to my shop" is not enough to map unrelated stores or tenants.

## 5. Forbidden inference

Never map based only on:
- Tenant ID (one Tenant may own many Stores);
- customer phone, name, email or address;
- product SKU/name or price;
- order date or amount;
- channel type alone;
- page ID / OA ID without verified historical installation ownership;
- current workflow route or current default Store;
- first Store created, Store A, or the only Store visible in a dashboard;
- synthetic R1 or V18.3.6B fixture relationships.

## 6. Apply contract

For each manifest row:
1. Re-read the exact source row in the private migration environment.
2. Recompute the canonical source row hash.
3. Verify Tenant and proposed Store relationship.
4. Verify owner approval is valid, exact-scope, unexpired and not revoked.
5. Verify independent reviewer approval.
6. Check composite FK and business-key conflicts.
7. Apply compare-and-set: update only if the source row still matches the approved hash and its `store_id` is still NULL.
8. Record exact target row, migration version, result hash and timestamp.
9. If any check differs, leave the row unchanged and set `QUARANTINED`.

The apply operation must be idempotent. Re-running the same batch cannot map a different row or Store. No broad `UPDATE ... WHERE tenant_id = ...` backfill is allowed.

## 7. Rollback contract

- Preserve the original source row hash and exact applied mapping.
- Reverse only rows applied by the exact batch and still matching the post-apply hash.
- Do not null out a Store ID if downstream Store-owned records depend on it; plan a dependency-ordered rollback.
- If the row changed after apply, quarantine and require manual review.
- Keep the audit event even after rollback.

## 8. Current inventory disposition

| Source | Live inventory | Store assignment |
|---|---:|---|
| Supabase public products | 2 | Unmapped / quarantine |
| Supabase public orders | 2 | Unmapped / quarantine |
| Supabase public customers | 0 | No rows |
| Supabase public order_items | 0 | No rows |
| Supabase public conversations | 0 | No rows |
| Supabase public messages | 0 | No rows |
| R1 Store/Bot identity map | 2 synthetic scopes → 2 distinct Auth Tenants | QA-only; not a same-Tenant Store A/B map |
| n8n Commerce Products DataTable | 8 across 3 tenants | Sandbox-only; no Store ID/Store Key |
| n8n Commerce Orders DataTable | Schema exists; row payload not read in V18.3.6C | Do not infer or backfill |
| Legacy Google Sheets | Not row-inventoried in this phase | Separate PII-safe inventory required |

The two public products and two orders are in QA staging Tenants and have no independent evidence tying each record to a canonical Store. They remain unmapped. No real data is assigned by this design.

## 9. Manifest custody

- Store raw source keys and evidence in a private schema with no anon/authenticated table grants.
- Restrict manifest access to a dedicated migration operator and independent reviewer.
- GitHub stores only the empty header template and aggregate counts.
- Never paste JWTs, refresh tokens, cookies, customer PII or raw source rows into issue comments, workflow logs or PR descriptions.
