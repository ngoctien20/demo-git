# TIEN404 V15.0-11A — SALES LITE × OWNER G2.3 / BACKUP SECURITY RECONCILIATION
Date: 2026-11-16 JST | GitHub Draft only | Hosted/Production NO-GO

## 1. Truth and branch continuity
- Base: V15.0-10B source-only private model benchmark PR #147, based on V15.0-10A PR #140, on Sales Lite Consolidation PR #128. PR #128 already has newer V15 Agent Core/Studio/Test Lab with security subset #125/#126.
- Parallel, NOT ancestral to this line: Owner/Recovery PR #135 (V15.0-09D) based on #132 (09C) based on #129 (09B) based on #126. GitHub compare Sales Lite #128 vs security #135 returned status DIVERGED: ahead_by 50, behind_by 45, 35 changed file paths. DO NOT blindly merge the branches and overwrite more recent Agent Core.
- This V15.0-11A branch copies EXACT complete source content from the latest PR #135 HEAD 6ef086202a524b0c595fda3f03ae89a10fe73676 for ONLY 21 newly introduced 09B/C/D paths:
  * 09B: 7 files, Owner Proof, Postgres17 mock JWT RLS, private intake, plan, CI.
  * 09C: 8 files, independent G2.3 and synthetic PG dump/restore evidence, private recovery intake, CI.
  * 09D: 6 files, synthetic Ed25519 backup approval test and private G2.3/real backup scope intake, CI.
- All pre-existing V15/09/10A/10B code remains as inherited from the Sales Lite line, untouched; no source overwrite. Copying new paths is not a Git merge or a signed Owner/provider approval.
- Branch preserves all earlier PRs #128/#140/#147/#129/#132/#135 intact. No production branch merge.

## 2. Hosted audit (READ-ONLY DIRECT)
Supabase ifxlvrhyjhbzbrkdsida: 3 Auth users, 2 Tenants, 3 active Tenant Memberships, 2 Products, 2 Orders, public.stores absent, public.store_memberships absent. Seven inspected business RLS policies on Conversations, Customers, Messages, OrderItems, Orders, Products, Agent Config are Tenant-only; none uses store_id.
Therefore genuine signed hosted JWT A/B (same Tenant) and Shop C (different Tenant) RLS proof is NOT yet attainable. Legacy 2 Products and 2 Orders have no independently verified Store attribution, and no default Store assignment is authorized.
n8n Messenger Published remains legacy AI_SALES_DEMO; Zalo private router is not wired live; G2.3 Owner/provider approvals, hosted backups/isolated restore not certified. Supabase Free: no guaranteed managed daily backup.
No changes to Supabase schema/RLS/GRANT/credential/data or n8n workflows.

## 3. Implemented source-only
- qa/v15011a-reconciliation/integrated-release-gate.cjs + tests: calls REAL current source modules from Sales Lite pilot (#128), Shop Knowledge (#140), independent Owner Proof (#129), G2.3 (#132), Backup Authorization (#135). All offline/synthetic indicators always fail closed, regardless of client-supplied PASS or model/paid claims.
- Combined GitHub Actions workflow .github/workflows/v15011a-reconciled-saleslite-security-no-send.yml runs the inherited V15 Agent/Skills/Lite and 10A/10B QA, 09/09B/09C/09D security negative matrices and PG17 synthetic dump/restore in ephemeral Docker with fake Stores only.
- This checkpoint. No new hosted adapter or actual provider Account/Bot credentials.

## 4. Gate matrix after source reconciliation
G0 independent merchant G2.3: BLOCKED until merchant Auth/Store/Provider native consent, active membership and PRIVATE signed record independently reviewed.
G0 Backup: BLOCKED until project-wide data controller plus independent security officer authorizes one-time STAGING export, private encrypted off-site vault and actual isolated restore rehearsal. Synthetic 09C pg_dump/restore does not count.
G1 Migration: NOT APPROVED; existing guarded SQL is REVIEW-ONLY and not executable migration. Requires explicit owner approval, verified backup/restore and precise backfill for each legacy Store.
G2 Hosted JWT/RLS: BLOCKED; Store schemas absent, no real A/B signed JWT proof or service_role limitation.
G3 Provider / Commerce: BLOCKED; native Messenger/Zalo ingress and replay, shared hosted Order/Products authoritative source, strict Order idempotency, owner notifications, human UAT.
Model 96+36: BLOCKED pending paid QA budget. Source-only 10B analyzer verifies dataset integrity + consumes later approved measurement receipts, but can't claim real 132-case accuracy or actual billed cost.
Release: NO-GO.

## 5. Acceptance checklist (not signed)
- [ ] Confirm PR #147 full CI at final SHA.
- [ ] Confirm copied 21 file blob SHAs match PR #135 sources (each path).
- [ ] Combined CI PASS on exact V15.0-11A HEAD, including node/per-Store/SQLite/PG17 recovery tests.
- [ ] Owner identifies merchant provider account, Store membership and consent independent private receipts.
- [ ] Project data controller and security reviewer authorize actual staging backup under encrypted custody, with real restore to approved isolated environment.
- [ ] Authorized staging Store migration and genuine JWT/authorization proof A/B/C.
- [ ] Real provider ingress/connectivity verified, no Order writer without independent security.
- [ ] Owner UAT and commercial pilot approval.
All unchecked real-world gates remain BLOCKED even when synthetic CI passes.

## 6. Safety, cost and rollback
No model calls, webhook sends, n8n Published edit, Supabase DDL/DML/RLS/GRANT/Auth/RPC, customer Orders/Stock, credential, Cloudflare deploy, billing change, live Messenger/Zalo or paid resources. Offline and ephemeral CI test costs are ordinary GitHub runner usage; no provider bill.
Rollback: Close Draft V15.0-11A PR or revert this child source-only branch; does not roll back hosted because nothing was changed. Future migration backup needs own signed rollback runbook.

NEXT: owner-approved private G2.3 and Free-tier recovery work + independently budgeted 132-case model QA in separate stages; then signed hosted JWT/RLS test on an approved isolated target. Do not publish until all independent evidence and checks are green.


## 7. Source checksum and integrated CI evidence, independently checked
- All 21 introduced file blob SHAs under 09B/09C/09D EXACTLY MATCH their corresponding paths from security PR #135 HEAD 6ef086202a524b0c595fda3f03ae89a10fe73676, verified via GitHub fetch_file SHA comparison in three batches. These are additive paths only; prior V15 Agent Core and Sales Lite files are not replaced.
- At source head 86c210b56de93d1469929570825dc29ff5b9e27a, unified GitHub Action #43799157082 SUCCESS. Exactly 345/345 combined offline tests PASS: six new release-gate tests, 294 other inherited Node tests, 45 SQLite tests. Synthetic PG17 pg_dump/restore, checksum, FORCE RLS and Store A/B negative read PASSED.
- Additional GitHub Actions at that source head also SUCCESS: 09B #43799157048, 09C #43799157118, 09D #43799157039, V15 Core #43799157149.
- These reflect SOURCE-ONLY/EPHEMERAL QA, not real Supabase JWT/RLS or real Owner/provider/backup certification. After THIS documentation-only commit, verify the newest exact HEAD CI before final TESTED claim.
