# TIEN404 CBOT-UAT-05 — REAL OPERATOR EVIDENCE / NATIVE CHANNEL AUTHORITY RUNBOOK
Date: 2026-11-16 JST | SCOPE: authenticated PRIVATE operator actions, NO hosted mutation or provider send in this PR.
Parent CBOT-UAT04 PR #213 exact pinned HEAD a383028c5a0b3355b94207aabe67ac80a172de69.
Cross-branch owners: PR #198 archive integrity (updated HEAD 4f7bef71f54ee17b88449026b90803ccf9743e30); PR #205 H11R.11 private signed evidence intake (HEAD 8df7b9b30f26906091340dc95531d4e422c8196b); PR #200 disposable Store schema; PR #211 user-visible Meta greeting baseline; PR #212 disposable fake-JWT RLS. Do not fork/merge their security logic into this PR.

## 1. OBSERVED BY CONNECTED READ-ONLY TOOLS (not self report)
- Supabase project tien404-staging ifxlvrhyjhbzbrkdsida ACTIVE_HEALTHY PostgreSQL17. Aggregated public tenant/product/order/customer counts 2/2/2/0, auth.users=3, auth.sessions=5, tenant_memberships=3, storage.buckets=0, storage.objects=0. No row contents, auth user identifiers or secrets retrieved.
- public.stores/store_memberships and Products/Orders.store_id absent, so same-Tenant two-Store owner JWT-RLS and per-Store Orders lookup cannot be performed. An existing tenant owner relation is NOT an independently proven Store Owner relationship.
- Existing public.qa_shop_b_zalo_claim SECURITY DEFINER remains EXECUTE by anon=true, as confirmed by SQL and Supabase Security Advisor. Active n8n Zalo V1 to V2 shadow still has an HTTP POST to this RPC. Immediate revoke is unsafe.
- Messenger Published actual execution #4176 re-inspected directly this turn: successful real webhook, Verify Signature Timing-Safe=true, Verify Meta Signature=true, AI Agent executed, Meta send verify has message ID + accepted timestamp; no executed order tool in the limited filtered run data. PR #211 separately records user confirmation of device-visible reply and no five business tools in that run. This is a live greeting baseline, NOT Page admin, live Commerce, Order write or cross-channel user identity.
- Supabase source logs in default connector latest-24h window: postgrest_logs 7 records, edge_logs 14. Literal query found 0 occurrences of named legacy claim and 0 rpc-path occurrences in selected log_attributes. Such small/partial logs DO NOT prove absence of external real callers.
- Cloudflare: connected account lists 23 scripts, 23/23 current source GET succeeded; no literal qa_shop_b_zalo_claim in downloaded script text. 13 scripts (BIO family) contain a generic /rest/v1/rpc/ literal, and 5 contain the TIEN404 Supabase project reference string. These are NOT proven calls to the named claim, and indirect/dynamic code, Pages routes, external accounts and downstream clients are not excluded. This remains an incomplete six-domain caller attestation.
- Supabase active Edge Function tien404-r1-owner-preflight verify_jwt=true; limited read-only source scan did NOT contain a literal named legacy claim. This does not prove non-use by dynamic routes.
- Browser provided only a general Facebook homepage, not native Meta Business or Zalo OA admin console. There is no independently verified Page admin, App↔Page subscription, authorized Zalo OA App or merchant-specific Page/OA→Store mapping in the connected evidence.

