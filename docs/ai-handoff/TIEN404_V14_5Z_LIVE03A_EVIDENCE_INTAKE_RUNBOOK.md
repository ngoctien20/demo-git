# TIEN404 AI — V14.5Z-LIVE03A — Trusted Provider & Gateway Evidence Intake

**Ngày:** 2026-11-16 JST  
**Tình trạng:** CANDIDATE · EVIDENCE REQUIRED · NO-SEND  
**Dự án:** TIEN404 AI, Draft PR #103, nhánh `work/v145z-live01-limited-uat-gate`

## Phạm vi được cho phép
Tiếp tục kiểm toán, thu thập và đối chiếu thông tin **chỉ đọc**; chưa cho phép gửi Zalo, kích hoạt workflow, deploy sang production, thay đổi credential/billing, webhook Published, Store RLS, dữ liệu thật hay cấu hình quyền quan trọng. Mọi bằng chứng phải đến từ nguồn xác thực, không nhận chuỗi `verified:true` do phía khách đưa vào làm chứng nhận.

## A. Nguồn định danh Zalo Bot Creator — yêu cầu từ chủ dự án

1. Đăng nhập **Bot Manager** bằng tài khoản có quyền quản lý bot QA.
2. Mở đúng Bot QA dự định dùng cho Shop B, xem **Bot ID** và tên Bot. API `getMe` chính thức trả `result.id`, `result.account_name`, `result.account_type` và `result.can_join_groups` theo https://docs.zaloplatforms.com/docs/BOT/apis/getMe.
3. Bằng chứng: ảnh đã che dữ liệu nhạy cảm nhưng hiển thị tên Bot, Bot ID, khu vực quản lý và thời điểm kiểm tra. **Không gửi Bot Token, mã xác thực, webhook secret, link token, raw Chat ID hay thông tin khách hàng.**
4. Bản đối chiếu server phải tự truy xuất hoặc có xác thực nguồn `getMe` thật và so sánh `result.id` với Bot đã được chủ dự án lựa chọn. **Ảnh người dùng cung cấp là thông tin hỗ trợ, không tự động trở thành server attestation.**
5. Xác định rõ `shop_id/tenant_id` QA của Shop B từ nguồn server tin cậy. Hiện registry `TIEN404_R1_SHOP_BOT_REGISTRY_QA` có hai bản ghi `zalo_bot_fixture / synthetic_qa / dry_run`; không promote các bản ghi đó lên verified.
6. Xác nhận tài khoản **Owner QA** là tài khoản thử nghiệm được chủ shop cấp quyền, và đưa đúng một định danh người nhận vào hệ thống xác thực phía server. Bản so sánh định danh/allowlist phải thực hiện riêng tư; không sao chép Chat ID ra GitHub, báo cáo công khai hoặc log. Allowlist QA trước đó hết hạn **2026-11-20T13:17:32.511Z**; không tái sử dụng sau khi hết hạn.

**Chỉ đạt** khi có bằng chứng provider + mapping shop/owner độc lập, khớp trường Bot ID/owner và thời hạn còn hiệu lực.

## B. Nguồn n8n Cloud Console — yêu cầu từ chủ dự án

Mở n8n Cloud Console → **Manage → Gateway credits** (nếu bố cục đổi, vào trang Gateway credits tương ứng). Cần kiểm tra tại thời điểm sát nghiệm thu:

- Số dư **Gateway credits** dùng chung cho instance, phân biệt với Assistant credits.
- Mô hình n8n Gateway thực sự cho phép gọi và **đơn giá do n8n công bố** trong service pricing của đúng model (USD/1M input/output, giá cached/reasoning nếu có).
- Mức sử dụng và chính sách Auto top-up (bật/tắt, ngưỡng nạp, số tiền nạp tối đa), **chỉ đọc**, không bấm nạp hoặc lưu thay đổi.
- Phạm vi tiền tệ tối đa chủ dự án chủ động chấp thuận cho một phiên QA (USD), với tối đa **3 model calls, 3 phản hồi, 10 phút và 2500 token tổng**.
- Nếu có nhiều workflow hoặc chạy đồng thời, phải có cơ chế ngân sách **theo instance** kiểm soát tranh chấp, đặt trước token **trước khi gọi AI** và khống chế max output. Không suy ra chi phí cứng từ 2500 token đã được đặt trước trong D1 synthetic QA.

**Bằng chứng:** ảnh chụp phần Balance, model pricing, Auto top-up (che thông tin nhạy cảm), timestamp và đường dẫn trang chứng minh. Không gửi số tài khoản, thông tin thanh toán hay credential.

