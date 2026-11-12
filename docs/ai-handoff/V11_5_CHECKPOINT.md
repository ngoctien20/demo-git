# TIEN404 AI — V11.5 checkpoint 13/11/2026 (JST)

**Chế độ:** Audit First · Staging Only · Production unchanged · Paid pilot NOT READY.

## VERIFIED

- GitHub repo `ngoctien20/demo-git`: `main` là HTML mẫu; website thực tại `gh-pages`; V11 tài liệu/QA ở `work/v11-consolidated-staging`, baseline `8dc7de718d93b0ef60b64c8c510282ff128e4680`. Không sửa `main` hoặc `gh-pages`.
- Supabase `tien404-staging` (`ifxlvrhyjhbzbrkdsida`) ACTIVE_HEALTHY, có 9 bảng `public` bật RLS. Migration PT409 `20261111225128` hiện hữu.
- Supabase Security Advisor: `public.save_merchant_product` là `SECURITY DEFINER` callable by `authenticated` (cần review quyền); leaked-password protection disabled; 8 bảng private no RLS policy (có thể cố ý fail-closed). Không sửa quyền.
- Cloudflare: một account kết nối; Pages `tien404-ai-git-staging`, `tien404-ai-staging`. Không deploy.
- Render: thấy workspace `My Workspace` qua list, chưa chọn/điều khiển vì cần người dùng xác nhận đúng workspace.
- n8n V4.5 gửi Telegram/Gmail QA và đối soát như `V11_5_NOTIFICATION_QA_REPORT.md`. Các published Messenger/AI SALES vẫn cần kiểm version mỗi lần tiếp tục.
- Zalo docs chính thức và giá OA có hiệu lực 01/06/2026 xác nhận OA/App policy & phí; OA test yêu cầu OA chính thức đã xác thực. Chưa có OAuth/credential Zalo.

## IMPLEMENTED

- Nhánh: `work/v11-5-zalo-first-notifications-20261113` từ `work/v11-consolidated-staging`; chỉ code/docs/QA mới.
- `qa/lab/notification_v5_contract.cjs`: preview order event verified, merchant/tenant owner, Zalo-first optional, Gmail/Telegram/Meta policy, `single/parallel/fallback`, unknown timeout fail closed, no sends.
- `qa/lab/test_notification_v5.cjs` và isolated CI workflow. Zalo ADR và review-only private PostgreSQL outbox candidate.
- n8n `TIEN404_V11_5_ZALO_POLICY_QA_STAGING` workflow `hkZzAmv86NoiTFHh`, manual trigger, 3 Code nodes, no credentials, inactive.

## TESTED

- GitHub Actions run `43319210988` SUCCESS (module syntax + 28 policy regressions).
- n8n execution `2693` SUCCESS, 27/27 synthetic Zalo policy cases. Không có tin Zalo nào được gửi.
- V4.5 evidence Telegram/Gmail vẫn tham chiếu, không gửi lại nhằm tránh duplicate.

## BLOCKED / NEXT

1. **P0 Auth A/B signed hosted sessions** chưa có QA secret và user sessions cho runner. Giữ merchant editor tắt.
2. **P0** SQL transactional outbox vẫn chỉ là candidate, chưa triển khai staging; cần migration review, test concurrent và tenant isolation.
3. **P0** full post-save event integration không có: không nối trực tiếp AI_SALES_DEMO Orders với Commerce.
4. **P1 Zalo OA live** thiếu OA đã xác thực, App/OAuth, permission, template, consent, ngân sách; cần chủ dự án duyệt mọi khoản phí.
5. **P1** Notification UI authenticated chưa triển khai; dashboard inbox còn là hợp đồng kiến trúc, không có backend.
6. **P1** Render workspace xác nhận, hosted Super Admin, restore rehearsal và lộ trình 1→3→5 shops.
7. **P1 Legal** phân loại SaaS và nghĩa vụ đăng ký, thuế, bảo vệ dữ liệu, pháp lý hoạt động từ Nhật; chưa thu phí.

## Rollback & approval

Revert nhánh/PR mới là rollback cho code. Workflow `hkZzAmv86NoiTFHh` giữ inactive; không cần rollback production. Mọi API gửi thật/DB migration/publish/cost/credential/billing cần owner approval. Không tuyên bố LIVE.
