# TIEN404 AI — V18.0-P0D Original Store Owner Evidence × M0 Recovery × Real Auth A/B Admission

**2026-11-18 JST · VERIFIED READ-ONLY HOSTED INVENTORY / IMPLEMENTED SOURCE ONLY / NO HOSTED EXPORT OR MIGRATION / REAL JWT NO-GO**

## Scope and exact inheritance

- Child of [V18.0-P0 PR #396](https://github.com/ngoctien20/demo-git/pull/396) exact prior HEAD `dc6eea754b73e240e57f6498a27258001fa6fa03`. Preserve its actual disposable PG17 **67/67 Node + SQL negative QA** in each independent Push/PR run. That proved ONLY simulated JWT session claims.
- Reuse the original **private four-row evidence intake** from [RPC12 PR #244](https://github.com/ngoctien20/demo-git/pull/244), and V17.23J [PR #354](https://github.com/ngoctien20/demo-git/pull/354). Do not create a second registry, export any original row/merchant identity to public source, or re-run prior H11R local acceptance.
- V18.0-P0D changes: read-only aggregate SQL, fail-closed **non-authoritative** Node baseline reviewer + negative tests, CI-only source QA, this runbook. No changes to existing SQL migrations, RPC10, n8n, Store data, permissions, Cloudflare or real credentials.

## Direct current staging inventory (2026-11-18 JST)

Read-only connected PostgreSQL queries against project `ifxlvrhyjhbzbrkdsida` (server 17.11), and Supabase organization metadata:

| Evidence | Live observed |
|---|---|
| Subscription | **Free**; no Supabase development branches |
| Core tenants / products / orders / customers | **2 / 2 / 2 / 0** |
| Anonymous tenant slot 1 | **1 Product, 1 Order, 2 active Tenant Owner memberships, 1 QA mapping** |
| Anonymous tenant slot 2 | **1 Product, 1 Order, 1 active Tenant Owner membership, 1 QA mapping** |
| Auth user rows / confirmed user rows | **3 / 3** |
| Auth session record rows / distinct users with session history | **7 / 2** |
| Active tenant Owner users with session history | **2** (does NOT verify fresh usable JWT) |
| QA identity maps / QA owner bindings / matching composite keys | **2 / 2 / 2** |
| Same-tenant QA with at least two distinct Stores | **0** |
| Core six-surface `store_id` column count | **0** |
| Canonical public `stores` / `store_memberships`, candidate `rpc178_qa` | **ABSENT / ABSENT / ABSENT** |
| Two Orders with source label | **2**; source label alone does NOT certify original Store |
| Idempotency / factory events / agent runs | **0 / 0 / 0** |
| Auth customer / channel identity / order ownership evidence rows | **0 / 0 / 0** |
| Storage buckets / object metadata rows | **0 / 0** |

Only aggregate counts and anonymous slot numbers were returned or recorded. No original Product/Order UUID, Auth UUID, raw row, phone, email, credentials, JWT, token, recovery file or Merchant identity was copied.

**Critical mismatch:** Current hosted Store QA labels occur in **two different Tenants**. The same-Tenant Store A/B scenario in PR #396 uses **synthetic fixture identities**, not actual hosted Store membership. Neither 3 Auth users nor 7 historical session rows proves an authenticated caller is currently authorized for Store A or B.

## Original four-row Store ownership decision

Require **four real hosted source rows**, two Products and two Orders in two independently anonymized Tenant slots. For each row, the authorized private operator must use the already existing RPC11/RPC12 private evidence scheme: original primary source, merchant Owner attestation, and separate independent review of authentic source. Keep actual identifiers and proofs on a controlled device, outside GitHub, chats, CI and logs. Mere `tenant_id`, `order_source`, SKU, QA owner binding or bot label is NOT enough to assign a canonical Store. Missing independent proof means **NO STORE ASSIGNMENT, NO BACKFILL**. No actual merchant row read or private evidence receipt was authorized or performed in V18.0-P0D.

## M0 current backup and restore decision (Owner instruction preserved)

- Founder already instructed on **2026-11-17**: **defer real local-machine backup** and continue safe Commerce source-only work. Reference RPC12 `T404_RPC12_OWNER_DEFER_LOCAL_BACKUP_20261117.md`. This is neither proof of current recovery nor a waiver of backup requirements for staging changes.
- Historical `H11R_PARTIAL_APPLICATION_ARCHIVE_LOCAL_QA_OWNER_ACCEPTED_WITH_LIMITATIONS` remains intact: 5/5 Application TABLE DATA (locally checked); 0/3 Auth and 0/2 Storage in the historical archive. Do NOT redo the old H11R exercise, do NOT call it an independently recoverable current hosted backup.
- Actual Supabase organization is **Free**, where automated daily backup entitlement must not be assumed. [Supabase official database backups](https://supabase.com/docs/guides/platform/backups) documents daily backups on Pro/Team/Enterprise, whereas Free operators should export with Supabase CLI and retain off-site backups. No programmatic backup listing/real recovery verification action is exposed by the connected Supabase tools in this session.
- Current logical backup + isolated restore has **NOT** been executed or independently certified. PostgreSQL `wal_level=logical` and `pg_stat_archiver` history are NOT evidence of a usable customer restore point. A disposable PG17 `pg_dump`/restore in CI tests its fixture only.
- `M0_SCOPE=UNDECIDED / LOCAL_REAL_BACKUP=DEFERRED_BY_OWNER / ACTUAL_CURRENT_RESTORE=NOT_TESTED / M1_M2_M4_NO_GO`.
- Future scoped M0 can use the **existing RPC12** `APPLICATION_WITH_EXTERNAL_AUTH_STORAGE_PLAN` or `FULL_SERVICE` path only after owner chooses, separately authorizes any real export/credential use, obtains cost quote if needed, and proves isolated restore of current application, Auth, relevant Storage/configuration. Avoid new paid branches and unnecessary local Docker requirements by default; restored Auth validity and service settings must still be demonstrated.

## Real Supabase JWT A/B admission

1. There are 3 Auth users and history for 2 session-holders, but **no signed access JWT was presented**, issuer/audience/expiry/session have not been cryptographically checked against Supabase. Server session history and `not_after` SQL records alone are not a signed JWT verification.
2. **Do not introduce a new Cloudflare account** to carry this out. These are Supabase QA identities, independent of the separate Founder Cloudflare Access QA success.
3. Reuse privately consented, already existing Auth QA users and **trusted server-side Owner→Canonical Tenant×Store bindings**, once the actual canonical Store migration and source authority are admitted.
4. On an authorized *no-send/no-write* private UAT path, a verifier must establish real Supabase Auth issuer and session context using supported methods; compare actor A and actor B separately, deny crossed Store reads even in the same Tenant, deny modified/untrusted `user_metadata` or client-supplied Store, revoked membership, expired token, unauthorized customer Order lookup and no verified channel identity.
5. Never paste real access/refresh tokens, service-role credentials, cookies or owner row IDs into GitHub, CI logs or this chat. Capture only a controlled, non-identifying PASS/DENY receipt, with independent runtime identity verification.
6. Until all required prerequisites are real and verified: `REAL_JWT_AB_ADMISSION=NO_GO`, regardless of green synthetic PG17 CI.

## New source-only QA and rollback

- `qa/v180-p0d/origin-m0-auth-staging.READ_ONLY.sql`: explicit `BEGIN TRANSACTION READ ONLY`, aggregate four-row tenant slots, Store mapping provenance, Auth session presence and RLS inventory, `ROLLBACK`. Not a migration; output is NOT a backup or Owner certificate.
- `qa/v180-p0d/origin-m0-auth-readiness.mjs`: reports baseline matches/drift with a **permanent NO-GO** output that cannot be flipped by self-reported owner/M0/JWT booleans. No external I/O. This is not a real verifier.
- Unit/static tests explicitly reject secret/row ID packets and any attempt to promote synthetic counts into M0 or signed JWT success.
- CI runs the new V18.0-P0D Node/no-host tests and inherited RPC17.8B fail-closed tests with empty hosted credentials. RPC12 private operator tests **remain on their owning separate Draft PR #244 branch and are not imported or executed in this child**, because the code does not exist on this stacked branch.
- `Rollback: close/revert Draft PR`. No real database, hosted schema, Worker, Access, credential, customer data, n8n Published, Supabase branch, billing or Auth user was modified.

**GO/NO-GO: Read-only aggregate and source-only security QA allowed. Original Store assignment, current M0 hosted backup/restore, real signed Supabase JWT A/B, M1 migration, live cross-channel commerce and production all NO-GO.**

**Separate P1:** RPC10 malformed workflow CI [Issue #397](https://github.com/ngoctien20/demo-git/issues/397) is not modified by this child PR.
