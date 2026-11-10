# Control Hub · Checklist chủ dự án tự đánh dấu

**11/11/2026 JST · Chỉ đánh dấu 1 trong 4 mục gốc.** [Phiên bản cụ thể](TIEN404_AI_WORK_MASTER_V7_1_CHECKPOINT.md) · [Kết quả QA và execution](TIEN404_AI_V7_1_QA_EVIDENCE.md). Chủ dự án thao tác trên [Control Hub](https://tien404-control-hub.fairflounder1.chatgpt.site).

## A. Có thể đánh dấu hoàn thành

| Mục | Trạng thái | Phạm vi hoàn thành | Bằng chứng | Còn thiếu |
|---|---|---|---|---|
| **1. Xác minh phiên bản Published của 7 workflow** | VERIFIED_DONE · **Đánh dấu** | 7/7 active có Published. Main, Messenger, Website khớp. Create, Manage, Update, Revenue có draft khác published | [Bảng 31 version](TIEN404_AI_WORK_MASTER_V7_1_CHECKPOINT.md) và [4 diff](TIEN404_AI_V7_1_QA_EVIDENCE.md) | Phê duyệt phát hành là nhiệm vụ riêng |

Nếu Hub có nhiệm vụ con, có thể đánh dấu riêng **RLS tầng DB A→B**, **hồi quy Commerce chỉ đọc 64/64**, **đối chiếu bề mặt demo/Render bằng trình duyệt**. Ba bước này không đóng ba mục gốc dưới đây.

## B. Đã làm nhưng chưa nên đánh dấu

| Mục gốc | Trạng thái / được đánh dấu? | Đã hoàn thành và bằng chứng | Còn thiếu để đóng |
|---|---|---|---|
| **2. Kiểm tra cô lập dữ liệu giữa các cửa hàng** | BLOCKED · **Chưa** | DB role authenticated: A đọc 1/1 sản phẩm/đơn A, 0/0 B; B có fixture. Subject không membership thấy 0. Fixture Chromium từ chối response lẫn tenant. [QA](TIEN404_AI_V7_1_QA_EVIDENCE.md) | Hai tài khoản QA độc lập, gọi API thật bằng JWT mỗi bên, kiểm đúng shop sau refresh, không xem shop kia |
| **3. Kiểm tra trừ/hoàn kho và chống đơn trùng** | IN_PROGRESS · **Chưa** | Kiểm đồ thị read-only và chạy preview 17+22+25 ca. Phân biệt sai giá, sai tổng trong node legacy. [1646](https://ngoctien20.app.n8n.cloud/workflow/ZVmMlwe2g0bPjVEq/executions/1646) | Tạo, trừ, hủy, hoàn trên fixture giao dịch riêng; retry và hai request cạnh tranh không làm ghi hai lần; rollback và audit |
| **4. Đối chiếu demo website với backend** | IN_PROGRESS · **Chưa** theo tiêu chí E2E của V7.1 | Đã đối chiếu thực tế theo bảng dưới, tách luồng public và merchant. [PR #7](https://github.com/ngoctien20/demo-git/pull/7) · [QA](TIEN404_AI_V7_1_QA_EVIDENCE.md) | Merchant login → dashboard → đọc dữ liệu có quyền → refresh/logout; xác minh website mô tả đúng khả năng sau tích hợp |

| Điểm trên hành trình | Nguồn hiện tại | Chủ shop có thể suy ra gì |
|---|---|---|
| Pages login, portal, checkout | GitHub Pages, sessionStorage, không yêu cầu mật khẩu | Trải nghiệm minh họa, không có danh tính merchant |
| Demo hội thoại và widget marketing | Kịch bản client và workflow marketing riêng | Tư vấn sản phẩm TIEN404; không có công cụ đọc Orders tenant |
| Render account và Products | Supabase Auth, PostgREST và membership/RLS | Code danh mục đã sẵn sàng cho QA Shop A; trang ẩn danh khóa |
| Orders, Conversations | API GET Orders yêu cầu owner/manager; conversations có bảng/policy | Chưa có màn hình merchant đã nghiệm thu cho hai mục |
| Super Admin, subscription, kết nối bot | PR #2 staging, adapter đọc health, Control Hub riêng | Chưa chứng minh tự cấp shop/gói và kết nối bot xuyên hệ thống |

## C. Chưa thực hiện / cần xử lý

1. **P0** chủ dự án duyệt cấp user staging cho B; đưa tài khoản QA vào cơ chế bảo mật rồi chạy acceptance hai chiều. Kiểm callback recovery bằng quyền quản trị Supabase; giữ recovery tắt tới khi QA email/PKCE đạt.
2. **P0** xử lý 6 ca sai của Revenue Published. Kiểm bốn Draft với dữ liệu lịch sử đã khử định danh và chính sách chuyển người xử lý. Phải có quyết định riêng trước publish.
3. **P1** kiểm cạnh tranh kho trên staging có giao dịch; hoàn thiện UI dữ liệu thật, thiết bị mobile, quan sát lỗi và restore.
4. **P1/P2** benchmark AI theo shop, usage và entitlement; nghiệm thu cấp shop và bot trước pilot thương mại.

**Không có checkbox nào được thay đổi trong phiên.**
