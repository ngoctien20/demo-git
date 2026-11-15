# TIEN404 AI — V14.5Z-LIVE03E
## Provider Bot ID Attestation × n8n Trial Continuity Gate
Checkpoint: 2026-11-16 JST
Stage: READ-ONLY VERIFIED / SOURCE-ONLY IMPLEMENTED / OFFLINE TESTED
Release: REAL ZALO SEND NO-GO
Repository: ngoctien20/demo-git
Branch: work/v145z-live01-limited-uat-gate
PR: https://github.com/ngoctien20/demo-git/pull/103 (DRAFT, NOT MERGED)

### 1. Approved scope
Proceed with safe provider Bot identity attestation architecture and n8n trial continuity gate. No Zalo sends, existing secret readout, credential change, production deployment, webhook change, commerce customer writes, payment, top-up, subscription or restoration of production data.

### 2. Hosted facts verified (READ ONLY)
- Connected n8n Cloud Console Gateway page shows $0.59 remaining of $2.00 free credit, updated Nov 16, 2026 02:35 local UI, about $0.18/day recent usage, 7-day total displayed $1.20; 7 days remaining in n8n trial banner. Based on a rounded 7-days-remaining banner seen Nov 16, **estimated** trial end is around Nov 23, 2026, NOT authoritative expiry.
- n8n documentation states free trials allow Gateway credits, but cannot top up until upgrading to paid; exact account Auto top-up setting not visible and remains UNKNOWN. Instance's n8n trial continuity is a separate risk from the Gateway credit balance.
- Official n8n help updated Oct 27, 2026 states a standard 14-day trial, 3-day grace period before instance stop, another 5 days before instance deletion, possible export access to workflow backups for up to 90 days. These timelines describe vendor policy and MUST NOT be used as an extension of operational uptime. Export immediately; do not defer until the grace period.
- The n8n Cloud account page shows 129/1000 executions at the captured time. Read-only n8n MCP search returned **98 workflows**, of which **19 Active**, not 19 total.
- Checked all **19 active workflow metadata** via n8n connector. Exactly **4** Draft versions differ from Published versions:
  - Manage Order fDB9dvs1qPPVt9Sp, Draft 2e8786fd-e5c5-410f-9d6c-655653c32278, Published 137d5689-40c5-4147-9bbc-b22809ad5908.
  - Revenue Report U2DJsxzSYPH5hRop, Draft e4e16b90-1c66-48b9-a9e0-9d8fb6dbc6df, Published 978b5a8d-d47b-4783-b27e-96fbc96d5262.
  - Update Order BkAi6TVUKAjCnI7v, Draft 3bd7043f-78e7-4a1c-93e5-2bc9d60ac767, Published 93cf227a-ab8a-42c6-9185-7ec44f7aeb00.
  - Create Order KrSn4DNR9ALX5ng4, Draft af9ee686-2a9f-483e-9622-6e449500ac5e, Published 4740251a-cd01-4f7f-b8e1-e300a8393151.
- **Existing Cloudflare Zalo outbound Worker remains ZALO_SEND_ENABLED=false.** LIVE03C no-send budget Worker binds only isolated QA D1. D1 LIVE03C has 7 QA_STOPPED, none armed. Old LIVE01 D1 has 7 QA_ARMED but ALL EXPIRED according to database time and no unexpired active grants; no legacy QA rows were modified in LIVE03E.
- Active Zalo ingress yIJk8LvJoLF40Z62 version 8ca4a6f6-ab3f-42f1-8637-d4f5db790a3e and private router sIPs6egzIwOY1GNv version 8d91d23c-cd87-462f-a112-9cca2340bec8 remain unchanged. Existing hardcoded synthetic Shop B binding remains.
- Existing Cloudflare provider read-only /v1/bot-check calls Zalo getMe using existing protected Bot Token but **returns only bot_token_valid**, intentionally omitting provider `result.id`. Official provider getMe documented response has `result.id` string and account_name. Existing Bot registry contains 2 synthetic_qa/dry_run fixtures and Owner allowlist alone is not proof of ownership; no real Bot→Shop B→Owner QA certification is achievable from available evidence.

