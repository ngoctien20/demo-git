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

| `lib/read-with-relay.mjs` | **Chỉ để thử**: gọi qua trạm trung gian kiểu OpenAI (xingchiapi) khi `AI_PROVIDER = "relay"` |

Test: `node --test setup/test/*.test.mjs` (18 ca, không gọi mạng, không cần key).

## Chế độ thử (24/11/2026)

`AI_PROVIDER = "relay"` gọi một API kiểu OpenAI bằng secret `RELAY_API_KEY`.
- **Đang dùng:** khóa Gemini chính thức (Google AI Studio, gói miễn phí): `AI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai"`, `AI_API = "chat"`, `AI_MODEL = "gemini-3.5-flash-lite"`. Gói miễn phí: Google có thể dùng dữ liệu gửi lên để cải thiện sản phẩm, nên **chỉ thử với ảnh mẫu**. Trước khi có shop thật: bật trả phí trên AI Studio hoặc đổi `AI_PROVIDER = "anthropic"`.
- **Không dùng được:** xingchiapi (trạm chỉ cho công cụ lập trình như Codex, đã tắt chat/completions). Không giả danh client để lách.

## Bật (Tiến chọn "Tạo trợ lý nhanh" bật trước, 23/11/2026)

Worker riêng `tien404-setup-draft` (`setup/wrangler.toml`), không sửa Worker đang chạy. Công tắc `SETUP_DRAFT_ENABLED` để `"false"` khi deploy.

1. Tạo D1: `npx wrangler d1 create tien404-setup`, điền `database_id`, rồi `npx wrangler d1 execute tien404-setup --remote --file migrations/0001_setup_draft_usage.sql`.
2. Deploy: `cd setup && npm ci && npx wrangler deploy` (route vẫn tắt).
3. Anh tự đặt secret `ANTHROPIC_API_KEY` trong Cloudflare: Workers › tien404-setup-draft › Settings › Variables and Secrets. Không dán key vào chat hay repo.
4. 🔒 Bật thử: `SETUP_DRAFT_ENABLED = "true"`, điền `SETUP_API` trong `apps/owner/src/config.ts`, build App, deploy gh-pages.
5. Thử 5 bảng giá thật (nail, spa, quán ăn, shop quần áo, trung tâm học); đo % món đọc đúng giá, số món phải sửa tay.

Tắt khẩn cấp: `SETUP_DRAFT_ENABLED = "false"` (hoặc xoá secret). Rollback App: revert commit gh-pages.

Chi phí ước tính (chưa đo thật): một ảnh bảng giá khoảng 2.000 token vào và 2.000-4.000 token ra, tức khoảng 1.000-3.000đ mỗi lần theo giá Claude Opus 5.5 ($4 vào / $20 ra mỗi triệu token).
