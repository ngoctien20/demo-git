# TIEN404 AI — V15 Sales Lite P0-J
## Native Meta Page / Zalo OA Ownership Evidence × Private PRE-M1 Backup Operator Handoff

**Ngày:** 16/11/2026 (JST)  
**Parent:** P0-I Draft PR #191, HEAD `f05d43f68199f99bffa73f4c901e478a03e2b40f`  
**Scope:** Operator instructions, metadata-only host audit, code QA, LOCAL FILE READ-ONLY inspection. **No provider API requests, new consents, credential use, hosted backup export, restore, migration, workflow Published or customer sends.**

### 1. Status from independently read evidence

- Supabase project `tien404-staging`, ref `ifxlvrhyjhbzbrkdsida`, active, PostgreSQL 17.11, Free.
- Direct SQL baseline from P0-I: 2 Tenants, 3 active Tenant Memberships, 2 Products, 2 Orders, 0 Customers, 0 hosted real private provider mappings; 0 canonical Store tables, 0 Store-scoped policies, 7 legacy permissive Tenant SELECT policies. Four business rows must receive privately verified Store ownership or remain quarantined before M2 backfill.
- Messenger Published `Z7FdV7uDvApfbURQ`, successful webhook executions #3865–3868, includes Meta signature check and DEMO Sheets/order tools. These are NOT Meta Page admin/app subscription/merchant consent evidence.
- Zalo V1 `yIJk8LvJoLF40Z62` calls V2 shadow `OgDZNSAvKEvhnAvn`. V2 contains a public QA pairing RPC caller; retained recent successful inspected runs were manual, NOT native OAuth admin proof.
- From the earlier H11R recovery work, a local archive was checked for presence, checksum and pg_restore TOC, but no independently verified **complete** restore (including Auth identity and Storage object bytes). Do not re-label this as full-project recovery.
- **NO-GO** for hosted Store schema, live Commerce quote, provider send or real Orders.

### 2. Native Meta Page verification — read-only owner procedure

**Who:** Authorized Meta Business/Page administrator, independently reviewed in a private session. Do not share Page tokens, system-user tokens, app secret or full Page IDs in chat, GitHub, n8n execution logs or screenshots.

1. Open your own **Meta Business Suite / Business settings** and locate the exact business portfolio and **Page** asset. Inspect **Page access / People with Facebook access / Business asset access** as applicable. Establish the person has the necessary admin or messaging task for the Page; a public Page name/URL is insufficient.
2. Open **Meta for Developers → My Apps → the TIEN404 app → Messenger / Webhooks**. Verify the Page assigned to the app, Page-level subscription of the **messages** field, and whether the app is correctly configured for the Page.
3. Check if public users are in scope: Meta's Messenger app requires the appropriate `pages_messaging` permissions/App Review status. A developer/tester-only access condition is NOT a real merchant pilot release.
4. If an approved authorized operator performs additional independent inspection, use only **read** `GET /{page-id}/subscribed_apps` for the exact Page, under native Meta authentication *privately*. Do not POST to subscribe, exchange or rotate tokens, modify Page or send a test message under P0-J.
5. Preserve in a **private encrypted vault**: read-only native console screenshots (identity and Page ID masked where shared), verification date/time, verified asset role and App assignment, subscription state, app permissions/review status, scoped merchant consent to associate that Page to a **specific proposed Store**, consent expiration/revocation path, and independent reviewer signoff.
6. Public checkpoint contains only **`META_PAGE_OWNER_NATIVE_VERIFIED` / `PENDING` / `FAIL`** and a non-sensitive opaque private evidence ticket, **not** Page IDs or signer PII. Self-declared PASS is not independently verified.

Official references:
- https://developers.facebook.com/docs/graph-api/webhooks/getting-started/webhooks-for-pages
- https://developers.facebook.com/docs/graph-api/reference/page/subscribed_apps
- https://developers.facebook.com/docs/messenger-platform/getting-started/quick-start

### 3. Native Zalo OA verification — separate from Zalo Bot

**Who:** Native Zalo OA administrator and independent reviewer. **Zalo OA** app OAuth and **Zalo Bot** require *distinct* ownership/provider contracts; never infer one from the other or from the QA claim RPC.

