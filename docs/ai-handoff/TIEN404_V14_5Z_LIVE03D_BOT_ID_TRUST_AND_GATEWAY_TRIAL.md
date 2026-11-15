# TIEN404 AI — V14.5Z-LIVE03D: Trusted Bot Identity Provenance & Trial Credit Gate

**Ngày checkpoint:** 16/11/2026 (JST)  
**Nhánh:** `work/v145z-live01-limited-uat-gate`  
**PR:** https://github.com/ngoctien20/demo-git/pull/103 — DRAFT  
**Quyết định:** PROVIDER BOT REAL ID / OWNER IDENTITY BLOCKED · LIVE SEND NO-GO

## 1. Phạm vi được phê duyệt
Người dùng phê duyệt tiếp tục từ LIVE03C. Đã thực hiện kiểm toán chỉ đọc n8n Cloud, cấu hình workflow, registry và tài liệu nhà cung cấp; bổ sung mã xác minh danh tính **chỉ chạy offline** trên nhánh Draft. Không thay đổi production, webhook Published, credential, thanh toán, Bot Token, dữ liệu khách, cấu hình Zalo đang hoạt động hoặc gửi Zalo thật.

## 2. Bằng chứng tài khoản n8n Cloud được đọc trực tiếp (không sửa)
Đã đọc tab được kết nối với n8n Cloud Console `https://app.n8n.cloud/manage/gateway` bằng Browser read-only:
- Gateway credits **$0.59 remaining of $2.00 free credit**, cập nhật UI **16/11/2026 02:35**.
- Free grant: **08/11/2026**, hết hạn **08/11/2027**; đây là hạn credit, không phải bảo đảm credit còn dùng đến thời điểm ấy.
- Khoản chi hiển thị `Last 7 days / Total`: **$1.20** (làm tròn); phân rã theo UI: Nov 9 $1.00; Nov 10 $0.07; Nov 11 $0.13; Nov 12/13 $0.00; Nov 14 $0.0026; Nov 15 $0.0001. Có thể có chênh lệch do làm tròn và ngày ngoài bộ lọc; **không gán nguyên nhân khi thiếu breakdown theo mô hình/workflow**.
- UI: **$0.18/ngày** gần đây, dự báo khoảng ba ngày, và banner **"7 days left in your n8n trial"**. Trial là rủi ro vận hành riêng biệt cần xử lý trước khi phục vụ khách hàng.
- Phần trang đọc chỉ có **Top up** button, KHÔNG bộc lộ trạng thái `Auto top-up`; chưa bấm, chưa mua và chưa đổi setting.
- n8n docs **https://docs.n8n.io/deploy/use-n8n-cloud/gateway-credits/**: Gateway balance chung instance; trong **free trial** có credit nhưng **không thể nạp thêm trước khi nâng lên gói trả phí**. Điều này là quy định công bố chung, **không chứng minh toggle Auto top-up của tài khoản cụ thể đang OFF**.
- Giá n8n `gpt-5.4-nano` đã xác minh từ ảnh người dùng: Input $0.20/1M token, Output $1.25/1M token. Chi phí model-only 2,500 token giả định toàn output = **$0.003125**. Số dư hiện tại không phải ngân sách riêng cho LIVE01.
- COST-01: `UI_BALANCE_OBSERVED`. COST-02: `EXACT_MODEL_PRICE_ROW_VISUAL_VERIFIED`. COST-03: `AUTO_TOPUP_ACCOUNT_SETTING_UNKNOWN; OWNER_MONEY_CAP_NOT_APPROVED`. COST-04: `LIVE_ACCOUNT_CONCURRENT_HARD_GUARD_NOT_VERIFIED`.

## 3. Zalo Bot / Registry / Owner — kiểm toán nguồn thực tế
- Chính thức theo **https://docs.zaloplatforms.com/docs/BOT/apis/getMe**: `POST /bot<TOKEN>/getMe` trả `{ok:true,result:{id:"...",account_name:"..."}}`. Bot ID là `result.id`; **không dùng tên hiển thị, Deeplink hoặc boolean token_valid thay thế Bot ID**.
- Existing n8n manual read-only getMe execution `3854 SUCCESS` dùng existing gateway, nhưng gateway đã cố ý trả boolean `bot_token_valid:true`, không trả `result.id`. Không có nguồn chính thức để đối chiếu Bot ID thật.
- Existing `TIEN404_R1_SHOP_BOT_REGISTRY_QA` ID `qLf19z9QjEaIHk00`: hai dòng `zalo_bot_fixture / synthetic_qa / dry_run`. Không được chuyển các dòng này thành verified.
- Existing `TIEN404_ZALO_OWNER_ALLOWLIST_STAGING_V1` ID `dRPj5k0t51hihJUW`: một dòng `ALLOWED_STAGING_OWNER`, hết hạn `2026-11-20T13:17:32.511Z`; không chia sẻ Chat ID thật. Chỉ có allowlist **không chứng minh** tài khoản Owner đó thật sự thuộc Bot Shop B.
- Existing Published ingress `yIJk8LvJoLF40Z62` vẫn `trusted_bot_id:'b'` hard-coded trong scope `SINGLE_STAGING_WEBHOOK_TO_SYNTHETIC_SHOP_B`, phiên bản `8ca4a6f6-ab3f-42f1-8637-d4f5db790a3e`, chưa sửa.
- Existing private router `sIPs6egzIwOY1GNv` version `8d91d23c-cd87-462f-a112-9cca2340bec8`, chưa sửa.
- Existing Cloudflare outbound vẫn `ZALO_SEND_ENABLED=false`; tất cả QA grant LIVE03C `QA_STOPPED`. Không sử dụng Bot Token, chưa gửi Zalo.

