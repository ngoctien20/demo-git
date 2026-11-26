# Checkpoint QA — 26/11/2026 (JST)

## VERIFIED

- Repo gốc: `ngoctien20/demo-git`, tiếp nối PR #515, nhánh `work/zalo-lite-private-catalog-20261126`.
- Checkpoint trước sửa: `943c692e6fd4874867c9ed630ffac3771cbb08a7`.
- Đọc Cloudflare Hub đang chạy: phiên bản `ae2cd33c-03c9-43b1-9403-81f72513f748`, bật nối Lite và gửi tin, chưa có catalog riêng/binding AI.
- PR #516 đang làm CSKH/dashboard trên nhánh khác; migration 0003 của nhánh đó là `0003_care.sql`. Bản này dùng migration 0004 để tránh trùng.

## IMPLEMENTED / TESTED

- `node --test gateway/zalo-hub/test/*.test.mjs`: **60/60 PASS** trên Node v24.22.3 với SQLite. CI dùng Node 22 và chạy cùng tập test.
- Entry QA `qa/runtime-check.mjs` chạy cục bộ: **20/20 PASS**, 21 lần gửi mô phỏng, 0 chuyển n8n, 0 yêu cầu provider ngoài dự kiến.
- Bằng chứng hội thoại tổng hợp: [latest-local-runtime.json](latest-local-runtime.json).
- Hash nguồn/migration/QA entry được ghi trong JSON. Không có token thật, khóa thật hoặc dữ liệu khách trong báo cáo.
- `git diff --check`: PASS.

Đã tái hiện và sửa: ghép chủ qua nhóm; ép sender bằng chat ID; Lite rơi về shared flow khi tắt cờ; `/v1/send` cũ bỏ qua pause; trả lời còn chờ AI gửi sau khi pause/đổi giá; vượt quota do hai tin đồng thời. Test hồi quy xác nhận từng hành vi.

## BLOCKED / chưa được kiểm chứng

Thao tác tạo D1 `tien404-zalo-lite-qa` chưa được thực thi qua kết nối Cloudflare trong phiên này. Lần đọc lại ngay sau thao tác trả danh sách rỗng cho tên đó. Chưa upload Worker QA, chưa áp migration hosted, chưa gọi inference Workers AI thật.

Không báo cáo local runtime là Cloudflare runtime. Không có gửi Zalo thật hoặc UAT trên thiết bị khách trong đợt này. Chưa thay phiên bản Hub đang phục vụ hoặc workflow n8n. Không promote vào Core Bot và không triển khai hàng loạt.

## Phần còn lại

1. Chạy entry QA với D1 riêng khi có thể thực thi thao tác tạo resource; xem SELF-SERVE-QA.md. Chỉ binding test, không sao chép credential bot thật.
2. Kiểm tra Cloudflare giới hạn truy vấn trong một invocation khi chạy scenario đầy đủ; tách scenario nếu gói hiện tại yêu cầu. Mỗi tin của luồng sản phẩm không phải cả scenario.
3. Tích hợp và UAT đúng Bot QA với event thật, nhận tin trên thiết bị, hai shop và trạng thái pause.
4. Hợp nhất điểm gửi/điều khiển CSKH với PR #516 trước mở tính năng theo gói trên dashboard.

Rollback và điều kiện triển khai nằm tại [SELF-SERVE-QA.md](../SELF-SERVE-QA.md). Giữ dữ liệu khi rollback; không chạy xóa bảng.
