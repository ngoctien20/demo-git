# TIEN404 V21.1 — Reaction Admission / Owner Page Policy (CANDIDATE)

**Trạng thái 22/11/2026:** IMPLEMENTED (pure JS contracts), TESTED (unit + n8n offline QA + disposable PG17), **NOT RELEASED**. Policy schema v1 của V21.1 đã được **superseded** bởi per-Page ngành/profile **schema v2** trong V21.2. Không có API gửi Meta hay schema production được thay đổi.

## 1. Mục đích

Reaction là một cách phản hồi ngắn, **không phải** phê duyệt đơn hàng, thay đổi thanh toán, chuyển hội thoại, hoặc chấp thuận hành động của người quản trị. Sau một ca ❤️ thật có HTTP 200 và được owner xác nhận hiển thị trên Messenger Mobile (executions #6707 / #6711), cần khóa quyền theo từng Fanpage và xử lý chống trùng trước khi tự động hóa.

Hiện tại:
- Messenger Published `47b48f6d-bc3d-40ae-afe6-96c5fd5452ac` vẫn nguyên trạng.
- Messenger Draft `9a705cbe-79bd-4bd5-ae41-578da7286c4f` có Shadow Code node `V21 Social Reactions Shadow (ALL OFF)`. Vì policy map rỗng, **mọi Page đều OFF**; Code node chuyển tiếp dữ liệu và không gửi HTTP.
- PR #493 là Draft. Không có giao diện bật/tắt thật.

## 2. Chính sách cấu hình cấp Fanpage — giao diện đề xuất

Chủ trang được ủy quyền chọn **Trả lời bằng biểu cảm** (mặc định Tắt), sau đó bật riêng `Cảm ơn → ❤️` và `Khen ngợi → 👍`. Có giới hạn tối thiểu 60 giây giữa các reaction trên cùng hội thoại; đề xuất ban đầu 300 giây và tối đa hai lượt mỗi giờ.

Cài đặt là **tách biệt** với menu `SHOW_CATALOG`, `HUMAN_HANDOFF` và danh sách hành động của Fanpage. Không gán một cấu hình chung cho tất cả Fanpage; một tenant có nhiều Page vẫn phải chọn/duyệt từng Page. Quản lý Owner App không được phép gửi trực tiếp `enabled=true` tới bot qua webhook, Messenger payload, prompt hay URL.

Trạng thái phiên bản của policy: `draft → approved → published → revoked/expired`; chỉ server có thể trả về bản `published`. Trong v1, public client không có quyền tự publish hoặc tạo bằng chứng duyệt.

## 3. Hợp đồng kỹ thuật

Các hàm thuần trong `config-core/lib/reaction-admission.mjs`:

| Hàm | Kết quả | Không làm gì |
|---|---|---|
| `verifyPublishedPageReactionPolicy` | `verified_policy` hoặc `blocked` | Không tải policy hoặc thay quyền |
| `prepareReactionAdmission` | `claim_required` hoặc `blocked` | Không ghi khóa, không gọi Meta |
| `verifyAtomicReactionClaim` | `dispatch_candidate` hoặc `blocked` | Không chứng minh tính nguyên tử thay DB; **sendAllowed:false** |
| `planSocialResponseAfterProvider` | `reaction_only` hoặc `normal_text` | Không thực hiện việc gửi |

**Bắt buộc** `tenantId`, `pageId`, `installationId`, `ownerId`, đúng policy revision và sự đồng ý owner còn hạn. Bản policy chỉ có hiệu lực khi đã publish, `enabled=true`, phiên bản schema=2, hết hạn tối đa một năm, có chủ trang đồng ý cùng revision, giới hạn cooldown 60–3600 giây, giới hạn giờ 1–6.

`authority.source=trusted_server`, `thread.source=trusted_meta_thread_lookup`, `business.source=trusted_business_state` và `receipt.source=trusted_durable_atomic_store` **là tên hợp đồng**, KHÔNG phải chữ ký mật mã. Nếu cho request của khách tự đặt các giá trị này thì bảo mật thất bại. Chỉ adapter backend với identity và scope đã kiểm tra mới được tạo các đối tượng đó. Code n8n không được lấy các cờ nguồn quyền này trực tiếp từ `$json` do khách gửi hoặc LLM.

### Thứ tự giải quyết đúng

1. Xác thực Meta HMAC/timestamp, Page recipient, sender PSID, MID, không echo, không quick reply/postback.
2. Resolve Page installation tới **trusted tenant/store/owner** bằng registry riêng; đọc **published policy** theo Page; đối chiếu tenant, Page, installation, owner, revision và consent.
3. Kiểm tra quyền bot hiện đang giữ thread bằng **nguồn Meta đáng tin cậy**, có kiểm tra tuổi dữ liệu (≤60 giây). Không suy diễn từ lần gửi tin thành công trước.
4. Kiểm tra business/handoff/approvals/order/menu/privileged/tool state từ server, tuổi dữ liệu ≤15 giây; khi thiếu bằng chứng thì không thả reaction.
5. Phân loại **lời cảm ơn hoặc lời khen thuần túy**. Câu chứa giá, đơn hàng, gặp nhân viên, `đồng ý`, `tiếp tục`, `QA_CORE`, nội dung menu/voice/sticker phải đi luồng thông thường.
6. Tạo khóa định danh theo `[tenantId, pageId, senderId, messageId, "react"]`. Dùng kho backend **bền vững và nguyên tử** để claim/đếm cooldown/hourly quota; nếu trùng, timeout, không có quyền, hoặc không có biên nhận chính xác thì **NO SEND**.
7. Sau khi có bằng chứng claim hợp lệ, adapter gửi tối đa một `sender_action=react` qua Meta. Chỉ kết quả từ **trusted Meta sender**, khớp claimId / Page / PSID / MID và `transportConfirmed + providerAccepted` mới cho phép chọn `reaction_only`. Lỗi hoặc kết quả không chắc chắn → `normal_text`, **không retry reaction**.
8. Dù `dispatch_candidate` được trả về, mã thư viện vẫn `sendAllowed:false` và `requiresExplicitReleaseApproval:true`. Phát hành yêu cầu cổng duyệt triển khai riêng; không chỉ đổi một boolean.

### Cơ sở dữ liệu chống trùng (OFFLINE PG17 TESTED, HOSTED PROPOSED)

Không dùng `TIEN404_MESSENGER_EVENT_KEYS` (dedupe inbound) cho action ledger: `rowNotExists` rồi `insert` không đảm bảo tính nguyên tử giữa hai executions. Yêu cầu storage/transaction service với ràng buộc unique trên (tenant, Page, sender, MID, action), kiểm tra cooldown và hourly quota trong **cùng transaction**, lưu `claimed / provider_accepted / provider_unknown / skipped`, anti-replay và TTL/retention tối thiểu. Bắt đầu bằng PostgreSQL **disposable PG17** để thử cạnh tranh đồng thời và cross-tenant negative; sau đó mới đề xuất migration Staging.

Nếu dùng Supabase, giữ bảng/thuật toán ở schema **private**, không grant RPC privileged cho `anon`/`authenticated` hay đưa `service_role` lên frontend. Phải kiểm toán SECURITY DEFINER/RLS, JWT owner mapping và backup/restore trước migration hosted. Không tạo bảng Production trong V21.1.

## 4. Bằng chứng hiện có

- Unit tests cho admission và industry profiles chạy trong CI riêng, bao phủ policy v2, owner consent, danh mục ngành bị khóa, profile limits, thread authority và fallback.
- GitHub CI: dedicated Social Reactions job chạy `config-core/test/reaction-admission.test.mjs` cùng các suite v21 khác; kiểm tra kết quả ở PR #493.
- n8n QA **inactive** `hc7AF0Dol8u9BG1o`, thư mục `90_QA - DIAGNOSTICS`: execution #6730 **20/20 PASS**; sau khi bổ sung chống giả mạo provider outcome, execution **#6731 21/21 PASS** (bao gồm spoofed Meta result), tất cả `metaCallExecuted:false` và `sendAllowed:false`.
- Không dùng credential trong QA, không gọi Meta hoặc Supabase, không ghi order.

## 5. Chưa đạt / điều kiện go-live

**BLOCKED**: chưa có owner settings UI hoặc trusted published policy registry; chưa có read-only current-thread-ownership adapter; chưa có **hosted** backend atomic claim + rate limit; chưa có Meta sender release gate; chưa thử concurrency trên Supabase hosted, multi-Page A/B real, Messenger web và end-to-end Commerce/handoff ở luồng auto reaction.

**Cần phê duyệt riêng**: migration database staging/hosted, thay đổi quyền/RPC, bật per-Page feature và Publish Messenger. Không tự triển khai từ checkpoint này.

## 6. Checkpoint / rollback

- Code: Draft PR #493. Có thể revert riêng `reaction-admission.mjs`, `reaction-admission.test.mjs`, CI + tài liệu; không động tới các nhánh menu.
- Messenger Draft: đang có Shadow ALL OFF. Nếu cần quay lại, xóa đúng node shadow và nối lại `Classify explicit human request -> Human handoff request?`; chỉ restore nguyên phiên bản cũ khi chắc chắn không có thay đổi đồng thời.
- n8n QA: `hc7AF0Dol8u9BG1o` inactive, có thể archive nếu không dùng. Mọi Page vẫn OFF.


## 7. V21.2 — Kết quả kiểm toán bổ sung (2026-11-22)

- Profile theo Fanpage đã được thiết kế trong `config-core/lib/reaction-profiles.mjs`; tài liệu đầy đủ tại `docs/config-core/REACTION_PROFILES_V21_2.md`.
- Schema owner policy `REACTION_POLICY_SCHEMA_VERSION=2` bắt buộc `industryId` trusted khớp record, và `settings.profileId` phải thuộc các profile ngành được phép. Schema v1 không thể bypass.
- n8n **#6732**: 30/30 synthetic Page policy/admission cases PASS, gồm nhánh trang pháp lý `silent`, nghệ sĩ `expressive`, bán sỉ `restrained`, khóa ngành giả và gửi kết quả Meta giả mạo. No external send.
- CI GitHub `45010560317` đã PASS PostgreSQL 17 disposable: 15/15 kiểm tra, gồm 2 nhóm 10 giao dịch đồng thời. Chưa có migration Supabase hosted; source tại `qa/reactions/atomic-claim-offline.sql` và `.sh`.
- Không cấp phép tự động Publish: Messenger Shadow Gate vẫn ALL OFF.
