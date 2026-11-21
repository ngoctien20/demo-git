# TIEN404 V19.8.19 — Cross-Platform Published Caller Closure × Backup Evidence × Real Owner A/B Preflight

**Read-only snapshot:** 2026-11-21 JST. **CANDIDATE / HOSTED NO-GO.** Extends Draft PR #472, without touching production. This document and the attached JSON are an *audit observation*, not operator attestations.

## 1. Direct evidence — n8n

Connected n8n search returned 174 workflows, 23 Active. The 23 Active workflow graphs were inspected read-only (eight + eight + seven in audit batches); for workflows with Draft≠Published the **saved Published versions** were separately read. **This enumerates the visible Active set; not exhaustive dynamic-runtime closure or every inactive callable tool.**

Pinned Published IDs:
- Messenger `Z7FdV7uDvApfbURQ` active `1064b1b3-d3f1-4a6b-a367-2414ba691522`, AI SALES main agent `v6PBwcqSapVzACMW` active `c0f04eb1-9e2b-4b42-bf70-0ce12d5b0c30`. Both call legacy order tools.
- Google Sheets Create `KrSn4DNR9ALX5ng4` `4740251a-cd01-4f7f-b8e1-e300a8393151` (append Orders), Manage `fDB9dvs1qPPVt9Sp` `137d5689-40c5-4147-9bbc-b22809ad5908` (update Orders), Address `BkAi6TVUKAjCnI7v` `93cf227a-ab8a-42c6-9185-7ec44f7aeb00` (update Orders), Status `4DFFCk60exrzaIl6` `1faaa1ee-a45c-4bf0-8e3f-f197051f33f8` (read). These use no trusted `store_id`.
- Commerce AI Core `iyfGUiEsZlNTBWOR` published `456862c9-e5ee-4bfa-9931-47dbc39ab73d` ≠ Draft `c96422e0-170b-46a3-8d75-3a2695e645e7`. Tenant Resolver `5Eeh8hbpsoNhuiVo` is tenant-scoped.
- Shop Onboarding `splyaeQtV719OuAu` published `ae8f65de-4325-4e83-97be-4945a3abaffd` includes three Data Table insert nodes for *inactive* onboarding records.
- Zalo Shadow `OgDZNSAvKEvhnAvn` published `f00ba506-c52a-4340-9a0c-809fd9c6ea9a` includes a **POST to Supabase** for synthetic Shop B pending claim and Data Table update/upsert QA markers.
- Messenger Support `KqSuGxCHixc6fsiu` includes Data Table insert, and Commerce QA Ticket `jirkuVts1AjIhnPJ` includes Data Table insert; neither is a protected multi-Store Commerce writer.
- Messenger workflow includes real Meta outbound HTTP POST node `Send Messenger Reply - CONFIGURE TOKEN`. Revenue Report `U2DJsxzSYPH5hRop` published `978b5a8d-d47b-4783-b27e-96fbc96d5262` includes Gmail sender and schedule trigger. **Presence of send nodes does not prove a send occurred in this audit**, but they are an important boundary. The current audit performed zero sends.
- Zalo receipt-only `jy7vCmt8LH6BSqGh` active `175b6609-6a95-4432-986a-075bf8cced35` includes Data Table QA marker upsert; no actual outbound Zalo send was run by this audit.

**Inventory limitation:** Dynamic Code-node HTTP requests, custom functions, disabled/indirect callable workflows, external app callers, and credentials/tenant installation ownership are not comprehensively proven. Do not equate an Active-workflow list with complete published caller closure. Separate legacy Google Sheets DEMO; do not route it into multi-Store Commerce.

## 2. Direct evidence — Supabase staging

Project `ifxlvrhyjhbzbrkdsida` `tien404-staging` reports PostgreSQL 17 **ACTIVE_HEALTHY**. Aggregate read-only query: **2 tenants**, **3 tenant memberships**, **0/6 Commerce `store_id` columns**, **0** public canonical Store/Installation authority tables out of those explicitly inspected; 1 anon-executable privileged public RPC. The values do not disclose user IDs or real customer rows.

Supabase Edge Function `tien404-r1-owner-preflight` is ACTIVE version **2** with `verify_jwt=true`; read-only source inspection shows tenant-scoped QA allowlist and Auth validation but no canonical `store_id` authorization. This is **not** real same-Tenant Store A/B hosted acceptance. Supabase branch list shows only the current main; no independently authorized dedicated hosted UAT branch was created.

## 3. Direct evidence — Cloudflare

