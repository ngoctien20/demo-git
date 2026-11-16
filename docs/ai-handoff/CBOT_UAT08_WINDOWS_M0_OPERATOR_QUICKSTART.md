# CBOT-UAT-08 — Windows M0 Existing-Archive Operator Quickstart (REAL SOURCE, OFFLINE)
Checkpoint: 2026-11-16 JST. Child of UAT07 PR #227 HEAD `1c467dac3cf5a2079f377702a7771933b4e62949`.

**This is the first directly runnable operator launcher in the CBOT-UAT line that invokes the EXISTING pinned RPC.7 actual read-only archive inspection script, rather than creating another self-declared recovery receipt.** It must run on a trusted local Windows machine with the EXISTING archive; the CI synthetic file is not the actual backup.

## 0. Protection and prerequisites
- Do not upload the archive, hashed receipt, private paths, Auth users, Page IDs, secrets, PSIDs or customer records into ChatGPT, GitHub, Google Drive or CI.
- Uses existing verified RPC.7 local source from [PR #198](https://github.com/ngoctien20/demo-git/pull/198) HEAD `4f7bef71f54ee17b88449026b90803ccf9743e30`. All three files `Inspect-TIEN404-RPC7-M0.ps1`, `local-archive-coverage-cli.cjs`, `local-m0-archive-receipt-cli.cjs` must be present in that separate trusted checkout. The wrapper refuses a different HEAD instead of silently using unreviewed scripts.
- Requires Git, Node.js and PostgreSQL `pg_restore` command-line utility installed on the LOCAL computer. Docker is NOT required if `pg_restore` is installed. No n8n network connectivity or Supabase access is required.
- This launcher's `Preflight` does not read the archive at all. `InspectExistingArchive` hashes the existing file and reads `pg_restore --list`; it does not `pg_dump` or `pg_restore -d`.
- A successful local file inventory still outputs `M0_ACCEPTED=false`. A separate independent off-host actual restore with Auth, roles/ACL, Storage/object bytes, normal login verification and Reviewer/Controller sign-off is required.

## 1. Obtain the reviewed source in a separate Windows checkout
PowerShell in your private operator machine (do not use a shared or compromised machine):

```powershell
$rpc7 = Join-Path $env:USERPROFILE 'Downloads\TIEN404-RPC7-PINNED'
git clone https://github.com/ngoctien20/demo-git.git $rpc7
git -C $rpc7 checkout --detach 4f7bef71f54ee17b88449026b90803ccf9743e30
git -C $rpc7 rev-parse HEAD
```

The printed HEAD must equal `4f7bef71f54ee17b88449026b90803ccf9743e30`. If already downloaded the repo and no user edits are pending, reuse a SEPARATE clean worktree rather than overwriting a working checkout.

## 2. Run the launcher from the UAT08 child Draft PR (do not merge it)
Open or download `qa/cbot-uat08/Invoke-TIEN404-M0-ReadOnly.ps1` from the CBOT-UAT08 Draft PR. On PowerShell 7+ or Windows PowerShell, from the directory containing this launcher:

```powershell
$launcher = '.\Invoke-TIEN404-M0-ReadOnly.ps1'
& $launcher -Mode Preflight -Rpc7Checkout $rpc7
```

Expected redacted terminal output:
```
CBOT08_RESULT=LOCAL_TOOLS_READY
CBOT08_RPC7_COMMIT_PINNED=true
CBOT08_ARCHIVE_INSPECTED=false
CBOT08_M0_ACCEPTED=false
CBOT08_HOSTED_MIGRATION_AUTHORIZED=false
```
If `PG_RESTORE_OR_NODE...` or local-tools missing is reported, fix the LOCAL executable path first; do NOT switch to hosted database credentials or improvise an export.

## 3. Inspect the EXISTING backup, not another export
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
- After M0, independent Merchant Owner claim adjudication must assign the two existing Products and two existing Orders to actual Store ownership privately. The second Tenant Owner in one Tenant is not proof of multiple Stores.
- Native Meta Page `subscribed_apps`, App Roles, `pages_messaging` grant/Full Control and Zalo OA/App OAuth must also be verified separately; new observed app-level webhook subscription does not establish Page owner or customer Store-level authorization.

## 5. Independent CI and rollback
The CI job checks out the **real pinned** RPC.7 code, launches this PowerShell wrapper in `Preflight`, rejects a wrong checkout, exercises the original inspector using a synthetic TOC and safe CI file, rejects a corrupted file using local `pg_restore`, and runs source regression UAT01–07. It does **NOT** touch hosted data. Claim CI VERIFIED only with final exact-head run status.
Rollback: close child Draft PR, no hosted or local private archive is modified. An operator may retain its private receipt for independent review; do not delete the original backup to roll back code.