1. In the real **Zalo Official Account manager** verify the **OA administrator** account, exact OA and merchant business relationship. Preserve native-portal scope and timestamp *privately*.
2. In **Zalo for Developers**, inspect official application/OA linkage and **OAuth v4** scopes. The native OA admin authorizes the exact app; an OAuth callback or provider-issued authorization grant is not to be pasted in chat. Do not initiate a new OAuth authorization, reissue access token or add app permissions in P0-J.
3. Verify webhook configuration and that the applicable OA event type supports the documented `X-ZEvent-Signature` scheme. The implementation must verify the **actual provider event** and match native OA/app; the existing shared Vault header in QA is **not** equivalent to Zalo provider signature verification.
4. If the channel is **Zalo Bot**, record the exact Bot platform/provider contract separately, rather than claiming Zalo OA webhook rules apply to Bot.
5. Preserve privately: OA admin role, App/OA association, webhook authenticity, merchant consent to bind exact OA to proposed Store, limitations, expiration, revocation, independent reviewer. Public report only status and opaque ticket; no OA ID, token, OAuth code, refresh token or secrets.

Official references:
- https://stc-developers.zdn.vn/docs/v2/official-account/bat-dau/xac-thuc-va-uy-quyen-cho-ung-dung-new
- https://stc-developers.zdn.vn/docs/v2/official-account/webhook/tin-nhan/su-kien-nguoi-dung-gui-tin-nhan
- https://docs.zaloplatforms.com/docs/OA

### 4. Private Backup Operator — precise PRE-M1 handoff without executing export

**Important correction — Supabase CLI v3 breaking change dated 2026-11-04:** `db dump` defaults to LOCAL unless explicitly selecting hosted using the verified CLI-version-specific option. `--remote` is required by v3 for hosted; **never** copy v2 examples unreviewed, and never invoke any `--remote` action from this PR. Do not assume the currently installed CLI version.

On the operator's own trusted **Windows PC / PowerShell** (outside public CI and ChatGPT), read-only inspection commands only:
```powershell
supabase --version
supabase db dump --help
pg_restore --version
node .\qa\v15-sales-lite-p0j\operator-offline-preflight.cjs
# Optional, only after an operator ALREADY possesses a local private archive:
node .\qa\v15-sales-lite-p0j\operator-offline-preflight.cjs --archive "C:\PRIVATE\existing.backup"
```
The script:
- Does **NOT** call the hosted database, `supabase db dump`, `pg_dump`, `pg_restore -d`, `psql` or any network or credential operation.
- Reads locally only the supplied archive's file size and SHA256 and invokes `pg_restore -l` to check **TABLE OF CONTENTS** of a supported archive format. It never performs a restore, prints local file paths/raw TOC/record values or writes a report to GitHub.
- Marks `actual_restore_verified=false`, `can_export=false`, `can_restore_hosted=false`, `can_apply_migration=false` **always**, even if hash and TOC are valid.
- If CLI or pg_restore not installed, mark tools unavailable; this is not a reason to expose private credentials or install billable infrastructure.
- **A passing archive TOC does not prove the backup contains Auth user data, database roles, current Supabase managed objects or Storage object bytes.** Supabase default CLI dump may exclude Auth/Storage schemas and data; verify commands against the installed CLI version only under later, explicit operation approval.

