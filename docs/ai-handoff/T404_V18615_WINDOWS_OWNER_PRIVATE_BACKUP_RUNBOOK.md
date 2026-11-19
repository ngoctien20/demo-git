# TIEN404 AI — V18.6.15 | Owner-only Windows Supabase Free export preflight

**Classification:** `CANDIDATE / OWNER OPERATED / NO REMOTE CHANGES BY CHATGPT`. **Connected staging:** `tien404-staging` project ref `ifxlvrhyjhbzbrkdsida`, organization plan **Free** (live verified on 2026-11-19). **Status B-00: BLOCKED** until private backup and isolated restore are independently verified.

## Why this exists

The V18.6.14 disposable PostgreSQL 17 custom dump-and-restore tests passed on synthetic Store A/B data. Those tests do not create a backup of Supabase. This V18.6.15 kit is a guarded, owner-run *logical SQL export* procedure for a Windows operator, using Supabase CLI **linked mode** so the database URL/password is not placed on a process command line. The script will not run any export in its default preflight mode.

## Critical caveat: not a whole Supabase disaster-recovery image

The current Supabase CLI `db dump` excludes Supabase-managed schemas such as `auth` and `storage` (see the official [CLI reference](https://supabase.com/docs/reference/cli/supabase-db-dump)), and Storage **object bytes** are not in a SQL dump. A full recovery plan must separately account for Auth users, storage files, provider credentials, Edge Functions, Vault keys/encrypted values, configuration, extensions, and migration histories. Never describe roles/schema/data SQL as complete restoration proof. Even if the export and SHA256 checks pass, B-00 remains BLOCKED without independently approved isolated restore.

## On the owner's personal Windows computer — NO steps were run by ChatGPT

1. Prepare Node.js 22+, Docker Desktop, and the official Supabase CLI. Use the official [CLI setup guide](https://supabase.com/docs/guides/local-development/cli/getting-started) and [linked project workflow](https://supabase.com/docs/guides/local-development/cli-workflows). Install a trusted Supabase CLI executable, confirm `supabase --version` and `docker version` manually. Never send access tokens/database passwords to this chat, GitHub, CI logs or connected agents.
2. In a **separate local CLI project folder** on the owner machine, perform `supabase init`, `supabase login` and `supabase link --project-ref ifxlvrhyjhbzbrkdsida` **interactively**. The CLI may ask for the database password. Never paste password or `postgresql://` connection string into a command saved in Git history. Do not run `db pull`, `db push`, `db reset`, `migration up`, or `restore_project` as backup steps. Confirm the CLI created `supabase/.temp/project-ref` matching the exact staging ID.
3. Create a **new empty folder on an encrypted, locally controlled drive**, e.g. `C:\TIEN404_PRIVATE_BACKUPS\2026-11-19`, outside any Git checkout, OneDrive, Dropbox, Google Drive, browser Downloads folder, or sync/share folder. Confirm the drive is encrypted (BitLocker or equivalent) and the folder's filesystem permissions are limited. This tool **does not verify encryption**. Do not use an auto-synced folder.
4. Download only the source-only owner kit from the reviewed **Draft PR #447** or the ZIP provided in this conversation. In a local PowerShell terminal, from the owner kit folder:

```powershell
# Preflight-only: no database network or backup export.
node .\qa\store-authority-v18615\owner-linked-export.cjs --project-root "C:\TIEN404_LINKED_CLI" --output-dir "C:\TIEN404_PRIVATE_BACKUPS\2026-11-19"

# ONLY AFTER OWNER EXPLICITLY APPROVES A PRIVATE B-00 EXPORT:
# This uses 'supabase db dump --linked' and asks for typed approval.
node .\qa\store-authority-v18615\owner-linked-export.cjs --project-root "C:\TIEN404_LINKED_CLI" --output-dir "C:\TIEN404_PRIVATE_BACKUPS\2026-11-19" --execute
```

5. If the user explicitly runs the second command: only 3 **logical exports** are attempted into the empty folder: `roles.sql --role-only`, `schema.sql`, and `data.sql --use-copy --data-only` (using the documented Storage vector table exclusions). The script never invokes SQL writes, migration, restore, Supabase Auth, n8n, Render or Cloudflare. It checks file presence, size and SHA256 and saves an **owner-private** `backup-manifest.json`. This metadata file excludes connection strings/tokens. *All `.sql` files can contain private customer data and secrets; keep them encrypted and never upload them to GitHub or a chat.* A completed SQL export **is not** a successful restoration or a complete backup of all Supabase components.
6. If any command fails, treat output as **partial and untrusted**. Do not share CLI stderr or output logs here if they might contain secrets. Empty the failed export folder securely and start with a new empty encrypted folder after reviewing the cause locally.
7. **Separately owner-approve** a restore rehearsal into a *different local/self-hosted isolated environment*, never a live Supabase project. Validate schema, roles, grants, RLS, FKs, indexes, data counts/hash, Auth/Storage/Vault gaps, and RPO/RTO; obtain a second reviewer. This kit deliberately **does not execute restore**. A private export or validated file hash does NOT satisfy Gate B-00 on its own.

## What to report back safely

Only share non-secret progress such as: `PREFLIGHT_ONLY_PASS`, `PRIVATE_EXPORT_CREATED_NOT_RESTORED`, `RESTORE_NOT_TESTED`, file **counts** and sizes if desired (not names if they contain business identifiers), and whether the backup drive is encrypted. Never share the `.sql` data, passwords, tokens, full connection strings, file paths that reveal identities, or customer records.

## Controls / security QA

- Fixed Supabase project reference; refuses other linked-project IDs.
- Refuses exporting inside any project path, protected developer folder, cloud sync folder or non-empty destination.
- Refuses executing under `CI`/`GITHUB_ACTIONS`, or with secret-bearing environment variables accidentally exported.
- Requires `--execute`, interactive terminal and exact typed confirmation; otherwise **preflight-only**.
- Exports by linked Supabase CLI, with no `--db-url` parameter, and discards tool stdout/stderr to avoid leaking secrets into chat/CI.
- Exports metadata only in the output manifest, not the contents of the private backups.
- **Not verified on the owner's Windows host**. Node local tests validate control flow but do not constitute Windows runtime or live backup proof.
- Rollback of this source-only kit: close/revert Draft PR; since nothing has run on Supabase, no live rollback is needed.

## Approval gates still open

`B-00`: actual protected backup/export **NOT DONE**, checksum on actual export **NOT VERIFIED**, independent restore **NOT DONE**. `D-02`: SKU namespace **RECOMMENDED STORE_LOCAL, NOT APPROVED**. `ROLE-01`: separate Tenant/Store Owner **RECOMMENDED, NOT APPROVED**. `STORE_RLS`: live 0/6 store IDs; real same-Tenant A/B UAT **BLOCKED**. `PRODUCTION`: **NO_GO**.

**References:** [Supabase CLI db dump reference](https://supabase.com/docs/reference/cli/supabase-db-dump), [link CLI reference](https://supabase.com/docs/reference/cli/supabase-link), [Supabase CLI backup/restore guide](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore), [V18.6.14 synthetic restore](https://github.com/ngoctien20/demo-git/pull/447).
