# TIEN404 V17.8 — Commercial Simple UX and Managed Full-Service Recovery
Date: 2026-11-17 JST. Source-only proposal in Draft PR #251; not deployed.

## One clear responsibility model
Customer (Owner, Manager, Staff) only uses a mobile-first Commerce Dashboard to serve customers and manage allowed Products, Orders, Inventory and Inbox. All technical backup, recovery, security and integration operations belong to the TIEN404 Platform Operator. Never ask a shop to use Supabase, n8n, SQL, Google Sheets or backup files to keep the system safe.

## Simplified commercial UI
Primary phone navigation: (1) Inbox / Hoi thoai, (2) Don hang, (3) San pham va Kho, (4) Bao cao for allowed roles, (5) Cai dat for Owner only.

- Staff: assigned inbox and orders; view stock and allowed price; no staff management, subscription, platform backup, or cross-store records.
- Manager: handle orders and edit allowed Products/Inventory in the assigned Store; limited reports; never manage platform credentials.
- Owner: own Store reports, staff permissions, business hours / away mode, price configuration, channel setup and subscriptions. No backup chores.
- Platform Operator: manage infrastructure backups, key custody, restore drills and incident response. Any privileged access to merchant data is separately scoped, authorized and audited.
- Hide advanced SKU variants, wholesale tiers, shipping policies until merchant needs them. Basic Product form needs only product name, image (optional), selling price VND, stock, status; SKU generated or validated by server. The backend stores money as integer VND. Each transaction validates ownership, product price, stock, idempotency and customer confirmation.

No user-supplied tenant_id/store_id or Sheet row is trusted as authorization. Every operation needs a verified session and server-side Store authority. The business owner cannot accidentally edit another Store by changing the UI URL.

## What happens to the Google Sheets
- Main V17.4 2-tab QA Sheet remains read-only QA fixture for release acceptance and test automation (not commercial data).
- Original AI_SALES_DEMO sheet stays in its separate legacy LIVE demo boundary.
- V17.2 31-tab sheet and old reporting/QA sheets are archived as test evidence.
- Real merchants have a simple Dashboard; optional per-Store CSV/Sheet import/export after authentication and strict validation. PostgreSQL/Supabase is the canonical system of record for Orders, Products, Prices, Inventory, Customers, roles and audit.

## FULL_SERVICE recovery (platform responsibility, not SaaS tier)
Includes application Postgres schema/data and transactional consistency, Auth users and critical Auth configuration, Storage metadata AND actual object bytes/images, n8n workflow/config restore strategy, secret/key custody, Meta/Zalo/Website binding and webhook reauthorization playbooks, offsite encryption, retention, alerting, independent isolated restore tests and a rollback/runbook.

For shared multitenant DB, never roll back ALL stores to fix one store. Instead restore backup to a separate isolated destination and reconcile/restore a single Store using verified original ownership, constraints and audit, preserving other stores. A CSV export is for portability, not a valid transactional recovery point. Merchant never needs to perform this work.

Configuration required before promising recovery: scheduled automatic backups, separately held offsite copy, completed integrity checks, backups-failed alert to TIEN404 admin, regular independently witnessed restores, defined RPO (maximum acceptable data loss) and RTO (target recovery time), retention and tested access. Until configured and measured, do not display a green backup-health badge or advertise zero data loss.

Current Supabase organization is Free. Provider docs https://supabase.com/docs/guides/platform/backups say automatic daily database backups are for Pro/Team/Enterprise and advise manual offsite dumps on Free; database backups exclude Storage object bytes. FULL_SERVICE is a scope of recovery, not a specific paid Supabase plan. Its implementation may require a paid infrastructure or separately supported offsite tool, with prior owner budget approval. Even a daily backup potentially loses orders since the last snapshot; define and validate business RPO/RTO before launch.

In Super Admin only, show: last completed backup, age vs policy, encrypted offsite copy, failure alerts, last independently validated isolated restore, tested scope, pending approvals/incident, and rollback readiness. Merchant sees only concise status and support notices (plus an authorized own-data export on request).

## Phase plan and release gates
1. Safe staging UX proposal/implementation: create role-based screens, basic Product form, UAT with staff/manager/owner. No hosted data, production bot, secrets or subscription changes.
2. Complete M0 real original 2 Products + 2 Orders Store ownership proof, current source-consistent recovery approval and independently verified isolated restore. Prior H11R partial application archive accepted with Auth/Storage limitations; no need to repeat that old local hash check.
3. Reuse existing Store migration and security PRs: M1/M3 scoped composite ownership, authenticated JWT Shop A/B same-Tenant allow/deny tests, privileged RPC remediation with its own approval.
4. Implement platform backup monitoring and restore workflow, QA and operations incident drill after exact provider/budget/keys authorization. No changes to merchant UI needed for backup.
5. Commercial UAT: actual authorized Staff/Manager/Owner flows, orders+stock consistency, channel binding, bot confirmation and idempotent order write. Separate go-live authorization.

## Status
VERIFIED: 2-tab V17.4 QA and after-cleanup 15/15; archived Commerce 24/24; Supabase staging Free and no canonical Store RLS.
IMPLEMENTED: THIS SPECIFICATION ONLY. No new commercial frontend code, backups, hosted data, permissions or production integrations changed.
BLOCKED: original Store authority, independently restorable current M0, authenticated Store JWT RLS, production order release and safe managed backup infrastructure.
ROLLBACK: close draft PR #251.