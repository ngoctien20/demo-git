# TIEN404 V13.5 — QA REPORT (2026-11-15 JST)

**Artifact status:** TESTED OFFLINE (not hosted Auth/RLS proof), source HEAD at test run `6d6a170d304b863e20d050b55372e2c966c48879`.

## Evidence
- New GitHub Actions [V13.5 run 43685461705](https://github.com/ngoctien20/demo-git/actions/runs/43685461705): **2/2 jobs SUCCESS**.
  - `v135-source-security`: **48/48 V13.5 scope/security**, **18/18 legacy Merchant/Auth**, **3/3 strict preview build**. **69/69 PASS**. Node 22.
  - `v135-mobile-browser`: Chromium simulated Supabase Auth and RLS-scoped Order response, **5/5 widths** (360, 390, 430, 768, 1280) PASS, no unexpected write requests. QA screenshot [artifact 14150715595](https://github.com/ngoctien20/demo-git/actions/runs/43685461705/artifacts/14150715595).
- Additional inherited jobs: [account boundary 43685461727](https://github.com/ngoctien20/demo-git/actions/runs/43685461727) **2/2 SUCCESS**; [Tester 43685461691](https://github.com/ngoctien20/demo-git/actions/runs/43685461691) **SUCCESS**; [navigation 43685461725](https://github.com/ngoctien20/demo-git/actions/runs/43685461725) **SUCCESS**.
- No tests connect to real Supabase using signed Shop A/B sessions; browser uses mocked user/tenant/one order only.

## Specific verified source contracts
1. Customer order query uses `orders` with only `id,tenant_id,status,total_vnd,created_at`, strict `eq('tenant_id',scope)`, descending created, **max 30 rows**, owner/manager UI role and server-RLS authoritative SELECT.
2. Rejects any cross-tenant readback, malformed id or dates, unsafe VND integer/rounded amount, API failures, staff role. Never substitutes mock data after live query failure.
3. Async UI refuses stale result display after logout, membership refresh or shop switch. No orders status changes, catalog edits, provider sends, subscription writes, or credential storage added.
4. Customer sees simple Overview / Orders / Profile / Plan / TIEN404 Billing / Support; no Bot Designer or technical Products/Customers editor.
5. Four-level role-port contract denies customer->staff/admin escalation, staff without assignment, cross-shop membership/assignment, admin->Platform Owner, owner action without reauth/MFA, missing/expired entitlement. All authorized decisions still `DRY_RUN_ONLY` with writesEnabled=false.
6. Prior PR #73 Account/Tester QA retained and rerun; no production merge/deploy.

## P0 blockers / known deviations
- **Hosted signed real Shop A/B Auth/RLS negative**: NOT_RUN, including session revocation and role transitions.
- **Secondary `account.html`**: still loads `assets/auth-account.js` with legacy CRM, orders, revenue, owner pairing and QA links. It was intentionally not rewritten without dependency audit; V13.5 has not yet achieved a single customer path in deployed Render.
- **Render deployed version**: unchanged from prior V12.5 staging; V13.5 new account-only code is PR-only, not yet hosted.
- **Subscription entitlement**: no live authoritative backend verified; `qa/v135/platform-role-contract.cjs` is a trust-boundary proposal, not live authorization.
- **Financial settlement**: order.status='paid' is shown as not reconciled. No paid revenue accepted without verified transaction source.
- **Privilege RPC**: public `qa_shop_b_zalo_claim` SECURITY DEFINER anon EXECUTE still P0; no exploit proven and no ACL edits.
- **Public auth QA**: PR #75 contains legacy `#saas-auth` fixtures conflicting with merged PR #74, remain Draft and must be reconciled.
- **Other agent Zalo QA**: PR #77 separate workflow route, not touched; no Zalo sends in this PR.
- **Mobile physical device / usability with real merchant data**: NOT_TESTED.

## Rollback/approval
Close or revert Draft PR #78; upstream #73, merged PR #74, Render services, Cloudflare production, Supabase, published n8n and Billing unaffected. Staff/Admin/Owner grants, SQL policy changes and customer Orders writes need explicit Owner approval before activation.

**Final release gate:** EXPERIMENTAL, not CANDIDATE/APPROVED/RELEASED.
