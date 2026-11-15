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

Lỗi xác thực, quyền DB, timeout, dữ liệu sai hoặc stale đều đóng quyền báo giá. Lỗi tạm thời rollback để có thể retry. Riêng khi khách đổi mã, lỗi nguồn mới làm xóa lựa chọn cũ và để event retry được. Một savepoint bảo đảm thao tác này hoạt động kể cả khi SELECT PostgreSQL đã lỗi. Một sự kiện trễ hơn lượt đã áp dụng không thể hồi sinh bản nháp đã hủy. Các sự kiện có cùng timestamp được tuần tự hóa theo thứ tự giữ khóa. Nếu provider có sequence ID thì adapter tương lai cần kiểm tra theo sequence. Tên sản phẩm từ catalog không đi vào prompt hay nội dung số tiền. Handoff mới ở mức yêu cầu hỗ trợ.

## Chạy QA

Từ repository dùng `node --test qa/zalo/public-reply-pilot.test.cjs qa/commerce/v124-core/*.test.cjs`. Bộ PostgreSQL dùng `npm ci --ignore-scripts` trong thư mục này và `node --test postgres/integration.test.cjs` với database PostgreSQL 17 **mới, rỗng, dùng một lần**. Biến môi trường bắt buộc và bước chạy nằm trong [workflow QA](../../../.github/workflows/v124-public-reply-qa.yml). Database name, host loopback và cờ QA được kiểm tra trước khi tạo fixture. Test tạo role A/B có RLS và đọc các dữ liệu giả lập riêng. SQL candidate chưa có role hoặc policy cấp quyền mặc định. Bài HTTP dùng các tài khoản merchant QA đã cấp qua GitHub Actions, chỉ kiểm tra khả năng nhìn thấy dòng của `public.products` và đóng đúng phiên mới mở.

## Vận hành

Lớp session lưu hash, SKU, số lượng, phase, revision và mốc thời gian. Session hết hạn được reset ở lần truy cập tiếp theo; receipt quá hạn của khách được dọn khi có lượt mới. Cần chính sách dọn các phiên khách không quay lại trước khi vận hành dữ liệu thật. Khi dùng kết nối PostgreSQL thực, pool phải xác thực SSL và quyền tối thiểu gắn với shop, có timeout khi lấy connection. Chưa có ánh xạ customer credential/RLS được phê duyệt trên Supabase hosting.


## V12.4R.2 · Retention QA candidate (no hosted cleanup)

`postgres/retention.cjs` bổ sung cổng `createQaRetentionMaintenance` với hai phương thức:

- `inspect()`: giao dịch `BEGIN READ ONLY`, chỉ đếm tổng số sessions đã hết hạn quá kỳ lưu giữ (mặc định 24 giờ) và receipts quá hạn + khoảng đệm (5 phút). Không đọc hoặc xuất danh tính khách, SKU, giá hay nội dung tin nhắn. Cần pool DB được cấp quyền rõ ràng, không có quyền mới.
- `sweepDisposableQaOnly()`: chỉ chạy khi cả ba cờ cho phép môi trường PostgreSQL kiểm thử dùng một lần cùng khớp; còn kiểm tra `current_database()` bên trong transaction. Xóa theo từng lô tối đa 250 và dùng `FOR UPDATE SKIP LOCKED`. PostgreSQL 17 CI kiểm chứng hai session QA cũ bị dọn, session còn hạn và receipt hiện hành được giữ, gọi lại không xóa thêm.

**BLOCKED trên Supabase staging và production:** chưa có maintenance role với RLS và quyền xóa tối thiểu, lịch chạy, retention policy được duyệt, backup và giám sát. Không import module này vào API core hoặc webhook; không bật job dọn; không chạy lệnh xóa trên Supabase. Cleanup candidate dùng cho QA PostgreSQL cô lập, không phải session thực thuộc PR #41.


## V12.4R.3 — Customer Catalog hosted RLS readiness (source QA, no hosted grants)

