# CBOT-UAT-08 — Windows M0 Existing-Archive Operator Quickstart (REAL SOURCE, OFFLINE)
Checkpoint: 2026-11-16 JST. Child of UAT07 PR #227 HEAD `1c467dac3cf5a2079f377702a7771933b4e62949`.

**This is the first directly runnable operator launcher in the CBOT-UAT line that invokes the EXISTING pinned RPC.7 actual read-only archive inspection script, rather than creating another self-declared recovery receipt.** It must run on a trusted local Windows machine with the EXISTING archive; the CI synthetic file is not the actual backup.

## 0. Protection and prerequisites
- Do not upload the archive, hashed receipt, private paths, Auth users, Page IDs, secrets, PSIDs or customer records into ChatGPT, GitHub, Google Drive or CI.
- Uses existing verified RPC.7 local source from [PR #198](https://github.com/ngoctien20/demo-git/pull/198) HEAD `4f7bef71f54ee17b88449026b90803ccf9743e30`. All three files `Inspect-TIEN404-RPC7-M0.ps1`, `local-archive-coverage-cli.cjs`, `local-m0-archive-receipt-cli.cjs` must be present in that separate trusted checkout. The wrapper refuses a different HEAD instead of silently using unreviewed scripts.
- Requires Git, Node.js and PostgreSQL `pg_restore` command-line utility installed on the LOCAL computer. Docker is NOT required if `pg_restore` is installed. No n8n network connectivity or Supabase access is required.
- This launcher's `Preflight` does not read the archive at all. `InspectExistingArchive` hashes the existing file and reads `pg_restore --list`; it does not `pg_dump` or `pg_restore -d`.
- A successful local file inventory still outputs `M0_ACCEPTED=false`. A separate independent off-host actual restore with Auth, roles/ACL, Storage/object bytes, normal login verification and Reviewer/Controller sign-off is required.

## 1. Prepare independently pinned checkouts (source only; NO backup inspection)

Use the corrected [PR #339 exact tested launcher](https://github.com/ngoctien20/demo-git/pull/339) at commit `de28444ab78e1ff418d84bc2297ddd4db58a6597`, **NOT the older broken PR #230 launcher**. The separate RPC7 inspector must be pinned at `4f7bef71f54ee17b88449026b90803ccf9743e30`.

Run this once in Windows PowerShell on a trusted private computer. It creates a NEW dedicated folder and refuses to overwrite an existing one. It downloads source code only; **it does not open, hash, export, delete, restore or transmit the existing backup**, and needs no Supabase credentials.

```powershell
$base = Join-Path $env:USERPROFILE 'TIEN404-M0-PREFLIGHT-20261117'
if (Test-Path -LiteralPath $base) { throw 'PREFLIGHT_FOLDER_EXISTS_REVIEW_BEFORE_REUSE' }
New-Item -ItemType Directory -Path $base | Out-Null
$cache = Join-Path $base 'repo-cache'
$rpc7 = Join-Path $base 'rpc7-pinned'
$reviewed = Join-Path $base 'launcher-339-pinned'
git clone --no-checkout https://github.com/ngoctien20/demo-git.git $cache
if ($LASTEXITCODE -ne 0) { throw 'GIT_CLONE_FAILED' }
git -C $cache worktree add --detach $rpc7 4f7bef71f54ee17b88449026b90803ccf9743e30
if ($LASTEXITCODE -ne 0) { throw 'RPC7_PINNED_WORKTREE_FAILED' }
git -C $cache worktree add --detach $reviewed de28444ab78e1ff418d84bc2297ddd4db58a6597
if ($LASTEXITCODE -ne 0) { throw 'LAUNCHER_339_PINNED_WORKTREE_FAILED' }
if ((git -C $rpc7 rev-parse HEAD).Trim() -cne '4f7bef71f54ee17b88449026b90803ccf9743e30') { throw 'RPC7_SHA_MISMATCH' }
if ((git -C $reviewed rev-parse HEAD).Trim() -cne 'de28444ab78e1ff418d84bc2297ddd4db58a6597') { throw 'LAUNCHER_SHA_MISMATCH' }
if (@(git -C $rpc7 status --porcelain --untracked-files=all).Count -ne 0) { throw 'RPC7_SOURCE_DIRTY' }
if (@(git -C $reviewed status --porcelain --untracked-files=all).Count -ne 0) { throw 'LAUNCHER_SOURCE_DIRTY' }
'PINNED_SOURCE_CHECKOUTS_READY'
```

Keep both directories separate. Do not put the existing archive in a Git checkout, disable Windows security, run `git reset --hard`, enter a real JWT or run `pg_dump`. If this exact folder already exists, inspect it before any reuse; do not delete private evidence to clear an error.

## 2. Safe Windows Preflight (DOES NOT READ BACKUP)

The launcher is used directly from the **verified, detached PR #339 checkout**, avoiding the stale PR #230 copy.

```powershell
$launcher = Join-Path $reviewed 'qa\cbot-uat08\Invoke-TIEN404-M0-ReadOnly.ps1'
Get-Command git, node -ErrorAction Stop | Select-Object Name, Source
Get-Command pg_restore -ErrorAction Stop | Select-Object Name, Source
& $launcher -Mode Preflight -Rpc7Checkout $rpc7
```

If `pg_restore` is missing or not on PATH, STOP; no data has been touched. Install a trusted PostgreSQL client if needed, then rerun the launcher with `-PgRestoreExe` pointing to its genuine `pg_restore.exe`. Docker is not required; never substitute CI's fake `pg_restore.cmd` for a real local operator tool.

Expected **sanitized** status after a successful local run:

```text
CBOT08_RESULT=LOCAL_TOOLS_READY
CBOT08_RPC7_COMMIT_PINNED=true
CBOT08_ARCHIVE_INSPECTED=false
CBOT08_M0_ACCEPTED=false
CBOT08_HOSTED_MIGRATION_AUTHORIZED=false
```

Only these `CBOT08_*` status lines can be reviewed remotely. No backup file, local paths, raw receipt JSON, account name, full digest, JWT, passwords or customer data may be pasted into ChatGPT/GitHub/CI. If the launcher responds `BLOCKED`, use only its safe `CBOT08_REASON` code; never bypass the deny gate.

## 3. Inspect the EXISTING backup, not another export — approval required later

**STOP GATE:** this section is NOT part of the safe Preflight. Do not execute it unless the private Backup Operator and Security Reviewer separately approve actual existing-archive inspection. Neither local source verification nor fake CI certifies M0.

```powershell
& $launcher -Mode InspectExistingArchive -Rpc7Checkout $rpc7
```

The script prompts for the existing private archive path locally, without placing it into a GitHub Action or service. If the original independently held previous SHA-256 and byte count are known, supply `-ExpectedArchiveSha256` / `-ExpectedArchiveBytes` privately; if unavailable, hash/size comparison remains unknown, not presumed passed.

A successful read-only inspection emits only a status such as:
```
CBOT08_RESULT=LOCAL_ARCHIVE_INSPECTED_NOT_CERTIFIED
CBOT08_classification=PARTIAL_APP_ARCHIVE_NOT_FULL_SERVICE_RECOVERY
CBOT08_localEvidenceStatus=LOCAL_ARCHIVE_TOC_REVIEW_ONLY
CBOT08_applicationEntries=5
CBOT08_authEntries=0
CBOT08_storageEntries=0
CBOT08_receiptSavedLocally=true
CBOT08_PRIVATE_RESTORE_WITNESSED=false
CBOT08_M0_ACCEPTED=false
CBOT08_HOSTED_MIGRATION_AUTHORIZED=false
```
These are **illustrative status values**, NOT claims about the existing archive. The private receipt is written only to `%LOCALAPPDATA%\TIEN404\private-evidence` by the original RPC.7 script. The wrapper deliberately does not print its path or SHA. Archive missing, corrupted, stored inside public git checkout or checker commit mismatch => BLOCKED.

## 4. Operator privacy and acceptance handoff
- **Share only the non-sensitive `CBOT08_...` terminal status lines**, if necessary. Do not share private archive, local receipt JSON, full digest, protected role identity or any Auth/Store records.
- Controller and independent Backup Operator / Security Reviewer inspect actual local evidence via approved encrypted private custody. Even a complete `pg_restore --list` TOC does not establish that real Auth users can re-login, that roles/ACL/RLS were restored, that Storage bytes exist or that a remote restore can pass.
- A complete, separately APPROVED, independent encrypted off-host recovery must be witnessed and documented before M0 may become ACCEPTED. Any new compute/branch/project or expenses must have separately approved account-specific cost and recovery scope. Reuse quote-only PR #225; do not create a billable branch automatically.
- The standing P1/P2/O1/O2 rows remain `QA_LIKELY_NOT_VERIFIED_SYNTHETIC` under [V17.03B PR #310](https://github.com/ngoctien20/demo-git/pull/310); do not request sensitive Merchant originals just to classify these staging rows without primary-source provenance. Two Tenant Owners do not prove two Stores. Genuine Store ownership still needs independent verified authority and an approved Store RLS gate.
- Native Meta Page `subscribed_apps`, App Roles, `pages_messaging` grant/Full Control and Zalo OA/App OAuth must also be verified separately; new observed app-level webhook subscription does not establish Page owner or customer Store-level authorization.

## 5. Independent CI and rollback
The CI job checks out the **real pinned** RPC.7 code, launches this PowerShell wrapper in `Preflight`, rejects a wrong checkout, exercises the original inspector using a synthetic TOC and safe CI file, rejects a corrupted file using local `pg_restore`, and runs source regression UAT01–07. It does **NOT** touch hosted data. Claim CI VERIFIED only with final exact-head run status.
Rollback: close child Draft PR, no hosted or local private archive is modified. An operator may retain its private receipt for independent review; do not delete the original backup to roll back code.
