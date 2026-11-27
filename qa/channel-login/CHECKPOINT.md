# Đăng nhập và kết nối kênh · 28/11/2026 JST

## Nguồn và phạm vi

Ghim #520 dd7928ab2f76d49807b0140f6be6a65887838bae cho Zalo Hub, #517 5bf4f50b cho tự cài. #521 b6171b36 là phòng thử Messenger. Trang thực tế đi từ trang chủ qua app/#/dang-nhap hoặc app/#/dang-ky. Gh-pages bc8bc387 trỏ giao diện V28 từ #514 d4a64b4f, khác giao diện #520. Vì vậy có một thay đổi tương thích V28 trên nhánh riêng. Bundle onboarding 78ed6f6 thuộc Camera Cloud, không nhập mã desktop loopback sang ứng dụng shop.

Supabase tien404-staging đang active. Đọc schema cho thấy tenants, stores, store_memberships và channel_connections. Giao diện chọn shop từ membership active của đúng user.id, máy chủ áp RLS. Zalo Bot có gateway và kho kết nối riêng. Khi ra khỏi tài khoản, ứng dụng chỉ đổi phiên. register_shop chỉ chạy khi chủ xác nhận biểu mẫu onboarding. Không thêm bước gộp tài khoản bằng email. Không tìm thấy bảng lời mời trong public qua truy vấn tên, chưa xác minh quy trình mời/chấp nhận. Tài khoản có membership đã cấp được định tuyến theo membership.

Google: Endpoint authorize của dự án staging trả HTTP 400, validation_failed, provider is not enabled. Chưa thể xác minh client, allowlist callback hoặc email trùng bằng tài khoản Google thật. Không đổi provider. Luồng Google Console → Supabase cần URI do Supabase cung cấp (/auth/v1/callback), sau đó Supabase → ứng dụng dùng đúng origin + pathname, ví dụ /demo-git/app/; preview QA riêng chỉ chạy mô phỏng. Mã đăng nhập không mang theo đích chuyển hướng ra bên ngoài.

## Tài liệu nhà cung cấp đã đối chiếu

| Kênh | Tài sản và cơ chế | Phạm vi cần cho lát cắt và phần còn thiếu |
|---|---|---|
| Google | Danh tính chủ qua Supabase Auth, Google OpenID Connect và PKCE | Scope danh tính theo SDK; không cần Drive. Cần bật provider web và duyệt đích trả về. Supabase có cơ chế tự liên kết danh tính đủ điều kiện. TIEN404 chọn quyền theo UID. [Google](https://developers.google.com/identity/openid-connect/openid-connect), [Supabase](https://supabase.com/docs/guides/auth/social-sign-in/auth-google), [identity linking](https://supabase.com/docs/guides/auth/auth-identity-linking) |
| Messenger | Chủ chọn Page, Page token ở server | Điều kiện tùy endpoint: pages_show_list cho chọn Page, pages_messaging cho messages, pages_manage_metadata cho đăng ký webhook theo chức năng. Chưa có Page QA gắn đúng shop, app/redirect/scopes staging chưa xác nhận. [Meta](https://developers.facebook.com/docs/graph-api/webhooks/getting-started/webhooks-for-pages) |
| Zalo Bot | Token bot do chủ cung cấp; Hub xác minh bot và ghép chủ | Dùng lại gateway #520, getMe/webhook và xác nhận trong chat riêng theo phạm vi pilot. Hoa Mai gắn ngữ cảnh một bot QA theo checkpoint #520; chưa xác nhận lại việc ghép trên thiết bị. [Bot Platform](https://bot.zaloplatforms.com/docs/) |
| Zalo OA | Quản trị viên cấp quyền cho ứng dụng OA, access/refresh token theo OA | Chỉ xem trước tên hành động và đích HTTPS; hướng dẫn chỉnh menu qua OA Manager theo gói/quyền. Chưa ghi qua OA API, chưa kiểm chứng vòng đời token hay quyền thao tác mẫu tin trên một OA thực. [Xác thực OA](https://stc-developers.zdn.vn/docs/v2/official-account/bat-dau/xac-thuc-va-uy-quyen-cho-ung-dung-new), [Menu và chatbot](https://oa.zalo.me/home/function/interaction?type=menu-chatbot) |

## Ma trận bằng chứng

| Ca | Môi trường | Kết quả |
|---|---|---|
| Chủ mới, tạo shop và tải lại | Chrome, bản preview mô phỏng | TESTED. QA-C được giữ lại sau reload |
| Chủ hai shop, mở QA-A, nút và menu OA | Chrome, preview mô phỏng | TESTED. Có hai nhánh riêng, OA hiện tên/đích để xem trước |
| Nhân viên QA-A | Chrome, preview mô phỏng | TESTED. Hai trường cấu hình OA bị khóa; adapter SQLite cũng từ chối khởi tạo cấp quyền |
| Hủy rồi thử lại, đăng xuất | Chrome, preview mô phỏng | TESTED |
| Trở lại đường dẫn nội bộ, URL lạ, chọn theo membership | Node unit | TESTED |
| Hai chủ, hai tài sản, đổi tab, callback lặp, hết hạn, sai người/loại, thu hồi vai trò, nhận lại sau ngắt, ngắt riêng từng kênh | Node SQLite QA | TESTED. Adapter độc lập, chưa nối endpoint provider |
| Nối lại Zalo Bot và tách shop | Hồi quy gateway #520 | TESTED offline (75 đạt, 12 bỏ qua do thiếu module legacy). Nối lại qua thiết bị NOT_RUN |
| Google thật: mới/cũ, email trùng, hủy, callback lặp; lời mời shop | OAuth staging | BLOCKED/NOT_RUN |
| Google Android, Google iOS, Google web callback thật; OA/Meta xác nhận, refresh/revoke OA | Provider hoặc thiết bị | NOT_RUN |

Preview riêng: https://tien404-ket-noi-kenh-qa.fairflounder1.chatgpt.site . Trên Chrome local đã đi từ “Tiếp tục với Google” đến QA-A → Kết nối kênh → Zalo Official Account. Không đưa email, token, mã callback hay log người dùng vào bằng chứng.

## Chạy lại và rollback

Tại gốc repo chạy `node --test qa/channel-login/auth.test.mjs gateway/zalo-hub/test/*.test.mjs`. Tại apps/owner chạy `npm ci`, `npm run typecheck`, `npx vite build --outDir /tmp/tien404-owner-qa`. Build preview riêng bằng `npx vite build --config channel-preview/vite.config.mjs --outDir /tmp/tien404-channel-preview`. Dùng Node hỗ trợ node:sqlite. Nhánh V28 kiểm tra thêm bộ qa/v28-account/account-ui.cjs. Đóng draft hoặc revert commit trên đúng nhánh nếu đã tích hợp. Có thể rút riêng site QA. Chưa có migration, thay đổi auth config, webhook hay dữ liệu thật cần hoàn tác.
