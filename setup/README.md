# TIEN404 Tự dựng trợ lý từ ảnh bảng giá / link

Trạng thái: **code + test offline, CHƯA bật** (chưa deploy Worker, chưa có API key).

Chủ shop chụp ảnh bảng giá/menu, hoặc dán link website, hoặc dán chữ. Claude đọc ra **bản nháp**:
tên shop, ngành, cách gọi khách, danh sách món/dịch vụ + giá + thời lượng, giờ mở cửa, câu hỏi thường gặp.
Chủ shop xem, sửa, bấm **Xác nhận** → nhập vào `Products` / `Dich_vu` bằng luồng nhập file đã có (V22.7).

## An toàn

- **Không lưu gì** cho tới khi chủ shop xác nhận. Route chỉ trả bản nháp.
- **Giá lấy từ chữ in trên bảng giá**, không lấy số AI tự quy đổi. AI đọc lệch, giá dạng khoảng ("150-200k"), "liên hệ", hoặc (với link) giá không có trên trang → món đó bị đánh dấu "cần xem lại" và **không được nhập** cho tới khi chủ shop sửa.
- Nội dung ảnh/trang là dữ liệu, không phải lệnh: AI chỉ trả JSON đúng khuôn, không có công cụ nào để làm việc khác.
- Link: chỉ trang công khai `https`, chặn IP/localhost/tên nội bộ, kiểm lại sau mỗi lần chuyển hướng, tối đa 500 KB, 8 giây.
- Facebook/Instagram/TikTok cần đăng nhập nên **không cào**; app nhắc chủ shop chụp màn hình bảng giá.
- Chỉ chủ shop đã đăng nhập (token Supabase được Supabase kiểm), 20 lần/ngày/chủ shop, ảnh ≤ 5 MB (JPEG/PNG/WebP).
- Khóa Claude chỉ nằm trong secret của Worker.

## File

| File | Làm gì |
|---|---|
| `lib/draft.mjs` | Khuôn JSON cho Claude, đọc giá kiểu "120k / 1tr2 / 1.200.000đ", kiểm bản nháp, đổi ra dòng Sheet |
| `lib/page-text.mjs` | Đọc chữ của trang web công khai an toàn |
| `lib/read-with-claude.mjs` | 1 lần gọi Claude (`claude-opus-5-5`, structured output, tự chuyển model dự phòng nếu bị từ chối) |
| `worker/setup-route.mjs` | Route Worker `POST /v1/setup/draft` |

Test: `node --test setup/test/*.test.mjs` (14 ca, không gọi mạng, không cần key).

## Bật (mỗi bước 🔒 cần anh duyệt riêng)

1. 🔒 Tạo API key Claude cho TIEN404 (anh tạo trên console.anthropic.com), đặt secret `ANTHROPIC_API_KEY` cho Worker.
2. 🔒 Tạo D1 `tien404-setup` + bảng `setup_draft_usage` (lệnh trong `SETUP_DB_DDL`).
3. 🔒 Deploy route vào Worker (bật `nodejs_compat`), biến `SETUP_DRAFT_ENABLED=true`, `APP_ORIGINS=https://ngoctien20.github.io`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`.
   Gộp file: `cd setup && npm ci && npm run bundle`. Tắt khẩn cấp: `SETUP_DRAFT_ENABLED=false`.
4. Trang "Tạo trợ lý nhanh" trong App (bước sau): chọn ảnh → xem bản nháp, ô vàng = cần xem lại → Xác nhận.
5. 🔒 Thử với 5 bảng giá thật (nail, spa, quán ăn, shop quần áo, trung tâm học); đo: % món đọc đúng giá, số món phải sửa tay.

Chi phí ước tính (chưa đo thật): một ảnh bảng giá khoảng 2.000 token vào và 2.000-4.000 token ra, tức khoảng 1.000-3.000đ mỗi lần theo giá Claude Opus 5.5 ($4 vào / $20 ra mỗi triệu token).
