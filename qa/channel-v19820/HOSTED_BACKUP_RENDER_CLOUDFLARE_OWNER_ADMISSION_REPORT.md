# TIEN404 AI — V19.8.20 Hosted Backup × Render/Cloudflare Caller Closure × Owner A/B Evidence

**As observed 2026-11-21 JST. STATUS: CANDIDATE / HOSTED NO-GO.**
Parent: Draft PR #475 (V19.8.19). All connected resource checks were **read-only**. The JSON alongside this document contains redacted observations (counts, hashes of public deploy commits, service names), not secret tokens or customer data. This branch does not contain a hosted migration.

## 1. Supabase backup inventory: what is and is not verified

Direct connection to staging `ifxlvrhyjhbzbrkdsida`: project `tien404-staging`, PG `17.11`, two Tenants, three active Tenant memberships, zero Store columns in six Commerce tables. Existing migration inventory has 21 entries, **none demonstrates a successful physical/logical backup or restore**.

The available connected Supabase tools expose project info, migrations and SQL but **do not expose GET backup inventory**. We therefore cannot inspect actual backup records or conclude there are no backups. We explicitly DID NOT attempt PITR, restore, database dump, backup creation, or pricing changes.

**Official read-only API**: `GET https://api.supabase.com/v1/projects/{ref}/database/backups` with Management API permission `backups_read` (the required scopes are documented). Supabase documentation:
- https://supabase.com/docs/reference/api/v1-list-all-backups
- https://supabase.com/docs/guides/platform/backups

A user-approved operator can run `node qa/channel-v19820/list-supabase-backups-readonly.mjs` **locally on their own computer** using a privately entered `SUPABASE_ACCESS_TOKEN`; this script is **GET-only, fixed to staging project ref, and prints sanitized counts/statuses only**, not backup IDs, signed URLs, credentials or raw API body. Token must never be committed or passed into CI. No operator execution has occurred in this checkpoint.

Windows PowerShell example (keep password/token OUT of shell history):
```powershell
$secure = Read-Host "Supabase Management API token (backups_read)" -AsSecureString
$ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try {
    $env:SUPABASE_ACCESS_TOKEN = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
    node qa/channel-v19820/list-supabase-backups-readonly.mjs
} finally {
    Remove-Item Env:SUPABASE_ACCESS_TOKEN -ErrorAction SilentlyContinue
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
}
```

**Acceptance is intentionally split:**
1. **Inventory seen:** authenticated GET succeeded, response schema recognized, number of `COMPLETED` entries and latest completion time locally observed (not proof backup can be restored).
2. **Backup usable:** operator verifies expiry/retention and scope and — **when an accessible encrypted artifact exists** — independent digest and integrity. Supabase-managed physical backups might not expose downloadable bytes/digest, so do not fabricate SHA-256. Instead preserve a restricted inventory receipt and restore evidence.
3. **Restore accepted:** an authorized and isolated recovery drill actually restores to a disposable environment; checks ownership/scope, schema, data counts or non-sensitive integrity checks, RLS, tenant/Store FKs and rollback. The source project must remain untouched.
4. **Release gate:** independent signoff, controlled retention, rollback runbook and explicit migration approval. None of these are satisfied by a dashboard screenshot alone.

Do not paste the token, backup file, customer data or full API JSON into chat, PR, Actions logs or any public artifact. Do not invoke the destructive `restore-pitr` API for inventory.

## 2. Cloudflare deployed caller inventory — materially expanded

Read-only Cloudflare API inspection counted **26** `tien404-` Worker scripts, **25** with published deployment metadata, **26** current script responses scanned for direct `supabase` / `/rpc/` / `.rpc(` signals (zero literal matches in this static sample), **25** deployed Worker version resources queried.

