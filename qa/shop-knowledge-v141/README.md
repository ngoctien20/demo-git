# TIEN404 AI V14.1 — Shop Knowledge Brain (EXPERIMENTAL)

Mục tiêu: **một Sales Core**, mỗi store có hồ sơ và knowledge độc lập; không fine-tune theo shop, không tạo bot riêng theo từng store.

## Đã viết thành mã nguồn
- `knowledge-core.cjs`: xác minh binding upstream (theo contract), kiểm tra snapshot và trạng thái `PUBLISHED`, phân loại `PUBLIC/STAFF_ONLY/RESTRICTED`, Profile/Policy/FAQ exact lookup, Commerce delegation, handoff, lifecycle proposal, safe AI behavior enums.
- `fixtures.cjs`: **ba cửa hàng hư cấu** A tạp hóa, B thời trang, C VLXD, với năm thành lập/số liên hệ/chính sách tách biệt.
- `knowledge-core.test.cjs`: positive/negative security, lifecycle/versioning, shop A/B/C, FAQ và hội thoại; không sử dụng dữ liệu khách thật.
- `ui/index.html`: Staff Knowledge Manager QA mobile-first, 7 tab, tạo draft trong bộ nhớ trình duyệt, FAQ/policy và trả lời mô phỏng. **Không có backend Auth, không lưu staging database, không publish kiến thức thật.**
- `ui-browser-qa.cjs`: Playwright Chromium 360/390/430/768/1280, tách draft Shop A/B, FAQ và mobile; kết quả theo GitHub Actions.
- `n8n-v141-manual-qa-snapshot.json`: snapshot workflow **mới**, inactive, synthetic only, không phải sao lưu các workflow production.
- `sql/v141_shop_knowledge_PROPOSAL_ONLY.sql`: SQL đề xuất có câu lệnh chặn trước DDL, không được chạy khi chưa duyệt Store/RLS.

## Gọi API engine offline, không có network

```js
const {reply}=require('./knowledge-core.cjs');
const {binding,snapshot,fixedNow}=require('./fixtures.cjs');
const result=reply({
  binding:binding('B'),     // QA-only trusted binding fixture
  snapshot:snapshot('B'),   // QA-only source of knowledge
  question:'Shop có đổi trả không?',
  now:fixedNow
});
// result.status === 'KNOWLEDGE_ANSWER'
// result.provider_payload === null, result.orders_written === 0
```

**Quan trọng:** `binding.server_verified` chỉ là hợp đồng giả lập, không phải cơ chế xác thực. Backend thật phải tạo binding bằng session/credential hợp lệ và truy vấn Bot→Tenant→Store phía server. Không cấp phép người dùng tự gán thuộc tính `verified`. Tương tự, `source:TRUSTED_KNOWLEDGE_READBACK` chỉ đáng tin khi backend tự dựng từ cơ sở dữ liệu sau khi kiểm tra RLS.

## Phân tầng thông tin
- `PUBLIC` + `PUBLISHED` + `VERIFIED` + `merchant_approved` + `effective`: mới được trả ra khách.
- `STAFF_ONLY` và `RESTRICTED`: không được đưa vào context của customer bot.
- `DRAFT/REVIEW/APPROVED/ARCHIVED`: không được xuất hiện trong câu trả lời khách.
- Commerce giá/tồn/SKU/trạng thái đơn: **không dùng knowledge text**, chỉ trả nhãn `COMMERCE_DELEGATION`, chờ tool có xác thực.
- Khi nhân viên tiếp quản, AI trả `SUPPRESSED_HANDOFF`; khi nguồn mơ hồ, trả `HANDOFF`.

## Kiểm thử
```bash
node --test qa/shop-knowledge-v141/knowledge-core.test.cjs
node --test qa/conversation-v138/conversation-core.test.cjs
node --test qa/multimodal-v14/core.test.cjs
```
Browser QA (GitHub Actions): `python -m http.server 8080` rồi `node qa/shop-knowledge-v141/ui-browser-qa.cjs` sau khi cài Playwright pinned Chromium.

## Chặn release
- Supabase staging có tenant nhưng chưa có public.stores và store_id trong products/conversations/messages.
- Chưa có database Shop Knowledge, published snapshot hoặc staff backend.
- Chưa có hosted store-level RLS, staff sessions, merchant approval log, CAS publishing.
- V14 Image-to-SKU chỉ test giả lập, AI Vision live và media downloader chưa xong.
- Không gọi OpenAI, n8n published, Zalo, Supabase write hoặc gửi tin thật.

## Rollback
Đóng Draft PR #85, không merge. Workflow QA mới `S6IZJ5q0QFU6pHx5` là inactive; nếu cần dọn dẹp thì chỉ archive sau khi có phê duyệt, không xóa sản phẩm hoặc workflow cũ. Không có schema mutation để rollback.
