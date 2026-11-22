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
