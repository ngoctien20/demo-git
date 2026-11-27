# TIEN404 · Messenger Shop · QA 27/11/2026

## Mốc trước thay đổi

Base của draft là HEAD #512 e08347545262f425f0fc0b8148a54bc83a594151 (claude/project-thread-qrrxnf). Không có AGENTS.md trong cây base; áp dụng bản Tiến cung cấp. Đọc docs/config-core/PHASE2_CONTINUATION_20261122.md, SMART_CONTEXTUAL_ACTIONS_V1_DESIGN_20261124.md và docs/qa/full-acceptance/AI_AGENT_EVALUATION.md. Website chính là GitHub Pages. Không sửa Page, webhook, n8n hay cơ sở dữ liệu hosted.

Git ghi tại 776cba6d rằng workflow Z7FdV7uDvApfbURQ publish 5e6e7e90 (rollback lịch sử 632a63f8). Đây là lịch sử, chưa kiểm trực tiếp draft/published hiện tại: API 401 và editor yêu cầu đăng nhập. Hồ sơ cũ đã ghi U27-1/U27-3 trên Page demo; không lấy đó làm bằng chứng cho candidate hiện tại.

| PR | Nhánh | SHA đối chiếu |
|---|---|---|
| #517 | work/zalo-lite-private-catalog-20261126 | 5bf4f50b |
| #518 | work/zalo-web-store-link-20261127 | 890a7bcf |
| #516 | work/cskh-plan-controls-20261126 | 190a1c0e |
| #515 / #507 | work/zalo-lite-self-serve-uat-20261126 / claude/project-thread-ps587w | f0935b04 / a3b9f2d7 |
| #506 | claude/project-thread-qt56eo | bde30ef4 |
| #514 | claude/project-thread-0tlmi5 | 9cac2534 |
| #513 | claude/project-thread-8pcvk5 | d4e24318 |

#518 tiếp nối #517 ở việc xác nhận liên kết dashboard với catalog Zalo. #516 vẫn là nhánh CSKH riêng. Không sửa chồng các nhánh này.

## Luồng, bằng chứng và giới hạn

- Renderer catalog giới hạn Page demo. Menu đọc bản publish theo account qua get_channel_menu. Chi tiết SKU của demo dùng AI_SALES_DEMO / Products; tài liệu ghi công cụ tạo/sửa đơn trỏ về Sheet. Hai node nháp được sửa: gõ đúng “Xem sản phẩm” trên Page demo đi cùng đường payload danh mục đã công bố; formatter chi tiết ngăn Page ngoài demo trước khi đọc dòng Sheet. Trước sửa, test mục danh mục bằng chữ thu được undefined. Chưa đồng bộ node lên n8n.
- qa/messenger-shop/draft-store.mjs là adapter chạy thử với SQLite trong bộ nhớ. Đường vào là envelope QA, payload hoặc tin nhắn; inbox/approve dùng chủ QA. Hai shop có cùng SKU, khác giá và tồn. Thuật toán parse chỉ bao phủ cụm từ QA có định nghĩa. Chưa tích hợp n8n, UI inbox, xác thực người dùng hosted hoặc giao dịch với Supabase.
- 4 ca QA adapter: đổi mẫu/size/số lượng và gửi lại; tranh tồn giữa hai yêu cầu và duyệt lại; liên hệ và dừng/tiếp quản; nhập tin tiếng Việt đến một yêu cầu mua chờ chủ duyệt. TESTED bằng hành động và trạng thái sau thực thi. Stock được trừ trong sổ QA. Thử hai yêu cầu xen kẽ trong một tiến trình; tải đồng thời đa worker còn NOT_RUN.
- Nguồn CSV: hai tệp single-turn cùng hash f266447e4be2… (96 ca). Tệp kết quả 97 dòng/96 mã; trùng theo mã + câu + kỳ vọng còn 96. Bộ nhiều lượt 36 mã, 71 mục. turn-results.csv ghi riêng theo ca/lượt: 31 ca dialogue, 66 lượt đi qua Code node Extract thật trong VM với envelope tổng hợp; 3 direct + 2 parallel cần đúng tool/writer. Nội dung phản hồi AI và thay đổi DB của 36 ca đều NOT_RUN. Chỉ replay đầu vào, không chấm PASS nghiệp vụ trên cơ sở router.
- Android, iOS, Messenger web, provider ACK, tin trên thiết bị và staging n8n đều NOT_RUN cho SHA này. Không có dữ liệu khách thật. Không mở thêm shop hoặc phát sinh đơn thật.

