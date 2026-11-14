# TIEN404 AI V12.2 — Guided Tester QA continuation
Date: 2026-11-14 JST
Scope: staging-only code on `work/v12-2-tester-guides-qa-20261114`
Parent: `work/supabase-auth-staging-v1` (Render Auth staging autoDeploy=off)
Lifecycle: CANDIDATE; no merge or redeploy by this change.

## Audit (live connectors)
- GitHub: existing `tester.html`, `tester-admin.html`, Auth PKCE, strict Render allowlist; no need to rebuild.
- Supabase staging `ifxlvrhyjhbzbrkdsida`: 7 tester tables have RLS. DB readback at start: staff=0, access=0, assignments=0, runs=0.
- Module readiness: sheets=READY (synthetic examples only), Messenger/Telegram/AI SALES/Commerce=PENDING, Zalo=BLOCKED. Five starter cases exist; not 96 QA cases.
- Render static service `srv-dbpj4irm8hqs73e2h2rg` has live deployment `dep-dbs448ui0phs73c2ikg0`, branch `work/supabase-auth-staging-v1`, autoDeploy OFF.
- No E2E signed-in tester or admin identity has been approved. Do NOT bootstrap from merchant ownership.
- No production Messenger/n8n/Zalo/Telegram activity introduced.

## Implemented
- `assets/tester-guides.mjs`: six Vietnamese channel playbooks with preparation, step-by-step checklist, and blocked guidance.
- `assets/tester-portal.js`: guided steps rendered **only after existing Supabase user/ACL checks and RLS-filtered module assignment**. Local checkbox completion never claims automated PASS.
- `assets/tester-portal.css`: responsive, accessible guided checklist.
- `scripts/build-auth-preview.mjs`: include only new safe public JS guide in strict preview artifact.
- `tests/tester-portal-staging.test.mjs`: verify guide coverage, import, and absence of credential/webhook patterns.
- `qa/tester_portal/QA_CASE_IMPORT_REVIEW_20261114.md`: map uploaded 96/36 fixture sources, no unsafe import.

## Safety & Rollback
- No database migration or permission change; no messages/orders sent.
- No production/public website writes.
- Rollback: decline/close the PR, or revert the guide-only commit(s) before manually redeploying staging.
- Existing Merchant Portal, Supabase Auth, Shop A/B, Zalo pairing, n8n and Commerce unchanged.

## Open gates
1. Approved owner Supabase Auth account + explicit bootstrap of tester Super Admin role by server-side administrator; account identity needs owner review.
2. Separate tester account, grant + revoke + expiry + unauthorized cross-module authenticated browser tests.
3. Verify each real Page/OA/Chat ID and permissions before opening a channel link.
4. Email invite (trusted backend) and private screenshot storage (RLS/PII review) remain blocked.
5. Full QA fixture import not yet allowed to self-test real writes; no fabricated PASS.
6. Render staging deployment only after PR QA + reviewer approval; do not merge to gh-pages/main.

## Reporting
VERIFIED: existing staging foundations, module readiness, access rows, live Render release metadata.
IMPLEMENTED: six accessible, static guide playbooks and UI, no backend changes.
TESTED: source review; GitHub CI status must be checked separately.
BLOCKED: live tester/grant E2E, provider links, upload, invitations.
