# TIEN404 AI — RPC17.8D Staging Recovery, Owner Admission & Disposable Schema GO/NO-GO

**2026-11-17 JST · OBSERVED LIVE STATUS: NO-GO · No staging DDL / no hosted changes**

## A. Current verified baseline
- Parent RPC17.8C Draft PR #366 HEAD `bf0086855ebe52fecad4cd491b811728409b68dd`, source-only CI 577/577 PASS.
- Supabase `ifxlvrhyjhbzbrkdsida`, ACTIVE_HEALTHY, PostgreSQL 17.11. Supabase dev branches: `[]`.
- Read-only Supabase catalog: `rpc178_qa` absent, public `stores` absent, public `products/orders` no `store_id`; four scoped public tables (`tenants`, `tenant_memberships`, `products`, `orders`) have RLS+FORCE RLS.
- Read-only structural fingerprint of **only those four table names and RLS flags**: `53b0943b3bf5f6f069eeeed379ff1f1ead1e4fb94b4b32faea2e7c85f6fdcc2d`. This is not a backup, comprehensive schema snapshot or restore evidence. Refresh before any future migration.
- Actual Supabase Owner SQL audited in RPC17.8C: `public.qa_owner_pairing` is authenticated, Tenant owner + synthetic dry-run guarded. `public.qa_shop_b_zalo_claim` is anon-callable behind a Vault secret header gate. Native Zalo provider signature proof and real Store authority **not** established. No function was called.
- GitHub disposable PostgreSQL17 `pg_dump` and restoration tested in RPC17.8B, **not** a staging restore.

## B. New source deliverables
1. `qa/v152-rpc178d/backup-inventory.mjs`: GET-only private operator Supabase Management API `/v1/projects/ifxlvrhyjhbzbrkdsida/database/backups`; returns only count of COMPLETED backups, newest UTC time, PITR boolean. No backup IDs, credentials, raw HTTP, customer data, uploads, SQL or restore actions emitted. All API successes still state `INVENTORY_OBSERVED_RESTORE_UNVERIFIED`.
2. `qa/v152-rpc178d/backup-inventory-cli.mjs`: opt-in local/private operator wrapper; OFF unless `RPC178D_PRIVATE_READONLY=YES`. Requires private access token with backup read scope; **never run with token in GitHub Actions/ChatGPT**. This was NOT executed with a real token.
3. `qa/v152-rpc178d/signed-admission.mjs`: offline Ed25519 signed packet verifier for owner, recovery and security attestations scoped to exact baseline fingerprint, candidate SQL SHA256, canonical UUID Tenant/Store A/B, 300-second freshness, distinct signers/keys/nonces. Trust anchors must come from an independent private registry. Even valid synthetic signatures yield **review ready only**, never migration GO.
4. Negative tests and source-only GitHub CI; inherited RPC13–RPC17.8C regression. No PostgreSQL hosted migration or real user Auth UAT.

## C. How to obtain real backup evidence safely (operator instructions)
1. Open Supabase Dashboard → project `tien404-staging` → **Database → Backups**. Record the most recent COMPLETED backup timestamp and backup type in a **private approval record**, not raw screenshots or tokens into GitHub. Do not click Restore on the active project.
2. If the plan supports Management API, grant the operator a **least-privilege backup metadata read token** in the private secret broker. Invoke the new CLI on a private trusted workstation only. The API requires `backups_read` fine-grained permission or `database:read` OAuth scope. **Never paste a token in this conversation or any PR**.
3. If no backups exist, or Free plan is used, plan an **operator-authorized Supabase CLI `db dump`** with off-site encrypted backup in private infrastructure; never store real customer data in CI, repository or current chat. An actual dump may include sensitive Auth data.
4. **Inventory ≠ restore.** Independently verify restore on a disposable **separate local or hosted isolated** PostgreSQL/Supabase-compatible environment with sanitized records and checksum/grant/RLS checks, then record a signed restore attestation with captured code SHA, timestamp and result.
5. If a separate paid Supabase branch/project is needed, **quote its exact cost and obtain explicit user consent before creating it**. Supabase branching usage can incur compute/disk/egress charges and branches are not covered by Spend Cap.
6. Do not use a destructive PITR restore or any restore to the active staging project as a QA drill. Supabase warns that restore replaces current state and causes downtime. Storage API objects are not included in database backups.

## D. Real Owner admission (not yet accepted)
- Reconcile real Store A/B canonical ownership against verified Supabase Auth subjects and server-side memberships, not `user_metadata` or QA `tenant_identity_map`.
- Existing Owner Pairing synthetic QA function tests may be reused **only** after proving native provider ingress signature, unique challenge, replay control and store-scoped auth. A private Vault gate alone does not validate a real Zalo-origin signature.
- Solo founder can authorize an exact bounded QA experiment, but actual independent **verification evidence** (fresh Auth sessions, signed ingress, restored backup) cannot be replaced by a self-declared boolean. Independent verification need not mean hiring three employees; the technical proof and trust anchors must be independently verifiable.
- Do not receive merchant credential, token, customer file or raw JWT into GitHub/ChatGPT.

## E. GO/NO-GO Decision — current NO-GO

| Gate | Evidence needed | Actual status |
| --- | --- | --- |
| B1 Backup inventory | Verified successful backup metadata for project | **BLOCKED** — connector lacks backup-list action; private operator CLI never executed with real token |
| B2 Restore | Encrypted snapshot/dump restored in isolated compatible environment, RLS and data integrity checks | **BLOCKED** — only disposable synthetic PG17 restore verified |
| O1 Real Store A/B owner | Trusted owner proof and server-sourced canonical Store authority | **BLOCKED** |
| O2 Provider ingress | Native signed provider webhook evidence, replay prevention | **BLOCKED** |
| S1 Scope and review | Signed exact candidate DDL SHA, independent trust anchors, current baseline | **PROPOSED / not signed** |
| S2 Schema isolation | `rpc178_qa` is absent; candidate DDL private, RLS+FORCE RLS and no grants tested offline | **TESTED DISPOSABLE ONLY** |
| C1 Cost | Confirm current plan and bounds for isolated recovery; authorize nonzero charges | **BLOCKED** |
| J1 Real JWT UAT | Distinct verified Auth A/B sessions, Store-level RLS negative results | **BLOCKED** |

**DECISION NOW: NO-GO for staging DDL, owner promotion, role GRANT, live JWT UAT, Cloudflare Access, native sends and paid branch.**

## F. Stop conditions and rollback
- Any missing/expired backup, unknown cost, mismatch in scoped catalog fingerprint, unsigned Store ownership, native signature gap, real data duplication or inconsistent permission/claim must STOP.
- RPC17.8D changes only source files. Closing Draft PR reverts them; **no Supabase rollback required**.
- Do not drop any actual `rpc178_qa` schema automatically; future migration/rollback requires explicit separate approval and inventory.
- Existing independent RPC10 workflow failure remains outside this change.

**Next real unblocker is operator-provided private backup inventory + restored staging-compatible evidence, not another synthetic gate.**
