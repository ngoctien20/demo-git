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
