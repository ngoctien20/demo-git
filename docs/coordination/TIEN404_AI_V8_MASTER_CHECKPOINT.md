# Bàn giao TIEN404 AI · Work V8

Ngày 11/11/2026, khoảng 12:27–12:36 JST. **PILOT READINESS: NOT READY. PRODUCTION CHANGED: NO.** Đã đọc Master V6, V7, hồ sơ V7.1 và đối chiếu với thay đổi song song V8.1. Dùng [checkpoint V7.1 cố định](https://github.com/ngoctien20/demo-git/blob/e73a580/docs/coordination/TIEN404_AI_WORK_MASTER_V7_1_CHECKPOINT.md) để tra lịch sử. [Hồ sơ Shop B và kết quả RLS của phiên song song](https://github.com/ngoctien20/demo-git/blob/0bdea384/docs/TIEN404_AI_V8_1_QA_EVIDENCE.md).

| PR Draft mở | Nhánh | SHA sản phẩm | Trạng thái giao hàng |
|---|---|---|---|
| [#2](https://github.com/ngoctien20/demo-git/pull/2) | ops/super-admin-v4-staging-20261110 | b76d704 | Admin staging riêng |
| [#3](https://github.com/ngoctien20/demo-git/pull/3) | docs/cto-coordination-v2 | nền e73a580 | Lab và checkpoint này |
| [#4](https://github.com/ngoctien20/demo-git/pull/4) | work/website-v4-1-simplify-navigation | 612f609 | Preview website |
| [#5](https://github.com/ngoctien20/demo-git/pull/5) | ops/tenant-data-platform-v1-staging-20261110 | f4b465f | Commerce, restore và RPC thử nghiệm ở CI |
| [#6](https://github.com/ngoctien20/demo-git/pull/6) | ops/cto-autonomous-v5-20261110 | 0a65513 | Widget và registry |
| [#7](https://github.com/ngoctien20/demo-git/pull/7) | work/supabase-auth-staging-v1 | d25d683 | Render Auth LIVE |

**Bản đang phục vụ.** GitHub Pages ở `6bb57e6`. Auth staging `dep-dbpu1qajnfac73efpjr0`, commit `d25d683f88e457658e3905b6881238303df63f90`, auto-deploy OFF. Data staging `dep-dbpifqbbc2fs73aa1ab0`, commit `9745dd181a63df30e20d174cef145fc7c2aef61b`. [Render Auth](https://dashboard.render.com/static/srv-dbpj4irm8hqs73e2h2rg) · [Data health](https://tien404-data-staging.onrender.com/health).

**Điểm tiếp quản.** Đã có tài khoản QA cho cả A và B. Chạy acceptance bằng hai danh tính qua kênh bảo mật, giữ nguyên quyền hiện có. Chỉ triển khai quyền tạo/sửa sản phẩm sau khi duyệt RPC và rollback trên bản sao staging. Không kết nối checkout tới Messenger hoặc đơn thật trong đợt kiểm tra này.

**Hoàn tác.** Nếu Auth phát sinh hồi quy, redeploy artifact staging `dep-dbppc3ek1f9s73ci4al0` / `4c13ea5`, sau đó kiểm login ready và account ẩn danh. Commerce/RPC chưa lên Supabase hoặc Data runtime. Có thể revert commit trên nhánh PR tương ứng. Bản sao lưu–khôi phục đã kiểm ở PostgreSQL CI, chưa diễn tập trên bản sao của dự án Supabase.

[Kiến trúc và quyền](TIEN404_AI_V8_ARCHITECTURE.md) · [Trạng thái](TIEN404_AI_V8_COMPLETION_REPORT.md) · [Bằng chứng](TIEN404_AI_V8_QA_EVIDENCE.md) · [Backlog và phụ thuộc](TIEN404_AI_V8_BACKLOG.md) · [Control Hub](TIEN404_CONTROL_HUB_MANUAL_CHECKLIST.md).
