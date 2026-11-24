# TIEN404 V26 — MASTER CHECKPOINT

Tài liệu sống: mỗi milestone thêm một mục mới ở đầu “Nhật ký”. Chi tiết audit: [TIEN404_V26_SYSTEM_AUDIT.md](TIEN404_V26_SYSTEM_AUDIT.md).

## Trạng thái hiện tại (2026-11-22 16:20 UTC)

| Thành phần | Phiên bản đang chạy / tham chiếu | Rollback |
|---|---|---|
| GitHub `main` | `78ba605` | — |
| GitHub `develop` | `078c91d` (gồm #500, #490, #487, #489, #496, #491, #493) | revert từng merge commit theo thứ tự ngược |
| GitHub `gh-pages` (website công khai) | `8d3f88f` = PR #496 @ `7a70fa5` | revert `8d3f88f` |
| n8n Messenger `Z7FdV7uDvApfbURQ` | Published `1f4069a5`, Draft `41bcea84` | publish `47b48f6d` |
| n8n Config Menu Bridge `9HXjjJ5ghPKUu43b` | Published `0d04c978` | unpublish (Z7Fd dùng `47b48f6d`) |
| n8n Create Order `KrSn4DNR9ALX5ng4` | Published `af9ee686` (22/11 ~21:10Z, parse VND chặt) | publish `4740251a` |
| n8n Manage Order `fDB9dvs1qPPVt9Sp` | `03384201` | `137d5689` |
| n8n Update Order `BkAi6TVUKAjCnI7v` | Published `3bd7043f` (22/11 ~21:10Z, SĐT/địa chỉ) | publish `93cf227a` |
| n8n Zalo V2 Shadow `OgDZNSAvKEvhnAvn` | **Unpublished** 22/11 21:06Z (trước đó `6277dd87`) | publish `6277dd87` + `rollback.sql` của #481 |
| n8n Shared Bot Core `A7XYwSqZwr9T7841` | `37af7677` (active) | — |
| n8n AI SALES Main `v6PBwcqSapVzACMW` | `c0f04eb1` | — |
| Supabase staging | migrations tới `20261122210608 revoke_anon_only_qa_shop_b_zalo_claim` (#481 đã áp); + V23 web, Config Core 10/20 áp bằng psql | V20: 60→70→80→90; Config Core: 80, 90 |
| Backup | B-00 VERIFIED run 44904780877 (21/11) | artifact mã hóa trước mỗi lần áp |
| **Vận hành bot** | **DỪNG** — n8n Cloud hết hạn dùng thử ~22/11 11:30Z | nâng gói |

## Không làm lại

- Inventory n8n Draft/Published, thứ tự merge, advisors Supabase: đã có trong audit 22/11.
- V20 Store Authority 10→40 đã áp staging; không áp lại drill #472.
- B-00 đã VERIFIED; chỉ cần theo dõi run định kỳ.

## Nhật ký

### 2026-11-23 22:30Z – 2026-11-24 11:00Z — UAT live Messenger (n8n đã nâng gói)
- Preflight: Z7Fd `1f4069a5`, Create Order `af9ee686`, Update Order `3bd7043f`, Manage Order `03384201`, Menu Bridge `0d04c978` đúng bản. Exec 6734 (22:28Z, pin data chữ ký 0…0) dừng ở Crypto = đúng.
- Đợt 1 (22:34–22:39Z): 10 webhook thật, `hmacVerified=true`, 0 execution lỗi; nội dung do chủ dự án xác nhận không có câu sai. Nút danh mục chỉ chào = lỗi đã biết, sửa ở S3 `9342025c` (WS-C).
- Đợt 2 (24/11 09:29–09:35Z): PASS O-01 (`ORD-20261124093007-6794-753032`, A002×1, 159000, pending), O-02 không trùng, O-03/O-04 không tạo dòng, O-05 không đổi địa chỉ, O-08 exec 6824 `order_not_matched`. CHƯA XÁC NHẬN O-06 (địa chỉ chưa đổi trên Sheet) và O-07 (quantity vẫn 1, có thể chưa xác nhận). Địa chỉ “Địa chỉ QA, không giao hàng” lưu thành “Địa chỉ QA”: AI tách phần ghi chú (`$fromAI('address')`), không phải lỗi code KrSn → PROPOSED sửa mô tả tham số khi publish Z7Fd.
- Đợt 3: H-01..H-03 PASS theo chủ dự án (bot im khi chuyển nhân viên, trả lời lại sau khi đánh dấu xong).
- Persistent menu Meta (đọc exec 6307 ngày 22/11): 4 mục + get_started + 4 ice breakers đã đặt; chủ dự án thấy trên máy tính, không thấy trên điện thoại → đang tìm nguyên nhân (cache app/hiển thị mobile).
- Execution thành công không lưu (`saveDataSuccessExecution=none`): bằng chứng = danh sách exec + Sheet + xác nhận của chủ dự án.

### 2026-11-23 ~03:10Z — Sheet AI_SALES_DEMO đa ngành (anh Tiến yêu cầu)
- Sao lưu trước: bản sao `AI_SALES_DEMO_BACKUP_20261123_truoc_da_nganh` trên Drive.
- Sửa: đổi tên tab `huomg_dan` → `huong_dan` và viết lại hướng dẫn cho mọi tab; `price_clean` tính cả cột; xếp Products theo SKU (A001 lên đầu).
- Đa ngành: Products thêm cột `nganh, nhom, don_vi` bên phải (4 cột bot đọc giữ nguyên); thêm tab `Cau_hinh_nganh` (shop/dich_vu/giao_duc/nghe_si → 3 nút menu theo Action Registry), `Dich_vu`, `Khoa_hoc`, `Nghe_si`, `Lich_hen` với dữ liệu DEMO. Bot chưa đọc các tab mới; nối vào bot là bước sau (cần duyệt publish).
- Đính chính: cột `price` là số có định dạng, không phải chữ.

### 2026-11-22 22:40Z — Việc offline chờ n8n (anh Tiến sẽ nâng gói tối nay)
- Thiết kế tích hợp Shared AI Core (#488 + Config Core): [TIEN404_V26_SHARED_CORE_DESIGN.md](TIEN404_V26_SHARED_CORE_DESIGN.md) — PROPOSED, các bước S1–S8, cần duyệt ở S1 (merge), S5 (migration), S6–S8 (publish).
- Kế hoạch UAT live: [TIEN404_V26_LIVE_UAT_PLAN.md](TIEN404_V26_LIVE_UAT_PLAN.md) — preflight P1–P5, Messenger M-01..09, đơn hàng O-01..07 (cần xác nhận vì ghi Sheet DEMO), handoff H-01..03.
- Không thay đổi hệ thống nào trong bước này.

### 2026-11-22 21:05–21:30Z — Thực hiện mục đã duyệt (anh Tiến: "Được làm đi em", 21:05Z)
- B-P0-02 DONE: unpublish `OgDZNSAvKEvhnAvn` (active trước đó `6277dd87`), áp migration #481 qua Supabase MCP. Kiểm tra: `proacl={postgres=X/postgres}`, anon/authenticated/service_role EXECUTE = false. Chưa probe REST (proxy container).
- B-P0-03/04 DONE: publish Create Order `af9ee686`, Update Order `3bd7043f` (chỉ đổi 1 Code node mỗi workflow). Offline 19/19 PASS (parser VND, tiền tố SĐT, địa chỉ có chữ). Chưa có UAT live vì n8n vẫn hết hạn.
- B-P0-05 VERIFIED: Z7Fd `1f4069a5` POST đi qua `Crypto → Verify Signature Timing-Safe → Verify Meta Signature` trước khi xử lý; sai chữ ký → nhánh trả lỗi.
- Hợp nhất: #500 (main→develop, `e9b7f106`), #490 (`c8e1383f`), #487 (`9ba3a8cf`). Merge develop vào #489 (`1c4a687`), #489 vào #496 (`5b04b8c`), #496 vào #491 (`c01afb4`), #491 vào #493 (`41a6fbd`, giải xung đột Shell.tsx/app.css, build lại `app/`).
- Merge vào develop (CI head xanh từng PR): #489 `e4d541a7`, #496 `1d8310b9`, #491 `9a4789db`, #493 `078c91d8`. Kiểm tra develop `078c91d`: config-core 242/242, messenger QA 144/144, build `app/` không lệch.
- Đóng #479, #480 (superseded bởi #482/#485). #481 đổi tiêu đề “ĐÃ ÁP STAGING”.
- Chưa làm: #488 (cần thiết kế Shared Core), #477 develop→main (giữ theo yêu cầu trước của chủ dự án).

### 2026-11-22 — Phase 0 audit (read-only)
- Branch: `claude/project-thread-8kj0gx`, Draft PR (docs-only).
- Không thay đổi hệ thống nào. Không chạy migration, không publish, không gửi tin.
- Kết quả: xem audit mục 1; backlog mục 7; workstream mục 8.
- Bước tiếp theo: B-P0-01 (chủ dự án nâng n8n), B-P0-02 (#481), B-P0-03 (Create Order drift), B-P1-01 (hợp nhất nhánh) — tất cả cần duyệt.
