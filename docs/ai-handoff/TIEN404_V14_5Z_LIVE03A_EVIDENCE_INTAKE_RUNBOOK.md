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

## G. Evidence received from owner: Zalo Creator and n8n Cloud screenshots (2026-11-16 JST)
- Source: four user-provided screenshots in the chat; screenshots were inspected, NOT uploaded to GitHub or persisted in any staging service. Dates of displayed metrics cannot be independently verified from the screenshots, and financial balance may change.
- Zalo Bot Manager shows **display name `Bot TIEN404 AI`** and **status `Hoạt động`**. Information tab shows **1 user** who has interacted with the Bot. The statistics UI has **Tháng này** selected and a visible bar labelled **3**. These are UI observations, not end-to-end AI model reply evidence.
- General settings visibly contain a Webhook URL beginning `https://ngoctien20.app.n8n.cloud/w...`, masked Secret Token and masked Bot Token. Only the prior API read-only `getWebhookInfo` execution 3855 provided verified exact hosted webhook path. **Do not infer ID from truncated Deeplink/Invite URLs.** No secrets revealed or changed.
- Zalo Bot ID / `getMe.result.id` and Bot ownership binding are NOT shown. Keep ID-02, ID-03 and ID-04 BLOCKED; existing registry still synthetic only. Screenshots do not attest provider identity, trusted store relationship or the Owner's account ID.
- n8n Cloud Overview screenshot of `ngoctien20.app.n8n.cloud` shows **Assistant credits = 0**, **Gateway credits = $0.59** and **129/1000 executions**; instance shown online and 19 active workflows. Distinguish Assistant credits from model/Gateway balance, and executions from model token use. The `$0.59` tile is visual evidence of a Gateway amount, NOT an audit of current available balance, actual model rate, historical spend or Auto top-up policy.
- COST-01 becomes **EVIDENCE_PARTIAL (UI overview shows $0.59, detail timestamp/ledger not certified)**; COST-02 (specific n8n rate), COST-03 (Auto top-up and owner USD ceiling), COST-04 (real token and payment guard) remain BLOCKED.
- No instruction to reset Bot Token, reveal Secret Token, click `Lưu thay đổi`/`Xóa Webhook`, or activate sends. No data written to n8n/Cloudflare from this visual intake.
- Next action requiring owner UI: open Gateway credits `Manage` to inspect current balance, service pricing/usage and Auto top-up (mask billing); then obtain provider immutable Bot ID via trusted `getMe` server-side attestation instead of manually sharing tokens. Do not publish screenshots or sensitive identifiers to public GitHub.
- Conclusion: evidence completeness improved, **LIVE-01 REAL SEND STILL NO-GO**.

## H. Verified from the n8n Gateway credits detail screen (owner evidence, 2026-11-16 02:07 displayed)
- The user supplied two images of the actual authenticated n8n Cloud Console `app.n8n.cloud/manage/gateway`. The images were inspected in chat only; raw screenshots, account email, payment identifiers and session data are **not committed**.
- **Gateway balance displayed: USD $0.59 remaining of free credit**. Progress indicator says `$0.59 / $2.00 left`. This is directly evidenced by the detail page, more reliable than the earlier Overview-only tile, and is therefore `COST-01: UI_BALANCE_OBSERVED`, not final signed account attestation.
- **Free grant history: +USD $2.00**, granted **2026-11-08**, expires **2027-11-08**. This is expiry of the original grant, not a guarantee the $0.59 survives until then.
- Recent consumption indicator: **USD $0.18/day** according to the n8n UI; at that observed rate the interface estimates **approximately three days remaining (around Nov 19, 2026)**. This is a forecast, not a contractual expiry time.
- `Spend` panel set to **Last 7 days / Total** shows **USD $1.20 drawn from balance**. Difference of `$2.00 - $0.59 - $1.20 = $0.21` between full-grant arithmetic and 7-day-spend filter is **not reconciled**; don't attribute it to a specific service, model or date without detailed ledger.
- Detailed Gateway unit pricing and model-specific usage, Auto top-up state, and the owner's approved USD hard ceiling are **not visible** in these screenshots: `COST-02`, `COST-03`, `COST-04` remain BLOCKED. Actual per-call n8n pricing must be used rather than the direct OpenAI public list price.
- Budget risk: recent platform-wide usage about $0.18/day is far higher than the illustrative single three-turn pilot direct-model estimate and may originate from other Gateway-backed usage; **cause is unknown**. Do not conclude an individual workflow is responsible without per-service records. No top-up or billing changes authorized.
- Recommended owner next UI action (read-only): click `Gateway prices` at top of the Gateway screen to inspect the precise model rates; look for service/model-specific usage, and check whether Auto top-up settings are available without changing them. Record a screenshot with payment information masked. Do NOT press `Top up`.
- The other identity blockers (provider getMe `result.id`, trusted real Bot→Shop B→Owner mapping, signed actual ingress) are unchanged. **LIVE ZALO SEND: NO-GO**.

