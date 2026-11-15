# TIEN404 AI — V14.1 Shop Knowledge Brain Checkpoint

**Ngày:** 2026-11-15 (JST) · **Release:** EXPERIMENTAL → STAGING DRAFT · **Không merge / không production**

## 1. Verified baseline trước thay đổi
- GitHub V14.0 PR #83 OPEN DRAFT HEAD `7000670725ada3b2e22fb348e20e4e0ced84e9eb`; V14.1 branch tạo trực tiếp từ SHA này, không merge.
- n8n protected Zalo Ingress `yIJk8LvJoLF40Z62` ACTIVE version `8ca4a6f6-ab3f-42f1-8637-d4f5db790a3e`, unchanged.
- n8n Customer Router `sIPs6egzIwOY1GNv` ACTIVE version `8d91d23c-cd87-462f-a112-9cca2340bec8`, unchanged.
- n8n V14 offline image QA `9UDajs5gyaasf6XN` INACTIVE version `35d84a17-4945-4b79-bb92-1719c34e9911`, unchanged.
- AI_SALES_DEMO main agent `v6PBwcqSapVzACMW` ACTIVE version `c0f04eb1-9e2b-4b42-bf70-0ce12d5b0c30` sử dụng Google Sheets tools. Không chỉnh sửa, không trộn DEMO Orders/Products/credentials sang Commerce.
- Supabase `ifxlvrhyjhbzbrkdsida` ACTIVE_HEALTHY. `public.products, conversations, messages` chưa có store_id; `public.tenants`, `tenant_memberships` dùng tenant-based RLS. `public.tenant_agent_configs` có knowledge_version ở tenant/channel, chưa giải quyết store-level.
- Supabase không có `public.stores`, `app_private.shop_knowledge_releases`, `shop_knowledge_items`, `shop_knowledge_audit`. No hosted data schema modification.
- Supabase security advisor giữ WARN: một hàm SECURITY DEFINER có quyền gọi bởi anon và hai hàm bởi authenticated; cần review riêng, không tự coi là lỗ hổng đã khai thác.

## 2. Implemented (STAGING DRAFT source)
- `qa/shop-knowledge-v141/knowledge-core.cjs`: hợp đồng trusted binding; exact FAQ lookup; profile/policy retrieval; chỉ Published + Public + Verified + merchant approved + đúng effective window; item validation cùng tenant/store.
- Dữ liệu `STAFF_ONLY` / `RESTRICTED`, draft/review/archived và phiên bản không khớp không tham gia câu trả lời khách.
- Commerce questions tạo `COMMERCE_DELEGATION`; **không bịa SKU, giá, tồn kho, trạng thái đơn**, không gọi tool ghi.
- Handoff khi không đủ thông tin, suppress AI reply khi `WAITING_STAFF/HUMAN_ACTIVE/RESOLVED`.
- Phiên bản và approval state machine `DRAFT→REVIEW→APPROVED→PUBLISHED→ARCHIVED` chỉ tạo proposal, không database write; public publish cần review độc lập, merchant signoff, quyền reviewer/admin.
- AI Behavior chỉ chấp nhận enum tone/detail an toàn; không nhận prompt tự cấp quyền tool.
- `qa/shop-knowledge-v141/fixtures.cjs`: ba cửa hàng hư cấu A tạp hóa, B thời trang, C VLXD. Không phải dữ liệu khách thật.
- `qa/shop-knowledge-v141/ui/index.html`: Staff Knowledge Manager 7 tab, mobile-first, local-only drafts và UI mock QA; **không có Auth/backend production**, không phải Bot Studio.
- `qa/shop-knowledge-v141/sql/v141_shop_knowledge_PROPOSAL_ONLY.sql`: migration nháp **có RAISE EXCEPTION ngăn thực thi**, cần canonical stores/RLS + approval trước khi gỡ cổng chặn.
- `docs/ai-handoff/V14_1_COMMERCIAL_COST_MODEL.md`: kịch bản 10/50/100/500 shop hoàn toàn minh họa với giả định; không đo doanh thu, token, support hoặc giá API thực tế.

## 3. QA evidence
- GitHub Actions `43703415333` SUCCESS: V14.1 Shop Knowledge 87/87; V13.8 Conversation 44/44; V14 Image SKU 39/39; **170/170 source tests**, 0 failed.
- Chromium Browser QA cùng run: **360, 390, 430, 768, 1280 px PASS**, no horizontal overflow. UI staff đổi Shop A/B, bản nháp không chéo, FAQ demo và câu trả lời mẫu PASS.
- Lần browser CI đầu lỗi JavaScript syntax; đã sửa trên nhánh. Giữ evidence run lỗi để truy vết, không che giấu.
- n8n `TIEN404_SHOP_KNOWLEDGE_ENGINE_V14_1_QA_STAGING` workflow `S6IZJ5q0QFU6pHx5`, Personal/90_QA - DIAGNOSTICS, INACTIVE version `1d8c3529-9d71-4601-88b4-f781a18fa9aa`: execution **3832 SUCCESS 16/16 synthetic-only**; provider sends 0, Orders writes 0, model calls 0, Storage writes 0.
- `qa/shop-knowledge-v141/n8n-v141-manual-qa-snapshot.json`: snapshot riêng của workflow vừa tạo, không chứa credential.
- **Không có hosted auth/RLS test, không có câu trả lời từ AI model thật, không có store knowledge DB thực, không có real image/provider-send QA.** Không dùng kết quả offline để tuyên bố sản phẩm đã sẵn sàng thương mại.

