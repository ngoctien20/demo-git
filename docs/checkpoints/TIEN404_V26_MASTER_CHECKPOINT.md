# TIEN404 V26 — MASTER CHECKPOINT

Tài liệu sống: mỗi milestone thêm một mục mới ở đầu “Nhật ký”. Chi tiết audit: [TIEN404_V26_SYSTEM_AUDIT.md](TIEN404_V26_SYSTEM_AUDIT.md).

## Trạng thái hiện tại (2026-11-22 16:20 UTC)

| Thành phần | Phiên bản đang chạy / tham chiếu | Rollback |
|---|---|---|
| GitHub `main` | `78ba605` | — |
| GitHub `develop` | `0e12f4c` | — |
| GitHub `gh-pages` (website công khai) | `8d3f88f` = PR #496 @ `7a70fa5` | revert `8d3f88f` |
| n8n Messenger `Z7FdV7uDvApfbURQ` | Published `1f4069a5`, Draft `41bcea84` | publish `47b48f6d` |
| n8n Config Menu Bridge `9HXjjJ5ghPKUu43b` | Published `0d04c978` | unpublish (Z7Fd dùng `47b48f6d`) |
| n8n Create Order `KrSn4DNR9ALX5ng4` | Published `4740251a` (Draft `af9ee686` chưa publish) | — |
| n8n Manage Order `fDB9dvs1qPPVt9Sp` | `03384201` | `137d5689` |
| n8n Update Order `BkAi6TVUKAjCnI7v` | Published `93cf227a` (Draft `3bd7043f`) | — |
| n8n Shared Bot Core `A7XYwSqZwr9T7841` | `37af7677` (active) | — |
| n8n AI SALES Main `v6PBwcqSapVzACMW` | `c0f04eb1` | — |
| Supabase staging | migrations tới `20261122003621`; + V23 web, Config Core 10/20 áp bằng psql | V20: 60→70→80→90; Config Core: 80, 90 |
| Backup | B-00 VERIFIED run 44904780877 (21/11) | artifact mã hóa trước mỗi lần áp |
| **Vận hành bot** | **DỪNG** — n8n Cloud hết hạn dùng thử ~22/11 11:30Z | nâng gói |

## Không làm lại

- Inventory n8n Draft/Published, thứ tự merge, advisors Supabase: đã có trong audit 22/11.
- V20 Store Authority 10→40 đã áp staging; không áp lại drill #472.
- B-00 đã VERIFIED; chỉ cần theo dõi run định kỳ.

## Nhật ký

### 2026-11-22 — Phase 0 audit (read-only)
- Branch: `claude/project-thread-8kj0gx`, Draft PR (docs-only).
- Không thay đổi hệ thống nào. Không chạy migration, không publish, không gửi tin.
- Kết quả: xem audit mục 1; backlog mục 7; workstream mục 8.
- Bước tiếp theo: B-P0-01 (chủ dự án nâng n8n), B-P0-02 (#481), B-P0-03 (Create Order drift), B-P1-01 (hợp nhất nhánh) — tất cả cần duyệt.
