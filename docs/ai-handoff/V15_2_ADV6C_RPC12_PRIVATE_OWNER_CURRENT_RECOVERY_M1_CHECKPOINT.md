# TIEN404 AI — V15.2-ADV.6C-RPC.12 CHECKPOINT
## Authorized Private Four-Row Evidence Intake × Current Recovery Scope Decision × M1 Independent Approval Readiness

**JST:** 2026-11-17  
**Lifecycle:** `EXPERIMENTAL / DRAFT / NO-SEND`  
**Parent:** RPC.11 Draft PR #241, exact base `7098a7d9094468ae71c0aceba14122871ae6ff73`  
**Project:** Supabase staging `ifxlvrhyjhbzbrkdsida`  
**Policy:** Source-only local Operator readiness is permitted; real private row inspection, backup export/restore, hosted M1/M2M4/M3, privilege changes and Published edits require **separate scoped authorization**.

### 1. VERIFIED — hosted state, READ-ONLY aggregates

Live Supabase read-only query on this task confirmed:
- 2 distinct Tenants, each with one Product, one Order, >=1 active Tenant Owner;
- totals: 2 Products, 2 Orders, 0 Customers;
- `auth.users=3`; `storage.buckets=0`; `storage.objects=0`;
- `public.stores` and `public.store_memberships` absent;
- three Tenant-scoped PERMISSIVE Commerce SELECT policies remain;
- legacy `public.qa_shop_b_zalo_claim(uuid,text,text,text)` still allows `anon EXECUTE`.

This **does not prove individual Product/Order ownership by Store**. No actual row UUID or Auth identity data was read by the assistant.

### 2. H11R limited acceptance — KEEP without redundant work

The prior owner decision is preserved **verbatim as a status**:
`H11R_PARTIAL_APPLICATION_ARCHIVE_LOCAL_QA_OWNER_ACCEPTED_WITH_LIMITATIONS`.
Original operator report: local archive SHA/size match old H11R reference, 5/5 Application TABLE DATA entries, 0/3 Auth, 0/2 Storage. User attributes omitted Auth to their original pgAdmin Application Auth selection and plans to add missing coverage later. That is a **user-reported** cause, not independently verified technical root cause or evidence that current Auth data is recoverable.

The historical limited application archive is **accepted as a local application-archive check only**. It is not a signed, *current*, independently restored hosted recovery point. No old hash check, new export, live restore or pgAdmin modification was repeated in RPC.12.

### 3. CURRENT recovery scope decision (NOT automatic migration approval)

The owner has **not selected a current M1 migration recovery method** in this milestone. Canonical `UNDECIDED` remains, separate from acceptance of the old H11R file.

Two paths for a future explicit decision:
1. `APPLICATION_WITH_EXTERNAL_AUTH_STORAGE_PLAN` — a current app recovery point independently tested, plus a separately approved and tested *external* recovery plan for current 3 Auth users and relevant Storage dependencies. The old partial H11R archive alone does not provide this.
2. `FULL_SERVICE` — independently accepted current source-consistent full recovery, including Auth users, database, required Storage object bytes/settings and other production dependencies. Old H11R Auth 0/3 and Storage 0/2 cannot be the sole basis.

Official Supabase technical caveat: database backups include Storage metadata but not Storage object bytes: https://supabase.com/docs/guides/platform/backups. A project clone can include Auth database rows, but Auth configuration and Storage objects/settings need separate validation: https://supabase.com/docs/guides/platform/clone-project.

**CurrentM0Status=`BLOCKED`**, **M1Authorized=`false`** regardless of human-readable scope string or self-asserted JSON flags.

### 4. IMPLEMENTED — local source evidence intake and recovery assessment

