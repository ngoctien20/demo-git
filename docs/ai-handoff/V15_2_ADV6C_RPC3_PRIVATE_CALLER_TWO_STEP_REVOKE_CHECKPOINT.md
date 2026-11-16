# TIEN404 AI — V15.2-ADV.6C-RPC.3
## Private Caller Attestation × Hosted Two-Step Pairing Acceptance × Individually Authorized RPC Revocation

**Ngày checkpoint:** 16/11/2026 JST
**Loại:** Source-only Draft / NO-SEND / NO HOSTED DATA WRITE / NO BACKUP EXPORT
**Cha:** RPC.2 Draft PR #185, HEAD `c4e042e56180c8aebb1e7ddc930bbc68b7a03507`
**Project:** Supabase staging `ifxlvrhyjhbzbrkdsida`.

## 1. VERIFIED — hosted preflight và caller
### RPC public đang cảnh báo
- `public.qa_shop_b_zalo_claim(uuid,text,text,text)` hiện SECURITY DEFINER, được sở hữu bởi postgres và `anon` vẫn có EXECUTE.
- Supabase Security Advisor: **1** linter `anon_security_definer_function_executable`; **2** linter `authenticated_security_definer_function_executable` ở các RPC khác. Đây là cảnh báo mức đặc quyền/bề mặt tấn công, **không phải bằng chứng bị xâm nhập**.
- Hàm đang kiểm tra shared header secret trong Vault; chưa chứng minh chữ ký gốc từng sự kiện Zalo, chống replay độc lập hoặc hoàn tất kiểm kê caller.
- `track_functions = none`; thống kê zero call không hợp lệ để kết luận không ai dùng.
- Supabase unified logs read-only (cửa sổ mặc định 24h, không có timestamp chính xác trong response): tổng PostgreSQL logs **44**, **3** bản ghi chứa literal `qa_shop_b_zalo_claim`; PostgREST logs **7**, **0** bản ghi chứa tên hàm; edge logs **157**, **0**. **Không thể phân loại ba bản ghi PostgreSQL là RPC call thực; có thể là metadata introspection của chính quy trình kiểm toán.** Không đọc/sao chép raw request, headers hoặc PII.

### Workflow chain đã xác minh lại
- V2 Shadow n8n `OgDZNSAvKEvhnAvn`, Active Published `f00ba506-c52a-4340-9a0c-809fd9c6ea9a`, node `Submit pending claim for Shop B` POST RPC, có credential header-auth, vẫn enabled.
- Upstream V1 `yIJk8LvJoLF40Z62`, Active Published `8ca4a6f6-ab3f-42f1-8637-d4f5db790a3e`, `Zalo V2 Shadow (Owner Gate Only)` gọi V2 qua workflow call; không thay đổi.
- RPC.2 đã kiểm tra 114/114 workflow n8n Draft và Published, tìm được một direct named RPC caller và một active upstream parent. Truy tìm caller bên ngoài / URL động / phiên bản lịch sử vẫn **BLOCKED**.
- RPC.2 đã quét 23 Worker representations, 1 Edge function; không có kết luận caller toàn cục.
- Không chạy webhook, không tạo pending claim, không gửi Zalo, không gọi HTTP PostgREST thật ở phiên này.

### Two-step private QA current
- `tien404_r1_qa.claim_owner_pairing_v3_synthetic` và `tien404_r1_qa.confirm_owner_pairing_v3_qa`: SECURITY INVOKER, `anon`/ `authenticated` không được EXECUTE trực tiếp; cả hai có row-lock và xung đột duy nhất.
- Confirm có kiểm tra `auth.uid()` và `owner_authorized_qa`.
- **Thiếu public.stores và public.store_memberships** trên hosted; chưa có Owner A/B same-tenant JWT/RLS proof; chưa có ghi hosted bằng cặp private function. Vì vậy **chưa có hosted two-step acceptance**.

## 2. IMPLEMENTED — Private Caller Attestation (synthetic)
`qa/v152-rpc3/private-caller-attestation.cjs`
- Tham chiếu chống giả mạo được gắn với chính xác project và commit parent.
- Tối đa 10 phút, nonce ngẫu nhiên 256 bit và ledger chống replay được cung cấp bởi môi trường QA.
- Ed25519 detached signatures từ 3 vai trò phân biệt: CONTROLLER / SECURITY_REVIEWER / CHANNEL_OPERATOR. Các public keys phải được enroll qua kênh độc lập; **trong PR này CHỈ sử dụng khóa QA ngẫu nhiên**.
- Đủ sáu miền evidence: n8n graphs; Cloudflare Worker accounts/routes; Supabase Edge; PostgREST log window; external scripts; third-party API clients.
- Chỉ nhận opaque reference + SHA256 digest và cờ tự khai. Không nhận raw logs, JWT, secret, số điện thoại hay customer rows.
- Chữ ký hợp lệ trả `SIGNED_METADATA_PENDING_PRIVATE_EVIDENCE_VALIDATION`; **không chứng minh bản ghi gốc có tồn tại hoặc chính xác**. Không có lệnh GRANT/REVOKE/send.