Tài liệu nguồn: https://docs.n8n.io/deploy/use-n8n-cloud/gateway-credits/  
Trang đơn giá nguồn: https://app.n8n.cloud/service-pricing

## C. Gate kỹ thuật/nhân sự bắt buộc trước khi đề xuất Live

| Mã | Tiêu chí | Trạng thái 2026-11-16 |
|---|---|---|
| ID-01 | Zalo `getMe` xác minh Bot Token | VERIFIED, exec 3854 |
| ID-02 | `getMe.result.id` được ghi nhận trong môi trường tin cậy | BLOCKED — gateway đang chỉ trả boolean |
| ID-03 | Bot thật → Shop B tenant/store qua registry tin cậy | BLOCKED — hiện synthetic_qa/dry_run |
| ID-04 | Đúng 1 Owner QA được xác minh và đồng ý tham gia | BLOCKED — allowlist chưa đủ xác minh |
| ID-05 | Webhook provider trỏ đúng staging | VERIFIED, exec 3855 |
| ID-06 | Chữ ký/integrity của event provider thật được xác minh server-side | BLOCKED |
| SEC-01 | D1 QA hosted replay/CAS/quota | TESTED ở dữ liệu synthetic, không phải live identity |
| SEC-02 | LIVE02 Worker /v1/send bị chặn 423 | VERIFIED qua n8n exec 3853 |
| COST-01 | Số dư Gateway của instance tại thời điểm thử | BLOCKED |
| COST-02 | Mức giá thực tế của n8n model đang chọn | BLOCKED |
| COST-03 | Auto top-up và hạn mức USD được chủ dự án phê duyệt | BLOCKED |
| COST-04 | Đo và khống chế tiền/token trên chính tuyến model thật | BLOCKED |
| GO-01 | Nghiệm thu được đính kèm và phê duyệt gửi thử cuối cùng | CHƯA CÓ |

**Lưu ý:** `gpt-5.4-nano` được cấu hình ở workflow manual QA nhưng việc có thể gọi qua Gateway không đồng nghĩa với việc đã kiểm toán phí n8n. Giá API OpenAI chỉ được dùng làm tham chiếu, KHÔNG phải giá đã bị trừ vào tài khoản n8n.

## D. Không được tự suy luận

- Phê duyệt “được phê duyệt” ở giai đoạn này **không phải** xác nhận kích hoạt gửi thật, công khai Webhook hoặc thay đổi production.
- Không thay các synthetic mapping thành verified bằng sửa trực tiếp một cột.
- Không dùng ảnh do người dùng gửi như một chữ ký mật mã hay bằng chứng quyền sở hữu bot nếu chưa được đối chiếu phía server.
- Không nhận raw credential hoặc Bot Token để kiểm toán.
- Không tự động mở, thay đổi, thu tiền, nạp tiền hoặc bật Auto top-up.
- Cổng `live03-identity-budget-gate.cjs` chỉ có 5 trust roots mô phỏng trong CI; hiện chưa có năm signer/attestor độc lập được cấp thực tế và code luôn `can_send:false`.

## E. Trình tự tiếp theo

1. Chủ dự án cung cấp bằng chứng đã che nhạy cảm từ Bot Manager và Gateway credits.
2. Kiểm tra đối chiếu provider ID bằng read-only endpoint trả **digest/attestation server-side**, thiết kế và kiểm thử trên một bản staging riêng. Nếu cần thay đổi old gateway dùng credential thật, phải xin phê duyệt phạm vi cụ thể trước khi thực hiện.
3. Khi xác thực danh tính và chi phí đạt, phát hành bản tổng hợp rõ `VERIFIED/TESTED/BLOCKED` và thiết kế cổng outbound/outbox có kill switch.
4. **Xin phê duyệt gửi Zalo thật cuối cùng riêng** với Bot ID đã xác minh, người nhận đã xác minh, đúng cửa sổ 10 phút, tối đa 3 lượt, token/tiền tệ và rollback. Tuyệt đối không gửi trước khi có bước 4.

## F. Rollback và checkpoint

Đây chỉ là tài liệu trong Draft PR, không thay đổi API, D1, n8n workflow, Cloudflare settings, token hay production. Rollback: revert commit tài liệu hoặc đóng PR Draft. Existing outbound Worker giữ `ZALO_SEND_ENABLED=false`; LIVE02 QA grants đã ở trạng thái `QA_STOPPED`. Không có dữ liệu thật được ghi.