## 2. M0 PRIVATE EXISTING ARCHIVE — OWNER ACTION (do not export again)
Operate on a trusted local Windows workstation. Use the **already implemented** operator wrapper in PR #198; this PR intentionally does NOT duplicate an archive inspector or make a new backup.
- From a trusted checkout containing PR #198 implementation, open a PRIVATE PowerShell session.
- Read path to the existing H11R archive via Read-Host; do not copy archive to ChatGPT, GitHub or CI.
- The script checks file presence, SHA-256, pg_restore --list and redacted metadata, and always prints M0/M1 NO_GO. It never calls the hosted database.
- The receipt must be stored on the workstation PRIVATE path, not public GitHub.
Example commands, only when the existing archive and scripts are available:

    $archive = Read-Host 'Existing private archive path'
    $pgRestore = Read-Host 'pg_restore.exe full path'
    & .\qa\v152-rpc7\Inspect-TIEN404-RPC7-M0.ps1 -ArchivePath $archive -RecoveryScope APPLICATION_WITH_EXTERNAL_AUTH_STORAGE_PLAN -PgRestoreExe $pgRestore

For previous SHA/byte receipt, provide ExpectedSha256 and ExpectedBytes ONLY if independently obtained from private evidence, not copied from chat. If mismatch => STOP and security investigation.
A pg_restore TOC or synthetic CI restore is NOT recovery acceptance. Distinct Controller, Security Reviewer and Backup Operator must independently sign for app data, **3 live Auth users and 5 observed sessions at checkpoint**, complete ACL/roles, external storage bytes/assets/config, offsite encryption/key custody, restore integrity and usable login, realistic RPO/RTO, retention and consent.
Even with zero storage buckets/objects now, the independent operator must check external storage, CDN and service configurations and prove backup recovery scope.

**STOP gate:** without an independently witnessed OFF-HOST real restore and clear Controller scope authorization, M0=NOT_ACCEPTED, M1 SQL and RPC cutover stay forbidden. Do not enter full backup URLs/paths or passwords into public threads.

## 3. META NATIVE AUTHORITY — READ ONLY
Authorized Meta Business/Page administrator (not an anonymous screenshot):
1. In Business Suite/Business settings, inspect the exact Business portfolio + Page and the operator's native Page access / messaging task. Keep IDs redacted in any public output; retain full identifiers only in private encrypted evidence vault.
2. In Meta for Developers, inspect the exact app, App Review status and its Webhooks Page object subscription **messages** and relevant messaging permissions (for provider production acceptance).
3. Read Page-level subscribed apps for the exact Page, without subscribing or sending messages. Meta official GET /{page-id}/subscribed_apps allows read under proper Page token/permission. Perform GET privately in Graph API Explorer using a token already managed by the administrator. DO NOT paste token, Page ID, PSID or full response into chat/PR; DO NOT execute POST /subscribed_apps here.
4. Compare Page→App authority and signed webhook Page identity against the independently verified Merchant Owner→Tenant→Store mapping; inspect consent purpose, allowed Page/Test recipient, App access level, version and TTL. HMAC=true on execution #4176 is evidence of message integrity, not legal ownership of the Page.
5. Independently qualified reviewer inspects privately stored native receipts/screenshots, time, app role and exact Page/Store mapping. If unable to inspect the native provider UI, mark META_NATIVE_OWNER=UNKNOWN. No self-declared proof.
Meta official sources: https://developers.facebook.com/docs/graph-api/webhooks/getting-started/webhooks-for-pages and https://developers.facebook.com/docs/graph-api/reference/page/subscribed_apps .

## 4. ZALO NATIVE OA AUTHORITY — SEPARATE FROM ZALO BOT
1. Authorized OA administrator opens the exact Zalo OA management and Developers App consoles; independently identifies the real OA asset, verified administrator, associated authorized Developer App and approved OA API scopes/status.
2. Read the OA↔App OAuth/authorization and webhook configuration using the native admin tools; verify how each event is authenticated, the authentic OA sender and event replay control. Do not expose OAuth tokens, App Secret, UID, event signatures or raw webhook content.
3. Zalo Bot Lab V1/V2 is **NOT equivalent** to Merchant Zalo OA. Do not substitute a Bot's chat ID or synthetic GHÉP owner claim for real OA ownership.
4. A verified cross-channel customer link needs explicit customer-controlled, time-bounded challenge and revocation tied to the same Store; phone/order ID alone cannot establish Messenger PSID ↔ Zalo OA UID.
5. Reviewer must validate exact OA→App→Merchant→Store association and compatible live policy/permission. If missing, ZALO_NATIVE_OWNER=UNKNOWN.
Zalo official source: https://developers.zalo.me/docs/ .

