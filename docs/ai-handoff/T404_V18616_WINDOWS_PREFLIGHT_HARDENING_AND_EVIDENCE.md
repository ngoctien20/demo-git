# TIEN404 AI — V18.6.16 | Windows backup preflight hardening and QA acceptance

**Status:** SOURCE-ONLY CANDIDATE / NO DATA EXPORT / NO MIGRATION / PRODUCTION NO-GO.  
**Inherited from:** Draft PR #447 V18.6.15, Supabase Free staging project `ifxlvrhyjhbzbrkdsida`.  
**Safety:** This patch hardens the *operator kit*, does not certify the operator's computer, backup, or recovery.

## Problems found in the V18.6.15 source

1. **Windows not tested:** The prior 26 green Node tests ran in a Linux runner; they did not prove Windows path semantics, console behavior or local preflight compatibility.
2. **Backup folder could be another Git checkout:** Existing check blocked output under the linked CLI project and literal `.git` path components but missed a different repository root containing a `.git` directory or a worktree with a `.git` file.
3. **Unbounded memory in SHA256:** `fs.readFileSync(file)` reads an entire data.sql into RAM, which is hazardous for GB-scale exports.
4. **Path aliases and common sync folders:** Windows path comparisons can be case-insensitive; OneDrive organization folders (for example `OneDrive - Org`) and Downloads deserve explicit blocking. A symlink/junction selected as output is refused to reduce redirection risk.

## Implemented (source only)

- Case-insensitive Windows containment via normalized `path.win32`, including proper separator and sibling comparison.
- Canonical output path inspection; refuse symlink/junction output, volume root, synced/system folders including OneDrive - organization and Downloads, and **any ancestor** with a `.git` directory or worktree `.git` file. This is *not* proof of encryption or absence of all third-party sync tools.
- SHA256 reads files in chunks of at most **1 MiB**, not `readFileSync`, retaining local-only checksum manifest and rejecting empty/missing/non-regular dumps.
- Existing owner-only `--execute` + linked staging ref + interactive typed approval + CI refusal are preserved. The default remains preflight-only with **no remote call**. The script never runs restore, schema changes, `db push`, `db reset`, provider sends or payments.
- New Windows-only CI smoke script creates an inert local `supabase/.temp/project-ref` fixture, calls `preflight` with synthetic env, verifies no SQL created, and asserts **both** the normal entrypoint and `--execute` are rejected under actual GitHub Actions environment. **No Supabase CLI login/link, credential, network, backup or restore** occurs in CI.

## QA evidence gate

- Linux Node unit tests: baseline **26**, new **6**, expected **32/32 PASS**.
- Dedicated `windows-latest` job: execute the same 32 offline unit tests and Windows-specific entrypoint smoke; require `WINDOWS_OFFLINE_PREFLIGHT_PASS` in stdout.
- Existing disposable PG17 full backup/restore and 11 anonymous GET Render staging checks remain separate jobs. Do not treat these as a Windows backup of Supabase.
- Do not claim TESTED/VERIFIED until actual GitHub Actions results and logs are checked for both Push and PR workflows.

## Remaining owner-only requirements (unchanged)

1. Owner verifies their own Windows machine, Node/Supabase CLI/Docker, encryption and separate private destination. Never send passwords, access tokens, full DB URLs, ZIP containing live backups or SQL files into the conversation or GitHub.
2. Owner runs the **preflight-only** command from the reviewed source. A `PREFLIGHT_ONLY_PASS` is validation of local paths/link marker only. It does **not** prove backup or restore.
3. Actual export requires a **separate explicit owner approval**; the operator must opt into `--execute` and confirm interactively. A successful manifest hash is not successful restore. Private isolated restore requires a separate approved rehearsal and review.
4. Backup coverage: Supabase CLI db dump is logical/filtered; managed Auth, Storage (object bytes), Vault/Edge Functions/credentials may require independent recovery plans. Gate B-00 is BLOCKED until real backup/restore verified. D-02 SKU and ROLE-01 Store Owner decisions still pending.
5. A review of CLI version and project link is still necessary locally; marker files alone cannot cryptographically prove an authenticated remote project. Do not bypass the owner confirmation or take shortcuts to Production.

**Rollback:** revert V18.6.16 source/CI changes in Draft PR #447; no live service rollback needed.  
**Checkpoint:** `V18.6.16 | WINDOWS_OFFLINE_CI_PENDING | PRIVATE_EXPORT_NOT_DONE | RESTORE_NOT_DONE | D02_ROLE01_PENDING | PRODUCTION_NO_GO`.
