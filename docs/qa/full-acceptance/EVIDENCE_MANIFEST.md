# EVIDENCE_MANIFEST — V21.0 Round 1–2

Mọi bằng chứng là đọc-chỉ hoặc offline. Dữ liệu cá nhân, token và địa chỉ email đã được loại bỏ. Thời gian UTC 2026-11-21.

| ID | Nguồn | Nội dung | Cách tái lập |
|---|---|---|---|
| E-01 | `develop` `00aff9b` | `assets/saas.js` dùng sessionStorage, không `fetch(`; trang SaaS ghi "mô phỏng" | `tests/test_saas_contract.py::test_assets_and_copy` |
| E-02 | Container | static 26 trang/795 link 0 lỗi; nav 24 trang PASS; pytest 11/13 | `python qa_static.py`; `node scripts/check-site-navigation.mjs`; `pytest tests` |
| E-03 | `login.html` | meta refresh sang Render `tien404-auth-staging` | đọc file |
| E-04 | Container | 39 file test QA, 631 PASS / 3 FAIL (browser cần server) — bảng dưới | `node --test <file>` |
| E-05 | GitHub REST | repo public; `branches/main|develop/protection` 404; Dependabot 403 disabled; 46 check trên `00aff9b`; 37 workflow, 0 `secrets.*` | `gh api` |
| E-06 | Supabase SELECT | tester_cases 137, runs 2, modules 6, staff 1 | SQL đếm |
| E-07 | `checkpoint/render-auth-staging-pre-v12-2-admin-csv-20261114` `6324b778` | test auth/merchant/tester 35/38 | `node --test tests/*.test.mjs` |
| E-08 | Git + Drive | Không có file `AI_SALES_QA_*` / `*_SINGLE_TURN*` / `*_MULTI_TURN*` trong 502 nhánh; Drive chỉ có Sheet `AI_SALES_DEMO` | `git log --all --name-only | grep -i AI_SALES` |
| E-10 | Supabase SELECT | 21 migration (max `20261117074559`); 46 bảng; 0 `store_id`; số dòng Commerce; không bảng billing/outbox ở public | SQL catalog |
| E-11 | Supabase advisors + ACL | ACL 4 hàm SECDEF; advisor anon/authenticated SECDEF, leaked password | `get_advisors security` |
| E-12 | Supabase grants | authenticated chỉ SELECT trên bảng Commerce | `information_schema.role_table_grants` |
| E-13 | n8n `KrSn4DNR9ALX5ng4` | Create Order: đọc Sheet, kiểm giá/tồn, chặn trùng 30 phút theo SĐT+SKU+SL, append Sheet, "tồn kho chưa bị trừ" | `get_workflow_details` |
| E-14 | `qa/v21-full-acceptance/n8n-published-drift.test.mjs` | 8/8 PASS, chứng minh khác biệt Published/Draft | `node --test` |
| E-15 | n8n execution 4498 (`Z7Fd`, 2026-11-17 04:30) | create_order trả `created`; node Verify Send có Meta message_id | `get_workflow_execution` (không trích PII) |
| E-16 | n8n search | 174 workflow, 23 active — bảng dưới | `search_workflows` |
| E-17 | n8n details | versionId ≠ activeVersionId: KrSn (af9ee686/4740251a), fDB9 (2e8786fd/137d5689), BkAi (3bd7043f/93cf227a), U2DJ (e4e16b90/978b5a8d), iyfG (c96422e0/456862c9) | `get_workflow_details detailLevel=execution` |
| E-18 | n8n details | Ghi chú "DISABLED" trên node có `disabled:false`; mô tả inactive/no outbound của yIJk, OgDZ, wgkk, iyfG | JSON workflow |
| E-19 | n8n exec 4498 runtimeData | `redaction.production=false`; dữ liệu khách lưu nguyên | không trích |
| E-20 | Container curl | onrender.com, pages.dev, workers.dev, github.io, supabase.co → mã 000 (proxy) | `curl -w '%{http_code}'` |
| E-22 | `ops/super-admin-v4-staging-20261110` | Super Admin 68/68, Control Hub 14/14; `/health` khai báo `local_sqlite_test_backend`, `live_n8n: DISCONNECTED` | `pytest -q tests` |
| E-23 | n8n version diff | fDB9 137d5689→2e8786fd; BkAi 93cf227a→3bd7043f; iyfG 456862c9→c96422e0 | `get_workflow_versions_diff` |
| E-24 | Clone mirror 503 nhánh | Quét secret toàn lịch sử, không có secret thật | `git rev-list --all \| xargs git grep -E <mẫu>` |
| E-25 | Nhánh `claude/project-thread-geyx0t` | Commit `f0df0903` in lỗi `psql` thô; `91ee3449` sửa | `git show` |
| E-21 | Reviewer độc lập (subagent read-only) | Xác nhận/phản biện 6 nhận định, thêm S-08, S-09, S-14, S-16 | Báo cáo tóm tắt trong `SECURITY_FINDINGS.md` |