Added:
- `qa/v152-rpc12/current-recovery-scope-decision.cjs` with **15** synthetic tests: historical H11R limited local acceptance, three current Auth users, no current Storage metadata, `UNDECIDED`/app-scoped/full-service choice, exact aggregate snapshot drift and conditional external evidence. A future *claimed* current recovery packet may be structurally reviewed without promoting old H11R. **All real M0/M1 permissions remain false**.
- `qa/v152-rpc12/private-operator-intake.cjs` with **12** tests: local, absolute private file path inputs outside Git checkout; uses exact RPC.11 four-row source-snapshot reconciliation, V14.4.3 Owner ledger and separate RPC.11 M1 approval packet. Prints only non-identifying counts and blocker codes; rejects malformed or symlink inputs and unexpected flags without printing filenames/UUIDs. Cannot authenticate primary sources, signer identities, actual hosted recovery or real M1.
- `docs/ai-handoff/V15_2_ADV6C_RPC12_PRIVATE_OPERATOR_RECOVERY_SCOPE_M1_RUNBOOK.md`: detailed private operator assignment and consent, source four-row evidence, owner/reviewer distinct authority, current recovery choices, practical Windows command, per-phase approval and rollback.
- `.github/workflows/v152-adv6c-rpc12-operator-intake-nosend.yml`: offline security regression and intentionally RED real hosted migration eligibility.

**Safe local operator command** (only after explicit private-data-read authorization and preparation of secure input files, not run by ChatGPT):

```powershell
$repo = "$env:USERPROFILE\Downloads\TIEN404_RPC12_PRIVATE"
$private = Join-Path $env:LOCALAPPDATA 'TIEN404\private-evidence\rpc12'
node "$repo\qa\v152-rpc12\private-operator-intake.cjs" --recovery "$private\recovery.json" --snapshot "$private\snapshot.json" --ledger "$private\owner-ledger.json" --phase "$private\m1-approval.json"
```

If no independent source documents/Owner review exist, **do not invent JSON**, and do not run an empty pseudo-acceptance; optionally use a local recovery-only packet explicitly marked `UNDECIDED` to verify the CLI FAILS CLOSED. Never place raw private evidence in GitHub, a web chat, or CI.

### 5. TESTED — exact verified CI commit

**Tested source SHA:** `953d22a2ad097fce88de9e51ff63ce12eb7da99e`  
**CI run:** https://github.com/ngoctien20/demo-git/actions/runs/43911073400

- New RPC.12 current recovery scope: **15/15 PASS**.
- New RPC.12 operator CLI/abuse tests: **12/12 PASS**.
- Inherited RPC.11 **42**, RPC.10 **15**, RPC.9 **14**, RPC.7 **42**, RPC.6 **24**, V14.4.3 **36**, ADV6C **6**, RPC.5 **18** = **197/197 PASS**.
- **224/224 Node tests PASS**, plus local-only/no-hosted static checks PASS.
- Hosted M0/M1 authorization job must remain intentionally **FAIL / exit 3** due lack of independent original source/backup restore/signed approvals. Overall run RED = release-policy denial, **not** source regression.
- **No Windows operator execution with real private inputs** was performed or claimed. RPC.10 PostgreSQL17 disposable M3 tests are inherited as documented prior evidence, not rerun.

### 6. Open blockers and next approval decision

**BLOCKED**
- `REAL_FOUR_ROW_OWNER`: no independently inspected original source linking four specific hosted Product/Order rows to canonical Store IDs. Tenant Owner != Store Owner.
- `CURRENT_M0_RECOVERY`: no current independently verified recoverable point and isolated restore. Three current Auth users absent from old H11R coverage.
- `SCOPED_M1_APPROVAL`: no original authorized Controller, Independent Security Reviewer and DB Operator signatures or approved recovery window.
- `CALLER_AND_REAL_JWT`: no complete hosted privileged caller inventory or same-Tenant real Owner A/B JWT proof.

**NO-GO:** all hosted DDL/RLS/GRANT/REVOKE, data backfill, M1/M2M4/M3, RPC revoke, n8n Published update, Zalo/Messenger real send, actual customer data access, new paid resources.

**PROPOSED next operator decision:** nominate the private evidence Operator and *different* independent reviewer; explicitly approve limited read-only inspection of the four actual Product/Order metadata rows if desired, then choose a current migration recovery scope based on feasible independently tested backups/restore. This Draft does **not** assign or assume either approval.

**Rollback:** close Draft child PR; no hosted database rollback because no live mutation was performed.

**Canonical state:** `RPC12_PRIVATE_OPERATOR_INTAKE_SOURCE_TESTED_M0_M1_HOSTED_NO_GO`.