## 3. IMPLEMENTED — Hosted Two-Step Acceptance / One-Time Revocation Gate
`qa/v152-rpc3/hosted-two-step-revocation-decision.cjs`
- Đọc snapshot read-only `qa/v152-rpc3/hosted-readonly-baseline.json`.
- Kiểm tra: private invoker + không public execute; lock/unique; xác minh Owner trong confirm; Store schema; Owner A/B JWT real; cross-store denial; session revocation; independently authorized claim and confirm hosted; externally inspected private evidence.
- Báo cáo hai trạng thái độc lập:
  - `PRE_REVOKE`: hiện anon EXECUTE=true là baseline bình thường; chỉ cho phép **tiến hành review** khi đủ toàn bộ các chứng cứ bên ngoài. Không gọi SQL.
  - `POST_REVOKE`: yêu cầu anon EXECUTE=false, REST anon denied, private signed path + separate owner confirmation PASS, advisor warning cleared.
- Kể cả mọi cờ JSON đã đổi thành true, outcome tối đa chỉ là `PENDING_INDEPENDENT_SIGNED_APPROVAL`. **Không có đường thực thi revoke, published change hoặc backup**.
- Chỉ lập kế hoạch cho đúng RPC signature; không cho phép blanket role changes hoặc service_role chung cho AI.

## 4. Private operator checklists (PROPOSED, NOT EXECUTED)
### A — Chứng nhận caller độc lập
1. Người chịu trách nhiệm truy cập private logs trực tiếp, kiểm tra nguồn dữ liệu và retention window; chỉ ghi digest và kết quả đã che PII.
2. Xác minh exact n8n Published caller, Worker bindings, Supabase Edge, Supabase PostgREST requests, external webhook, manual operator scripts, old revisions.
3. Đối chiếu dynamic callers và các tuyến RPC alias; không dựa vào `track_functions=none` hoặc chỉ đếm chuỗi literal.
4. Security Reviewer độc lập kiểm tra source/log raw trong kho chứng cứ riêng tư. Chữ ký của ba vai trò xác nhận hồ sơ được ký, không tự chứng minh bản chất request.

### B — Hosted JWT/RLS và hai bước ghép nối
1. Chỉ dùng hai Owner thật được ủy quyền, cùng tenant nhưng khác Store, cùng một user không được giả mạo hai vai trò; kiểm thử người dùng bị thu hồi phiên.
2. Trước khi chạy cần schema Store/Store Membership hợp lệ, baseline backup được phê duyệt riêng và thiết lập private role đúng phạm vi; nếu thiếu thì dừng và đánh dấu BLOCKED.
3. Chạy thử ký sự kiện chính hãng ở kênh staging đã được phép, xác nhận claim mới ở trạng thái pending, **không** tự bind Owner khi tin nhắn đến.
4. Chạy bước confirm bằng JWT Owner đúng Store; thử Owner B và JWT revoked phải denied. Kiểm tra idempotency khi retry, race condition, rollback.
5. Kiểm chứng rằng `service_role`/postgres không bị dùng làm bằng chứng cho RLS khách hàng, kiểm tra TTL/session claim freshness.

### C — Từng quyền duyệt riêng (mặc định DENY)
- Duyệt **backup/export** một lần (dự án, phạm vi, mã nonce, operator, encrypted destination, TTL, retention, tối đa chi phí).
- Duyệt **migration private DB role/schema** độc lập sau backup+restore.
- Duyệt **n8n Published canary** riêng, single-writer, snapshot trước khi thay.
- Duyệt **RPC REVOKE** riêng, đúng chữ ký `public.qa_shop_b_zalo_claim(uuid,text,text,text)`, không tự áp dụng các function khác.
- Duyệt **rollback** theo runbook và mức độ tác động đã kiểm chứng; không tự cấp lại quyền anon để chữa cháy.

### D — Điều kiện NO-GO
- Chưa có bộ bằng chứng caller ngoại vi đầy đủ, backup+restore thật, private signing enrollment, Store/JWT hosted proof, provider signature và canary → NO-GO.
- Một job CI xanh hoặc JSON `approved:true` không được chuyển sang RELEASED.
- Giữ PR Draft, không merge/promote/publish khi chưa có phê duyệt từng thao tác.

## 5. TESTED — phải dựa vào exact CI SHA
- `private-caller-attestation.test.cjs`: 16 test ký 3 vai trò, TTL, nonce replay, scope and tampering.
- `hosted-two-step-revocation-decision.test.cjs`: 16 test PRE/POST guard, thiếu JWT/restore/caller, forged green flags cannot authorize.
- CI nên kiểm thử lại RPC.2 No-Send và PG17 disposable. Không chạy JWT thật, n8n Published hoặc Supabase mutations.
- Nghiệm thu PASS chỉ sau khi GitHub Actions hoàn tất tại exact PR HEAD.

## 6. Quyết định hiện tại, rủi ro, rollback
- **READ-ONLY VERIFIED:** caller chain + Supabase privileged RPC + 2 private functions + hosted Store schema thiếu.
- **IMPLEMENTED:** offline attestation/gate và tài liệu kế hoạch.
- **BLOCKED:** independent real callers, JWT/RLS, private runtime role, post-revoke evidence, authorized backup/restore, live canary.
- **NO-GO:** One-time anon RPC REVOKE; hosted pairing release; production Commerce.
- **Rollback:** Close child Draft PR, no hosted changes, no DB restore required.
- **Next:** V15.2 ADV.6C-RPC.4 — Private External Caller Evidence Intake & Signed Revocation Decision (without performing REVOKE absent separate per-operation approval).
