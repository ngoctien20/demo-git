# TIEN404 AI — AUTONOMOUS CTO V13.5 CHECKPOINT

**Date:** 2026-11-15 JST  
**Stage:** EXPERIMENTAL / STAGING SOURCE ONLY — **NOT RELEASED**  
**PR:** [#78 V13.5 Lean Customer Orders and Roles](https://github.com/ngoctien20/demo-git/pull/78), DRAFT stacked on [#73](https://github.com/ngoctien20/demo-git/pull/73).  
**Parent snapshot:** PR #73 HEAD `c68743bfa54848c43b77be4ff26890b83e790869`.  
**Tested source commit before documentation-only commits:** `6d6a170d304b863e20d050b55372e2c966c48879`.  
**Latest deployed public site:** gh-pages `ff2daf970e8209399a28b2d0cade8a33b9fa71c6` after merged PR #74; V13.5 has not changed it.

## 1. VERIFIED inventory / baseline
- PRs #66, #67–#73, #75–#77 currently separate Drafts at initial audit; #74 merged and must **not** restore email-any login.
- Render workspace My Workspace: Auth `tien404-auth-staging` deployment `b14501a0` live; Data `tien404-data-staging` `ab940a95` live. Neither was redeployed in this task.
- Cloudflare Pages `tien404-ai-git-staging`: production gh-pages; Preview CUSTOM v133 only, Access protected preview wildcard. The V13.5 branch has no verified hosted Preview.
- Supabase `tien404-staging` ACTIVE_HEALTHY, RLS enabled on tenants/memberships/orders/customers/products. Current metadata: tenants 2, memberships 3, orders 2, customers 0; no commercial subscription/staff role authority confirmed in inspected schemas.
- Security Advisor `anon_security_definer_function_executable` remains WARN for `public.qa_shop_b_zalo_claim`; no ACL/SQL changes.
- n8n inventory 82 workflows: 19 active and 63 inactive; no workflow archived, unpublished or modified.
- AI Studio FUTURE — PRESERVED. Tester QA is separate from commercial Staff Console.

## 2. IMPLEMENTED — new branch only
- `assets/merchant-order-readonly.mjs`: strict owner/manager read from Supabase orders by verified selected tenant, RLS, tenant readback, bounded 30 rows, exact VND, no PII; status paid does not prove funds settled.
- `assets/merchant-account-only.js`, `merchant-portal.html`: PR #73 simple account extended with an **Orders** tab, status and total read only; pending write buttons disabled; prevent cross-shop stale async renders.
- `scripts/build-auth-preview.mjs`: allowlist new customer order helper, not public credentials.
- `qa/v135/platform-role-contract.cjs`: 4-level DRY_RUN-only backend-port authorization matrix, scope and Owner MFA / Staff assignment checks; **no live role grants**.
- New source/negative QA, Chromium 5 viewports and isolated workflow `.github/workflows/v135-lean-roles-orders-qa.yml`.
- The requested eight documentation artifacts: [Product Scope](V13_5_PRODUCT_SCOPE.md), [Role Matrix](V13_5_ROLE_PERMISSION_MATRIX.md), [System Inventory](V13_5_SYSTEM_INVENTORY.md), [Cleanup Register](V13_5_CLEANUP_REGISTER.md), [Active Development](V13_5_ACTIVE_DEVELOPMENT_REGISTER.md), [Architecture Map](V13_5_ARCHITECTURE_MAP.md), [QA Report](V13_5_QA_REPORT.md) and this checkpoint.

## 3. TESTED
- [GitHub Actions 43685461705](https://github.com/ngoctien20/demo-git/actions/runs/43685461705): 69/69 contracts/source/build and 5/5 simulated Chromium viewport runs (360–1280 px), zero mutation requests, **2/2 jobs SUCCESS**.
- [Inherited PR #73 Account QA 43685461727](https://github.com/ngoctien20/demo-git/actions/runs/43685461727): source and browser SUCCESS.
- [Tester QA 43685461691](https://github.com/ngoctien20/demo-git/actions/runs/43685461691) and [Navigation 43685461725](https://github.com/ngoctien20/demo-git/actions/runs/43685461725) SUCCESS.
- QA passed **offline and simulated Auth**, not hosted signed-session Shop A/B. Final documentation-only commit may trigger rechecks; report newest CI independently before claiming final HEAD all green.

## 4. BLOCKED / approval
1. Real hosted JWT Shop A/B owner/manager/staff, cross-shop and revoked membership negative QA. No credentials collected or changed.
2. Alternate `account.html` still renders legacy CRM/Bot interfaces; audit all links/Tester usages before retiring this route or changing Render deployment.
3. A real platform roles/staff assignment/subscription backend must be designed with independent policy/transaction/audit approval; tester staff is not production TIEN404 Staff.
4. Order transition writes, payment confirmation, notification outbox and billing integration require separate approval and business QA.
5. Privileged RPC `qa_shop_b_zalo_claim` anon EXECUTE security audit; inventory callers and prepare rollback before any revoke.
6. PR #75 obsoleted login tests; update QA without re-enabling demo login.
7. Zalo PR #77 separate bounded QA track; no credential/Worker route/publish/send change in PR #78.

## 5. Scope, release gate and rollback
- GitHub source-only Draft PR; no production `gh-pages` merge, Render deployment, Cloudflare Access/Worker change, Supabase SQL/data mutation, published n8n workflow update, real order/payment, Zalo/Messenger send or paid service.
- Rollback: close PR #78; source branch remains for audit, upstream #73 and production unchanged. No database restore required.
- Promotion flow: **EXPERIMENTAL -> CANDIDATE -> APPROVED -> RELEASED**, only with complete hosted security and Owner approval.

## 6. Next recommended CTO checkpoint
**V13.5R.1 — Hosted Auth/RLS Shop A/B and Account route consolidation.** Obtain authorized QA session evidence from existing Render Auth without exposing credentials; verify RLS and session revocation, compare old `account.html` dependencies, propose safe route migration. After that, implement real Staff/Admin backend roles (independent from merchant memberships), and only then enable more operations.

**Source of truth:** User's V13.5 Revised request, PR #78, linked docs and GitHub Actions. Do not regress to the older PR #72 generic Merchant Portal or turn AI Studio back on.
