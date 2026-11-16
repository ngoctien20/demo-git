# TIEN404 CBOT-UAT-06 — REAL PRIVATE M0 + MERCHANT STORE OWNER + NATIVE META / ZALO OA OPERATOR HANDOFF
Date: 2026-11-16 JST | No production / no hosted mutations | SOURCE-ONLY.
This is the operator handoff and evidence review sequence, not a certificate or remote backup exporter.

## Already OBSERVED (direct read-only)
Supabase staging project ifxlvrhyjhbzbrkdsida, PostgreSQL17 ACTIVE_HEALTHY. 2 Tenants, 2 Products, 2 Orders, 3 Tenant memberships; 3 Auth users, 5 current Auth sessions, 0 Storage buckets and 0 Storage objects. Role-slot 1 has 2 Tenant Owner memberships but 1 Product + 1 Order; slot 2 has 1 Owner + 1 Product + 1 Order. Tenant Owner != verified Merchant Store Owner. public.stores and store_memberships absent; Products/Orders.store_id absent. RLS exists at Tenant level only; not independently evidenced as true same-Tenant two-Store isolation.
Supabase public.qa_shop_b_zalo_claim SECURITY DEFINER remains anon EXECUTE=true. n8n V2 Shadow OgDZNSAvKEvhnAvn still contains HTTP POST to this RPC.
Messenger workflow Z7FdV7uDvApfbURQ Published active, 27 nodes, version d5c96b6b-d790-4270-8b0f-d0ebdd8bbd92, unchanged. User-confirmed LIVE01 #4176 is Meta webhook/delivery baseline, not native Page or Commerce authorization.
PR #214 reports a user-provided Meta Business Suite screenshot visibly selecting Page Tien404 AI under the signed-in account. This demonstrates Page asset visibility, NOT independent Full Control or messaging task, App/Page subscription, merchant Store ownership, QA recipient, or native OA authorization. Separate n8n Canary test #4177 remains synthetic inactive.
The current execution container exposes only QA CSV fixtures, not a mounted local Windows backup archive. Neither the existing archive itself nor any current independent true full restore receipt was inspected during UAT06.

## STOP / RELEASE STATES
- ALLOWED NOW: GitHub Draft code, independent source QA, safe metadata-only hosted reads, manual local private archive inspection, native Meta/Zalo console READ-ONLY inspection, independent private proof handling.
- NEEDS OPERATION-SPECIFIC APPROVAL: actual encrypted offsite backup export, independent disaster-recovery operation and any resource/cost impact, hosted DDL/M1 Store migration, RLS edits, privileged RPC grant/revoke, Published Messenger/Zalo workflow replacement, external provider send or commercial Orders data.
- NOT ALLOWED BY THIS CHECKPOINT: self-certifying private evidence, production release, using legacy DEMO Google Sheets Orders as SaaS Commerce, customer cross-Store reads, invented Page/OA owner mapping.

