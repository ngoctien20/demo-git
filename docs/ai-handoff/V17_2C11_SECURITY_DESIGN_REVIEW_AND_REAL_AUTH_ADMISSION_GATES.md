# V17.2C.11 — Independent Security Design Review & Real Auth Admission Blockers

Date: 2026-11-18 JST
Parent: Draft PR #392, V17.2C.10 checkpoint HEAD `ffae7b2284ac960935ec52f8df7e118f78745455`.
Status: **SOURCE CHANGE IMPLEMENTED, HOSTED JWT/MIGRATION NOT APPROVED.**

## Actual review actions

1. Fetched exact candidate SQL and rollback source from the current Draft branch; checked them against Supabase's published RLS guidance. Prior source-only CI run `44150650619` was SUCCESS for V17.2C.10 at its pinned head.
2. Identified one concrete index gap: Store membership policy checks user_id plus active state, but the existing composite PK begins with tenant_id. A tenant-first btree index is not a substitute for a user-first index when filtering by auth.uid().
3. Added only to *NOT EXECUTED* SQL candidate:
   `CREATE INDEX qa_store_memberships_user_active_idx ON tien404_v172c10_disposable.qa_store_memberships (user_id, active, tenant_id, store_id);`
   and a new fail-closed source assertion requiring it. No database migration applied. The new test is source-only; exact-HEAD CI still must be checked.
4. Supabase `list_branches` still returned zero development branches during V17.2C.10; staging is not disposable and contains existing products/orders. Real rollback/restore cannot be claimed from SQL source.
5. Independent verified consent by BOTH actual Auth actors (A and B) has not been received. Existing membership and historical auth.sessions rows are not proof of current valid JWT possession, consent or Store ownership.

## Admission decision

| Gate | Decision |
|---|---|
| Source candidate safety and user-first membership index | IMPLEMENTED in Draft only |
| CI at new HEAD | PENDING |
| Real PostgreSQL schema/rollback execution | NOT RUN |
| Isolated disposable Supabase instance and restore proof | BLOCKED |
| Private A and B independent authenticated consent | BLOCKED |
| Real Supabase JWT A/B store isolation | NO-GO |
| Zalo RPC grant/Published workflow | KEEP UNCHANGED |

**One concrete next human operation:** a privately authenticated operator must establish A and B as separate consenting QA actors and arrange an independent disposable database project or reversible branch; do not paste secrets/JWTs into chat. After private approvals, run the isolated SQL and verify PostgreSQL RLS, full rollback, and real JWT negative UAT. Until then no safe action can legitimately certify hosted security.

No production, credential, Auth, Supabase schema, n8n or provider changes. Rollback is revert candidate source commits or close Draft PR #392.
