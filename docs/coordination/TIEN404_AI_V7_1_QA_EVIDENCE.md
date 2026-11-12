# QA evidence · Work V7.1

11/11/2026 JST. Ô PASS chỉ áp dụng cho phép thử và môi trường trong dòng. [Mốc triển khai và inventory](TIEN404_AI_WORK_MASTER_V7_1_CHECKPOINT.md). [Auth V6 đã đăng nhập thật trên bản cũ](https://github.com/ngoctien20/demo-git/blob/8ff253b/docs/SUPABASE_AUTH_V2_CHECKPOINT.md).

| Môi trường / phép thử | Đầu vào và kỳ vọng | Kết quả quan sát | Phán quyết / bằng chứng |
|---|---|---|---|
| Render Auth · login | Mở trang ẩn danh, chờ SDK. Nút phải mở sau khởi tạo | Trên cb9d187 nút bật, hiện hướng dẫn tài khoản staging | PASS · [login](https://tien404-auth-staging.onrender.com/login.html) |
| Render Auth · account | Mở trực tiếp không JWT. Dữ liệu riêng phải ẩn | Thông báo phiên không hợp lệ/hết hạn, protected.hidden=true. Nút retry có mặt và ẩn khi khởi tạo bình thường | PASS · [account](https://tien404-auth-staging.onrender.com/account.html) |
| PR #7 · Chromium fixture | Chặn module account, tiến đồng hồ 24 giây. Không lộ dữ liệu, phải báo lỗi và hiện retry | Hồi quy mới đạt cùng ca JavaScript tắt/Enter, login sai/đúng, danh mục, refresh, đổi identity, logout, mobile dark mô phỏng | PASS · [CI 42902044096](https://github.com/ngoctien20/demo-git/actions/runs/42902044096) |
| PR #7 · unit/build | Kiểm helper, timeout, tenant filter, artifact allowlist và không dùng auth demo | Static PASS, 13/13 Node PASS; kiểm điều hướng CI PASS | [CI điều hướng](https://github.com/ngoctien20/demo-git/actions/runs/42902044063) |
| Supabase staging · baseline | Đếm fixture quản trị, không đọc nội dung. Để negative có ý nghĩa Shop B phải có hàng | Shop A và B mỗi nơi 1 product, 1 order; A có membership, B không có | PASS · [project](https://supabase.com/dashboard/project/ifxlvrhyjhbzbrkdsida) |
| PostgreSQL staging · RLS A | BEGIN READ ONLY, lấy UUID QA A từ membership đã biết và UUID hai QA shop; set_config transaction-local claim sub; SET LOCAL ROLE authenticated; đếm từng shop; ROLLBACK | current_user=authenticated, thấy 1 tenant, products A/B=1/0, orders A/B=1/0. B có fixture thật | PASS một chiều tại DB; không phát hành JWT, không gọi HTTP |
| PostgreSQL staging · không membership | BEGIN READ ONLY; SET LOCAL ROLE authenticated; subject UUID ngẫu nhiên, chạy SELECT count(*) rồi ROLLBACK | Memberships/tenants/products/orders đều 0 | PASS tầng DB; không phải phiên B |
| Data API staging | GET /health và /api/v1/tenants không bearer. Mong health trung thực, route riêng từ chối | mode=staging, CONFIGURED_NOT_VERIFIED, database_connected=false; endpoint trả AUTH_REQUIRED | PASS public smoke · [health](https://tien404-data-staging.onrender.com/health) · [tenants](https://tien404-data-staging.onrender.com/api/v1/tenants) |
| PR #5 · acceptance runner | Backend giả lập trả thiếu items, [] hoặc row thiếu id ở shop QA đã seed. Phải fail | Thêm 3 hồi quy, CI fixture Data Platform và Super Admin PASS. Local thiếu pytest nên dùng runner CI cài dependency pin | [Data QA](https://github.com/ngoctien20/demo-git/actions/runs/42902308235) · [Admin QA](https://github.com/ngoctien20/demo-git/actions/runs/42902308281) |
| Auth thật bản mới / Android thật | Đăng nhập A, refresh, role owner, danh mục theo quyền, logout, thu hồi và IME | Không có phiên QA A trong Cloud Browser. Không tái mở thẻ chờ đăng nhập đã hủy. Chưa có bằng chứng thiết bị thật hoặc Safari | BLOCKED cho Auth thật; mobile vật lý chưa nghiệm thu |
| Hai JWT độc lập | Hai user khác nhau, đọc dữ liệu của mình, 404 khi đọc shop kia | Chỉ có 1 Auth user. Công cụ chấp nhận A riêng và báo PARTIAL; cần B cho chiều ngược | BLOCKED · [runner](https://github.com/ngoctien20/demo-git/blob/83c390c/ops/data-platform/scripts/live_auth_acceptance.py) |
| Pages & website drafts | Kiểm nhãn demo trực tiếp; quét đường dẫn/meta và điều hướng | Live login ghi dùng email bất kỳ, không yêu cầu mật khẩu. PR #4 trước sửa có 1 lỗi mô tả; sau sửa 27 trang/873 tham chiếu, 0 lỗi. PR #6 kiểm 24 trang điều hướng + integrity PASS | [Pages](https://ngoctien20.github.io/demo-git/login.html) · [PR #4](https://github.com/ngoctien20/demo-git/commit/612f609a7471314b28d2a6bbe6b0ce658ee43257) · [PR #6](https://github.com/ngoctien20/demo-git/pull/6) |
| Knowledge offline | QA truy xuất đúng tenant/ngành, bỏ record lỗi, không trả draft | 10/10 unit fixture PASS trên 6cbb6d0. Corpus có 96 single chưa ghi output; 36 case NOT_RUN gồm 9 ca một lượt và 27 nhiều lượt; 97 dòng lịch sử có 1 định nghĩa lặp | [Lab](https://github.com/ngoctien20/demo-git/tree/6cbb6d0/qa/lab) |
| HMAC lịch sử | Đọc metadata execution thật và checkpoint assertion | 1639 success cho chữ ký hợp lệ; 1641 error là ca âm, checkpoint ghi 401 INVALID_SIGNATURE. Không replay. Replay cache hiện là process-local | [checkpoint HMAC](https://github.com/ngoctien20/demo-git/blob/9508321/ops/data-platform/checkpoints/LIVE_INTEGRATION_QA_20261110.md) |

## Commerce chạy mới

Kiểm tra graph và dependency trước khi chạy bằng manual trigger. Catalog, Cart, Rules, Business và Tenant Resolver chỉ dùng dataTable get trên đường chạy, code xử lý và subworkflow. Đọc assertion cuối, không suy kết quả chỉ từ trạng thái success.

| Suite | Mong đợi | Quan sát | Execution |
|---|---|---|---|
| Catalog + Cart | 7 và 10 ca | 7/7 + 10/10 | [1646](https://ngoctien20.app.n8n.cloud/workflow/ZVmMlwe2g0bPjVEq/executions/1646) |
| V3 Business | 22 ca | 22/22 | [1645](https://ngoctien20.app.n8n.cloud/workflow/tjsVobfjKLnv0o6b/executions/1645) |
| V3 Extension | 25 ca | 25/25 | [1644](https://ngoctien20.app.n8n.cloud/workflow/QR7aYMpLfKDLVgyH/executions/1644) |

Tổng **64/64** quyết định sandbox. Các execution cũ 1473, 1474, 1479, 1604 vẫn mang trạng thái success. Các suite này không thực hiện commit kho, hoàn hàng hay kiểm isolation của giao dịch đồng thời.

## Bốn workflow lệch Draft / Published

Version ID đầy đủ trong [inventory](TIEN404_AI_WORK_MASTER_V7_1_CHECKPOINT.md). Graph connections không đổi ở cả bốn. Đọc code hai version bằng n8n, chỉ chạy từng node JS thuần trên fixture trong bộ nhớ, không gọi subworkflow, Sheets, Gmail hay Meta.

| Workflow / node thay đổi | Giá trị thử và kết quả Published → Draft | Ảnh hưởng khi publish và bước tiếp |
|---|---|---|
| [Create Order](https://ngoctien20.app.n8n.cloud/workflow/KrSn4DNR9ALX5ng4) · Validate Order | Giá “100bad”, đầu vào còn lại hợp lệ. Published trả ok/create, Draft từ chối. Draft kiểm số nguyên an toàn, tổng tiền và thay cách tạo mã đơn | Có thể chặn dữ liệu giá lỗi trước append. Kiểm migration định dạng, trùng đơn, retry và concurrency trước duyệt |
| [Manage Order](https://ngoctien20.app.n8n.cloud/workflow/fDB9dvs1qPPVt9Sp) · Validate Change, Check Update Result | quantity=1, unit=100, total=999. Published cho preview; Draft trả corrupted_order_amount. Code Draft kiểm lại mã đơn và định dạng số điện thoại sau ghi | Các đơn cũ có tổng sai sẽ chuyển người xử lý. Kiểm preview/apply và read-back trong fixture ghi riêng |
| [Update Order](https://ngoctien20.app.n8n.cloud/workflow/BkAi6TVUKAjCnI7v) · Validate Address Update | Địa chỉ chỉ gồm 12 chữ số được Published chấp nhận; Draft từ chối. Draft cũng siết đầu số di động | Có thể từ chối đầu số/địa chỉ cũ. Duyệt phạm vi hỗ trợ và kiểm dữ liệu khử định danh |
| [Revenue Report](https://ngoctien20.app.n8n.cloud/workflow/U2DJsxzSYPH5hRop) · Code in JavaScript | Trên cùng 9 fixture: Published **3/9**, Draft **9/9**. Published sai số có phân nhóm, hậu tố tiền, số thập phân .00 định dạng nhóm; không từ chối null, chữ, số âm | Published có thể báo thiếu/sai tiền. Draft sẽ dừng khi gặp paid total lỗi. Cần cảnh báo cho chủ shop, xử lý dòng lỗi và chạy shadow report trước duyệt. [9 fixture](https://github.com/ngoctien20/demo-git/blob/6cbb6d0/qa/lab/revenue_contract.cjs) |

**Chưa được chứng minh:** giao dịch kho đúng khi cạnh tranh, khôi phục Data Platform sau sự cố, quản trị từ Sites đến Supabase, recovery email/allowlist, Android/iOS thật, JWT real cho API và độ chính xác hội thoại trên benchmark đầy đủ. Rollback ứng dụng về deployment trước đã xác định; chưa thực hiện diễn tập rollback trên dịch vụ đang chạy.