Sau khi kiểm tra trực tiếp Supabase `tien404-staging`, `public.products` chỉ có `tenant_id`, không có `store_id`. RLS `public.products` cho tài khoản merchant QA hoạt động: hai tenant thử nghiệm chỉ thấy sản phẩm của mình; unknown user/anon bị chặn; JWT claim `tenant_id` giả không được quyền mở dữ liệu shop khác. Đây chỉ là **SQL role/claim simulation**, không phải Customer backend JWT E2E.

`tien404_r1_qa.catalog` có khóa tenant/store/bot/SKU và dữ liệu Shop A/B; schema/bảng đóng quyền cho `anon`, `authenticated`, `service_role`. Chưa có Customer backend role trong Supabase.

- `hosted-catalog-guard.cjs`: repository QA chọn dùng riêng, **không export trong index.cjs**, yêu cầu context Customer đã HMAC xác thực, DB client thuộc transaction, role đúng tên server map, không superuser/BYPASSRLS, RLS thực sự có hiệu lực ở cả catalog và shop_bots, không SELECT `credential_ref` và không có quyền ghi Catalog. Trước khi trả giá/tồn, từ chối đọc chéo tenant/store/bot/SKU. Role/credential không do dữ liệu chat quyết định.
- `hosted-rls-readonly-audit.sql`: tái hiện kiểm toán hosted **chỉ đọc** cho hai tenant, user không hợp lệ và anon; không tạo hoặc cấp bất kỳ policy/quyền nào. File này không chạy trong public REST.
- `hosted-rls-audit.test.cjs`, `hosted-catalog-guard.test.cjs` và PostgreSQL 17 integration bổ sung kiểm tra fail-closed, role mismatch, credential column grants, read-only access thật ở PG17 QA disposable.
- [Đề xuất role/RLS cần phê duyệt](../../../docs/ai-handoff/V12_4R_3_CUSTOMER_HOSTED_RLS_APPROVAL_PROPOSAL.md): DRAFT SQL cho hai role QA NOLOGIN chỉ đọc; **KHÔNG ĐƯỢC TỰ ÁP DỤNG**. Owner PR #41 không bị sửa. Để triển khai hosted Customer, phải phê duyệt role/credential, policy, backup, rollback và E2E quyền theo shop.

Mọi channel vẫn `RESERVED_NOT_CONNECTED`; không gọi model trả phí, không ghi Orders/Outbox hoặc cấp quyền database trong bản này.


## V12.4R.3 — Transaction-bound Customer Catalog QA hardening (candidate)

`transactional-catalog.cjs` bổ sung một repository **chủ động thuê và giải phóng PostgreSQL client** qua `poolForContext` server-only. Luồng mỗi lần đọc là `BEGIN READ ONLY` → `SET LOCAL row_security=on`, statement/idle timeout → kiểm tra chính role PostgreSQL/privilege/RLS → SELECT sản phẩm đúng scope → COMMIT, hoặc ROLLBACK khi lỗi. Nếu rollback không thành công, kết nối sẽ bị discard thay vì trả về pool. Trường hợp truyền `client` ngoài vào bị từ chối; không sử dụng `SET ROLE`, không nhận role từ tin nhắn. Bộ bảo vệ kiểm tra thêm cột `catalog_source_ref` và việc ghi vào bảng `shop_bots`.

**Phạm vi:** Chỉ nguồn và PostgreSQL QA dùng một lần. Khác với `sessions.process()` hiện tại: adapter mới không thể lắp trực tiếp vào transaction session do cổng đó truyền `client` riêng — việc tích hợp cả hai phải giữ đúng một chủ sở hữu transaction, cần thiết kế và QA riêng. Không kết nối vào n8n, web, Zalo hoặc Messenger Published. Hosted Supabase vẫn **không có Customer backend role/credential**; đề xuất RLS vẫn chưa được phê duyệt.
