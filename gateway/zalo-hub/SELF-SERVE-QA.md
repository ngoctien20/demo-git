# Zalo Lite — chủ shop tự cài dữ liệu riêng

## Mục tiêu và phạm vi

Một chủ shop nối bot qua luồng đăng ký Lite hiện có, nhập mã ghép nối trong hội thoại riêng của bot shop, rồi tự cài sản phẩm. Không tạo workflow, credential AI hoặc bảng Products n8n riêng cho từng khách. Bot TIEN404 AI giữ vai trò đăng ký; kiểm thử bán hàng dùng Bot QA hoặc môi trường cách ly.

Trạng thái mã nguồn: **CANDIDATE** sau kiểm thử tự động; không đồng nghĩa với nghiệm thu khách thật. Chưa tích hợp thanh toán, chuyển giao CSKH theo gói của PR #516, hoặc công cụ tạo đơn vào luồng này.

**Phạm vi đang chạy ngày 26/11/2026:** pilot chỉ dành cho kết nối `qa-zalo-bot`/own. Đăng ký Lite vẫn bật nhưng merchant và Bot TIEN404 AI tiếp tục handler cũ. Các bước tự cài dưới đây hiện nghiệm thu trên Bot QA; chưa công bố tính năng private commerce cho mọi shop. Bằng chứng triển khai: [qa/latest-pilot-deployment.json](qa/latest-pilot-deployment.json).

## Chủ shop thao tác

1. Nối bot qua Bot TIEN404 AI và nhập mã ghép nối vào bot shop như luồng đã có.
2. Nhắn **Bắt đầu**. Bot lần lượt hỏi tên shop, số CSKH được phép công khai (có **Bỏ qua**), mã/tên sản phẩm, giá và tồn kho.
3. Kiểm tra bản xem trước. Nhắn **Thử SP01** để xem câu trả lời. **Lưu** lưu dữ liệu nhưng không tự bật một bot đang tắt; **Bật bot** lưu rồi mở trả lời khách.
4. **Thêm sản phẩm**, **Sửa sản phẩm**, **Xem cấu hình** hỗ trợ vận hành. Sửa sản phẩm hỏi giá/tồn từng bước và cho phép **Giữ nguyên**.
5. **Tạm dừng** ngừng trả lời khách; chủ shop vẫn xem thử và bật lại được. **Hủy** bỏ bản nháp.

Bản nháp hết hạn sau 30 phút, không sửa dữ liệu đã công khai trước xác nhận. Giới hạn pilot: 50 sản phẩm/shop; số tiền VND nguyên; tồn kho nguyên không âm. Các lệnh có dấu `|` cũ vẫn dùng được. Giá và tồn chỉ phản ánh lần chủ shop cập nhật, chưa đồng bộ phần mềm bán hàng.

## Hành vi trả lời

- Shop được xác định từ webhook và dòng kết nối đã xác thực, không lấy từ lời khách.
- Catalog được ràng buộc với connection, store và lần ghép chủ (`owner_epoch`). Hai shop cùng SKU vẫn dùng giá/tồn riêng.
- Ghép chủ chỉ nhận tin văn bản riêng; lưu riêng sender ID và chat ID. Nội dung trong nhóm không ghép chủ.
- AI chỉ phân loại CATALOG/CONTACT/GREETING/OTHER. Nội dung giá/tồn/CSKH được tạo từ dữ liệu đã lưu của shop; đầu ra tự do từ model bị loại bỏ. Không có tool ghi đơn, tồn kho hoặc công nợ.
- Khi AI tắt, quá hạn mức, lỗi hoặc chờ quá 4 giây, vẫn dùng trả lời cục bộ nếu có dữ liệu. Không tự retry model.
- Không trả lời tự do về thông tin không được shop cung cấp. Không tự hứa tạo đơn hoặc báo đơn.
- Tắt/mất cờ commerce không quay về n8n DEMO. `/v1/send` cũ bị chặn cho Lite và QA đã chuyển sang commerce.

## Vận hành và dữ liệu

Migration `0004_lite_private_catalog.sql` thêm owner identity/epoch, catalog, danh sách chat đã liên hệ, quota AI và metadata giao nhận. Số `0003` để dành cho nhánh CSKH #516; migration 0004 không phụ thuộc nhánh đó.

Mã ghép mới tăng epoch: các câu trả lời đang chờ và catalog của lần ghép trước không tự phục vụ chủ mới. Catalog cũ vẫn được giữ để đối chiếu; luồng hiện tại yêu cầu cài lại sau khi ghép lại. Ngắt và nối lại tạo connection mới, không thừa hưởng dữ liệu cũ.

Quota gửi được giữ chỗ nguyên tử trước khi gọi provider. Lượt có kết quả không rõ vẫn tính vào hạn mức và không tự gửi lại. Tạm dừng hoặc cập nhật dữ liệu chặn phản hồi còn đang chờ AI bằng so revision ngay trước dispatch. Tin đã chuyển cho provider trước thời điểm tạm dừng có thể hoàn thành.

`zh_lite_delivery` chỉ ghi connection/message ID, thời điểm và mã kết quả, không ghi nội dung khách, token, số điện thoại hay catalog. `API_ACCEPTED` nghĩa là API chấp nhận, không chứng minh đã hiển thị trên máy khách. Các mã còn lại gồm NO_REPLY, SEND_DISABLED, MONTHLY_CAP, STATE_CHANGED_OR_CAP, PROVIDER_REJECTED, DELIVERY_UNKNOWN, FAILED.