## M0 — Windows LOCAL existing archive inspection, no export
Reuse the FULL script from existing [PR #198](https://github.com/ngoctien20/demo-git/pull/198), updated HEAD 4f7bef71f54ee17b88449026b90803ccf9743e30.
This new UAT06 branch DOES NOT contain a cloned copy of RPC.7 scripts. Operate from the checkout of PR #198, with installed pg_restore and node on an authorized private Windows machine.

    $archive = Read-Host 'Existing PRIVATE archive path'
    $pgRestore = Read-Host 'pg_restore.exe full path'
    & .\qa\v152-rpc7\Inspect-TIEN404-RPC7-M0.ps1 -ArchivePath $archive -RecoveryScope APPLICATION_WITH_EXTERNAL_AUTH_STORAGE_PLAN -PgRestoreExe $pgRestore

Script does read-only Get-FileHash SHA256 and pg_restore --list; it cannot prove successful real full restore and intentionally reports m0Approved=false, m1Authorized=false. Its encrypted private receipt stays under LOCALAPPDATA/TIEN404/private-evidence (default), NOT GitHub or ChatGPT. Compare prior private SHA/bytes receipt only if independently known; never paste full hash/path or raw archive here.
Required independent roles: CONTROLLER, SECURITY_REVIEWER, BACKUP_OPERATOR. They must genuinely be distinct authorized people/services, with privately authenticated authority; synthetic fingerprints do not prove this.
An approved M0 actual recovery drill, when separately authorized and implemented in a private isolated environment, must test latest real app schema/rows; Auth identities and re-login viability; roles, ACL, RLS and extensions; Storage object bytes/metadata AND external services; offsite encryption and key custody; manifest checks, independent restore logs, RPO/RTO, retention/erasure and rollback. Do not assume five active sessions should or can be ported; test login viability instead.
NO-GO if selected-schema archive only, Auth roles omitted, encrypted object bytes unknown or external independent reviewer unavailable.
NEVER run pg_restore -d against hosted production/staging under this source-only checkpoint.

## M1 — Prove REAL four-row Merchant Store ownership
2 Products and 2 Orders are legacy hosted rows. Their existing Tenant IDs do NOT prove which Store owns them.
Authorized actual Merchant Owner must match EACH of the four legacy rows to a real Tenant+Store with private evidence (sales/catalog records, current legal merchant and channel ownership, reviewer confirmation), then independently verify with SECURITY_REVIEWER and CHANNEL_OPERATOR. Keep raw Order IDs, UUIDs, customer details out of public code/chat.
Use already implemented H11R.11 #205 four-row evidence schema and H11R.10 #200 migration compatibility; use V16.10 #212 synthetic fake-JWT PG17 only as mechanical regression, NOT hosted JWT proof.
Before M1 approval require accepted M0 independent real recovery and exact row mapping; after approved expand-only schema, run two genuinely signed Supabase Auth Owner JWT roles inside ONE tenant, two Stores, negative cross-Store READ/WRITE and revoked Owner tests under non-privileged roles. Never use service_role to claim RLS works.

## META native Page owner — REAL operator steps
Separate Page-only greeting canary from Commerce; user has approved READ-ONLY/canary preparation, not an actual hosted Store cutover.
1. Authorized operator opens Meta Business Suite / Settings > Business assets > Page Tien404 AI > People/Page access, checks exact Full Control or required messaging permissions. Merely seeing a Page tile is insufficient. Keep identifying values private.
2. In Meta for Developers, select the actual app, confirm its Business ownership, App Review / pages_messaging access and the Page Webhooks object messages subscription.
3. Verify Page-level App association, read-only subscriptions, expiry of app credentials and one approved private QA recipient. No subscription POST or sending.
4. Independent SECURITY_REVIEWER compares native app+Page details with that merchant's legal Store proof; customer Messenger PSID may not be used as verification of Zalo identity.
5. Preserve private immutable screenshots/API read-only receipts with timestamps and protected full Page/App IDs in an approved encrypted vault; GitHub only gets an opaque EVID reference, not raw IDs or screenshots.
If Page role, App subscription or reviewer cannot be verified independently: META_AUTHORITY=NOT_VERIFIED.

## ZALO native OA owner — SEPARATE FROM ZALO Bot
1. Authorized merchant OA administrator opens actual Zalo Official Account Manager and Zalo Developers App console.
2. Verify genuine OA owner/admin, exact OA↔Developer App OAuth binding, approved scopes, webhook authenticity/signature validation, consent and QA recipient.
3. Independently map that OA to Merchant→Tenant→Store and signed customer link through a bounded single-use challenge. A phone or Order ID alone is NOT identity.
4. Preserve sensitive proof only in private encrypted custody. n8n Zalo Bot Lab V1/V2 and old anon RPC do NOT establish Zalo OA identity.
If actual OA/App admin proof unavailable: ZALO_NATIVE_OA=NOT_VERIFIED.

## PRIVATE ACCEPTANCE PACKET: offline schema and semantics
The UAT06 offline CLI is run ONLY on a trusted private workstation:
    node qa/cbot-uat06/private-operator-cli.mjs < private-packet.json
The optional packet has five unique operator role digests, six M0 coverage domains, metadata of the existing RPC7 archive (no path), four separately identified legacy Product/Order ownership evidence refs and six each Meta+Zalo native authority domains. No raw identifiers, Page IDs, tokens, SQL backups, screenshots, customer info, credentials or personal names should enter the packet.
The CLI only prints aggregate counts and remaining gaps, never references/sha/input. It DOES NOT authenticate people, decrypt evidence, run pg_restore, access native providers or sign a release. Even an all-green packet outputs PRIVATE_METADATA_SCREENED_NOT_AUTHORIZED. A real independent security reviewer and authorized release operator must validate source artifacts in the private vault using existing H11R.11 / operational process; code must NEVER be used as a substitute for consent.

## OPERATIONAL SIGN-OFF (currently missing)
- Controller legal scope, date/purpose and separated reviewer: NOT VERIFIED.
- Backup Operator real full off-host restore M0 including 3 Auth identities, ACL, Storage/external bytes: NOT WITNESSED.
- Merchant Owner independent two Products + two Orders real Store mapping: NOT VERIFIED.
- Actual native Meta Business/Page admin + App/Webhooks and approved one-QA-recipient: NOT VERIFIED.
- Actual native Zalo OA/App OAuth + scopes and customer linkage: NOT VERIFIED.
- Six-domain real RPC caller inventory and exact cutover authority: NOT VERIFIED.
- Same-tenant two-Store signed Owner JWT RLS and hosted scoped read-only Commerce pilot: NOT RUN.

## ROLLBACK
All UAT06 GitHub changes are candidate/source only. Close its Draft PR to roll back new artifacts; no hosted changes were made. Do NOT delete existing n8n QA evidence, archived file or old PRs to roll back a source change.
