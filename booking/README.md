# TIEN404 Đặt lịch + Cọc + Nhắc lịch (ngành thử: spa / nail)

Trạng thái: **code + test offline, CHƯA bật**. Chưa đụng n8n, Sheet thật, Worker hay Supabase.
Làm sau pilot bán hàng (`sales/`, PR #502). Không phụ thuộc PR #502.

## Khách nhắn → có lịch chắc chắn

1. Khách hỏi "mai 2h chiều còn chỗ sơn gel không?". AI chỉ chuyển **mã dịch vụ + giờ khách muốn** cho `validateBooking`.
2. Luật kiểm từ Sheet (AI không tự đặt giá, cọc hay giờ trống):
   - dịch vụ có trong `Dich_vu`, đang nhận, cho đặt lịch;
   - trong giờ làm (dịch vụ phải xong trước giờ đóng cửa), không phải ngày nghỉ, đặt trước ít nhất 60 phút, tối đa 30 ngày;
   - **không trùng lịch**: số khách cùng lúc ≤ `capacity` (số thợ/ghế). Kín thì gợi ý giờ còn trống trong ngày;
   - gửi lại cùng tin = báo "đã có lịch", không tạo lịch thứ hai.
3. Ghi 1 dòng vào `Lich_hen` (status `pending`) và trả lời khách kèm **mã QR VietQR** (đã điền số tiền cọc + nội dung `T404XXXXXX`).
4. Lịch cần cọc được **giữ 30 phút**. Quá 30 phút chưa cọc thì giờ đó mở lại cho khách khác.
5. Tiền về tài khoản **của shop** → SePay/Casso gọi webhook → `matchTransfer`:
   - đủ tiền, đúng mã → `deposit_paid`, nhắn khách "đã nhận cọc", báo chủ shop;
   - thiếu tiền → không xác nhận, báo chủ shop;
   - cọc muộn mà giờ đó đã có người → báo chủ shop gọi khách đổi giờ hoặc hoàn tiền;
   - cùng giao dịch gửi 2 lần → bỏ qua.
6. Nhắc lịch: **24 giờ trước** (nếu đặt trước ≥ 12 giờ) và **2 giờ trước**, mỗi lần 1 tin, chỉ lịch đã cọc/đã xác nhận.

Cọc mặc định: 30% giá, ít nhất 50.000đ, không quá giá, làm tròn lên 1.000đ. Dịch vụ 0đ không cần cọc (chủ shop tự xác nhận). Shop đổi được trong "Shop Settings".

TIEN404 **không giữ tiền, không cần mật khẩu ngân hàng**: QR chuyển thẳng vào tài khoản shop; SePay/Casso chỉ báo "có tiền vào".

## File

| File | Làm gì |
|---|---|
| `lib/booking-rules.mjs` | Giờ trống, giữ chỗ, chống trùng, tạo dòng `Lich_hen` |
| `lib/deposit.mjs` | Tiền cọc, mã chuyển khoản, link VietQR, đọc webhook SePay/Casso, khớp tiền |
| `lib/messages.mjs` | Tin cho khách, tin báo chủ shop, nhắc lịch |
| `lib/vn.mjs` | Tiền VND, SĐT Việt Nam, giờ Việt Nam (UTC+7) |
| `n8n/build-nodes.mjs` | Sinh code 3 node n8n từ thư viện trên (không sửa tay trong n8n) |

Test: `node --test booking/test/*.test.mjs` (14 ca, CI `tien404-booking-setup-qa.yml`).

## Sheet: chỉ THÊM cột vào `Lich_hen`, không đổi cột cũ

Cột có sẵn: `request_id, nganh, ma_muc, ten_khach, phone, thoi_gian_mong_muon, kenh, ghi_chu, status, created_at, nguoi_xu_ly`.
Thêm (sau cột K): `ten_dich_vu, gia_vnd, coc_vnd, ma_chuyen_khoan, giu_cho_den, ma_giao_dich, da_nhac`.
`Dich_vu` dùng nguyên: `ma, ten_dich_vu, gia, thoi_luong_phut, dat_lich, trang_thai`.

## Bật thử (mỗi bước 🔒 cần anh duyệt riêng, sau khi n8n chạy lại và pilot bán hàng ổn)

1. 🔒 Sheet DEMO: thêm 7 cột trên vào `Lich_hen` (có backup trước).
2. 🔒 n8n, workflow mới **"Booking Tool"** (không sửa Z7Fd đang chạy): `Booking Input` → đọc `Dich_vu`, `Lich_hen` → node `Validate Booking` (`node booking/n8n/build-nodes.mjs validate`) → ghi `Lich_hen` → trả `reply` cho khách, gửi `owner_text` cho chủ shop qua route báo đơn của GĐ1.
3. 🔒 n8n workflow **"Booking Payment"**: Webhook (Header Auth = API key SePay/Casso, lưu trong credential n8n) → node `Match Payment` → cập nhật `status`/`ma_giao_dich` → nhắn khách + chủ shop.
4. 🔒 n8n workflow **"Booking Reminders"**: Schedule mỗi 15 phút → node `Due Reminders` → gửi tin → ghi `da_nhac`.
   - Messenger: ngoài 24 giờ kể từ tin cuối của khách phải gửi kèm tag `CONFIRMED_EVENT_UPDATE` (Meta cho phép đúng loại tin nhắc lịch).
   - Zalo: nhắc ngoài cửa sổ chat cần ZNS (mẫu tin duyệt trước, có phí). Chưa có ZNS thì chỉ nhắc khách đặt qua Messenger.
5. 🔒 UAT với 1 tiệm nail thật: 10 lịch thử, 2 khách cùng giờ (khách 2 bị từ chối), 1 cọc thiếu, 1 cọc muộn, nhắc 24h/2h đến đúng giờ.

Tắt khẩn cấp: tắt 3 workflow trên. Không ảnh hưởng bot bán hàng.