Before any new real hosted export, the private operator/reviewer must validate:
- Whole-project data Controller jurisdiction and informed privacy/legal basis covering all Tenants; one technical Supabase Owner screenshot is supporting evidence, not merchant consent for all businesses.
- Distinct independent reviewer OR separately **explicitly** accepted staging-only compensating-control exception, not an AI self-signature.
- Operator least-privilege authority, external encrypted vault and recovery key custody, retention/secure deletion, exact target project and 0 USD incremental cost ceiling.
- Precise backup scope/coverage: schema + data + roles + Auth, product/order data, relevant managed schemas and Storage **object bytes** as separate workstreams, external n8n/Cloudflare config separately; independently reviewed excluded components.
- Project-bound, expiring **single-use approval**, durable private atomic claim and audit; separate authorization for restore.
- **PRE-M1 backup decision is separate from POST-M1 Store JWT/RLS.** [PR #192](https://github.com/ngoctien20/demo-git/pull/192) already resolves this dependency by proposing a narrowly scoped PRE-M1 recovery gate. Do not make PRE-M1 logically depend on non-existent post-M1 Store policies, nor silently downgrade required Owner/Operator/Vault/independent review.

No backup/export/restore operation is authorized by this document or by the earlier "5/5 prepared" checklist. The user must explicitly approve the **specific, scoped hosted export** in a future change after independent private verification. This P0-J script may read an already-created local archive but cannot prove a hosted export.

Official references:
- https://supabase.com/changelog?types=breaking-change
- https://supabase.com/docs/guides/local-development/cli/migrating-to-v3
- https://supabase.com/docs/guides/platform/backups
- https://supabase.com/docs/reference/cli/supabase-db-dump

### 5. Private handoff receipt — template, NOT a signed attestation

Store the filled record ONLY inside encrypted private owner/operator vault, NOT GitHub/ChatGPT:
```text
Record ref: SEC-<private non-PII random reference>
Target: tien404-staging / ifxlvrhyjhbzbrkdsida
Operation: PRE-M1 recovery preparation (NO REMOTE EXPORT)
Verified Meta Page admin and app subscription: PENDING / VERIFIED / FAILED
Verified native Zalo OA admin / OAuth app: PENDING / VERIFIED / FAILED
Verified distinct Zalo Bot provider identity, when used: PENDING / VERIFIED / FAILED
Merchant/Tenant/Store legal/consent proof: PENDING / VERIFIED / FAILED
Legacy Products 2 / Orders 2 exact Store attribution: PENDING / VERIFIED / FAILED
Full-project Controller proof: PENDING / VERIFIED / FAILED
Independent reviewer or approved exception: PENDING / VERIFIED / FAILED
Backup Operator and least privilege: PENDING / VERIFIED / FAILED
Encrypted private vault and key custody: PENDING / VERIFIED / FAILED
CLI version and local tool health: PENDING / VERIFIED / FAILED
Existing local archive SHA/TOC-only: PENDING / STRUCTURE_ONLY / FAILED
Auth + roles + data + Storage physical files coverage: PENDING / VERIFIED / FAILED
Independent complete restore: NOT DONE / PRIVATE VERIFIED
One-time remote export approval: NOT GRANTED (separate decision)
Live provider send, hosted Store migration, Order writes: NOT GRANTED
```
Screenshots must be redacted before even sharing them with an AI. Local archive SHA is only a fingerprint, not authority or proof of a real hosted restore. **Do not share private evidence ledger contents, passwords, tokens, private vault URLs, signing keys, personal identifiers or backup bytes in PR comments.**

### 6. Real release decision & existing work reused

| Gate | Currently verified? | Result |
| --- | --- | --- |
| Supabase Owner UI role | UI shows one Owner | Technical admin role only |
| Meta native Page/admin & app assignment | **No** | BLOCKED |
| Zalo native OA admin / OAuth app linkage | **No** | BLOCKED |
| Private Merchant–Tenant–Store consent | **No** | BLOCKED |
| Four legacy business rows attributed to Store | **No** | BLOCKED |
| Encrypted hosted backup and independent full restore | **No** | BLOCKED |
| Specific PRE-M1 recovery approval | **No** | BLOCKED |
| Canonical Store schema, hosted JWT/RLS Shop A/B | **Absent** | NO-GO |
| Provider send, real Order/Outbox | **Not approved** | NO-GO |

Reuse [P0-I #191](https://github.com/ngoctien20/demo-git/pull/191), [PRE-M1 recovery #192](https://github.com/ngoctien20/demo-git/pull/192), [migration #189](https://github.com/ngoctien20/demo-git/pull/189), [JWT matrix #143](https://github.com/ngoctien20/demo-git/pull/143), [Owner/backup #135](https://github.com/ngoctien20/demo-git/pull/135). Do **NOT** modify hosted, call provider APIs, generate new production credentials, merge/squash/rebase these draft lines or silently revoke existing public QA RPC.

**Release state:** VERIFIED metadata; IMPLEMENTED operator intake guide + local offline tool; TESTED only when exact-head CI succeeds; real owner/backup proof BLOCKED; production NO-GO.

**Rollback:** close child Draft PR. No remote state changes were performed.

**Next concrete human step:** Verify the exact Messenger Page and app attachment privately with Meta Business access (Messenger first), then native OA authorization if required. Send only **redacted** screenshot or non-sensitive summary: role shown, Page-to-app subscription yes/no, whether message permission/review is production-ready. Operator backup evidence remains private until separate scoped export and restore approvals.
