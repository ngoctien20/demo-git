# TIEN404 V15.2 ADV.3 — Presentation Intelligence × Secure Action Registry reconciliation
Ngày rà soát: 16/11/2026 JST
Lifecycle: **EXPERIMENTAL → DRAFT → NO SEND → NO HOSTED WRITE**.
Mục tiêu: nối tiếp hiện trạng thật, không xây lại ADV.3 hoặc nâng cấp thử nghiệm thành production.

## 1. Checkpoint đã đối chiếu trực tiếp
- PR #142: ADV.3 Structured Output + **Synthetic QA Ed25519 Signed Preview**, HEAD gốc **96a930181f1ef2feaacb77207683cd8c4a59f54e**, OPEN DRAFT chưa merge.
- PR #152: ADV.5 **HMAC-SHA256 server-only receipt** (Node), HEAD **58cd3acd19982592d05fb41dbe5f829304c51934**, OPEN DRAFT chưa merge. Không mặc nhiên đồng bộ mã PR #142 hiện tại vào #152 vì #145/152 dựa trên HEAD ADV.3 cũ.
- PR #144: Channel Registry UI nhánh song song, HEAD **ebc29571c389e982bdc670a85df08157b3106133**, OPEN DRAFT. Không tự merge.
- PR #138: ADV.2 Channel Registry, HEAD **2cb5128ef4ffce11fb562805b82b698fe396fed5**, OPEN DRAFT.

## 2. Hai hợp đồng có chức năng KHÁC NHAU
| | ADV.3 Ed25519 QA | ADV.5 HMAC server |
|---|---|---|
| Contract | T404_ADV3_SIGNED_PREVIEW_V1 | T404_ACTION_V1 |
| Mục đích | Chứng thực snapshot preview synthetic | Biên nhận hành động, dự thảo server gate |
| Điều kiện kiểm tra | Hash tenant/store/customer/conversation + decision | Verified identity callback + scope + re-authorization |
| Thời hạn | Tối đa 120 giây | Tối đa 300 giây |
| Replay | Set trong bộ nhớ QA | In-memory QA claim / cần inject durable claim |
| Giao tiếp sản xuất | KHÔNG | KHÔNG |
| Thực thi order/stock | KHÔNG | KHÔNG |
| Provider send / ZBS | KHÔNG | KHÔNG |

**Không chuyển đổi hoặc tái sử dụng token Ed25519 QA thành HMAC action receipt.** Chúng dùng định dạng, audience, key và trust model khác nhau; không có auto-bridge production. Trước release phải chọn **một cổng hành động server canonical** và hoàn tất review migration/version, không duy trì hai gateway có quyền tương đương.

## 3. P1 security gap được sửa trong child Draft
Bản ADV.3 Ed25519 trước đây tạo decisionDigest từ `contract,storeId,tenantId,channel,action,selectedComponent`, bỏ qua text, các thẻ sản phẩm, bot/knowledge version, model intent, style và cảnh báo. Kẻ có thể thay nội dung preview trong khi vẫn giữ nguyên các trường đó; chữ ký QA không chứng minh content chưa đổi.

Child Draft chỉ sửa `actionDigest` để bind toàn bộ snapshot quyết định:
- contract / lifecycle / mode / source
- tenantId / storeId / shop / channel
- botVersion / knowledgeVersion
- modelProposal / decision / full preview (bao gồm giá, nút, text, style)
- action / releaseAuthorized

Đây là cải tiến integrity của **QA-only preview token**; không có nghĩa người dùng thật đã được xác thực, cũng không xác thực tính đúng của catalog hosted.

Bổ sung negative regression:
- 26: thay câu trả lời báo giá trên cùng action/component;
- 27: đổi model intent nhưng giữ action;
- 28: đổi bot/knowledge version;
- 29: sửa giá hoặc promotion trên card đã ký.

## 4. Kiểm thử và bằng chứng
- Chạy workflow `TIEN404 V15.2 ADV3 Secure Action Registry QA (NO SEND)` trên GitHub tại HEAD child Draft.
- Chạy lại 29 bộ test signed preview, các regression evaluator ADV.3, channel registry ADV.2, policy ADV.1 và static no-send.
- Chỉ ghi TESTED khi CI của đúng HEAD PASS. Không dùng kết quả từ SHA trước.
- Bộ 96 cases còn là oracle synthetic, không phải 96 output model thật.
- Không thực thi API/model, không thay hosted, không cập nhật PR #142/#152, không triển khai Cloudflare.

## 5. P0/P1 phụ thuộc trước khi hợp nhất / LIVE
- P0: Hosted Shop Owner identity và JWT/RLS thật; dữ liệu Shop A/B biệt lập với test độc lập.
- P0: Order lookup Commerce chung và customer linkage Messenger/Zalo xác minh có đồng ý.
- P0: Backup/approval đối với hosted migration, credential và phân quyền quan trọng.
- P1: canonical server action gateway, durable nonce/idempotency transactional, key rotation & custody; không dùng QA signer hoặc in-memory nonce.
- P1: channel entitlements (Meta, Zalo Bot/OA), paid-template budget approval, provider-safe payload validated.
- P1: model benchmark thực tế, token cost/latency/accuracy, Owner mobile UAT.

## 6. Approval và rollback
Không cần phê duyệt cho Draft-only hardening. Không được chuyển stage này thành APPROVED/RELEASED. Cần phê duyệt trước hosted write, live send, use of real keys, owner authorization changes, paid model và production rollout.

Rollback: đóng child Draft hoặc revert commit hardening. Không có thay đổi ngoài mã nguồn GitHub.

## 7. Mốc tiếp theo
**V15.2-ADV.3R → ADV.6 — Canonical Action Gateway Decision × Durable Nonce Contract × Verified Identity Gate**.
Trước khi tích hợp live, đối chiếu PR #142/#152/#144, lựa chọn một action gateway đã được chứng nhận, và xây migration/compatibility plan riêng (chưa áp dụng).
