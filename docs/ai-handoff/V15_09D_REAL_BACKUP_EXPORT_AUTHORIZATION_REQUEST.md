# TIEN404 AI V15.0-09D — REAL STAGING BACKUP AUTHORIZATION GATE (REQUEST ONLY)
Date 2026-11-16 JST | Request status: NOT SUBMITTED / NOT APPROVED / NOT EXECUTED

## 0. Intended action only (not permission)
Project: Supabase tien404-staging; ref ifxlvrhyjhbzbrkdsida; PostgreSQL 17.11; organization plan FREE.
Requested action: ONE-TIME logical BACKUP EXPORT only, to a separate encrypted private off-site location, NO RESTORE.
This document is a proposal/authorization intake; it confers zero execution privilege. User choosing V15.0-09D to develop a gate does NOT authorize any real backup. A checkmark in a document, unverified email or synthetic key signature is not a real approval.

## 1. Actor separation
- BACKUP REQUESTOR: platform operator/data controller authorized to handle ALL tenant data in THIS staging project and to decide backup necessity, privacy/legal basis, minimization and retention. Merchant Owner authorization for one shop does not cover other shops.
- SECURITY APPROVER: an independent reviewer not identical to requestor, verifies identity, environment/project, source readonly access, encryption/secure custody, private evidence trail, approval expiry and cost.
- BACKUP OPERATOR: a least-privileged authorized actor, separately confirmed before a real dump; their operational permission is NOT conferred by this source-only draft.
- RESTORE OPERATOR: separate later approval, authorized isolated environment, not included in any backup-export approval.

## 2. Request specification to approve in private
ACTION: STAGING_DATABASE_LOGICAL_EXPORT
TARGET: ifxlvrhyjhbzbrkdsida ONLY, NEVER production
SOURCE: READ ONLY snapshot via documented Supabase CLI tooling (actual syntax and credentials checked privately before any run)
COVERAGE: select schema, Auth, application data, migration history and dependent services after privacy classification; exclude secrets when possible; storage object bytes & Cloudflare D1/KV/n8n resources are distinct recovery processes
DATA: treat as sensitive because even staging can hold PII/phone/order records; do not assume Demo-only
EXPORT: encrypted before leaving controlled environment, to access-controlled offsite vault with no public artifact/log
RETENTION: proposed 7 days (requires explicit signoff; 1–30 days permitted by synthetic policy model)
BUDGET: 0 USD additional spend without independent approval; if paid infrastructure/storage required, STOP and seek separate explicit cost approval
EXCLUSIONS: no restoration, no schema modification, no RLS/GRANT/RPC change, no production deployment, no order/stock write, no Bot send, no credential change, no token/PII publication, no parallel backup scheduling
EXECUTION: ONLY after separate explicit conversation approval, genuine controller and security signatures validated privately, independently verified backup destination/custody and a supported secure backup execution method.

## 3. Real approval chain
GATE A — project data owner/controller identity and authority to export the entire staging database (not just Store A or B). RESULT: BLOCKED.
GATE B — independently enrolled security reviewer, private signed approval for exact environment, purpose, retention, cost, timestamp and expiry. RESULT: BLOCKED.
GATE C — encrypted destination exists, verified access and key custody, retention and private evidence manifest. RESULT: BLOCKED.
GATE D — exact approved operator, read-only database access, secure backup procedure and privacy minimization. RESULT: BLOCKED.
GATE E — owner/controller gives explicit actionable instruction for one-time EXPORT. RESULT: NOT PROVIDED. User asking to develop V15.0-09D is NOT authorization.
GATE F — actual backup SHA/size/time metadata and protected location verified by reviewer. RESULT: NOT RUN.
GATE G — separate isolated RESTORE approval/test after export. RESULT: NOT GRANTED.

## 4. Non-executing cryptographic rehearsal
Code qa/v1509d-owner-backup/backup-authorization-gate.cjs accepts only ephemeral synthetic fixture requests and two independent Ed25519 signatures from generated test-only keys; it never grants backup rights and has no Supabase or other network dependencies.
Real signing key enrollment and review must be implemented in an approved trusted service with provenance and revocation — not using private keys or tokens in GitHub actions, public PR or ChatGPT.

## 5. Private approval receipt TEMPLATE (all empty; never invent)
- request_version: V15.0-09D
- environment: staging
- project_ref: ifxlvrhyjhbzbrkdsida
- requested_operation: STAGING_DATABASE_LOGICAL_EXPORT
- data_controller_receipt: NOT_SUBMITTED
- security_approver_receipt: NOT_SUBMITTED
- private_vault_retention_verified: false
- backup_tool_credential_scope_verified: false
- request_expiry: not_set
- explicit_operator_authorization: false
- real_backup_started: false
- real_backup_sha256_verified: false
- real_restore_authorized: false
- real_restore_test_passed: false
- permission_to_apply_migrations: false
- permission_to_send_provider_messages: false
- overall_status: BLOCKED

## 6. One-time explicit owner/controller approval language (future user response only, not prefilled)
"Phê duyệt xem xét sao lưu logic MỘT LẦN của Supabase STAGING ifxlvrhyjhbzbrkdsida, CHỈ ĐƯỢC XUẤT SAO LƯU SAU KHI xác minh bảo mật/đơn vị lưu trữ riêng tư và xác nhận không có chi phí phát sinh. Không phê duyệt khôi phục, migration, thay đổi credential hoặc production."
This only starts a review/approval flow and does NOT bypass missing security approval, data handling or tool availability.

## 7. Product constraints and recovery
Official Supabase docs: https://supabase.com/docs/guides/platform/backups (Free plan users recommended manual offsite logical backup; paid plans daily backups; database backups do not automatically include Storage object bytes).
No connector action presently supplies downloadable hosted backups or a guarded restore service. Do not trigger an unauthorized generic SQL dump through execute_sql.
Any real cost outside approved budget, external storage account creation, Supabase project creation/upgrading or Restore operation requires independent user approval.

REAL BACKUP STATUS: NOT AUTHORIZED, NOT EXECUTED. Owner/G2.3 certification: NOT COMPLETE. Release: NO-GO.
