# TIEN404 V18.3.6B — QA Checkpoint

**Checkpoint:** `V18.3.6B-PG17-44263318020`  
**Date:** 2026-11-18 (JST)  
**Status:** `CANDIDATE / SYNTHETIC PG17 REPLAY PASS / REAL AUTH A-B BLOCKED / STAGING NO-GO`

## Verified execution

- GitHub Actions workflow: `TIEN404 V18.3.6B Full PostgreSQL 17 Migration Replay`
- Run: `44263318020`
- Job: `134661699145` — `full-disposable-migration-replay`
- Runner: `ubuntu-24.04`
- PostgreSQL: `17.12 (Debian 17.12-1.pgdg13+1)`
- Draft PR: [#412](https://github.com/ngoctien20/demo-git/pull/412)
- Workflow commit at the verified run: `f91cfd6b1b274ac78b6d6915dabf6d5583805972`

All job steps completed successfully:
1. Checkout QA-only source.
2. Reconstruct original three SQL files and verify their exact SHA-256 hashes.
3. Start PostgreSQL 17.12 with `--network none`, no published ports, and a synthetic-only password.
4. Create `tien404_v1836_disposable`.
5. Execute original preflight, full migration and A/B RLS acceptance with `ON_ERROR_STOP=1`.
6. Execute final schema/mapping audit.
7. Remove the disposable container.

Log markers verified:
- `V18_3_6B_SOURCE_HASH_VERIFICATION_PASS`
- `V18_3_6B_PREFLIGHT_PASS`
- `V18_3_6B_FULL_MIGRATION_PASS`
- `V18_3_6B_AB_RLS_ACCEPTANCE_PASS`
- `V18_3_6B_FULL_MIGRATION_REPLAY_AND_LEGACY_MAPPING_PASS`

## SQL and mapping results

The exact source hashes are recorded in `README.md`; all three source hashes matched before execution. The final audit passed:
- RLS enabled on all 10 synthetic tables.
- Six restrictive Store SELECT policies present.
- Ten Store/relationship foreign keys validated.
- QA principal is NOLOGIN, non-superuser, NOBYPASSRLS, and has no INSERT/UPDATE/DELETE/TRUNCATE privilege on the ten tables.
- Store A and B are two different synthetic principals in one synthetic tenant and two different Stores.
- Store A/B positive reads and same-tenant cross-Store negative reads passed; cross-tenant, missing identity, revoked membership, permissive-policy OR bypass, cross-Store order-item FK and write-denial tests passed.
- Legacy synthetic rows remain unmapped: one product and one order have NULL Store. Both Store A and Store B are denied the legacy order and legacy product.
- The migration's fixture mapping statements are not evidence of actual merchant history mapping.

## Connected system recheck — read-only

Supabase staging `ifxlvrhyjhbzbrkdsida` remains PostgreSQL 17.11 with:
- 0 canonical `stores` / `store_memberships` tables.
- 0 `store_id` columns in the six Commerce tables.
- 0 restrictive Store SELECT policies.
- 3 active tenant memberships.

No staging DDL, data update, Auth session inspection, Storage operation or customer-data access was performed. The runner did not call Supabase, n8n, Cloudflare, provider APIs or webhooks.

n8n workflows remain active with their previously observed published versions:
- Messenger `Z7FdV7uDvApfbURQ`: active version `1064b1b3-d3f1-4a6b-a367-2414ba691522`.
- Zalo Bot `yIJk8LvJoLF40Z62`: active version `2d912cb0-007f-452f-9536-b92ba12a03e6`.
- Commerce Core `iyfGUiEsZlNTBWOR`: active published version `456862c9-e5ee-4bfa-9931-47dbc39ab73d`; draft/current version remains distinct.

## Decision

- `SYNTHETIC_PG17_FULL_MIGRATION_REPLAY`: **VERIFIED / PASS**.
- `LEGACY_SYNTHETIC_MAPPING_AND_QUARANTINE`: **VERIFIED / PASS**.
- `REAL_SUPABASE_AUTH_OWNER_A_B`: **BLOCKED / NOT RUN**.
- `LIVE_LEGACY_MAPPING`: **BLOCKED / NO OWNER-APPROVED MANIFEST**.
- `STAGING_MIGRATION`, `PRODUCTION_WRITERS`, `PROVIDER_SEND`, `RELEASE`: **NO-GO**.

Do not merge PR #412 or promote this synthetic schema to staging. Real Auth A/B requires two independently consented owners, private server-side session verification, authoritative Store membership, a separately approved staging migration, backup/PITR and an independent security review.
