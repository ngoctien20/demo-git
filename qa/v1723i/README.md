# TIEN404 V17.23I — Trusted Store Origin × Dependency Reconciliation

**DRAFT ONLY / NO HOSTED WRITE / REAL JWT NO-GO / REAL M0 DEFERRED**

Parent: [V17.23H PR #346](https://github.com/ngoctien20/demo-git/pull/346), exact reviewed HEAD `c667036ff260916fd1306eb0c0c55392467f69f8`. Inherits proven GitHub Actions PG17 disposable run 44089888136. Does NOT alter PR319 or PR346 source.

## Verified read-only Supabase staging facts (2026-11-17)
- Project ifxlvrhyjhbzbrkdsida: 2 tenants, 2 products, 2 orders, 0 customers, 3 Auth users, 5 session records (count does not verify JWT).
- public.stores, public.store_memberships absent; 0/6 canonical Commerce surfaces have store_id.
- QA tenant_identity_map: 2 rows; QA owner_bindings: 2; same tenant with >=2 different Store keys: **zero**. A Tenant with multiple active Auth memberships is NOT the same as two owner-verified Store principals.
- Customer auth/channel/order-ownership binding tables all empty. Six public Commerce SELECT policies currently PERMISSIVE and tenant-wide, not Store-scoped.
- Product/Order original 4 hosted rows have no independently proven canonical Store lineage; **never infer Store from SKU, tenant, QA bot, filename, or customer name/phone**.

## Dependency gates
- M0 (DEFERRED): Owner chooses current recoverable scope; independent application/Auth/roles/Storage restore with distinct Operator & Reviewer; H11R partial archive accepted with limitations, not current full recoverability.
- M1 (BLOCKED): current M0 independently accepted, real four-row Store ownership privately evidenced, legacy caller inventory and schema compatibility reviewed; only nullable Store expansion; never silently backfill.
- M2/M4 (BLOCKED): approved Store ownership backfill and atomic replacement/restrictive AND of legacy tenant-wide permissive SELECT policies for six surfaces; positive/negative A/B per operation. Adding a second permissive Store policy DOES NOT restrict the first.
- M3 (BLOCKED): composite same-Store order ↔ customer and order-items ↔ product/order FKs, SKU uniqueness and existing client compatibility.
- M5 (BLOCKED): two independent *real* Supabase issuer-validated Auth sessions, canonical same-Tenant Store A/B ownership, genuine PostgREST RLS negative UAT, provider signature/install ownership and challenge-backed cross-channel Customer/Order ownership. No JWT/PII uploaded to GitHub.

## Execution and rollback
- `node --test qa/v1723i/dependency-admission.test.mjs` offline source tests only.
- `hosted-readonly-baseline.sql` contains READ ONLY aggregate queries, not a migration.
- `reviewMigrationAdmission()` deliberately never authorizes hosted actions, even if all caller-supplied flags are true; real Operator claims must be independently verified in private authenticated infrastructure. Do not use this public library to grant permissions.
- No backup export, Auth changes, Supabase DDL/DML, GRANT/REVOKE, n8n edits, provider sends, real customer row reads, public intake, costs, hosted rollout or auto merge.
- Rollback: close Draft PR only. Existing PG17 evidence and all published workflows retained.
