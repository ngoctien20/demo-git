# CBOT-UAT-07 — Real M0 Restore Witness × Merchant Store Claim Adjudication × Native Channel Authorization Review

Checkpoint: 16 November 2026 JST | Parent: CBOT-UAT06 PR #220 HEAD 95c8dc66f266b6bdc2dc542ed07dd9931658aac4.
Purpose: **obtain independent primary proof** while preserving existing published bot/customer data. This is NOT M0 acceptance, NOT live cross-channel Commerce, and NOT a release signature.
Existing sibling work must be reused, not duplicated: RPC.7 PR #198 (Windows existing archive inspector); H11R.11 PR #205 (private attestation); H11R.10 PR #200 and V16.10 #212 (ephemeral PG17 Store tests); Meta Canary-03B PR #224 (separate Page-only one-recipient risk gates), V16.11P PR #222 (separate private operator approval work).

## 1. New ground-truth native Meta and n8n correlation
Read-only connected browser on Meta for Developers, app "TIEN404 AI Messenger", use-case Messenger API Settings.
- The configured webhook callback URI path is **/webhook/tien404-messenger-qa** (no secret value exposed).
- App-level webhook subscription **messages** is visibly CHECKED/SUBSCRIBED, version **v27.0**.
- App-level webhook subscription **messaging_postbacks** is visibly CHECKED/SUBSCRIBED, version **v27.0**.
- Meta verify token input is masked. No raw secret, App/Page ID, PSID or provider access token is copied into public evidence.
- Direct n8n published workflow `Z7FdV7uDvApfbURQ` ACTIVE, 27 nodes, exact version `d5c96b6b-d790-4270-8b0f-d0ebdd8bbd92`. It has TWO Webhook nodes with matching path `tien404-messenger-qa` (GET verification and POST delivery routes). Meta callback path parity: **OBSERVED**.
- Previous LIVE01 #4176 independently established HMAC=true, accepted Meta Send MID and user confirmed a reply. This **proves one signed inbound and send receipt**, NOT Page Administrator rights or merchant Store data authority.
- **Not yet verified** in the available browser tab: exact Page subscribed_app(s), App role/permission `pages_messaging` APPROVED, native Page messaging task/Full Control, App Review for external customer messaging, isolated single-recipient QA consent. Do not publish/send a new canary or edit native subscriptions.
- Native Zalo OA administrator/App binding OAuth scope/signed callback are still not accessible and NOT VERIFIED. Zalo Bot staging != Zalo OA.

## 2. Real M0 private existing-archive witness — recommended exact owner actions

**Controller (separate from Reviewer):** confirm precise project staging ref, scope and evidence custody. No full export or charged hosted recovery unless individually authorized. Use existing backup; do not re-export merely to generate a green artifact.

**Backup Operator (private Windows, not GitHub CI):** use read-only `Inspect-TIEN404-RPC7-M0.ps1` from separate PR #198, pinned HEAD `4f7bef71f54ee17b88449026b90803ccf9743e30`, in that branch checkout. Example in a private PowerShell session:
```powershell
$archive = Read-Host "Existing private archive path"
$pgRestore = Read-Host "pg_restore.exe location"
& .\qa\v152-rpc7\Inspect-TIEN404-RPC7-M0.ps1 `
  -ArchivePath $archive `
  -RecoveryScope APPLICATION_WITH_EXTERNAL_AUTH_STORAGE_PLAN `
  -PgRestoreExe $pgRestore
```
Only `pg_restore --list`, SHA256 and byte comparisons are performed, with private receipt written to the operator's local AppData private-evidence directory. The archive is not uploaded or emailed. Reported `m0Approved=false` is expected and correct.

**Independent Security Reviewer:** authenticate actual Controller, Backup Operator and their identities outside ChatGPT; inspect private original archive SHA/manifest, dated source snapshot and custody. Distinguish a partial application TOC from complete Postgres app + Auth users/accounts + roles/ACL/RLS/extensions + Storage byte objects + external assets and encryption key recovery. A local TOC listing is not a restore. For a separately approved distinct isolated host recovery drill, check normal user re-login and row totals with cross-tenant isolation; do NOT assume preexisting 5 sessions remain valid or must be copied. Record retention, RPO/RTO, rollback, independent attestation and restore validation privately.

**STOP:** Without actual witnessed off-host restore, legal authorization and independent reviewer, M0 stays NOT ACCEPTED. No real host backup/export/restore has been initiated by CBOT-UAT-07.

## 3. Four-row merchant Store claims: never auto-backfill
Real hosted metadata: exactly 2 Products and 2 Orders. Two Tenant Owner memberships under Tenant ordinal slot #1 are **not** evidence that Store A/B both exist under that Tenant.
For each actual Product/Order, authorized Merchant Owner and independent reviewer must privately:
- Identify actual merchant legal/controller relationship, independent evidence of Tenant and Store ownership, correct source document and current channel configuration.
- Independently reconcile all 4 hosted rows to real Store identities; include related OrderItems if present and customer/order FK implications, SKU/price and VND totals preservation.
- Mark each row `CONTESTED` if two owners assert different Store, data absent, document stale, or wrong-Tenant Store. The default is `MISSING`, not Owner A/B.
- Privately retain raw UUID/order/customer details; publish only opaque evidence references and unresolved counts.
- Reuse #200 compatibility tests and #205 private evidence signer only after separately authorized M0. No Store id guessed, no hosted UPDATE/DDL under this PR.

## 4. Native authority: read only, separate Meta and Zalo proofs
Meta administrator views Business Settings Page permissions and real App roles, app messaging permissions and App/Page binding/subscribed apps separately. The new **App-level messages/postbacks SUBSCRIBED** observation is real but does not demonstrate Page-level authorization. No native setting changed or Page token copied.
Zalo OA administrator separately inspects OA→Developer App OAuth binding, scope, status and webhook signed sender. Zalo Bot labs cannot be treated as OA.
Trusted customer cross-channel identity must use a customer-controlled single-use challenge tied to the same Store and approved lifecycle; order code/phone cannot authenticate cross-channel access.

## 5. Decision and handoff
Evidence snapshot `qa/cbot-uat07/native-meta-webhook-parity-observation.json` contains only bounded direct-read observations; `source-evidence-adjudicator.mjs` is a **local classifier, not an authority service**.
- VERIFIED: App-level Meta subscription two fields, callback parity to existing active n8n workflow; prior signed LIVE01.
- PENDING/BLOCKED: real offhost M0, four real Store row owner cases, real two-Store JWT/RLS, native Page-level permission, native Zalo OA, full RPC caller migration, cross-channel real user link, hosted Commerce Order READ.
- For actual operator decisions, references remain in private encrypted custody and are accepted/rejected by independently authenticated people. Do not put backup paths, SHA manifest, tokens, Page/PSID/OA IDs, actual Order UUID or private reviewer identity into public repo/chat.
- No statement/metadata/report can automatically authorize `SUPABASE_GRANT/REVOKE`, migration, paid branch, live provider send, credential update, n8n Published patch, production merge.

## 6. QA evidence / rollback
CI source tests and inherited regression, no new PostgreSQL hosted tests. Check exact PR HEAD GitHub Actions result before TESTED. New branch is source-only; close its Draft PR to roll back proposal. No hosted or n8n change to revert.
