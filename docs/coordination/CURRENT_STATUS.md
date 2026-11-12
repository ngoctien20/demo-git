# Checkpoint CTO V2 · 10/11/2026 JST
VERIFIED 29 workflows; 16 active. Baseline website 7bf9c660, main 2ddf0138, monitor 385782af. 4 workflow nháp khác active. Revenue Report có lỗi manual, staging mock đạt 8/8. Website QA offline và kiểm graph xem QA_BASELINE. Linear là backlog; 8 workstream được thể hiện bằng prefix và owner Work. Không gán cá nhân thay chủ dự án.

Discrepancy: README mô tả mô phỏng nhưng demo.html có consultant n8n riêng. Workflow tên TEST có đường gửi/ghi. Monitor PR #1 không phải nguồn triển khai Sites. Supabase kết nối nhưng danh sách dự án rỗng. Nguồn Project hiện có bốn tệp CSV (xem QA_REPORT). Các trạng thái auth, tenant và billing thực còn UNKNOWN.

Nguồn đối chiếu: [Pages tại baseline](https://github.com/ngoctien20/demo-git/tree/7bf9c660e70a65295e80b0fba8c241590d6aa0bf) · [checkpoint monitor](https://github.com/ngoctien20/demo-git/pull/1) · [checkpoint tổng thể riêng của dự án, ngày 10/11/2026].


### Cập nhật đồng thời · PR #2
[Super Admin staging tại b2108431](https://github.com/ngoctien20/demo-git/tree/b2108431f1c230f03bb7961387d1aa900c046b62/ops/super-admin) đã triển khai FastAPI/SQLite, MFA, RBAC, entitlement từng shop, payment fixture, audit và test restore staging. QA_REPORT ghi nhận 64/64 local; [job staging-security](https://github.com/ngoctien20/demo-git/actions/runs/42802094703) đã success. PR #2 draft dựa trên nhánh PR #1. Chưa triển khai Sites/D1, thanh toán thật hay kết nối OAuth. Contract cho các route hiện có nằm tại ops/super-admin/docs/API_CONTRACT.md của PR #2. Tái sử dụng trước khi thiết kế thêm; PostgreSQL là phương án cần so với D1 theo phạm vi dữ liệu. NGO-6/11/12 tập trung review, port và kiểm phần thiếu.

### Kiểm tra bổ sung ngày 10/11/2026 (JST)
- Đã đối chiếu 9 kết nối qua thao tác đọc. Calendar trả danh sách lịch; Contacts trả 0 kết quả cho TIEN404. PostHog chỉ có Default project và ingested_event=false. Ba automation QA đang bật.
- Bốn CSV trong Project. Hai bản single-turn giống từng byte (96 ca, chưa có output). Tệp lịch sử 97 dòng, 96 định nghĩa khớp baseline, QA01 lặp. Tệp 36 kịch bản có 27 kịch bản từ hai lượt và 9 kịch bản một lượt; cả 36 mang trạng thái NOT_RUN.
- Hai execution thủ công Revenue 934/936 dừng vì tổng tiền đơn paid không hợp lệ ở dòng 2. Fixture độc lập cho thấy bản published cộng 159 cho chuỗi `159.000` và 0 cho `159.000đ`; bản draft cho 159000 trong cả hai ca. Không suy ra giá trị tại dòng dữ liệu thật. Published đạt 3/9, draft 9/9 theo contract offline dưới đây. Chưa phê duyệt publish.
- Kết quả n8n đọc trực tiếp từ node assert: Catalog/Cart 17/17 (1473), V3 22/22 (1474), Extension 25/25 (1479), Revenue mock 8/8 (1604).

## Giai đoạn 1 · Messenger Bot V1 cho một shop
Đã kiểm tra lại 7/7 plugin. 29/29 workflow đọc được cấu hình; 16 active, 4 draft lệch published. PR #1, #2, #3 mở; Pages 7bf9c660, Super Admin b2108431, monitor 385782af. [Linear](https://linear.app/ngoctien20/project/tien404-ai-455b6a09e0fb) có 10 issue thuộc 8 nhóm. Supabase trả về 0 project khả kiến, PostHog Default chưa ingest; Gmail đọc labels. Sites V1 có deployment, V2 chưa có deployment ID. **BLOCKED** pilot thật tại cổng cô lập Messenger và tính đúng tiền. Trạng thái chạy thật của auth, quyền tenant, thanh toán và chi phí/shop là UNKNOWN. [Báo cáo quản trị](https://docs.google.com/document/d/16jeY-s8iwvPzgngQ2k8O16DcPYO1WG0x3hBMCAKGc3E/edit).

### V7 · 2026-11-11 JST · Pilot NOT READY

PR #7 catalog ada27656, auth QA run 42848394303; previous V6 real-browser login/refresh/logout for Shop A documented in PR #7. Supabase still has one user, two tenants and one membership. Require a separately authorized QA Shop B identity and a two-user negative test. PR #6 owns workflow inventory and public widget; PR #3 owns offline quality fixtures. PR #2 MFA/RBAC and entitlement remain isolated. Billing, agent release and order access stay gated. Restore prior Auth deployment dep-dbpjiv1srm7s73aur350 for UI rollback. No production change.

## 11/11/2026 JST · Work V7.1
Xem [checkpoint tiếp quản V7.1](TIEN404_AI_WORK_MASTER_V7_1_CHECKPOINT.md) và [checklist thủ công](TIEN404_CONTROL_HUB_MANUAL_CHECKLIST.md). Chỉ 1/4 mục gốc đủ điều kiện đánh dấu. Pilot NOT READY.
