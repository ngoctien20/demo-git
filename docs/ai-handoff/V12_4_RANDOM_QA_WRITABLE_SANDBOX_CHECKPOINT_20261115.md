# TIEN404 AI V12.4 — Random QA + Writable Tester Sandbox (STAGING CHECKPOINT)

Date: 2026-11-15 Asia/Tokyo
Scope: TIEN404 AI staging only. Runtime source: GitHub `work/supabase-auth-staging-v1`, Render `tien404-auth-staging`, Supabase `tien404-staging`, n8n separate QA candidate. No production actions.

## Status

- **VERIFIED** Actual AI SALES QA training draft `3MzEyZgbwkRmO4NI` is inactive but still wired to DEMO create/edit order tools. Main AI SALES and Messenger Published have live DEMO writing tools. No changes made to any of them.
- **IMPLEMENTED** Independent Google Sheet `TIEN404_QA_MODEL_SANDBOX_V12_4_PRODUCTS_ORDERS` (id `1br6KbSwpddPBhLt7AyPW2vTedanXJpgOHG6cR_axETg`) with 21 Products snapshot rows, Orders_QA empty, README_QA. This is not the original `AI_SALES_DEMO` spreadsheet `1flbUFHb6ybJVLnnXTf3FQD70YNtd6MneL_xVpPYsscE`.
- **IMPLEMENTED** Two separate Supabase QA-only tables: `public.tien404_qa_sandbox_products` and `public.tien404_qa_sandbox_orders`, migration `tien404_v12_4_isolated_tester_sandbox`. Per-owner RLS, 6 policies, anon denied, DELETE denied, 100 products/orders per account, price, stock-reservation validation and cancellation release. No real Orders/Products tables referenced.
- **IMPLEMENTED** `96` distinct sanitized single-turn question cases from verified n8n data table `AI_SALES_QA_CASES` `oFGBSdR7zIMOVXOL`. Questions categorized as catalog (24), consultation (12), language (12), order create (12), order edit (12), security (12), policy (12); no previous `actual_output` or customer contact information copied into public app.
- **IMPLEMENTED** Tester Portal adds isolated Supabase QA Products/Orders editor (seed 21, create/edit product, create/edit QA orders) plus random question dropdown and copy. UI explicitly warns that edits on personal Supabase QA sandbox DO NOT synchronize to n8n QA candidate's independent Google Sheet. Random question button DOES NOT invoke LLM.
- **IMPLEMENTED/CANDIDATE** New private n8n workflow `8HtaQAJuZWKyNhXu`: `TIEN404_AI_SALES_QA_SANDBOX_V12_4_CANDIDATE`, 7 nodes, gpt-5-mini, 4 Google Sheets tools pointing only to independent QA sheet, private chat trigger. Folder `90_QA - DIAGNOSTICS`; `active=false`, no execution or model credit spend. SDK source: `qa/n8n/AI_SALES_QA_SANDBOX_V12_4_CANDIDATE.sdk.ts`.
- **BLOCKED** Exposing n8n model to external tester web UI: no audited authenticated JWT gateway, rate limit/cost budget, mapping per-tester data to model, transactional order-write gate. Do not publish candidate, reuse DEMO write tools, or claim end-to-end model QA verified.

## Deployment and QA

- Feature PR #53 merged source commit `8c157e79000ee280b1af071e03d2a90146effef2`.
- Render deploy `dep-dbs8r649v7es73c1klr0` LIVE on `https://tien404-auth-staging.onrender.com/tester.html`.
- Feature CI `43616240092` SUCCESS.
- Post-deploy QA-only PR #54 merged commit `ecbdee7db0b58560b2f69dbdf59ae167b6d41880`; GitHub Actions `43616663827` SUCCESS:
  - 51 unit/source/security tests PASS and 24 strict preview build tests PASS.
  - Chromium Auth stub checks tester scenarios, CRUD sandbox, 96-case prompts, account tab-stability, anonymous fail closed. These are NOT equivalent to a real signed-in UAT or a live AI execution.
  - 20 hosted HTTP routes/assets 200, including three new QA modules; 6 private sources 404 including isolated QA RLS SQL.
- Supabase write QA in a single `BEGIN ... ROLLBACK` transaction: approved tester creates QA product, creates order, overstock rejected, stock lowered below reservation rejected, cancel order and lower stock succeeds; all rolled back. Unapproved synthetic UID reads zero. Persisted after QA: **0 QA products and 0 QA orders**. RLS policies: 6; existing 1 approved tester with active Sheets module assignment. No real customer data created.
- New DB tables did not appear in Supabase Security Advisor alerts. Legacy unrelated warnings remain; not claiming full platform security completeness.
- n8n QA CANDIDATE validated by SDK, node readback reveals all 4 sheet tool doc IDs are QA sheet; remains Inactive; actual chat/model behavior and costs not yet tested.
- Google QA sheet readback: 21 Products, Orders_QA header only, no customer data.

## Operational Manual Acceptance

1. Sign in at https://tien404-auth-staging.onrender.com/login.html with already-approved Tester Auth.
2. Open https://tien404-auth-staging.onrender.com/tester.html. Find `V12.4 DỮ LIỆU QA RIÊNG` and `Lấy câu hỏi ngẫu nhiên`.
3. Click `Nạp 21 sản phẩm mẫu`, then create/update one QA product and one QA order; verify stock and price rejection on QA-only tables, not real DEMO.
4. Click `Lấy câu hỏi ngẫu nhiên` by category, copy into external AI for critique. This does not run n8n QA candidate directly yet.
5. Admin readback / revoke permissions; verify other tester cannot read/write this user's QA rows.
6. Before enabling direct model tests: separately approve model cost cap, signed gateway, quota, and tool-level hard isolation; then independent QA tests are required, including real Google Sheet tool write and rollback strategy.

## Safety and Rollback

- Source rollback branch: `checkpoint/v12-4-before-qa-sandbox-writes-20261115`. Previous successful Render app deployment `dep-dbs82b6c6qcc738eseh0` and staging commit `9790d20e003d6f72272282405a4bbb75e8be4dc2`.
- No modification to production `gh-pages`, active n8n Published workflows or customer Orders.
- Supabase QA table migration is additive; removing QA data or schema requires separate approval after inventory/row backup.
- New QA Google Sheet remains private; do not share publicly.
- No automatic LLM/model calls or notifications were dispatched. 