## I. Service pricing page screenshot evidence — 2026-11-16 JST
- Owner supplied a screenshot of authenticated `app.n8n.cloud/service-pricing#openai` showing n8n Cloud **Service pricing**, OpenAI catalogue marked **41 models**, and `Prices per 1M tokens`.
- The visible rows include `chatgpt-image-latest` **$5.00 input/$10.00 output** (image rates separately shown), `gpt-4.1` **$2.00/$8.00**, `gpt-4o` **$2.50/$10.00**, `gpt-4o-mini` **$0.15/$0.60**. These are **not** the configured synthetic-qa workflow model and must not be used to price its pilot.
- The active manual QA model in earlier read-only workflow audit was `gpt-5.4-nano`. **Its exact row is not visible in the supplied screenshot**; `COST-02` remains **BLOCKED / awaiting exact n8n service-pricing row**. Do not substitute direct OpenAI API prices or other displayed models.
- Owner UI step: browser Ctrl+F `gpt-5.4-nano` within the n8n service-pricing page; if absent search `nano`, inspect model availability, and submit only model name and Input/Output unit prices. No secrets/billing changes.
- Previous Gateway balance evidence $0.59 USD from detail page still stands as an observed snapshot, with Auto top-up/owner monetary cap and actual model spending still unverified. LIVE ZALO SEND remains NO-GO.

## J. n8n model price evidence — gpt-5-nano (user transcription, 2026-11-16 JST)
- User supplied n8n Service Pricing row `gpt-5-nano`, input USD 0.05 per 1M tokens and output USD 0.40 per 1M tokens. The row was transcribed by the user and is not independent account billing reconciliation.
- Read-only n8n workflow `OMV22pdETQFVU9ru` has configured model `gpt-5.4-nano` (INACTIVE; version `0bbd2547-e68d-419f-a7cb-3460b38b5528`). `gpt-5-nano` is a **different model ID**; this table row must NOT certify the price of `gpt-5.4-nano`. No model has been changed.
- Hypothetical per-session upper bound for **gpt-5-nano only** if 2,500 actual aggregate tokens are strictly enforced: 2500×USD 0.40/1,000,000 = **USD 0.001** (assuming all billed at output rate). This is a reference bound, not measured n8n spend or a firm monetary cap.
- Compared with previously shown USD 0.59 Gateway Credits, 0.001 USD is small, but account-wide spending averaged USD 0.18/day in the n8n UI. Concurrent instance usage can consume the shared balance.
- COST-02 remains **MODEL_MISMATCH** until n8n shows exact `gpt-5.4-nano` pricing or a separately approved candidate uses `gpt-5-nano` with compatibility and QA tests. COST-03 Auto top-up and owner USD hard cap remain unverified; Zalo sending still NO-GO.
