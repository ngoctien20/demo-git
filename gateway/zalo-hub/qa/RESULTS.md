# Checkpoint QA — 26/11/2026 (JST)

## VERIFIED

Repo `ngoctien20/demo-git`, PR #517, tiếp nối #515, nhánh `work/zalo-lite-private-catalog-20261126`. Checkpoint trước sửa: `943c692e6fd4874867c9ed630ffac3771cbb08a7`.

Hub trước pilot: `ae2cd33c-03c9-43b1-9403-81f72513f748`; một connection QA active, một connection khác active; QA đã ghép chủ. Không xuất bản token, ID khách hoặc nội dung chat thật. PR #516 dùng `0003_care.sql`; bản này dùng `0004_lite_private_catalog.sql`.

## TESTED — source

- Cục bộ: **85/85 PASS** trên Node v24.22.3 và SQLite, gồm 12 bài parity với bản sao live riêng và 8 bài phạm vi router dùng handler tổng hợp.
- CI Node 22 của runner `b515b8e01f62026e3f6e7cdcb5797aa51821609a`: **65/65 PASS**, [run 45795640155](https://github.com/ngoctien20/demo-git/actions/runs/45795640155).
- CI pilot công khai chạy 73 bài; 12 bài phụ thuộc bản sao riêng được ghi rõ SKIP. Trước triển khai phải cấp `ZH_PILOT_LEGACY_MODULE` và chạy đủ 85 bài; không dùng SKIP làm bằng chứng parity.
- `git diff --check`: PASS.

## TESTED — Cloudflare thật

| Mục | Bằng chứng |
|---|---|
| Worker | `tien404-zalo-lite-qa` |
| Source | `b515b8e01f62026e3f6e7cdcb5797aa51821609a` |
| Version | `141461c3-106e-403d-bf6b-145aa746f1b3` |
| Deployment | `e23bebe0-ba0e-4abc-bf13-a8757087fccc` |
| Runtime | Workers + D1 thật |
| Kết quả | **22/22 PASS**, 26 HTTP request đều 200 |
| AI | Binding thật được gọi, `CLASSIFIED` / `CATALOG` |
| Zalo | **21 lượt gửi mô phỏng**, không phải tin thật |
| n8n / provider ngoài dự kiến | 0 / 0 |

Báo cáo và hội thoại tổng hợp: [latest-hosted-runtime.json](latest-hosted-runtime.json). Runner chia 26 bước; đo cục bộ tối đa 14 truy vấn D1/request. Thiếu khóa QA trả 401; route đăng ký production trên Worker QA trả 404. Khóa và continuation không nằm trong báo cáo hoặc Git.

Tạo D1 QA mới trả HTTP 403/code 7406 vì tài khoản đã có 10 database. Đây là giới hạn tài nguyên, không phải lỗi đăng nhập. Đã kiểm tra và tái sử dụng `tien404-v1723u-qa-bot-once-disposable`: trước thử nghiệm chỉ có canary trống. Đã áp 0001, 0002, 0004 và lưu receipt; canary cũ vẫn 0 dòng. Không tăng gói, không xóa database và không dùng D1 merchant cho dữ liệu tổng hợp.

## IMPLEMENTED — pilot đúng Bot QA

`pilot/router.mjs` chỉ chọn candidate cho connection lấy từ D1 có `store_id=qa-zalo-bot`, `flow_mode=own`. Merchant/Lite/system giữ nguyên handler trước pilot. Payload khách và allowlist môi trường không mở thêm shop. Tắt commerce vẫn chặn `/v1/send` QA cũ, không quay về n8n DEMO. Lookup lỗi trả 503.

Automatic approval review từ chối công khai toàn bundle live lên GitHub do nguy cơ lộ mã nội bộ. Cách đóng gói đã đổi: giữ bản sao live ngoài repository, chỉ đưa lại vào chính Worker sở hữu mã; Git chỉ có router mới, entrypoint, test và hash. Không công khai bundle qua đường khác.

Checkpoint D1, hash module và cách chạy parity ở [pilot/README.md](../pilot/README.md). Migration và upload Hub phải có receipt riêng; source đã kiểm thử không có nghĩa pilot đã chạy.

## Chưa được nghiệm thu

- Chưa có UAT nhận tin trên thiết bị Zalo thật trong đợt này. `API_ACCEPTED` chỉ là API chấp nhận.
- Chưa mở private commerce đại trà hoặc promote Core Bot.
- Chưa hợp nhất CSKH/subscription theo gói của #516.
- Reply path chưa có công cụ tạo đơn, ghi tồn hoặc công nợ.

## Bước tiếp theo và rollback

Đọc lại version/schema trước pilot, áp schema cộng thêm, giữ bindings và dùng entrypoint QA hẹp. Sau đó chủ QA nhắn **Bắt đầu**, nhập dữ liệu, **Thử SP01**, **Bật bot**; khách hỏi giá; chủ thử **Tạm dừng**.

Rollback ưu tiên tắt commerce/AI QA nhưng giữ router/catalog, merchant tiếp tục legacy. Không DROP, xóa dữ liệu hoặc restore cả DB khi merchant có dữ liệu mới. Xem [SELF-SERVE-QA.md](../SELF-SERVE-QA.md) và [pilot/README.md](../pilot/README.md).
