# Thay đổi và ownership

| Owner | Thay đổi có thể kiểm tra | Trạng thái |
|---|---|---|
| Auth | #17 b4763a1 gắn sự kiện khôi phục PKCE với user hiện tại, hủy biểu mẫu khi đổi danh tính | Deployed staging qua #18 |
| Merchant | #16 593db7c xuất CSV UTF-8 cho kỳ 7/30 ngày từ báo cáo theo cửa hàng. Khóa tải khi lỗi, rỗng hoặc dữ liệu sai tenant | Deployed staging, cần phiên thật để nghiệm thu dữ liệu |
| Web | #19 61cf82f tải widget khi cần, mở được fallback khi SDK lỗi, trả focus sau Escape | Cloudflare preview |
| Super Admin | #15 10dd3b6 loại giá trị đầu vào như mật khẩu và mã MFA ra khỏi phản hồi 422 | Tested, chưa host |
| AI Lab | #13 56e1f39 kiểm SKU, bằng chứng tồn kho, cả lượng âm, và xử lý tool trace thiếu trường | Tested trên fixture và trace lưu |
| DevOps | #14 d5df816 kiểm SHA-256 từng asset Render, kiểm anonymous Chromium trước/sau refresh. Nhánh qa/v11-widget-deployment kiểm preview Cloudflare | Xem QA |


## 12/11/2026 — P0 Commerce conflict hotfix

- Extended Work #22 without overwriting its branch: [Draft PR #26](https://github.com/ngoctien20/demo-git/pull/26), branch `fix/v11-merchant-stale-conflict-pt409-20261112`, base `work/v11-commerce-limits`; commit `a4b73126c39112e6bce28307874c514de74acdc1`.
- Changed `ops/data-platform/candidates/merchant_product_qa_allowlist_v10.sql` and legacy candidate to return terminal `PT409` on stale optimistic lock instead of retryable `40001`. Updated disposable SQL QA, synthetic signed JWT/PostgREST HTTP QA, and added static regression tests.
- Exact reviewed QA-only function was applied to Supabase staging as a new migration, retaining 2 tenant UUID+slug allowlists and grants. No Render API deployment / merchant editor activation.
- Added a separate read-only public HTTP monitoring workflow/script on **docs-only branch** `docs/v11-continuation-verification-20261112`: Cloudflare/GitHub Pages/Render Auth/Render Data health and anonymous/forged bearer 401 checks, no credentials and no business writes. CI run result must be read before marking this monitoring test PASS.
