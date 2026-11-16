# TIEN404 AI — V15 Sales Lite P0-E.1 · Private Backup Operator Authorization × Real Export Evidence

**Ngày checkpoint:** 16/11/2026 JST  
**Loại:** SOURCE-ONLY DRAFT / NO HOSTED EXPORT / NO RESTORE / NO SEND  
**Parent:** PR #146 HEAD 0bedc7c935ca01fe4b2ef241e0c3ffe42961a189  
**Mục tiêu sản phẩm:** đưa Sales Lite tối thiểu đến thử nghiệm 1–3 cửa hàng nhỏ; Enterprise Dashboard, AI model cao cấp tùy chọn, Advanced Bot Studio tiếp tục tạm hoãn.

## 1. VERIFIED — trạng thái thực tế, chỉ đọc
- Dự án Supabase \`tien404-staging\` ref \`ifxlvrhyjhbzbrkdsida\`, PostgreSQL 17.11 ACTIVE_HEALTHY, tổ chức Free.
- 3 Auth users, 2 Tenants, 3 active memberships, 2 Products, 2 Orders; chưa có canonical \`public.stores\` và \`public.store_memberships\`.
- No hosted backup receipt, backup bytes or isolated hosted restore evidence surfaced by the connected tools. Supabase connector offers no backup export/verification operation; NO export attempted.
- PR #146 OPEN DRAFT, GitHub CI #43798444755 SUCCESS (85/85 source QA).
- PR #135 OPEN DRAFT, Ed25519 two-signature synthetic approval gate, CI #43792524351 SUCCESS. It does **not** recognize any real enrolled controller/security signer or grant export permission.
- PR #132 OPEN DRAFT, PG17 synthetic dump/restore SHA256 with CI #43790419032 SUCCESS. **No Supabase hosted dump**.
- PR #136 OPEN DRAFT, disposable Store A/B/C schema expansion and rollback, CI #43792737344 SUCCESS.

References:
https://supabase.com/docs/guides/platform/backups
https://supabase.com/docs/reference/cli/supabase-db-dump
https://supabase.com/docs/guides/self-hosting/restore-from-platform

Supabase Free has no guaranteed daily scheduled backup. The CLI's default \`db dump\` excludes application data/custom roles and normally filters managed \`auth\`/\`storage\` schemas; three SQL files alone cannot certify complete restoration. Database backups do not restore Storage object bytes, and n8n/Cloudflare/credentials are separate resources.

## 2. IMPLEMENTED — pre-export private authorization evidence contract
File: \`qa/v15-sales-lite-p0e1/export-authorization-evidence.cjs\`.

The request contract only accepts:
- Exact staging project ref, operation \`STAGING_DATABASE_ONE_TIME_LOGICAL_EXPORT_REVIEW\`, narrow <=1-hour review window, one opaque request reference, proposed retention 1–30 days, zero additional USD.
- Four **separate** authority classes: WHOLE_PROJECT_DATA_CONTROLLER, INDEPENDENT_SECURITY_REVIEWER, LEAST_PRIVILEGE_BACKUP_OPERATOR, ENCRYPTED_PRIVATE_VAULT_CUSTODIAN.
- Abstract ticket \`SEC-...\` and actor \`ACT-...\` references only; reject role reuse, actor reuse, forged PASS, unknown fields, token/email/phone/DB URLs.
- Every sensitive operation prohibited: restore, hosted migration, RLS/GRANT edits, credential changes, data/Orders writes, live provider sends, extra spend and production release.

The review result stays \`BLOCKED\` with \`request_approved=false\`, \`can_export=false\`. No access rights are granted by an external file or ChatGPT assertion. **True identity verification is necessarily separate and private.** The Ed25519 synthetic material from PR #135 is only QA evidence.

## 3. IMPLEMENTED — after-export evidence contract (not a certificate)
A separately prepared receipt may contain private references to:
- Matching project + request reference, export start/finish time, method and source labels explicitly \`UNVERIFIED\`.
- Encrypted archive byte count and 64-character lowercase SHA256 reference **only in a private intake environment**. Never publish actual artifact hashes or archive paths to the public repo.
- Three independent tickets for manifest, vault custody and integrity reviewer.
- Nine coverage categories: database roles, app schema, app rows, Auth managed data, Storage metadata, Storage object bytes, RLS/RPC/extensions, migration history and external dependencies.

It MUST stay \`BLOCKED\` until an independent reviewer privately verifies original export credentials/scope, manifest, actual ciphertext file SHA256, private key custody, authorized source and an isolated restore with safe outbound controls. A SHA field filled with random text is **not** evidence; source code cannot validate private facts itself.

## 4. Real-data execution gate — NOT AUTHORIZED / NOT RUN

**Controller:** independently prove authority over the entire staging project, not just one Shop. Record a scoped approval in a private, authenticated audit system.

**Independent security reviewer:** different individual, check privacy/data classification, exact target and retention, vault access and no additional cost. A second same actor does not count.

**Vault custodian:** actual encrypted private offsite destination, access controls, key rotation/recovery, encryption-at-rest/in-transit, deletion after retention and immutable evidence inventory. A cloud URL typed in a document is not verification.

**Operator:** explicit least-privileged one-time read-only connection, verified Supabase CLI version and flags, source identity, access logging, no credentials in chat/GitHub or Actions; native Auth, Storage, n8n and external-service scopes recorded separately.

**Whole-project export approval:** a separate message/action approving ONE export from \`ifxlvrhyjhbzbrkdsida\` after all four independent roles, secure destination and no unexpected fee are satisfied. The request to implement checkpoint P0-E.1 is **not** a real backup/export authorization.

**After-export independent evidence:** archive hash/size/time, encrypted storage proof, operator log, source coverage inspection and a privately signed receipt by a different reviewer, followed by **separate restore permission and isolated restore QA**. Never restore into current Supabase staging without a new exact permission.

No sensitive private evidence, real dump, Auth JWT, provider token, customer number or archive link is to be committed to GitHub, uploaded to ChatGPT or printed in CI logs.

## 5. TESTED, not certified
New Node tests: invalid/wrong-project scope, expired approvals, conflicting roles/receipts, arbitrary PASS, data leakage, no extra charges, spoofed export timestamps/hash/size, missing Auth/Storage coverage, cross-request replay attempts and every forbidden operation. All pure offline/synthetic, no backups or provider calls.

**Source-only rollback:** close the new child Draft PR. No hosted writes were made; no DB recovery needed for these changes.

## 6. Acceptance checklist — gates remain BLOCKED
| Gate | Evidence / status |
| --- | --- |
| True whole-project Controller | Unverified |
| Independent security reviewer | Unverified |
| Least-privileged backup operator | Unverified |
| Actual encrypted private offsite vault | Unverified |
| Explicit one-time actual export authorization | **Not granted** |
| Hosted Supabase export started | **Never run** |
| Independent real archive SHA/size/UTC verification | **Not available** |
| Separate isolated real restore | **Not authorized / not run** |
| Hosted Store ownership & JWT/RLS | **Blocked** |
| Real Commerce Orders, Meta/Zalo pilot | **NO-GO** |

## 7. Next step with correct separation of responsibility
After CI success: privately collect the four real proof lanes and vault/operator details; perform private identity validation (not public GitHub). Then request **a separate explicit one-time authorization** to export staging data and run the authorized operator procedure. Backup export approval **does not** grant restore, RLS, Store migration, Order/Stock writes, provider messaging or production deploy.

Checkpoint proposed: \`V15 Sales Lite P0-E.2 — Private Operator Intake × One-Time Export Approval Decision\`. If no separate approval or private custodian verification exists, keep the task BLOCKED rather than claiming real backup certification.
