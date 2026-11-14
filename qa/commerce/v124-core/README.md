# TIEN404 V12.4R · Core hội thoại khách hàng

Lõi trả về bản xem trước bằng tiếng Việt. Một engine xử lý nhiều shop bằng registry phía server. Theo dõi lần chạy và trạng thái từng môi trường trong [checkpoint V12.4R](../../../docs/ai-handoff/V12_4R_CORE_READINESS.md). Mã nguồn trong thư mục này chỉ dùng cho staging QA.

## Contract

| Thành phần | Đầu vào và kết quả |
|---|---|
| Ingress / Resolver | Envelope v1 gồm `version, channel, botRef, senderRef, eventRef, eventType, chatType, text, issuedAt, signature`. `qa-fixture` ký HMAC nội bộ trên mảng trường chuẩn hóa. Registry server xác minh binding duy nhất, active, thời hạn, thu hồi, mode, store và tenant. Context Customer chỉ dùng trong cùng process. |
| Catalog | `createPostgresQaCatalog({poolForContext})` dùng SELECT tham số theo tenant, store, bot, SKU trên `tien404_r1_qa.catalog`, JOIN bot ở `dry_run/synthetic_qa`. Reader dùng phiên DB được backend chọn cho scope. Mỗi câu cần giá/tồn thực hiện readback mới. Thiếu chính sách sỉ, phí, size, màu hoặc đơn vị thì giữ trạng thái thiếu. Thời điểm database trả dòng QA chỉ xác minh thời điểm đọc fixture. |
| Phiên | `createPostgresCustomerSessions({poolForContext, ttlMs, windowMs, maxTurns})`. Mặc định 30 phút, 8 lượt/60 giây. Khóa tenant + store + channel + bot + HMAC người gửi. Trong một transaction, khóa hàng, kiểm receipt, quota, thứ tự sự kiện, lập preview, cập nhật revision. Receipt giữ tối thiểu một giờ để bao phủ cửa sổ xác thực 120 giây. |
| Hội thoại | `createReadOnlyReplyCore({ingress,repository,classifier,sessions}).preview(envelope)`. Trả `status,phase,replyCandidate` khi có kết quả. Chỉ đọc lại mã sản phẩm từ phiên, giá và tồn luôn lấy từ catalog. Hủy, chuyển mã, báo thiếu dữ liệu, yêu cầu người hỗ trợ đều kết thúc theo trạng thái cụ thể. Không có công cụ ghi đơn. API dùng ports RAM cũ vẫn chạy bộ regression đơn lượt. |
| AI & ngân sách | Classifier thử nghiệm đề xuất intent, SKU, số lượng. Backend đối chiếu mã được nhắc hoặc đã chọn, kiểm lượng, tồn, số tiền nguyên an toàn. Hạn chờ mặc định 1,5 giây. Port GPT khóa trước transport; ledger RAM đếm lượt bị chặn. Giới hạn cấu hình 10 lượt, 100.000 micro-USD và 96 output tokens chỉ mô tả chính sách. |
| ChannelAdapter | Zalo Bot, Messenger, Website, Telegram trả `RESERVED_NOT_CONNECTED`, `OUTBOUND_DISABLED`, `productionReady=false`. Các phương thức xác thực provider, chuẩn hóa, phân giải bot, tạo event và định dạng đều từ chối khi chưa có kết nối. `getDeliveryStatus()` trả `NOT_SENT`. |

Lỗi xác thực, quyền DB, timeout, dữ liệu sai hoặc stale đều đóng quyền báo giá. Lỗi tạm thời sau khi mở giao dịch sẽ rollback receipt cùng state để có thể retry. Một sự kiện trễ hơn lượt đã áp dụng không thể hồi sinh bản nháp đã hủy. Các sự kiện có cùng timestamp được tuần tự hóa theo thứ tự giữ khóa. Nếu provider có sequence ID thì adapter tương lai cần kiểm tra theo sequence. Tên sản phẩm từ catalog không đi vào prompt hay nội dung số tiền. Handoff mới ở mức yêu cầu hỗ trợ.

## Chạy QA

Từ repository dùng `node --test qa/zalo/public-reply-pilot.test.cjs qa/commerce/v124-core/*.test.cjs`. Bộ PostgreSQL dùng `npm ci --ignore-scripts` trong thư mục này và `node --test postgres/integration.test.cjs` với database PostgreSQL 17 **mới, rỗng, dùng một lần**. Biến môi trường bắt buộc và bước chạy nằm trong [workflow QA](../../../.github/workflows/v124-public-reply-qa.yml). Database name, host loopback và cờ QA được kiểm tra trước khi tạo fixture. Test tạo role A/B có RLS và đọc các dữ liệu giả lập riêng. SQL candidate chưa có role hoặc policy cấp quyền mặc định. Bài HTTP dùng các tài khoản merchant QA đã cấp qua GitHub Actions, chỉ kiểm tra khả năng nhìn thấy dòng của `public.products` và đóng đúng phiên mới mở.

## Vận hành

Lớp session lưu hash, SKU, số lượng, phase, revision và mốc thời gian. Session hết hạn được reset ở lần truy cập tiếp theo; receipt quá hạn của khách được dọn khi có lượt mới. Cần chính sách dọn các phiên khách không quay lại trước khi vận hành dữ liệu thật. Khi dùng kết nối PostgreSQL thực, pool phải xác thực SSL và quyền tối thiểu gắn với shop, có timeout khi lấy connection. Chưa có ánh xạ customer credential/RLS được phê duyệt trên Supabase hosting.
