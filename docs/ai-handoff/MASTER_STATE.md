# TIEN404 AI · Bàn giao Work V9

Chốt ngày 11/11/2026, 18:15 JST. Agent WORK, bản V9. **PILOT READINESS: NOT READY. PRODUCTION CHANGED: NO.**

Điểm xuất phát [V8 e9752ea](../coordination/TIEN404_AI_V8_MASTER_CHECKPOINT.md). Đã rà tất cả remote refs, PR #1–#7 và hồ sơ V8.1 trên nhánh Auth. Tại lúc đồng bộ chưa thấy checkpoint V8.2. PR #8 mới chứa schema cấu hình bot theo tenant. Xem SHA sản phẩm và file thay đổi trong [CHANGELOG](CHANGELOG.md), kết quả thực thi trong [QA_EVIDENCE](QA_EVIDENCE.md).

| Phase | Trạng thái ngày 11/11 | Phạm vi |
|---|---|---|
| 1 Auth | BLOCKED cho nghiệm thu hai JWT | Anonymous HTTP, SQL role A/B đã kiểm. Thiếu signed HTTP A/B, nonmember, recovery email và phiên mobile thật trên bản mới. |
| 2 Merchant | IN_PROGRESS | Auth staging LIVE c728f15. Báo cáo 7/30 ngày theo ngày tạo đơn giờ Việt Nam, đọc danh mục phân trang, đơn và chi tiết, khách hàng và lịch sử mua, hội thoại và lịch sử, cấu hình AI, chuyển shop. Chưa nghiệm thu độc lập với hai tài khoản. |
| 3 Commerce | IMPLEMENTED_NOT_VERIFIED ở gateway live | Đã kiểm CRUD lệnh giới hạn trên HTTP fixture + PostgreSQL. Data runtime chỉ đọc. |
| 4 AI platform | VERIFIED_DONE cho metadata và RLS staging | Shop A có một cấu hình QA paused, B có 0. Quyền điều phối tool runtime và kích hoạt kênh còn mở. |
| 5 Training Lab | IN_PROGRESS | Scorer chạy offline, replay một trace model, 64 assertion sandbox đạt. Sáu tình huống khác chưa có trace model trong bộ chấm. |
| 6 Super Admin | IN_PROGRESS | Có metering/quota và UI usage được kiểm ở SQLite/Chromium CI. Chưa có hosted Admin đã nghiệm thu. |
| 7 Onboarding | IN_PROGRESS | Website preview nối đến login staging và yêu cầu tham gia. Chưa cấp tenant xuyên hệ thống. |
| 8 Operations | IN_PROGRESS | Đã kiểm quota và backup/restore fixture. Chi phí thực, diễn tập sự cố và hóa đơn còn mở. |

[Kiến trúc](ARCHITECTURE.md) · [Công việc đang mở](ACTIVE_WORK.md) · [Backlog V9.1](BACKLOG.md) · [Điều kiện phát hành và rollback](RELEASE_GATES.md).


## Bản thực sự phục vụ

| Môi trường | Phiên bản | Kiểm chứng |
|---|---|---|
| Auth Render | c728f153906781905ec80f06e7fef9572e9e02c9 · dep-dbq33krl550s739e1vfg | LIVE, ba file JS/module phục vụ khớp byte với commit. Form ghi sản phẩm tắt mặc định. |
| Data Render | 3c29f70eae00edd6572756c91c4a4bfa43e77d2c · dep-dbq30a2jnfac73euucsg | LIVE, health 200 CONFIGURED_NOT_VERIFIED. Runner anonymous trên gateway + Supabase đạt. Không truyền commerce_connect trong entrypoint. |
| Supabase | 20261111085750 và 20261111090920 | Metadata bot và RPC thống kê chỉ đọc. Đã kiểm hai chiều trong DB. |
| Website công khai | gh-pages 6bb57e6 | PR4 chỉ phát hành preview/CI. Không merge production. |

Form sản phẩm hiện có thể thử bằng transport fixture. Cấp quyền ghi và bật form cho QA đang chờ chủ dự án duyệt. Lúc chốt chưa có dấu hiệu V8.2 được lưu trên các nhánh đã rà.