## E-04 — Kết quả từng file test QA trên `develop`

| File | Kết quả |
|---|---|
| `qa/auth/public-login-redirect.test.cjs` | pass 8 fail 0  |
| `qa/channel-v143/browser.test.cjs` | pass 0 fail 1  |
| `qa/channel-v143/channel-core.test.cjs` | pass 36 fail 0  |
| `qa/channel-v144/secure-widget-preview.test.cjs` | pass 37 fail 0  |
| `qa/channel-v185/browser.test.cjs` | pass 0 fail 1  |
| `qa/channel-v185/shared-core-bridge.test.cjs` | pass 14 fail 0  |
| `qa/channel-v1851/protected-http-gateway.test.cjs` | pass 27 fail 0  |
| `qa/channel-v1852/published-core-readonly-admission.test.cjs` | pass 28 fail 0  |
| `qa/channel-v1853/access-jwt-verifier.test.cjs` | pass 22 fail 0  |
| `qa/channel-v1854/cloudflare-access-context-gate.test.mjs` | pass 13 fail 0  |
| `qa/channel-v1855/n8n/ingress-contract-offline.test.cjs` | pass 9 fail 0  |
| `qa/channel-v1855/read-admission-policy.test.mjs` | pass 14 fail 0  |
| `qa/channel-v1855/t404-read-admission-do.test.mjs` | pass 9 fail 0  |
| `qa/channel-v1855/worker-v1855-readonly-adapter.test.mjs` | pass 18 fail 0  |
| `qa/channel-v1981/authority-policy.test.mjs` | pass 1 fail 0  |
| `qa/channel-v19810/mock-ingress-catalog-policy.test.mjs` | pass 1 fail 0  |
| `qa/channel-v19811/protected-no-send-admission.test.mjs` | pass 1 fail 0  |
| `qa/channel-v19811/zalo-official-readonly-verifier.test.mjs` | pass 1 fail 0  |
| `qa/channel-v19812/local-no-send-canary.test.mjs` | pass 1 fail 0  |
| `qa/channel-v19814/hosted-admission.test.mjs` | pass 23 fail 0  |
| `qa/channel-v19816/hosted-readiness.test.mjs` | pass 23 fail 0  |
| `qa/channel-v19819/hosted-evidence-preflight.test.mjs` | pass 30 fail 0  |
| `qa/channel-v1982/admission-gate.test.mjs` | pass 1 fail 0  |
| `qa/channel-v1984/catalog-preview-contract.test.mjs` | pass 1 fail 0  |
| `qa/channel-v1985/protected-catalog-compat.test.mjs` | pass 1 fail 0  |
| `qa/channel-v1986/installation-authority.test.mjs` | pass 1 fail 0  |
| `qa/channel-v1987/hosted-uat-admission-gate.test.mjs` | pass 1 fail 0  |
| `qa/channel-v1988/owner-ab-real-auth-readonly-uat.test.mjs` | pass 1 fail 0  |
| `qa/channel-v1989/local-real-auth-uat.test.mjs` | pass 1 fail 0  |
| `qa/messenger-rich-v136m/adapter.test.cjs` | pass 53 fail 0  |
| `qa/messenger-rich-v136m/preview.test.cjs` | pass 0 fail 1  |
| `qa/messenger-rich-v136m1/integration.test.cjs` | pass 41 fail 0  |
| `qa/messenger-rich-v136m2/trusted-repository.test.cjs` | pass 48 fail 0  |
| `qa/messenger-rich-v136m2/trusted-resolver.test.cjs` | pass 22 fail 0  |
| `qa/messenger-rich-v136m3/canonical-pipeline.test.cjs` | pass 25 fail 0  |
| `qa/messenger-rich-v136m4/event-isolation.test.cjs` | pass 22 fail 0  |
| `qa/messenger-rich-v136m5/private-event-store.test.cjs` | pass 33 fail 0  |
| `qa/v201-p0-s1/qr-admission-offline.test.mjs` | pass 33 fail 0  |
| `qa/v201-p0-s2/evidence-review.test.mjs` | pass 31 fail 0  |

