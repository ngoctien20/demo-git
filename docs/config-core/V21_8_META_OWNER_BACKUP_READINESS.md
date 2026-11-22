# V21.8 — Meta Test App Read-Only Attestation × Owner A/B Auth UAT × Backup/Restore Readiness

**Checkpoint:** 2026-11-22 JST · Draft PR #493 · branch work/v21-ai-social-reactions-qa-20261122.
**Decision:** **NO-GO** for staged reaction migrations, real Page proof writes, policy publication, and live Meta reactions. No credentials, Meta subscriptions, hosted schema or Messenger Published changed.

## 1. VERIFIED — Supabase staging SELECT-only evidence

Database: tien404-staging, project ref ifxlvrhyjhbzbrkdsida, PostgreSQL 17.11.

Ran the committed SELECT-only file qa/reactions/v218-hosted-readonly-attestation.sql directly via Supabase connector; it reads catalog objects, RLS grants, aggregate counts, migration tracking and a hash. No customer rows, user IDs, tokens, Page IDs or PSIDs were selected. Marker: T404_V218_READONLY_HOSTED_PREFLIGHT.

| Preflight gate | Observed |
|---|---|
| Supabase tracked migrations | **25** |
| Tracked V20 store migrations | **4** |
| Tracked Config Core migration names | **0** |
| Tracked reaction migrations | **0** |
| Store/tenant memberships, assistants, channel connections, config versions | **ALL PRESENT** |
| Messenger channel registry | **1 active DEMO connection** |
| Forced RLS / authenticated SELECT / tenant-store member SELECT policy | **TRUE** |
| anon denied SELECT; authenticated direct INSERT/UPDATE denied | **TRUE** |
| Reaction app allowlist, Page proof, nonce ledger, draft table | **ALL ABSENT** |
| Reaction owner Page list and save draft RPCs | **BOTH ABSENT** |
| Config Core catalog column fingerprint MD5 (not a credential) | 048a5ae3be9df36cc7fb66919f1cf047 |

**Interpretation:** Config Core schema exists hosted, but is not represented by a corresponding tracked migration name. This is migration provenance drift, not proof that the current schema is unsafe. Reconcile exact object definitions and original deployment before any new hosted DDL. Do NOT blindly replay the Config Core baseline.

## 2. VERIFIED — Encrypted backups and hosted restore-test history

No backup was downloaded, decrypted, restored or modified in V21.8.

- **V23 staging backup:** GitHub Actions #44966529697 SUCCESS (2026-11-22 00:25 UTC): role/schema/data Supabase dumps, tar+GPG AES-256 encryption, generated SHA-256 file and tested decryption+tar listing. Artifact tien404-staging-pre-v23web-2026-11-22T0027Z exists, 48,368 bytes, expiry 2027-02-20, not expired.
- **V20 staging backup:** GitHub Actions #44907960104 SUCCESS (2026-11-21); artifact tien404-staging-pre-v20-2026-11-21T1317Z, 49,147 bytes, expiry 2027-02-19.
- **V20 restore-test hosted UAT:** #44923540012 SUCCESS with isolated project tien404-restore-test and synthetic GoTrue JWT UAT plus rollback. This is useful testing precedent, NOT restoration proof for the V23 encrypted artifact.
- **V23 restore-test hosted UAT:** #44966129996 SUCCESS applying V23 10→20→30 and rolling back UAT on a separately guarded restore-test project. No import of the V23 staging backup artifact was established.
- **V23 staging migration and UAT:** #44966529697 SUCCESS; UAT_TOTAL=51 FAILED=0, UAT_WRITES_ROLLED_BACK=1, provider sends=0. This refers to V23 only.

**Restore readiness verdict:** backup creation, encryption, upload and decryption/list verification VERIFIED. An **actual restore of the exact encrypted backup file into a disposable database with readback/role/schema checksum** is NOT TESTED. The earlier snapshot is also not a fresh backup for reaction migration. Such an operation and new project/compute cost require owner approval.

GitHub source:
- https://github.com/ngoctien20/demo-git/actions/runs/44966529697
- https://github.com/ngoctien20/demo-git/actions/runs/44907960104
- https://github.com/ngoctien20/demo-git/actions/runs/44923540012
- https://github.com/ngoctien20/demo-git/actions/runs/44966129996

