# TIEN404 AI — V15.0-09C CHECKPOINT: Independent Owner/G2.3 × Private Recovery
**Date:** 2026-11-16 JST
**Phase:** V15.0-09C
**Parent:** Draft PR #129 V15.0-09B @ 2991cf9d62bf856b23c0ddbcb53d7a426cefd99d
**Classification:** VERIFIED READ-ONLY | IMPLEMENTED SOURCE-ONLY | TESTED DISPOSABLE POSTGRES 17 (CI) | HOSTED OWNER/RECOVERY BLOCKED
**Release:** NO-GO / NO SEND / NO HOSTED MUTATION

## 1. VERIFIED DIRECT EVIDENCE
- Supabase staging ifxlvrhyjhbzbrkdsida: ACTIVE_HEALTHY, PG 17.11, 2 tenants, 3 Auth users, 3 active tenant memberships.
- QA owner_bindings = 2 status paired. QA owner_pairing_claims_v3 = 3 CONFIRMED + 1 PENDING_OWNER_CONFIRMATION.
- QA owner_pairing_challenges = 19 (9 used, 10 expired unused, zero unconsumed and not expired; maximum failed attempts 5). This does not imply all challenges or pairings are owner-certified.
- QA tenant_identity_map has 2 links mapping to 2 existing Tenant IDs. Products = 2, Orders = 2, but none has verified canonical Store.
- public.stores and public.store_memberships do not exist. Host cannot complete Auth→Tenant→Store→Store Member ownership chain. RLS remains Tenant-scoped. JWT/Store hosted security cannot be certified.
- n8n G2.1 provider attestor manual QA bOjbj4MZIZnMn8XP #3874 and #3880 SUCCESS; G2.2 signed Shop B QA znp3ABDLUH5bTqFE #3881 SUCCESS. Execution success ≠ independent merchant/provider G2.3 authorization.
- Supabase organization pjdoiuhtwrhzkzlhelvr plan = FREE. Official documentation states daily managed backups for paid plans and advises free-tier off-site manual logical dump. No backup list/restore action exposed via current Supabase connector; 0 development branches and 14 migration entries do NOT prove a valid backup.
- No actual hosted snapshot or restore verified.

## 2. IMPLEMENTED SOURCE/CI ONLY
- qa/v1509c-owner-recovery/evidence-gates.cjs: fails closed for independent five-source synthetic G2.3 intake, owner consent, verified Provider Account/Ingress/Canonical Store, store/tenant cross binding, expiry and raw-sensitive-field leakage; always explicitly not real certified.
- qa/v1509c-owner-recovery/evidence-gates.test.cjs: positive/negative offline evidence and private recovery receipt shape tests; no real credential or provider requests.
- qa/v1509c-owner-recovery/rehearse-ephemeral-recovery.sh: guarded localhost-only Postgres17 synthetic pg_dump + pg_restore + file SHA256 comparison, delete dump on EXIT.
- qa/v1509c-owner-recovery/assert-restored-ephemeral.sql: check restored synthetic counts, Store SKU, FORCE RLS, RESTRICTIVE Store guard and composite FK, plus mock Owner A cannot see Store B.
- .github/workflows/v1509c-owner-recovery-no-send.yml: safe PG17 ephemeral service and independent disposable Docker psql/pg_dump/pg_restore job, no actual Supabase credentials.
- docs/ai-handoff/V15_09C_PRIVATE_G23_OWNER_CERTIFICATION_INTAKE.md: private independent merchant/provider ownership signoff and no-PII receipt.
- docs/ai-handoff/V15_09C_PRIVATE_RECOVERY_RECEIPT_AND_SOP.md: free-tier recovery plan with offsite encrypted backup & approved isolated restore gating.
- This checkpoint file. Only GitHub Draft source is changed, no public preview deployed.

## 3. TESTING LIMITS (NO FALSE CERTIFICATION)
- Offline fixture "ready" means source shape only; not a real signature, Auth session, independently signed owner approval, or tenant/store owner certificate.
- Synthetic PG17 snapshot is generated with manufactured QA-only data and deleted, never a Supabase hosted copy.
- Any pg_dump/pg_restore success proves a TECHNIQUE within a disposable Postgres17 container only. It does not prove Supabase Auth, Storage, external n8n/Cloudflare integrations or future migration recovery.
- CI at source HEAD a4421ba1327def034aa98f75f355d9b4a25c315c: GitHub Actions #43790185889 SUCCESS (45 new cases + 117 inherited = 162/162 PASS); V15 Core/Model #43790185954 SUCCESS. Evidence logs prove successful disposable pg_dump/pg_restore, SHA256 match, restored 2 Tenants/3 Stores/4 Store Memberships/3 Products/2 Orders and mock claim A vs B isolation. One additional sensitive-array negative test added afterwards; verify the latest exact HEAD CI before final acceptance.
- All such tests are local/ephemeral and do not imply true merchant account, provider-native G2.3 or hosted backup restoration.

## 4. G0–G3 RELEASE GATES
G0 Owner Proof = BLOCKED: trusted canonical Store+Store Membership, merchant independent signature, provider ownership, correct real Shop→Bot and private evidence receipts. Cannot substitute QA paired/confirmed claims.
G0 Recovery = BLOCKED: verified authorized hosted private backup artifact and encrypted offsite custody; actual restore on isolated target; objective and measured RPO/RTO and rollback. No proof exists in current checkpoint.
G1 Migration = NOT APPROVED: cannot run guarded SQL V15.0-09, change RLS/GRANT or assign legacy products/orders.
G2 JWT/RLS = PREPARED via V15.0-09B ephemeral mock claim, NOT HOSTED TESTED.
G3 Commerce Integration = BLOCKED: native provider signatures, durable replay, source-of-truth Store Catalog, pending-order+outbox, Owner UAT.
Production = NO-GO.

## 5. Owner-facing acceptance checklist
- [ ] Owner confirms each exact Shop A/B/C to Tenant and approved Provider Page/Bot mapping privately.
- [ ] Security reviewer independently verifies real authenticated Owner, provider getMe/native signature, consent and revocation.
- [ ] Owner explicitly authorizes backup of QA staging data to private encrypted off-site store; consent and retention recorded.
- [ ] Backup artifact restored in isolated approved environment, schema/data/RLS/extension/storage coverage checked.
- [ ] Only then evaluate migration of canonical Stores and genuine signed JWT hosted QA; separate written approval required.
- [ ] Review whether Free plan has appropriate backup strategy before first live merchant onboarding.

## 6. SECURITY / ROLLBACK / CHECKPOINT
- No Hosted SQL DDL, DML, RPC, RLS/GRANT, credential or Auth changes. No n8n Published edits or execution calls, no Meta/Zalo sends, no Commerce orders, no Cloudflare deploy, no payment or AI provider costs.
- Do not post raw PSID, Zalo sender info, JWT, Secret, phone, email, QR/code or customer PII in GitHub. Public checkpoint contains aggregated metrics only.
- Rollback: close this child Draft PR; parent #129/#126/#125/#123/#122/#121 remain untouched. No runtime rollback needed.
- NEXT: G0 Independent Owner Certification intake with actual merchant and private evidence repository, then privately authorized G0 backup/isolated restore; proceed to hosted JWT/RLS only after independent signoff.