## QA đã chạy trên các checkout cách ly

| Lệnh từ gốc nhánh tương ứng | Kết quả |
|---|---|
| node --test config-core/test/*.test.mjs | 302/302 |
| node --test qa/messenger-shop/*.test.mjs | 4/4 |
| node --test qa/messenger-rich-v136m2/*.test.cjs | 70/70, resolver/port QA đọc |
| node --test qa/v26-wsc/*.test.mjs (#498 0bd86b54) | 68/68, bản node ghim riêng |
| node --test gateway/zalo-hub/test/*.test.mjs (#518) | 74 pass, 12 skip do thiếu fixture riêng, 0 fail |
| node --test setup/test/*.test.mjs booking/test/*.test.mjs (#506) | 36/36, bộ gộp, không đo OCR thật |
| node qa/v28-account/account-ui.cjs - (#514, public bundle + admin build, Chromium local) | 108 assertions PASS; viewport desktop/mobile, Supabase giả lập. Không phải thiết bị hoặc thuê bao thật. |
| node --test don-chac-tien/test/*.test.mjs (#513) | 38/38 sau khi có jsqr và pngjs cho giải mã ảnh QA |

Tái tạo ma trận với Node 24 và Python 3: node qa/messenger-shop/replay-ingress.mjs /path/AI_SALES_36_MULTI_TURN_FOR_LATER.csv > /tmp/turn-results.csv. So sánh với CSV kết quả. Các cột thiết bị ghi NOT_RUN riêng.

Zalo với D1 shim: owner-A → bot-A → catalog-A, owner-B → bot-B → catalog-B. Mỗi owner tạo 5 sản phẩm, khách độc lập hỏi SP01 được 10.001đ / 20.001đ. A đổi thành 30.000đ, B giữ 20.001đ. A tạm dừng rồi bật lại đúng giá. A không có CSKH công khai, B khai một số QA. Thời gian tự thao tác của người thật, QR thiết bị và reconnect provider chưa đo. Pilot gần nhất chỉ ghi qa-zalo-bot; khôi phục kết nối theo trạng thái needs_reconnect qua quy trình owner của Hub, xác minh lại shop/bot trước mở.

M5 biệt lập: đối chiếu 20 đơn số tiền khác nhau với sổ QA #513, mỗi giao dịch phát lại một lần. 20 đúng, 0 ghi nhầm, 26 ms thời gian máy cho cả vòng tạo/đối soát; chưa đo phút lao động của chủ. Test suite có hủy, nhắc hoàn, COD, trễ sau hết giữ. Không tự động hoàn tiền thật.

M3 còn thiếu thí nghiệm nhập tay/ảnh trên 10 mã có người quan sát, lần sửa giá thứ hai qua kênh thật và quy tắc sỉ có lịch sử/hoàn tác. M4 có phiếu pilot.md; Overview trong #514 đã có các số chờ duyệt/cần nhân viên. Chưa nối đơn nháp QA với màn hình chủ; doanh thu đang tính cả confirmed và paid, cần nguồn chứng từ riêng trước khi ghi “đã thu”. Chưa đo 100 hội thoại hoặc tiền thuê bao. Dừng ở ranh giới QA cho đến khi có backend staging đúng scope và Tiến duyệt thao tác live cần thiết.

Rollback: bỏ nhánh candidate hoặc revert commit của PR. SQLite chỉ trong bộ nhớ và đóng sau test. Để chạy staging hosted cần editor n8n đã đăng nhập, clone QA giữ đường send/write thật ngắt, Page QA và mapping Page→shop/chủ đã xác minh. Chạy lại các ca gắn phiên bản và so tác động sau từng lượt trước khi đề xuất pilot.

## Kiểm tra tiếp từ 28093f6e, 27/11 (JST)

Editor n8n có phiên đăng nhập. Lịch sử hiển thị bản đầu tiên đồng thời là Published V27.7, ID 5e6e7e90-3b1c-4ea2-ba5e-80458df3334c, không hiển thị bản nháp mới hơn. Workflow LIVE Z7FdV7uDvApfbURQ có node đọc Products DEMO, gửi Meta và gọi create_order/manage_order. Không chạy hoặc sửa LIVE.

Workflow QA thủ công riêng gBgz9QEF8lINrnrY gồm Manual Trigger và Code, chỉ fixture mô phỏng. Execution [7032](https://ngoctien20.app.n8n.cloud/workflow/gBgz9QEF8lINrnrY/executions/7032) Succeeded 1.784s, ba kết quả. Chạy lại bằng Execute workflow trên workflow QA. Harness chạy thân node format-product từ 28093f6e, giả lập đầu vào Loop/Products. Kiểm tra 159.000đ và tồn 2, 159.000đ và hết tồn, Page khác trả mảng rỗng. Chỉ xác nhận formatter trên n8n Cloud. Chưa thử webhook, provider, thiết bị, hoặc backend staging cho đơn nháp.

Adapter SQLite kiểm lại giá trước ghi và trước duyệt. Nếu tổng thay đổi giữa xem và gửi, trả tổng mới để khách xác nhận lại. Bộ QA05–10 đi qua customerMessage với giá 159.000đ và tồn đầu 8, gồm chốt hai áo, suy nghĩ thêm, giảm còn một, xác nhận hai lần, vượt tồn, thiếu liên hệ. Dữ liệu liên hệ trong fixture là mô phỏng. Chạy node --test qa/messenger-shop/*.test.mjs và node qa/messenger-shop/replay-dialogue.mjs /path/AI_SALES_36_MULTI_TURN_FOR_LATER.csv rồi đối chiếu dialogue-results.csv. Trong 36 ca, 6 ca đáp ứng 18/18 lượt gồm trạng thái trả về và số đơn/tồn. 25 ca đi qua adapter nhưng chưa đủ chức năng/fixture để nghiệm thu (48 lượt); 5 ca direct/parallel chưa chạy vì thiếu writer có cùng contract và phiên độc lập. Kết quả adapter chưa xác nhận câu trả lời AI trên kênh. Ma trận kênh giữ nguyên NOT_RUN cho cả 36 mã trên Android/iOS/web. Không có xác nhận Meta. Phục hồi bằng revert commit tiếp nối trên nhánh PR; workflow QA chỉ chạy thủ công, ngừng chạy là đủ.

## Page, catalog và quyền nhận đơn · tiếp từ b493b09e

VERIFIED trên Supabase tien404-staging. public.channel_connections có đúng một Messenger, active, environment=demo, gắn đúng Page DEMO đã ghim. Đối chiếu đồng thời store_id và tenant_id thấy một chủ active và một sản phẩm active. public.products có price_vnd/stock_on_hand, chưa có cột màu/size ở bảng này. Chưa xác minh liên kết tới hai shop thời trang QA có biến thể. Trong tien404_r1_qa có hai bot synthetic_qa/dry_run, hai dòng catalog và 0 owner_bindings ở trạng thái paired còn hạn. Dashboard Orders đọc public.orders theo store_id. Writer commit_order_qa dùng sandbox_orders và owner_outbox trong schema QA. Một dòng ở outbox chưa chứng minh chủ đã nhìn thấy trên dashboard.

TESTED staging bằng staging-writer-guards.sql. Bốn ca gọi trực tiếp writer tạo yêu cầu lần lượt trả CONFIRMATION_REQUIRED, PRICE_MISMATCH (thiếu tổng), PRICE_MISMATCH (tổng cũ), OWNER_NOT_PAIRED. Mỗi lần thử nằm trong subtransaction hoàn tác kể cả khi writer bất ngờ nhận. Chạy lại script trên đúng Supabase staging; kết quả tổng hợp 4/4. Đây là writer tạo mới, không thay thế các ca QA25–QA27 về sửa đơn có sẵn.

IMPLEMENTED/TESTED offline. pendingInbox(owner) lấy duy nhất bản chờ hiện hành, có thành tiền. Khi khách nhắn “để mình suy nghĩ”, tăng revision để chủ không thể duyệt yêu cầu cũ. Hành trình A001 đen M → L → 2 cái → một bản chờ 200.000đ cho A, B không thấy → khách rút → chủ duyệt bị từ chối → khách chốt 1 cái → 100.000đ → duyệt hai lần, trừ đúng một cái. Lệnh node --test qa/messenger-shop/*.test.mjs config-core/test/*.test.mjs đạt 308/308; chạy lại replay-dialogue và diff với dialogue-results.csv trùng khớp. Dữ liệu toàn bộ mô phỏng.

BLOCKED đường mua hosted tới dashboard. Cần liên kết Page QA, shop và người nhận sandbox có hiệu lực, kèm adapter cho hộp duyệt. Chưa thay credential, pairing, webhook, public.orders hoặc quyền. n8n live phiên đã kiểm gần nhất là 5e6e7e90-3b1c-4ea2-ba5e-80458df3334c; lần này chỉ kiểm Supabase và Git, không kiểm lại n8n/Meta/thiết bị. Rollback bằng revert commit tiếp nối. SQL không để lại dữ liệu.

## Hộp yêu cầu QA trong màn hình Đơn hàng · từ 95e273e9

VERIFIED staging: 2 ánh xạ bot QA nhưng 0 khớp cả auth_tenant_id và store_key với public.stores, 0 liên kết người nhận còn hạn. Không tự ghép qua tên hoặc chỉ tenant. Đường đọc mới là candidate: page Đơn hàng → qa_owner_inbox(p_store) → sandbox_orders và owner_outbox cùng đơn/bot/shop, kiểm tra active store owner, binding còn hạn, challenge thuộc chủ hiện tại và đích outbox. Chỉ hiển thị mã đơn, SKU, SL và tổng. Không có thao tác duyệt hosted. Phần UI chỉ bật trong build VITE_QA_OWNER_INBOX=true. Chưa cài RPC hoặc cấp quyền trên hosted.

TESTED: chạy thân SELECT đối chiếu schema staging; 0 dòng khi chưa có danh tính/shop. Chạy node qa/messenger-shop/inbox-fixture-query.mjs, thực thi SQL sinh ra trên PostgreSQL staging: 6/6 kết quả đúng với danh tính mô phỏng. Hai shop cùng tenant và SKU; chủ A/B chỉ thấy đơn của mình; hai truy vấn chéo, nhân viên và khách vô danh đều rỗng. Đơn trước thời điểm ghép hoặc sai người nhận bị loại. Đây là truy vấn SELECT với CTE mô phỏng, chưa dùng JWT thật, chưa nghiệm thu quyền RPC qua PostgREST. Build từ apps/owner: npm run typecheck; VITE_QA_OWNER_INBOX=true npx vite build --outDir /tmp/tien404-owner519-stage. Hồi quy Node: 308/308. Test trình duyệt chưa chạy được do thiếu Chromium binary. Chưa có tin Meta hoặc ảnh thiết bị mới.

Trước khi cài lên staging: xác minh ánh xạ bền vững shop QA ↔ store UUID, đúng bot và đúng chủ; duyệt phạm vi cấp EXECUTE trên RPC ứng viên. Script nằm ngoài migrations. Rollback nhánh bằng revert commit này; không có thay đổi hosted cần hoàn tác.
