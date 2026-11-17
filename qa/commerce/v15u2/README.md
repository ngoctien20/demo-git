# TIEN404 V15.0-10U.2 — Disposable PostgreSQL 17 ONLY

**Purpose:** Test the exact guarded V15.0-10U.1 candidate SQL on a brand-new PostgreSQL 17 container using synthetic v1/v2 fixture records. **No connection to Supabase, n8n, Messenger/Zalo or customer data.**

Run via GitHub Actions on a draft PR into main, using `postgres:17` service. The wrapper enforces `PGHOST=127.0.0.1`, `PGDATABASE=tien404_v15u2_disposable`, `PGUSER=postgres`, DB must initially have no v1 table, PG server major 17. The original review guards are **never modified**; their exact known sentinel lines are stripped only into temporary files inside this ephemeral test job and those temporary files are destroyed. No role/policy SQL is ever sent to hosted.

* `00` is a schema/legacy Owner RPC shape fixture; **the Owner functions are synthetic analogs, not live original function definitions**.
* `01`/`02`/`03` are exact review-only SQL from V15.0-10U.1, unchanged.
* `04` seeds 2 Stores under **one** synthetic Tenant (plus another Tenant), 3 distinct bot mappings, 3 synthetic Reader subjects.
* `05` checks PostgreSQL RLS mechanics with `SET ROLE` and **simulated `request.jwt.claim.sub` GUC**. This is NOT a cryptographically verified JWT, must not be used to certify hosted JWT UAT.
* `06` checks rollback preserved v1 and removed only v2.

**M0 recovery:** Synthetic ephemeral rollback is **not** a complete Supabase backup/restore rehearsal. Before hosted migration, require independent operator evidence for real Auth/Storage/ACL/roles recovery, actual signed M0 restore, and scoped authorization.

**Release:** No merge, no hosted changes, no publish. Full hosted JWT 17-case matrix remains `NOT_RUN`.