# V12.4R · Bàn giao lõi hội thoại khách hàng

**WORK · 15/11/2026 JST · EXPERIMENTAL.** Chủ Shop B đã xác nhận ghép nối trong workstream Owner. Hai tài khoản Owner và hai khách hàng trong core là hai phạm vi khác nhau. V12.4R chỉ lập bản xem trước. [PR #52](https://github.com/ngoctien20/demo-git/pull/52) · [API và cách chạy QA](../../qa/commerce/v124-core/README.md).

## Checkpoint trước khi sửa và phạm vi

| Phần | Bằng chứng / quyết định |
|---|---|
| Customer | #52 open draft, base `work/v12-r1-shop-owned`, nhánh `work/v124-public-ai-reply-pilot-20261115`. Mốc rollback `f6195154a698650e6789ff27f49761f19cce6d3a`, Git bundle đã kiểm tra đủ lịch sử; 83/83 chạy lại trước thay đổi. [CI gốc](https://github.com/ngoctien20/demo-git/actions/runs/43620041047). |
| Owner | [#41](https://github.com/ngoctien20/demo-git/pull/41) open draft, HEAD kiểm lúc đầu `2ce3eeb046b317b3ea1ec3e70e617b843a2e8881`. Nhánh sở hữu Shop B Owner sessions, RLS và backup. Không dùng các bảng đó cho Customer. |
| Tester | #53–56 là các PR về Tester và Google Sheets. Không đưa bảng Tester hoặc credential DEMO vào core. |
| Phiên bản | [Manifest](../../qa/commerce/v124-core/version.cjs) ghi phiên bản core, prompt, knowledge, resolver, catalog, conversation, QA và channel. Đề xuất xét Candidate cho phạm vi logic + PostgreSQL cô lập; quyết định promote thuộc chủ dự án. |

## VERIFIED · Hạ tầng và ranh giới dữ liệu

Supabase `ifxlvrhyjhbzbrkdsida`, 14 migration lúc kiểm. Mới nhất `20261114170717` thuộc Tester. RLS bật trên 20 bảng public, 8 bảng `tien404_r1_qa` và 2 bảng `tien404_dialogue_private` thấy trong truy vấn kiểm kê. `public.products` có policy SELECT cho `authenticated` khi membership còn hiệu lực. Catalog này có tenant, chưa có store. Catalog fixture có khóa tenant/store/bot/SKU; `anon`, `authenticated`, `service_role` đều thiếu quyền USAGE schema và SELECT bảng QA khi kiểm. Giữ quyền hiện tại. Không có bảng customer state của bản này trên Supabase hosted.

Ngày 15/11 lúc **02:58:35 JST** connector đọc trực tiếp bot ở mode `dry_run/synthetic_qa` và đúng mã F01. Kết quả tức thời Shop A **159.000đ, 3**, Shop B **199.000đ, 5**. Bảng QA không có active theo sản phẩm, giá sỉ, size, màu, đơn vị hoặc timestamp xác minh nghiệp vụ. Không suy ra các trường này từ tên. Không cache số liệu này cho câu trả lời sau.

| Workflow n8n | ID | Draft đã đọc | Published |
|---|---|---|---|
| Zalo V1 ingress | yIJk8LvJoLF40Z62 | 8ca4a6f6-ab3f-42f1-8637-d4f5db790a3e | cùng draft |
| Customer router V12.3 | sIPs6egzIwOY1GNv | 8d91d23c-cd87-462f-a112-9cca2340bec8 | cùng draft |
| Owner Shadow | OgDZNSAvKEvhnAvn | f00ba506-c52a-4340-9a0c-809fd9c6ea9a | cùng draft |
| Reply Guard QA | nKNKDLO4l2PXL4tx | 48d0e00c-3b3a-42ca-8551-ae7de6410f44 | không có |
| AI Intent Draft | uGesZLvNkhY4ZO6l | 27f8744a-229a-4da3-9ccf-1325e2d1cf89 | không có |
| Commerce AI sandbox | iyfGUiEsZlNTBWOR | ddc3ce5b-365e-47e2-a06d-08daffceb9a8 | không có |

V1 có node gọi router V12.3 và Owner Shadow. Không có đường gọi tới core V12.4R. Cloudflare settings Worker `tien404-zalo-outbound-v1-staging` xác nhận `ZALO_SEND_ENABLED=false`. Bốn interface kênh của V12.4R đều khóa. Không thay đổi hoặc publish workflow, không gửi tin, không ghi Orders hoặc Outbox.

## IMPLEMENTED · Customer Core

- Mở rộng entrypoint preview hiện có. Một engine dùng cho mọi shop, thêm SELECT theo tenant/store/bot/SKU, tùy chọn dữ liệu sỉ đã kiểm, giá/tồn đọc lại mỗi lần tính. Tổng VND tính từ số nguyên an toàn; hàng thiếu, giá lỗi, báo giá cũ và số lượng không rõ sẽ yêu cầu kiểm tra lại.
- Resolver kiểm binding active, hết hạn, thu hồi và scope. Context Customer lưu nội bộ trong process, không thể tái lập bằng JSON. Scope phiên phân tách cả kênh, bot và người gửi qua HMAC. Dữ liệu giá, PII và lịch sử chat không được lưu vào session.
- Customer session và receipt chạy chung transaction với SELECT catalog. Khóa cùng một hàng trước khi kiểm receipt, giới hạn tốc độ và cập nhật revision. Giữ thứ tự lượt đến, rollback khi lỗi kho/model, chặn retry đã xử lý. Người dùng có thể đổi số lượng, đổi sản phẩm, hủy nháp và bắt đầu lại khi hết hạn.
- Intent tiếng Việt dùng fixture; xử lý cả thiếu dấu, một số lỗi gõ, so sánh, giá sỉ, thiếu chính sách và bàn giao. Model chỉ được gợi ý intent; backend xác nhận SKU, số lượng, giá và tồn. Không ghi nhận đã chuyển nhân viên khi chưa có dịch vụ nhận.
- Port GPT khóa trước transport, có bộ đếm lượt bị chặn, chính sách output và timeout. Chưa có ledger chi phí của provider, số dư xác thực hoặc reservation xuyên worker cho đợt QA. n8n Gateway trả `available=true`, chưa chứng minh hạn cứng **0,10 USD/10 lượt**. Lượt inference thực trong phiên **0**, chi phí model từ phiên **0 USD**. [Chính sách Gateway](https://github.com/n8n-io/n8n-docs/blob/main/docs/deploy/use-n8n-cloud/gateway-credits/README.md).

## TESTED · Bằng chứng

| Bộ kiểm | Đầu vào / kết quả đợi | Kết quả đã quan sát |
|---|---|---|
| Source và regression | 35 ca Reply Pilot + 48 ca core cũ + 34 ca V12.4R. Giá/tồn, quantity, giới hạn, từ chối cấu hình không hợp lệ, không ghi/gửi | 117/117 PASS local. |
| PostgreSQL 17.10 cô lập | Hai role A/B, cùng F01, expected 318.000đ và 398.000đ cho hai sản phẩm; không thấy hàng của tenant khác | 19/19 PASS integration bằng driver pg. Có 2 backend thực chờ cùng một khóa; 1 lượt được áp dụng, 1 receipt, lượt còn lại bị chặn. Khi đổi mã và truy vấn mới gặp lỗi SQL, savepoint xóa lựa chọn cũ, giữ sự kiện cho retry, lượt “lấy 2” không thể báo lại SKU cũ. Có rollback/retry, phiên hết hạn, chuyển SKU, đổi giá/tồn, giới hạn cho lượt tới trễ, session mới đọc lại được bản nháp. |
| n8n Reply Guard QA | Manual trigger, 1 lần đọc snapshot và 25 tình huống giả lập; dự kiến không gửi / ghi đơn | [Execution 3671](https://ngoctien20.app.n8n.cloud/workflow/nKNKDLO4l2PXL4tx/executions/3671) trả 25/25 PASS, `real_llm_tested=false`, `external_sends=0`, `orders_written=0`. |
| Hosted Supabase | CI riêng chạy trên push của chính nhánh. Hai merchant QA đăng nhập, SELECT `public.products`: thấy dòng shop mình, kết quả rỗng cho shop còn lại, đóng phiên vừa mở | [Job 132541340161](https://github.com/ngoctien20/demo-git/actions/runs/43625844898/job/132541340161) đạt 9/9 assertion qua HTTP, gồm anonymous, đăng nhập, đọc đúng shop, lọc shop kia và đóng phiên từng tài khoản. Quyền merchant khác quyền Customer của core. |
| Core lên kênh thật hoặc model thật | Cần credential truy cập DB theo shop, xác thực provider và giới hạn ngân sách | BLOCKED. Không có phép thử trả lời Zalo, Messenger, Website hay gọi GPT trả phí. |

## Bằng chứng CI

- Commit triển khai đầu tiên `28eb0c4ea8fb8f3b21b8805893261ecf834b0c03`, [push CI](https://github.com/ngoctien20/demo-git/actions/runs/43625844898) và [pull request CI](https://github.com/ngoctien20/demo-git/actions/runs/43625849816) success. Đọc log: 115/115 source, 17/17 PG, hai backend chờ khóa; hosted merchant HTTP 9/9. Bản sau bổ sung 4 regression cho việc đổi SKU khi nguồn đọc lỗi, quyền hủy và nhãn sản phẩm.
- Không kích hoạt deployment ứng dụng. Nguồn cho CI là nhánh riêng của PR #52. Mọi secret QA chỉ đi vào bước hosted trên push đúng nhánh, kết quả ghi ra trạng thái và số dòng.

## SECURITY · Cổng nghiệm thu

| Mức | Trạng thái | Điều kiện tiếp theo |
|---|---|---|
| P0 | BLOCKED hosting Customer | Phê duyệt quyền DB tối thiểu và backup/rollback trước migration; kiểm E2E adapter bằng đúng identity customer service của hai shop. Không mở quyền cho frontend hay dùng service-role để vượt RLS. |
| P0 | BLOCKED live channel | HMAC internal QA chưa xác minh chữ ký của provider. Cần mapping bot đã phê duyệt, chính sách lưu giữ/dọn bản ghi và quản lý khóa ổn định, giới hạn gửi, rollback. Chỉ xem xét kết nối sau khi core được duyệt. |
| P1 | BLOCKED mô hình | Cần chứng cứ giới hạn cứng ở Gateway hoặc phương thức ngân sách tương đương được chủ dự án phê duyệt. Khi đủ điều kiện mới đo chất lượng hội thoại, token và độ trễ bằng model thật. |
| P1 | PROPOSED dọn phiên ngủ | Đã reset logic khi hết hạn và dọn receipt khi có lượt mới. Trước sử dụng lâu dài cần job retention cho các phiên không quay lại, metrics ẩn danh và diễn tập phục hồi. |
| P2 | PROPOSED dữ liệu sản phẩm | Bổ sung nguồn doanh nghiệp xác minh cho trạng thái bán, bảng sỉ/MOQ, biến thể, freshness và chính sách; chỉ bật câu trả lời khi đủ nguồn. |

## Rollback và bước tiếp

Bản thay đổi chỉ nằm ở nhánh draft. Revert commit V12.4R trên nhánh bằng commit mới nếu cần. Không reset HEAD khi agent khác đã thêm commit. Mốc mã gốc ở đầu trang. Database PostgreSQL dùng cho integration được tạo riêng từng lượt chạy rồi dừng. Không áp SQL candidate, không cấp role/phân quyền lên hosted, không có thay đổi workflow để hoàn tác.

- [x] Catalog hai fixture thật sự được đọc từ Supabase bằng connector kiểm toán; có scoped SELECT đã chạy bằng role A/B trong PostgreSQL cô lập.
- [x] Có vòng hội thoại chọn mã → xem tổng → đổi → hủy; rate-limit, receipt, concurrency và fail-closed có assertion.
- [x] Giới hạn chi phí đóng trước inference; bốn channel adapter chỉ dành chỗ; có manifest và rollback.
- [ ] Cấp và nghiệm thu quyền đọc riêng của Customer backend Supabase cùng quy trình retention.
- [ ] Chạy mô hình thật có cap và đánh giá tiếng Việt trước khi duyệt Core Bot Candidate cho lưu lượng khách.
- [ ] Đề nghị tích hợp provider riêng sau khi các điều kiện trên đạt.