## 4. Phân loại phase và blockers
| Phase | Kết quả | Trạng thái |
|---|---|---|
| A Audit & backup | Đối chiếu PR/n8n/schema, snapshot workflow QA mới | VERIFIED |
| B Shop Profile | Validation + three-shop fixture + positive/negative QA | IMPLEMENTED, TESTED offline |
| C Retrieval & lifecycle | Structured/FAQ exact retrieval + approval proposals | IMPLEMENTED, TESTED offline |
| D Agent integration | Chưa tích hợp Knowledge Core vào AI Sales live/multi-channel pipeline | BLOCKED |
| E Staff UI | Giao diện in-memory mock + responsive Chromium | TESTED mock; hosted backend BLOCKED |
| F Vision + Knowledge | V14 chỉ đang mock ảnh/SKU, chưa có model live/media fetch | BLOCKED |
| G Commercial evaluation | Có mô hình chi phí giả định; setup/latency/accuracy chưa đo | PROPOSED |
| H Handoff | Draft PR #85, QA evidence, docs, rollback | IMPLEMENTED |

## 5. P0/P1/P2 risks
**P0:** store_id và canonical Store không có trong Commerce/Conversation; tenant-based RLS không chứng minh cách ly hai store cùng tenant. Nghiêm cấm DB write hoặc merchant knowledge read cho khách cho tới khi có Hosted Shop A/B test bằng auth sessions thật.

**P0:** security advisor hiện cảnh báo anon/authenticated-callable SECURITY DEFINER functions; cần audit RPC quyền và tác động theo server-side principal. Không tự ý đổi quyền.

**P0:** chưa có production trusted catalog/knowledge read adapter, database-enforced release/approval, phân công nhân viên; string flag trong offline fixture không thay thế JWT/RLS.

**P1:** template thiếu từ đồng nghĩa/tiếng địa phương, FAQ đang **exact match**, chưa có retrieval toàn văn, không có RAG hoặc LLM test. Không đánh giá precision thật bằng fixture nội sinh.

**P1:** Knowledge Source thay đổi, need atomic publish + revalidation; Orders/price/stock phải đọc nguồn Commerce real-time.

**P2:** Staff UI chưa có server save, upload tài liệu, audit log hosted, accessibility review mở rộng ngoài chromium viewport.

## 6. Next authorization gates
1. **Phê duyệt riêng** canonical Store/RLS design + migration sau khi backup và kiểm thử QA chủ shop A/B.
2. Phê duyệt schema Knowledge private và policy/staff assignment; không gỡ SQL `RAISE EXCEPTION` khi chưa có Hosted RLS QA.
3. Sau khi có source, cho phép backend read-only adapter, rồi test câu hỏi từ API staging với sessions được cấp quyền.
4. Chỉ với chấp thuận chi phí và mẫu dữ liệu thích hợp mới kiểm thử model Vision/LLM; không gửi Zalo thật.
5. Phê duyệt riêng mọi thay đổi production, subscription hoặc credential.

## 7. Rollback
- Không merge PR #85. Rollback code = đóng/revert riêng PR trên nhánh `work/v141-shop-knowledge-brain-offline-staging`.
- Workflow mới `S6IZJ5q0QFU6pHx5` inactive; giữ nguyên QA hoặc archive sau phê duyệt; không xóa workflow cũ.
- Không có Supabase schema/data writes, không có credential/Render/Cloudflare/Zalo changes do V14.1, nên không có database migration cần rollback.
- Bản nháp UI chỉ ở bộ nhớ tab, tự mất khi reload.

## 8. Đề xuất sau V14.1
- **Ưu tiên P0 trước mọi sản phẩm:** Store-Level RLS & trusted knowledge adapter.
- **V14.2** AI Shop Onboarding qua form/hội thoại staff, báo thiếu dữ liệu.
- **V14.3** Document-to-Knowledge (PDF, nguồn, trích dẫn, duyệt trước publish).
- **V14.4** Multimodal Product Brain (chờ V14 Vision thật).
- **V14.5** Customer Memory & CRM (retention, consent, store isolation).
- **V14.6** Evaluation Studio (test theo ngành, ground truth độc lập).
- **V14.7** Unified Knowledge Multichannel (Zalo/Messenger/Website).
- **V15.0** Commercial Release Candidate chỉ sau Auth/RLS, provider send gate, Finance/QA/Subscription signoff.

## 9. Chưa được phép tuyên bố
- “AI thực sự hiểu shop và tư vấn tự nhiên trên Zalo live”.
- “Đã có knowledge data source của ba cửa hàng thật”.
- “Đã có quyền xem từng shop an toàn trên hosted Auth/RLS”.
- “Tổng chi phí trong mô hình kinh doanh là phí vận hành thực tế”.