### 3. Implemented GitHub-only files
- `qa/zalo-live-v145z/live03e-readonly-provider-id-attestation.cjs`: provider getMe result.id MUST come from trusted server-owned runtime. It produces nonce-bound HMAC digests of Bot, tenant, store using a separate 32-byte-or-greater secret, does not expose raw IDs, and always returns `can_send:false`, `can_promote_registry:false`, `bot_shop_owner_verified:false`. It does NOT fetch providers itself. NOT DEPLOYED. The required attestation HMAC secret has NOT been provisioned and is NOT the provider Bot Token.
- `qa/zalo-live-v145z/live03e-readonly-provider-id-attestation.test.cjs`: 23/23 synthetic offline PASS, including invalid transport, missing getMe result.id, bad account name, bad key, error redaction, nonce disjointness and user-supplied verification ignored.
- `qa/zalo-live-v145z/live03e-trial-continuity-gate.cjs`: fail-closed source-only gate for owner Cloud Console Export, 98/19 manifest, published version reconciliation, private storage, credential/table migration plan, independent restore QA, decision on trial continuity and separate approval of any paid subscription. NEVER purchases or enables sends.
- `qa/zalo-live-v145z/live03e-trial-continuity-gate.test.cjs`: 28/28 offline PASS (25 original tests plus 3 validating actual manifest and version mismatch evidence).
- `qa/zalo-live-v145z/live03e-n8n-workflow-inventory.json`: metadata-only list of 98 workflows including 19 Active: ID, workflow name, active and last update. **NOT a backup**.
- `qa/zalo-live-v145z/live03e-active-version-differences.json`: 4 active Draft≠Published version IDs, used in backup reconciliation. Does not include secrets, node code or workflow contents.
- `qa/zalo-live-v145z/live03e_verify_n8n_export.py`: local-only JSON/ZIP/directory checker for owner-exported definitions; reads files without network, without ZIP extraction, with safe size/file count limits, and reports only counts/status (never code/credentials). Does NOT verify credential availability, data tables, restores, or exact live runtime unless version fields are present.
- `qa/zalo-live-v145z/live03e_verify_n8n_export.test.py`: 11/11 synthetic PASS across JSON/ZIP/folder, missing active workflows, duplicates, status conflict, version mismatch, oversized ZIP and missing file.
- CI GitHub Actions [43744679433](https://github.com/ngoctien20/demo-git/actions/runs/43744679433) **296/296 PASS**: inherited 234 + 23+28+11 LIVE03E. First run 43744596079 had a test-file syntax error (missing parenthesis) and was fixed in commit 454503248b4432fa3f10eec2798401740c453912; subsequent run SUCCESS. No workflow/live environment deployment in LIVE03E.

### 4. Backup continuity: owner action STILL REQUIRED
Because connected Browser is read-only and n8n connector does not expose a supported full-account export operation, an owner-generated n8n backup ZIP/JSON was **NOT downloaded or verified** in this session. Do not misrepresent this as a backup.

From authenticated Cloud Console go to **Export** at https://app.n8n.cloud/manage/export, choose the latest available backup date, click **Download workflows**. Official docs:
- https://support.n8n.io/article/how-to-export-workflows-from-the-n-8-n-cloud-admin-panel
- https://support.n8n.io/article/migrating-from-cloud-to-self-hosted
Do not publish raw export to a public repo: workflow JSON can contain endpoint URLs, expressions, embedded static values and credential references. Save encrypted locally. This export may capture an older backup snapshot, not the current Published workflow graph. Use editor's individual Download for specific last-minute changes as necessary, but compare with metadata, especially 4 Draft≠Published workflows.

Local validation (from a clone of this Draft branch; no internet required for the script):
```bash
python3 qa/zalo-live-v145z/live03e_verify_n8n_export.py "/private/path/to/n8n-export.zip"
```
Result `definition_coverage: PASS` only if expected metadata IDs are covered; the report remains `ready_for_production:false` until secrets and data tables are migrated separately and restore QA is performed on isolated staging. Do not upload the raw JSON/ZIP to a public GitHub branch.

### 5. Trial continuity options, not approved for purchase
- **Keep n8n Cloud:** official pricing Starter **€20/month when billed annually** (effective annual commitment €240 before tax) with 2,500 executions/month and 5 concurrent executions, currently shown publicly. Pro **€50/month when billed annually**; only consider if tested Starter limitations require it. Actual checkout/region taxes and monthly billing not yet confirmed. No payment done or authorized.
- **Request trial extension:** official n8n help says one courtesy extension may be requested before instance is deleted. Contact official support using the instance owner account; this is an option, not a guaranteed extension. No message sent in this phase.
- **Self-host later:** not an immediate drop-in backup for TIEN404; according to official n8n docs, Gateway Credits are not available on self-hosted Community edition, so an own provider API key and fresh credential/security approvals would be needed. Live webhooks/queue, storage, restore, access management and rollback must be tested.
- If **no paid plan or approved migration is ready before the trial ends**, stop any actual commerce launch plans and preserve workflow JSON promptly. Do not presume trial services operate through the grace or backup-retention window.

### 6. Security and rollback
No real provider Bot ID or owner ID was extracted, no token/HMAC key provisioned, no new Cloudflare Worker, D1 row, n8n workflow, webhook setting, billing, Gateway usage or production deployment was made. Source-only GitHub Draft commits can be reverted without impacting Published workflows.

### 7. Final release gates
- **VERIFIED:** account trial banner (approximate days), Gateway balance UI, 98 workflows/19 active, 4 Draft≠Published, old Worker kill switch off.
- **IMPLEMENTED:** safe HMAC digest adapter, private backup verification and trial continuity gates on GitHub.
- **TESTED:** 296/296 offline tests; zero provider/LLM sends.
- **BLOCKED:** actual user-downloaded backup file, independent restoration, authenticated real Bot ID/Owner pair, live shared n8n credit guard, account Auto top-up switch, approved USD cap, and final owner approval.
- **REAL ZALO SEND: NO-GO**.
