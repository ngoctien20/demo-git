# Nhật ký Work V9 · 11/11/2026 JST

Agent WORK. Checkpoint ban đầu ở docs/cto-coordination-v2 e9752ea, [PR #3](https://github.com/ngoctien20/demo-git/pull/3). SHA tài liệu cuối có trong lịch sử Git của thư mục này.

| PR / nhánh | Bắt đầu → phiên bản thực hiện | Tệp và mục đích |
|---|---|---|
| #1 ops/control-hub-audit-v2-20261110 | 385782a | Kiểm kê, không đổi checkbox. |
| #2 ops/super-admin-v4-staging-20261110 | b76d704 → 0534ed3 | core.py, gateway.py, server.py, UI và tests. Quota có chữ ký, retry an toàn, trang usage có phân trang và xóa dữ liệu sau logout. |
| #4 work/website-v4-1-simplify-navigation | 612f609 → 0f83a51 | Login/register preview, contact, trang nhà và CI. Sửa liên kết AI Lab và menu mobile. |
| #5 ops/tenant-data-platform-v1-staging-20261110 | f4b465f → 4ff447e → 3c29f70 | commerce_transactions.py, merchant_orders.py, main.py, commerce_http.py, workflow CI và live_auth_acceptance.py. Thêm lệnh đổi số lượng, xác nhận, hủy; QA trực tiếp PostgREST và logout cục bộ. |
| #6 ops/cto-autonomous-v5-20261110 | 0a65513 → 55f49af | qa/agent/evaluate.py, scenarios.json, recorded.json, test_evaluate.py, README và CI. |
| #7 work/supabase-auth-staging-v1 | d25d683 → e87bb82 → 1b4815e | assets/auth-account.js, merchant-lists.mjs, auth.css, build, static checks và auth_browser_smoke.py. Sửa assertion chọn nhầm cả option và tiêu đề shop. |
| #8 work/v9-tenant-agent-preview | f4b465f → b4fabcb | candidates/tenant_agent_configs.sql, qa/tenant_agents.sql, agent-assignment-qa.yml. Migration staging v9_tenant_agent_preview_readonly. |

Đối chiếu diff bằng đường dẫn commit trong [lịch sử repository](https://github.com/ngoctien20/demo-git/pulls). gh-pages tại 6bb57e6. Chi tiết môi trường và smoke nằm ở [QA](QA_EVIDENCE.md).