## 4. Mã ứng viên LIVE03D — IMPLEMENTED, OFFLINE TESTED
- Source `qa/zalo-live-v145z/live03d-trusted-identity-preflight.cjs`: `makeVerifier()` nhận dependency chỉ từ **trusted server runtime**, không nhận `verified:true`, bot ID, owner ID từ client. Đòi hỏi:
  1. trusted `getMe` transport thực sự, HTTP 200, `ok:true` và `result.id` dạng chuỗi số;
  2. đúng **một** mapping server Bot ID → `zalo_bot_creator / verified_provider_id / limited_qa / synthetic_fixture=false` cho tenant/store được pin phía server;
  3. đúng **một** Owner allowlist chưa hết hạn;
  4. callback xác minh **riêng** Owner tương ứng với Bot và sự đồng ý Owner, freshness 120 giây;
  5. HMAC-SHA256 domain-separated bằng khóa bí mật server được cấp **ngoài source** để chỉ xuất hash Bot/tenant/store/owner.
- Kết quả **luôn `can_send:false` và `can_promote_registry:false`**. Ngay cả khi mô phỏng tích cực, nó chỉ trả `ELIGIBLE_FOR_SIGNED_CERTIFICATION_ONLY`, không tự tạo chứng thư có chữ ký, không được gửi tin.
- Số Bot ID ví dụ trong kiểm thử lấy từ **sample response công khai trong tài liệu Zalo**, KHÔNG phải Bot ID của TIEN404.
- Test `qa/zalo-live-v145z/live03d-trusted-identity-preflight.test.cjs`: **31/31 PASS** gồm giả mạo provider, số ID sai, duplicate registry/Owner, cross-tenant/cross-shop, expired Owner, consent thiếu/sai/stale, không rò raw ID hoặc secret và bất biến no-send.
- GitHub run [43742910640](https://github.com/ngoctien20/demo-git/actions/runs/43742910640): **234/234 PASS**, tính cả 203 bài trước đó + 31 LIVE03D. Không có workflow, Worker hoặc D1 mutation trong LIVE03D.

## 5. Giới hạn tính xác thực và bước tiếp theo
Mã ứng viên không chứng minh được identity thực tế vì chưa có **server-owned provider `getMe.result.id` attestation** và **independent Owner provider pair verifier** được kết nối. Dependency injection trong QA chỉ là fixture; chính xác tuyệt đối không coi 31 tests là proof of ownership.

Cần:
1. Thiết kế endpoint **read-only, chỉ trả HMAC digest/attestation**, dùng Bot Token hiện hữu trong trusted runtime; tuyệt đối không lộ token hay Bot ID thô; tránh sửa Worker gửi hiện tại nếu chưa duyệt riêng.
2. Xác thực quyền người quản lý Bot Shop B qua provider và thông tin quyền của Shop/Owner; lập server-side mapping nguyên tử ở bản staging mới, KHÔNG promote synthetic registry rows.
3. Với tài khoản trial, xác minh ngày hết hạn dịch vụ, chính sách nâng cấp và rủi ro mất khả năng n8n vận hành; không bấm nâng cấp hoặc nạp credit nếu chưa có phê duyệt ngân sách.
4. Nắm trạng thái Auto top-up sau khi có màn hình cài đặt có thể đọc thật; không tự diễn dịch nút `Top up` thành Auto top-up ON/OFF.
5. Hoàn thiện giới hạn chi phí có chứng nhận account-wide, usage thực tế và money cap được chủ dự án phê duyệt riêng.
6. Trình lại các cổng FINAL LIVE GO/NO-GO, gửi riêng đúng một Bot, một Owner, tối đa ba phản hồi/ba model calls/2,500 token/10 phút, với kill switch, rollback và explicit last approval.

## 6. Checkpoint, rollback, tách môi trường
Chỉ thay đổi source/test/CI và tài liệu trong **Draft PR #103**. Không merge, không triển khai Worker, không sửa registry, không đọc token thô, không thay quyền, credential, subscription hay production. Rollback: revert các commit LIVE03D trên nhánh Draft, giữ Published ingress và outbound Worker như hiện tại.

**FINAL LIVE STATUS: NO-GO.**