## 5. M1 REAL STORE OWNER + TWO-STORE JWT-RLS
Current hosted 2 Products and 2 Orders lack store_id. Owner must privately resolve every legacy Product/Order (and related OrderItems) to an independently attested Merchant→Tenant→Store authority. Do not backfill a Store guess from Tenant membership, SKU, Page name or LLM.
Reuse H11R.11 #205 private four-row evidence, H11R.10 #200 disposable compatibility and V16.10 #212 synthetic PostgreSQL17 role tests; these do not automatically authorize a hosted migration.
After full M0 recovery and separate exact migration approval: expand nullable Store FKs and Store membership under a rollback plan, preserve existing row IDs and VND totals; test real Supabase Auth JWT/Store RLS with two independently authenticated Store Owners within **one Tenant**, cross-Store negative READ/WRITE, expired subscription, and non-privileged invoker role. Never use service_role for Owner RLS proof.

## 6. SIX-DOMAIN LEGACY RPC CALLER CUTOVER
Source inventory: current n8n Published/Draft graphs, Cloudflare Workers/Pages all routes/accounts/deployments, Supabase Edge functions, PostgREST real request attribution, external clients and manual operator scripts.
The 23 Worker literal reads and tiny retained log window only reduce UNKNOWN, never count as zero live callers.
Replacement UAT04 is **source candidate** only, not hosted. Independently verify real Meta HMAC/Zalo OA signature before trusted service invocation, bind exact channel/Store, use durable atomic nonce replay ledger and private invoker. Run privacy-safe no-send shadow comparisons; verify old caller migration with real request receipts, then obtain exact separate privileged ACL cutover approval and rollback. Re-run Advisor after approved change. Do NOT REVOKE now.

## 7. HOSTED READ-ONLY AUTHORIZATION: only metadata is currently approved
- Allowed: existing metadata/count-only SELECT and non-personal runtime inspection on staging.
- Denied: SELECT real order content as unverified Customer across Messenger/Zalo; revoke RPC; store_id migration; Auth/Storage export; production publish; Meta/Zalo sends; paid inference.
- First real read-only Commerce pilot only after M0 real restore, M1 Store claims and real Store Owner JWT RLS, native provider Page/OA authorization, verified customer cross-channel link, a scoped read-only backend, idempotent recipient restriction and approved rollback.
- Do not create a QA Order for real Commerce before separate store-aware writer authorization. Legacy AI_SALES_DEMO Orders/Products must remain isolated.

## 8. PRIVATE EVIDENCE SUBMISSION RULES
This PR carries only safe metadata from connected read-only tools. A private operator may keep a proof package and supply to an independent Security Reviewer via an approved encrypted vault, not here. The optional UAT05 opaque reference intake accepts only seven exact redacted fields (kind, reference, reference digest, operator role, reviewer role, source class, pending status); it never grants hosted authority.
Required kinds: M0 real restore, M1 four legacy rows, M2 signed Owner JWT RLS, six-domain real caller attestation, Meta native Page app ownership, Zalo native OA app owner, customer cross-channel proof, safe hosted Commerce read receipt.
There are currently **0 actual submitted independent private references**. Never manufacture one in code or CI.

## 9. ROLLBACK AND CHECKPOINT
This UAT05 package is source-only Draft, no hosted/Published change. Close its Draft PR to revert source; retain already-existing n8n QA workflows #4177 and #4175 inactive. No existing data, ACL, Meta/Zalo subscriptions, App tokens, paid API or Commerce Orders were changed by this task.