## E-16 — 23 workflow active (id, tên, số trigger)

| ID | Tên | Trigger |
|---|---|---|
| `jy7vCmt8LH6BSqGh` | TIEN404_ZALO_V19_7I_PROTECTED_WEBHOOK_STAGING_RECEIPT_ONLY_NO_SEND | 1 |
| `iyfGUiEsZlNTBWOR` | TIEN404_COMMERCE_AI_AGENT_SANDBOX | 0 |
| `yIJk8LvJoLF40Z62` | TIEN404_ZALO_BOT_LAB_V1_STAGING | 1 |
| `Z7FdV7uDvApfbURQ` | TIEN404_MESSENGER_TEST | 2 |
| `wgkkmT7q4lm4HyuA` | TIEN404 WEBSITE — DEMO & MARKETING AI (QA ISOLATED) | 1 |
| `4ycmVzaNzVRulBjQ` | TIEN404_V1715_ZALO_WEBSITE_SHARED_CORE_SHADOW_NO_SEND | 0 |
| `dw1JOxWOEY8csTnm` | TIEN404_V1713_SIGNED_MESSENGER_TO_CENTRAL_CORE_SHADOW_NO_SEND | 0 |
| `sIPs6egzIwOY1GNv` | TIEN404_ZALO_V123_PRIVATE_CUSTOMER_ROUTER_STAGING | 0 |
| `OgDZNSAvKEvhnAvn` | TIEN404_ZALO_V2_SHADOW_STAGING | 0 |
| `VBEns4KfWEz9AFgM` | TIEN404_COMMERCE_V3_RULES_EXTENSION_LAB | 0 |
| `Y0WLykMtNAldbgL0` | TIEN404_COMMERCE_V3_BUSINESS_CORE_SANDBOX | 0 |
| `fDB9dvs1qPPVt9Sp` | AI SALES - Manage Order | 0 |
| `KrSn4DNR9ALX5ng4` | Create Order Tool (AI_SALES_DEMO) | 0 |
| `splyaeQtV719OuAu` | TIEN404_COMMERCE_SHOP_ONBOARDING | 0 |
| `jirkuVts1AjIhnPJ` | TIEN404_COMMERCE_SUPPORT_TICKETS_QA | 0 |
| `igPOsSbEgd4NgtRA` | TIEN404_COMMERCE_CART_PREVIEW | 0 |
| `oOOXicKXGkBskKqh` | TIEN404_COMMERCE_CATALOG_QUERY | 0 |
| `5Eeh8hbpsoNhuiVo` | TIEN404_COMMERCE_TENANT_RESOLVER | 0 |
| `v6PBwcqSapVzACMW` | AI_SALES_DEMO - Main Agent | 1 |
| `KqSuGxCHixc6fsiu` | TIEN404_MESSENGER_SUPPORT_REQUESTS | 0 |
| `4DFFCk60exrzaIl6` | TIEN404_MESSENGER_ORDER_STATUS | 0 |
| `U2DJsxzSYPH5hRop` | AI SALES - Revenue Report | 1 |
| `BkAi6TVUKAjCnI7v` | AI SALES - Update Order. | 0 |