Among 26 Worker scripts:
- **10** have D1 bindings; **5** have Service Bindings; **11** have at least one secret-type binding (names/types only); **1** has a binding named `ZALO_SEND_ENABLED`. **The flag's value was NOT inspected; no provider send was performed.**
- Seven specific Service Binding edges were verified from their **deployed version metadata**, including private issuer → installation registry / replay ledger, QA AB gateway → same, private hosted runner → gateway, negative caller → signer, and QA caller cron → QA receipt RPC.
- Service Binding environment sometimes says `production` even when the caller script name is `...staging`. This is a target **Worker environment label**, not evidence the TIEN404 Commerce production release is enabled or safe.
- The script content fetched at `/workers/scripts/{name}` is a **current source snapshot**; comparing it to deployment metadata is not proof source bytes match a particular deployed version. Runtime dynamic URLs, environment bindings, service forwarding, cron triggers and all cross-channel capabilities require separate closure.
- Cloudflare Pages project `tien404-ai-git-staging`: **canonical production** `gh-pages` commit `ff2daf970e8209399a28b2d0cade8a33b9fa71c6`, deployment `8aace8d2-524a-4643-8add-23c1ef59cea1`; **latest preview** branch `develop` commit `00aff9b77c2312e028466fbaccd31e6ecdeb97d6`, deployment `cda52689-2202-49b4-bdb4-b0cf4f1ac954`. This differs from previous V20.1 preview; no deployment was changed.

**Cloudflare closure still PARTIAL**: need one version-locked source evidence per deployed script, route and custom domain inventory, D1/DO/Service dependency inventory and explicit allowlisted target call paths for any write-capable workers. A zero-match static scan is not a security guarantee.

## 3. Render published caller gate

Render account lists one accessible workspace `My Workspace`. Connector specifically requires **user selection of workspace**, and none has been made. No Render service listing or deployed version was read in this checkpoint.

**Do not treat a single available workspace as implicit authorization.** Ask the user to confirm `My Workspace`, then use its exact confirmed workspace ID for read-only `list_services`, service details, deployed commit/route, and environment **variable names only**. Read actual endpoint callsites from approved deployed code, not from guessed repo branch.

## 4. Real hosted Owner A/B admission

V19.8.18 obtained 56/56 with authentic **local** Supabase Auth JWT, not real hosted owner acceptance. The current hosted Supabase Commerce schema has **zero** Store columns across six tables, and connected Owner preflight Edge v2 is tenant-scoped; **same-Tenant, distinct-Store Owner A/B authorization is currently BLOCKED**.

Before any real hosted UAT:
1. Independent operator authorizes the exact staging tenant, two existing Store IDs and owner identities (private channel); do not attach emails, raw JWT or IDs to public PR.
2. Backup inventory and **isolated restore** accepted first, with full writer/RPC caller closure and rollback.
3. An approved canonical Store schema and explicit Store membership/installation consent are required; never synthesize hosted Store A/B membership from two Tenants.
4. Test owner A→A and B→B, A→B/B→A denied, tenant-only denied, revoked membership with still-valid token, inactive Store, signed trusted installation, nonce/replay, invalid JWT — **read-only**, and record only redacted pass/fail.
5. Independent security reviewer signs off. Only then consider a separate approval for migration, production sends or order writes; never infer authorization from a passing offline mock.

## 5. Open defects and rollback

- **P0/P1 blocked:** real hosted backup list and restore certificate, Render workspace consent + deployed callers, Cloudflare version-locked dynamic write paths, full n8n and SQL/Edge RPC privileged caller closure, hosted Store schema/real owners, live official Zalo attestation, merchant consent.
- Neither V19.8.19 nor V19.8.20 modifies Supabase hosted, n8n Published, deployed Cloudflare, Render, Vault or payments.
- **GitHub Draft PR only**: rollback = close PR or revert files on the new branch. No hosted state requires rollback.

**Checkpoint:** `V19.8.20_CLOUDFLARE_26_WORKERS_25_DEPLOYED_7_SERVICE_EDGES / BACKUP_GET_NOT_RUN / RENDER_WORKSPACE_PENDING / REAL_OWNER_AB_BLOCKED / HOSTED_NO_GO`.