## 3. BLOCKED — Meta Test App OAuth evidence

Connected browser currently shows **Meta Business Suite inbox** and Facebook, but no usable Meta Developers app configuration tab. Inbox access is not Meta App OAuth installation proof.

NOT OBSERVED: app mode, scopes and review status; /debug_token verification; /me/accounts Page MESSAGING task; the selected app's entry in Page subscribed_apps; verified owner/store/Page installation consent. No authenticated Meta Graph GET, permission changes, token access, or send occurred.

V21.7 Meta GET assessor and signed-receipt tests are **synthetic security harnesses**, not live Meta evidence. No trusted OAuth issuer or private Page-proof writer exists hosted. Verdict BLOCKED.

Official Meta references:
- https://developers.facebook.com/docs/graph-api/webhooks/getting-started/webhooks-for-pages/
- https://developers.facebook.com/docs/graph-api/reference/page/subscribed_apps/

## 4. BLOCKED — Two real Owner Auth JWTs

Earlier V21.6 verified database RLS via BEGIN READ ONLY and SET LOCAL ROLE authenticated with claim simulation (Owner A sees 1 channel, B sees none, unknown sees none, anon SELECT denied). **Those are NOT real signed Auth JWT sessions.**

The existing explicit opt-in, GET-only harness qa/reactions/owner-auth-jwt-readonly-uat.mjs requires two independent real Owner sessions, does not print JWTs or private IDs, and forbids service-role keys. Such sessions have not been made available for this acceptance. Do not request secrets in chat or create/delete hosted test users without approval. Status BLOCKED.

## 5. IMPLEMENTED + TESTED — V21.8 readiness worksheet

- New committed SELECT-only preflight: qa/reactions/v218-hosted-readonly-attestation.sql. Executed against staging; report marker and counts verified.
- Pure QA-only classifier: qa/reactions/v218-staging-readiness.mjs. It reports blocked gates for schema migration provenance, real Meta OAuth, two real JWT sessions, matching encrypted backup digest AND confirmed isolated restore of the same artifact, recent schema fingerprint, and explicit staging owner approval.
- Regression tests: qa/reactions/v218-staging-readiness.test.mjs, **16 tests** including wrong project, stale/mismatched backup, missing restore, missing Meta/Owner UAT, approval missing and no sensitive output.
- Social Reactions CI #45033766238 **SUCCESS**: **119/119 Node unit tests PASS** including new 16, both isolated PostgreSQL 17 jobs SUCCESS. The V21.7 page/nonce SQL candidate itself was not changed here.
- Even when a synthetic worksheet reports every gate green, its result is REVIEW_REQUIRED, with canApplyHostedMigration=false and canSendMetaReaction=false. The worksheet is **NOT a security authorization system**. It never performs I/O.
- Existing Owner Preview and Config Core QA remain separate. V23 aggregate still enforces compiled app asset synchronization and should not be bypassed.

## 6. Release gates

| Gate | Status |
|---|---|
| Hosted Config Core and Store RLS read-only health | VERIFIED |
| V21.4-17 disposable PG17 Page/nonce QA | TESTED |
| Previous encrypted staging backup creation | VERIFIED |
| Fresh reaction pre-migration backup + same-artifact restore | BLOCKED |
| Migration provenance / hosted baseline reconciliation | BLOCKED |
| Real Meta Test App OAuth and subscribed Page authority | BLOCKED |
| Two independent real Owner A/B signed JWT sessions | BLOCKED |
| Privileged issuer, owner consent, publish and provider send | OFF / NO-GO |
| Owner approval for new staging migration | NOT RECEIVED |

## 7. Rollback / next

PR https://github.com/ngoctien20/demo-git/pull/493 remains **DRAFT**. Only source QA/test/doc/CI changed in V21.8; revert these files and one CI test line if rollback required. No Supabase hosted, Meta or Messenger rollback needed.

Follow-on approvals: (1) open a real Meta Developers Test App in an owner-authorized browser session, read its permission/app-review/Page installation state; (2) owner-assisted A/B Auth JWT read-only UAT without sharing credentials; (3) reconcile migration history; (4) approve a fresh encrypted backup and isolated same-file restore; (5) independently approve staging DDL. Keep reaction sender/publisher disabled until separately authorized.