## Cấu hình một lần cho nền tảng

| Biến/binding | Vai trò |
|---|---|
| ZH_LITE_COMMERCE_ENABLED | Bật xử lý Lite riêng; mặc định tắt |
| ZH_LITE_COMMERCE_QA_STORES | Danh sách chính xác shop `qa-*` theo flow own; dùng `qa-zalo-bot` khi thử bot QA |
| ZH_LITE_AI_ENABLED / AI | Bật tùy chọn phân loại bằng Workers AI |
| ZH_LITE_AI_MODEL | Chỉ nhận model đã kiểm tra `@cf/meta/llama-3.3-70b-instruct-fp8-fast` |
| ZH_LITE_AI_DAILY_CAP | Mặc định 20 lần thử/shop/ngày UTC, tối đa 100; 0 tắt |
| ZH_LITE_AI_GLOBAL_DAILY_CAP | Mặc định 100 lần/ngày UTC, tối đa 1000; 0 tắt |
| ZH_LITE_AI_TIMEOUT_MS | Mặc định và tối đa 4000 ms |
| ZH_MONTHLY_CAP | Hạn mức gửi của bot theo cấu hình nền tảng |

AI chỉ nhận câu hỏi ngắn, không nhận ID khách/chủ, credential hoặc toàn bộ catalog. Chặn các mẫu token, số điện thoại, email, URL, địa chỉ trước model. Bộ lọc là giảm dữ liệu gửi đi, không phải bảo đảm nhận diện mọi loại dữ liệu nhạy cảm. Quota giữ chỗ trước inference; deadline không cam kết hủy tính phí của provider.

## Kiểm thử và môi trường cách ly

Chạy `node --test gateway/zalo-hub/test/*.test.mjs` với Node 22+; SQLite thực thi các migration. API Zalo/n8n/Supabase được mô phỏng, không gửi thật. CI `.github/workflows/zalo-hub-qa.yml` chạy lại trên pull request.

Bộ kiểm thử bao phủ wizard, công khai liên hệ sau xác nhận, sửa giá/tồn, hủy/hết hạn, tách hai shop, sender khác chat, khách không sửa cấu hình, ghép lại, revision khi pause/update, quota đồng thời, lỗi model, dữ liệu nhạy cảm và không chuyển DEMO. Kết quả cập nhật trong `qa/RESULTS.md`.

`qa/runtime-check.mjs` là entrypoint QA riêng. Nó nhận D1 riêng và dùng API Zalo/n8n giả trong bộ nhớ; không có lời gọi mạng tới Zalo. GET `/health` nêu rõ chế độ. POST `/qa/run` cần khóa QA riêng. Không bind token hệ thống, token bot thật, khóa chính D1 hiện hữu hoặc secrets n8n vào Worker QA. Dữ liệu QA được gắn run ID, không sửa bảng của môi trường đang phục vụ khách.

Runner hosted phiên bản v2 chia thành 26 request để phù hợp giới hạn truy vấn D1 Free. Continuation được mã hóa và xác thực, hết hạn sau 30 phút, không đưa vào báo cáo công khai. Client `tools/run-hosted-qa.mjs` đọc khóa từ file riêng và chỉ chấp nhận hostname Worker QA cách ly. Chạy thật trên Cloudflare ngày 26/11/2026 đạt 22/22 checks, bao gồm một inference Workers AI thật. 21 lần gửi Zalo vẫn là mô phỏng; xem `qa/latest-hosted-runtime.json`.

## Điều kiện đưa vào Bot QA thật và rollback

1. Đạt kiểm thử cục bộ, CI và Worker/D1 QA cách ly. Đọc lại phiên bản Hub, flags, schema trước triển khai để tránh ghi đè thay đổi đồng thời.
2. Giữ checkpoint phiên bản Worker đang chạy. Áp migration cộng thêm trước khi thay code; dữ liệu hai kết nối hiện có không được chuyển tự động.
3. Entrypoint `pilot/worker.mjs` chỉ chọn candidate cho `qa-zalo-bot`/own; phần còn lại thực thi nguyên module đang triển khai. Xem `pilot/README.md` về bản sao riêng, hash kiểm chứng, CI phạm vi và các test parity bắt buộc trước deploy. Không đưa module live lên GitHub. Không thay webhook Bot TIEN404 AI.
4. Thiết bị thật phải xác nhận pairing, tự cài, khách A/B nhận đúng bot/giá, tạm dừng và API receipt. CI và Worker giả lập không thay thế bước này.
5. Đối chiếu và hợp nhất có kiểm soát với #516 trước bật điều khiển CSKH/dashboard theo gói. Không ghi đè worker của nhánh song song; ưu tiên một cổng gửi thống nhất.

Rollback candidate: tắt commerce và AI để dừng xử lý Lite, giữ catalog để đối chiếu; không chạy DROP hoặc xóa dữ liệu. Nếu phục hồi Worker cũ vốn chuyển Lite vào shared flow, phải dừng các kết nối bị ảnh hưởng hoặc tắt gửi trước để không mở lại đường DEMO. Worker QA riêng có thể tắt endpoint/subdomain, không cần chạm Hub đang chạy.
