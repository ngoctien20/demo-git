# Báo cáo hoàn thành V7.1

**11/11/2026 JST · Pilot NOT READY.** Đơn vị đếm là 20 gói nghiệm thu trong bảng. Tác vụ đóng theo phạm vi kỹ thuật ghi rõ. Ba mục BLOCKED nằm trong 12 mục còn mở. Bốn checkbox của chủ dự án được đếm riêng.

| VERIFIED_DONE | IMPLEMENTED_NOT_VERIFIED | IN_PROGRESS | BLOCKED | NOT_STARTED | DEFERRED |
|---:|---:|---:|---:|---:|---:|
| 8 | 3 | 4 | 3 | 1 | 1 |

| # | Trạng thái | Nhiệm vụ | Bằng chứng và phần còn thiếu | Nguồn |
|---|---|---|---|---|
| 1 | VERIFIED_DONE | Kiểm kê Published của 7 workflow | 7/7 có activeVersionId, lưu đầy đủ cả hai version. Phát hiện 4 lệch. | [Đối chiếu](TIEN404_AI_WORK_MASTER_V7_1_CHECKPOINT.md) |
| 2 | VERIFIED_DONE | Phân tích bốn chênh lệch | Đã xác định 5 node thay đổi và chạy fixture trên hai bản, có ca phân biệt ở cả bốn workflow. | [Đối chiếu](TIEN404_AI_V7_1_QA_EVIDENCE.md) |
| 3 | VERIFIED_DONE | Chạy hồi quy Commerce chỉ đọc | 64/64 tại execution 1644–1646, có assertion. | [Đối chiếu](TIEN404_AI_V7_1_QA_EVIDENCE.md) |
| 4 | VERIFIED_DONE | Sửa chờ vô hạn khi module account bị chặn | PR #7 có test Chromium lỗi tải module; Render phục vụ bản mới, account ẩn danh khóa và login trở về sẵn sàng. | [Đối chiếu](https://github.com/ngoctien20/demo-git/pull/7) |
| 5 | VERIFIED_DONE | Kiểm RLS ở DB cho chiều A → B và subject không membership | Cả hai tenant có fixture. Kiểm authenticated role trong transaction read-only, kết quả A/B 1/0, không membership 0. | [Đối chiếu](TIEN404_AI_V7_1_QA_EVIDENCE.md) |
| 6 | VERIFIED_DONE | Sửa cổng nghiệm thu fixture rỗng | Ba regression CI đạt. Công cụ chạy tại môi trường QA, có chế độ một shop; không thay binary backend. | [Đối chiếu](https://github.com/ngoctien20/demo-git/pull/5) |
| 7 | VERIFIED_DONE | Sửa lỗi static QA của preview website | PR #4 trước sửa 1 lỗi meta; sau sửa 27 trang/873 tham chiếu không lỗi. Phạm vi trang preview trên nhánh. | [Đối chiếu](https://github.com/ngoctien20/demo-git/pull/4) |
| 8 | VERIFIED_DONE | Phân loại bề mặt demo và dữ liệu thật | Đã đối chiếu trang đăng nhập Pages, source mô phỏng, Auth Render, đường PostgREST và API protected; lập bảng ở checklist. | [Đối chiếu](TIEN404_CONTROL_HUB_MANUAL_CHECKLIST.md) |
| 9 | IMPLEMENTED_NOT_VERIFIED | Merchant Dashboard Products | Đã code và có Chromium fixture. Cần xem sản phẩm bằng session Shop A trên bản hiện tại và kiểm sau refresh. | [Đối chiếu](https://github.com/ngoctien20/demo-git/pull/7) |
| 10 | IMPLEMENTED_NOT_VERIFIED | Phục hồi mật khẩu | Có code PKCE; preview tắt nút. Chưa đọc được allowlist quản trị và chưa có E2E callback/email. | [Đối chiếu](https://github.com/ngoctien20/demo-git/pull/7) |
| 11 | IMPLEMENTED_NOT_VERIFIED | Super Admin, gói dịch vụ và audit nhiều hệ thống | MFA/RBAC, entitlement staging và adapter có code/CI. Thiếu chứng minh danh tính quản trị xuyên Hub/API, usage và audit pilot. | [Đối chiếu](https://github.com/ngoctien20/demo-git/pull/2) |
| 12 | IN_PROGRESS | Knowledge, registry và benchmark hội thoại | Có 6 agent được version hóa, 10/10 unit offline. Chưa có kết quả agent cho 96+36 case, onboarding knowledge và chi phí theo shop. | [Đối chiếu](https://github.com/ngoctien20/demo-git/tree/6cbb6d0/qa/lab) |
| 13 | IN_PROGRESS | Trừ/hoàn kho và idempotency | Có bảng idempotency và Commerce preview. Cần kiểm commit/refund, cạnh tranh, retry, rollback và audit bằng fixture giao dịch. | [Đối chiếu](TIEN404_AI_V7_1_QA_EVIDENCE.md) |
| 14 | IN_PROGRESS | Website, widget và hành trình SaaS | Menu và fixture widget có QA, demo phân loại xong. Thiếu mobile vật lý/iOS, mở dashboard dữ liệu thật từ hành trình thống nhất. | [Đối chiếu](TIEN404_CONTROL_HUB_MANUAL_CHECKLIST.md) |
| 15 | IN_PROGRESS | Vận hành và triển khai pilot | Có HMAC, status adapter và runbook. Thiếu shared replay, backup/restore Data Platform, giám sát, onboarding shop và hỗ trợ. | [Đối chiếu](TIEN404_AI_WORK_MASTER_V7_1_CHECKPOINT.md) |
| 16 | BLOCKED | Nghiệm thu Auth thật trên bản mới | Cloud Browser ẩn danh; cần phiên QA A an toàn để kiểm login, refresh, logout, expiry và multi-tab bản mới. | [Đối chiếu](https://github.com/ngoctien20/demo-git/pull/7) |
| 17 | BLOCKED | E2E hai JWT Shop A/B qua gateway | Chỉ 1 Auth user, 1 membership A. Cần chủ dự án cấp tài khoản QA riêng B và chạy positive/negative hai chiều. | [Đối chiếu](https://github.com/ngoctien20/demo-git/pull/5) |
| 18 | BLOCKED | Merchant Copilot và tra đơn người mua với dữ liệu tenant | Thiết kế quyền đã có. Kích hoạt tool merchant phụ thuộc nghiệm thu identity/RLS. Shopper cần ownership hay OTP trước khi xem đơn. | [Đối chiếu](https://github.com/ngoctien20/demo-git/blob/e911758/docs/ASSISTANT_ACCESS_ARCHITECTURE_V5.md) |
| 19 | NOT_STARTED | Nghiệm thu màn hình merchant Conversations/Orders xuyên UI và API | Account hiện chỉ có Products. Có endpoint Orders trong gateway và bảng conversations; chưa ghi nhận hành trình UI cho hai màn này. | [Đối chiếu](https://github.com/ngoctien20/demo-git/pull/5) |
| 20 | DEFERRED | Thanh toán thật và promote bot cho khách hàng | Phụ thuộc duyệt thương mại, quyền, pilot, rollback. Chưa có tác vụ thanh toán/live publish trong phiên. | [Đối chiếu](TIEN404_AI_WORK_MASTER_V7_1_CHECKPOINT.md) |

## Tiến độ kế thừa

- **V6:** [checkpoint Auth](https://github.com/ngoctien20/demo-git/blob/8ff253b/docs/SUPABASE_AUTH_V2_CHECKPOINT.md) ghi đăng nhập thật Shop A, owner, refresh, kiểm lại quyền, logout và chặn account ẩn danh ở 7d0c5754. [Data checkpoint](https://github.com/ngoctien20/demo-git/blob/9508321/ops/data-platform/checkpoints/LIVE_INTEGRATION_QA_20261110.md) ghi HMAC 1639/1641 và giới hạn gateway. Đây là bằng chứng có mốc phiên bản.
- **V7 trước phiên:** danh mục Products chỉ đọc, registry sáu agent, knowledge Lab, timeout và CDN dự phòng; Auth staging đã tiến từ 404b63b lên 2b16ac7. Bộ 96+36 chưa có kết quả đủ chấm bot.
- **V7.1:** Account có retry khi module chính hỏng; runner kiểm dữ liệu QA rỗng và cho chạy Shop A riêng; sửa mô tả trang preview PR #4. Đã kiểm RLS tầng DB, kiểm hai bản node n8n, chạy lại 64 ca sandbox, tích hợp bằng chứng vào bộ bàn giao này. Production changed: NO.