Cloudflare Workers inventory includes several TIEN404 QA/staging Workers. Their **deployed versions** were checked read-only, including:
- `tien404-v175e2-installation-registry-nosend-staging`: deployment `8931debd-6ea5-4997-bcb6-833ad63584ff`, version `96c77292-0916-40c9-b4c2-f0ad25eed915`.
- `tien404-widget-gateway-v144-staging`: deployment `b4f501e0-ff37-4ea4-be77-6e3148667b15`, version `da022974-1832-425f-bf82-afddc558b893`.
- `tien404-meta-messenger-qa-canary-v1876cm3`: deployment `6dc160b2-08fd-4b41-9fa9-957da9656312`, version `e9bbe823-417c-40cc-8831-6b63efbb0bda`.

Read-only static scan of these **three** scripts did not observe direct Supabase RPC patterns; negative static matches cannot rule out dynamic imports, runtime bound services or calls in other Worker scripts. Full worker/RPC closure **PARTIAL**.

Pages project `tien404-ai-git-staging`: production `gh-pages` canonical deployment `8aace8d2-524a-4643-8add-23c1ef59cea1`, commit `ff2daf970e8209399a28b2d0cade8a33b9fa71c6`. Latest preview `1b6b727e-a080-4767-90a9-cb96215326d4` on `work/v201-p0-s1-privileged-rpc-commerce-qr-20261121`, commit `19b0f1695ca3d6089538e2c99f456a8b87e6adea`. **Never equate preview with production.** V20.1 preview is in a separate, newer workstream — do not overwrite or duplicate it.

## 4. Render

One accessible workspace named **My Workspace** was found, but the Render connector requires the user's *explicit workspace selection*. No workspace was chosen or service caller list queried. This gate is **BLOCKED_WORKSPACE_SELECTION**, not a claim that Render has no RPC callers. Once the user explicitly selects it, collect service names, deployed commit, request route references and environment variable **names only**, never secret values.

## 5. Backup evidence (M0 hard gate)

The connected Supabase tools do **not** expose a verified backup artifact/restore certificate. This means **evidence not available**, not proof that backups are disabled. No backup was created, downloaded or restored here.

To consider any hosted migration, operator must independently provide a sanitized, scoped receipt containing:
- project ref and exact database revision; backup method (snapshot, logical dump or PITR) + scope, retention, UTC time and artifact object reference (never raw SQL dump in public GitHub);
- SHA-256 of protected encrypted backup artifact, custody/location and independent verifier attestations; evidence that artifact can be decrypted by authorized recovery team;
- disposable restore target ref and isolation proof, restored server version, migration applied/version/checkpoint, exact schema/FK/table count assertions and checksum results;
- authenticated Store A/B negative tests on restored disposable data or fully synthetic Store A/B, documented discrepancies and tested rollback procedure;
- operator signoff, failure/abort decision and restoration drill receipt. **A file name, screenshot or checkbox is insufficient.**

**NO DROP, ALTER, TRUNCATE, RESTORE, DUMP of real customer data, or Supabase paid branch operation without explicit approval.** No user secrets should be placed in chat, GitHub or QA logs.

## 6. Real Owner A/B hosted admission preflight

The local V19.8.18 test achieved **56/56 using real LOCAL Supabase Auth JWT**. This is not evidence of real merchant Owner A/B in hosted. Required independent acceptance, still BLOCKED:

1. Store schema must exist, with server-owned canonical `tenant_id/store_id` and Store membership. Do not map two distinct hosted Tenants to the same Tenant as a shortcut.
2. Each real owner authenticates in an approved hosted/private channel; independently validate JWT with Auth, user-to-membership binding, current Store role, Store active state and consent scope. Keep JWT/token, email and user ID **out of shared logs**.
3. Test Owner A→Store A and Owner B→Store B protected reads across six tables, both cross-Store negative directions, tenant-only and anonymous denials, still-valid-JWT after membership revocation, expired/invalid JWT, revoked installation and nonce replay.
4. Require privately operator-witnessed Zalo `getMe` and `getWebhookInfo`, correct webhook secret binding, installation version/epoch, signed registry proof, exact Store scope and owner consent; never send provider messages or write Orders during read-only admission.
5. Independent security review of privileged RPC caller paths, Editor versus Published and rollback. No automatic production promotion on successful read QA.

### CI evidence gate

`hosted-evidence-preflight.mjs` checks **format only** of independently supplied sanitized evidence; it never validates real provider signatures or accesses hosted systems. Even a syntactically complete fixture yields `EVIDENCE_FORMAT_COMPLETE_HUMAN_REVIEW_REQUIRED` and **all runtime permissions false**. The real read-only snapshot must remain `NO_GO`.

## Checkpoint / rollback
`V19.8.19_CROSS_PLATFORM_PARTIAL / BACKUP_EVIDENCE_PENDING / REAL_OWNER_AB_PENDING / READONLY_PRECHECK_NO_GO`.

Rollback = close Draft PR or revert only QA files. No hosted database, workflow, deployed Worker, credential, real order or provider state was touched. Continue only after approvals, not automatic release.
