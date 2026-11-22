# TIEN404 AI — V21.9 Meta OAuth Evidence × Owner JWT Acceptance × Config Core Migration Provenance

**Checkpoint:** 2026-11-23 (Asia/Tokyo). **Branch:** `work/v21-ai-social-reactions-qa-20261122` · Draft PR #493.
**Decision:** **NO-GO** for reaction migration staging, Meta auto-reaction and Page policy publish. NO hosted writes.

## 1. VERIFIED — Config Core deployment provenance FOUND

Previously V21.8 had found five Config Core tables on staging but no matching records in `supabase_migrations.schema_migrations`. This checkpoint reconciles the **deployment origin** from historic GitHub Actions; it does **NOT** insert/update migration ledger records.

- **Config Core step 10:** owner-approved workflow `.github/workflows/tien404-config-core-hosted.yml` on branch `claude/project-thread-xv1r63`, [run #44996262167](https://github.com/ngoctien20/demo-git/actions/runs/44996262167), **2026-11-22 07:00–07:04 UTC SUCCESS**. Restore-test guard, apply, 21-case hosted UAT, rollback fingerprint and reapply PASS. Staging job confirmed `NOT_APPLIED=true`, created encrypted pre-apply backup, executed `psql -f db/config-core/10_config_core.sql` with `T404_CC_CONFIG_CORE_OK`, recorded `APPLIED=1`, hosted UAT **21/21** and no UAT rows left.
- **Config Core step 20 — public channel menu read:** owner-approved workflow `.github/workflows/tien404-config-core-20-hosted.yml`, [run #44998110645](https://github.com/ngoctien20/demo-git/actions/runs/44998110645), **2026-11-22 07:24–07:28 UTC SUCCESS**. Restore-test apply/rollback/reapply and 9-case hosted UAT passed. Staging confirmed `NOT_APPLIED=true`, backup created, `psql -f db/config-core/20_channel_menu_read.sql` emitted `T404_CC20_CHANNEL_MENU_READ_OK`, UAT **9/9**, DEMO Messenger Page bound and anon menu read PASS, no Meta change.
- Backup artifact for pre-Config Core staging `tien404-staging-pre-config-core-2026-11-22T0704Z`: **51,757 bytes**, expires 2027-02-20, not expired at audit.
- Backup artifact for pre-CC20 staging `tien404-staging-pre-cc20-2026-11-22T0727Z`: **59,358 bytes**, expires 2027-02-20, not expired.
- Direct `psql` application explains why these workflows did not add entries to the Supabase CLI migration ledger. Do **not** pretend the tables are still uninstalled or replay them. Also do not automatically repair the ledger.

**Precisely what is reconciled:** deployment provenance and source compatibility are VERIFIED. A future structured migration tracking/backfill remains **PROPOSED / APPROVAL REQUIRED**, not implemented. Supabase `migration repair` modifies tracking, not the actual schema, and may be affected by CLI v3 defaults. Independent review is mandatory before touching remote history.

## 2. VERIFIED — Source-to-hosted schema parity

A new reproducible **SELECT-only** query `qa/reactions/v219-config-core-source-parity.sql` is pinned to the source SQL `db/config-core/10_config_core.sql` (blob `dea34da9c9324813fcf057428ea009c6ece3ada2`) and `20_channel_menu_read.sql`.

Ran it directly against Supabase staging ref `ifxlvrhyjhbzbrkdsida` (PostgreSQL 17.11), result marker `T404_V219_SOURCE_PARITY_READONLY`:

| Check | Result |
|---|---|
| Expected Config Core table columns (type/nullability) | **45/45 MATCH** |
| Exact PostgreSQL `pg_proc.prosrc` source body MD5 and execution privileges | **11/11 MATCH** (10 core + 1 channel-menu RPC) |
| Named constraints/indexes/trigger | **12/12 PRESENT** (9 constraints + 2 indexes + 1 trigger) |
| Named SELECT policies | **5/5 PRESENT** |
| Forced RLS and anon/authenticated table grants on 5 Config Core tables | **5/5 PASS** |
| Column/function/grant/index/policy/RLS findings | **0** discrepancies within audited inventory |
| Tracked migrations | **25** total, 0 named Config Core, 4 named V20 |

All results are based on source tables, PostgreSQL catalog metadata and hashes; no customer records/credentials/IDs were returned and no SQL writes were sent. This check is more robust than a mere table-exists test, but **does not prove every unnamed database object, execution route, or full Meta authority safety**. Policy existence and names were checked, not a byte-for-byte proof of each RLS policy expression. Do not treat parity as permission to deploy.

Offline regression `qa/reactions/v219-config-core-source-parity.test.mjs` pins the golden audit columns and SQL function hashes to the repository source. The Social Reactions CI runs these tests; source changes must update fingerprints deliberately before being accepted.

## 3. Meta OAuth — BLOCKED REAL ATTESTATION

- Browser tab read access in this turn was unavailable: connector returned `Browser access requires the originating browser context`. Meta Business Suite inbox in prior V21.8 showed Page inbox access but **not** the Meta Developers OAuth installation / app-permission state.
- No Page access token, app secret or two real JWT sessions were supplied to the tools. No live `/debug_token`, `/me/accounts`, or `/{page-id}/subscribed_apps` authenticated GET was executed. Browser inbox access is not sufficient.
- Existing `meta-page-graph-evidence.mjs`, HMAC verification and nonce/claim ledger (V21.7 75/75 disposable PG17 PASS) are simulated admission logic only. The trusted Meta OAuth server-side issuer and real installation ownership remain BLOCKED.
- Refer to official Meta `/subscribed_apps` and Messenger Page permissions for the next owner-authorized, read-only UAT. No Page subscriptions or Meta grants were changed.

## 4. Owner A/B JWT — BLOCKED REAL AUTH

- V21.6 performed hosted RLS role simulation under `BEGIN READ ONLY`, not real signed Auth JWT.
- Existing opt-in GET-only runner `qa/reactions/owner-auth-jwt-readonly-uat.mjs` is tested offline with mocked responses. A real owner A/B negative UAT requires two independent authorized Supabase Auth sessions; neither was accessible in this turn.
- No credentials requested, created, logged or posted; hosted membership/tenant data unchanged. NEVER call SQL role simulation a real Auth JWT attestation.

## 5. Release / backup checkpoint

- Prior backups (pre-Config Core and pre-CC20) and restore-test migration workflows are evidenced and GitHub artifacts retained; **no fresh reaction pre-migration backup or restoration of that exact encrypted file** was conducted.
- No authorization to create paid Supabase branch/restore, alter migrations history, issue privileged Meta proof, apply SQL 10/20/30/40 reaction candidate, merge PR, or enable Messenger reaction sender.
- Existing V23 aggregate has a distinct built-asset `app/` synchronization gate; do not disable or publish Owner preview as a workaround.

**Status classification:** VERIFIED = Config Core provenance + parity; IMPLEMENTED = read-only golden audit and offline regression; TESTED = staging SELECT-only + CI; PROPOSED = future migration ledger reconciliation; BLOCKED = live Meta OAuth/Owner JWT and fresh same-file restore; RELEASED = none.

## 6. Recovery / next phase

PR [#493](https://github.com/ngoctien20/demo-git/pull/493) stays Draft. V21.9 adds read-only SQL, offline tests/CI and this document; rollback is a Git revert of these additions, no hosted or Meta rollback needed.

**V21.10 next:** owner-authorized Meta Developers Test App read-only proof, two independent real owner JWT read-only checks, new backup+same-file isolated restore proposal with cost approval, and explicit staging reaction schema security review. Keep `sendAllowed=false`, published policies absent, and Shadow Gate ALL OFF.
