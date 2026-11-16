# TIEN404 AI — V15.2 ADV.5 Merchant UAT Self-Report Receipt

**Ngày ghi nhận:** 16/11/2026 JST  
**Nguồn:** Người dùng gửi JSON trực tiếp trong cuộc trò chuyện TIEN404 AI; đây **không** phải bài kiểm thử tự động hay xác nhận độc lập từ chủ cửa hàng.  
**Thời gian JSON tự khai:** `2026-11-16T05:02:01.952Z` (14:02:01 JST).  
**Trạng thái:** `SELF_REPORTED_PASS_RECORDED`; **merchantUatApproved = false**, **releaseAuthorized = false**.

## Đối chiếu hợp đồng

- `contract`: `T404_ADV5_MERCHANT_UAT_SELF_REPORT_V1`, phù hợp bản `advanced-merchant-uat.js` đã đọc trên nhánh ADV.5.
- `kind`: `MERCHANT_SELF_REPORTED_NOT_VERIFIED`.
- `sessionLabel`: `LOCAL_SYNTHETIC_UAT`.
- `scope`: `PUBLIC_SYNTHETIC_QA_ONLY`.
- `canonicalRegistryReleaseCandidate`: `T404_ADV5_CANONICAL_RC1_NO_SEND`.
- Danh sách 16 ID `UAT01`–`UAT16` được cung cấp đúng và không trùng; mỗi mục `result=PASS`.
- Đã đối chiếu trường `counts`: PASS **16**, FAIL **0**, NOT_RUN **0**, NOT_APPLICABLE **0**. Không có bất kỳ observation nào: **16/16 chuỗi rỗng**.
- `technicalPreview.renderCount = 111` do trình duyệt tự khai. `canSend=false`, `canWriteOrders=false`, `realModelCalls=0`, `hostedReads=0`, `sourceOnly=true` là trường trong JSON, **không phải log mạng hoặc bằng chứng kiểm thử độc lập**.

## Quyết định nghiệm thu

| Hạng mục | Quyết định | Giới hạn |
|---|---|---|
| Nhận và đối chiếu cấu trúc báo cáo | **PASS** | Đúng kiểu dữ liệu và ID, đầy đủ 16 mục |
| Người thử tự đánh giá giao diện | **16/16 SELF_REPORTED PASS** | Không có ghi chú, ảnh hoặc bằng chứng kiểm thử cho từng bước |
| Đánh giá độc lập bởi chủ cửa hàng | **NOT VERIFIED** | Chưa xác minh danh tính Owner, merchant consent hoặc bên đánh giá |
| Chứng nhận AI và quyền gửi đa kênh | **NOT TESTED / BLOCKED** | Không có model call thực, Meta/Zalo permissions, end-to-end order |
| Phê duyệt staging/production | **BLOCKED** | Không đủ điều kiện Owner G2.3, JWT/RLS, budget, Action Gateway |

**Tuyệt đối không** chuyển trạng thái sang `APPROVED`/`RELEASED` từ tệp JSON tự đánh giá, kể cả đạt 16/16.

## UX follow-up không phủ định kết quả tự khai

Ảnh xem trước trong cuộc trò chuyện trước cho thấy bảng UAT nhiều cột phải cuộn ngang ở khung hẹp. Đề xuất **P2 UI improvement**, chưa triển khai: render bảng trên desktop, thẻ UAT xếp dọc trên màn hình điện thoại (320–412px) để đánh giá Đạt/Chưa đạt thuận tiện hơn. Kiểm thử responsive đã PASS về kỹ thuật nhưng chưa đồng nghĩa UI có trải nghiệm tối ưu.

## Bằng chứng kỹ thuật gốc

- [PR #159 — Draft](https://github.com/ngoctien20/demo-git/pull/159).
- [ADV.5 CI tại commit baseline](https://github.com/ngoctien20/demo-git/actions/runs/43803154265): 185/185 Node tests, 12/12 Chromium viewport passes, 3/3 jobs SUCCESS.
- Bản UAT offline là dữ liệu **Shop A/B/C tổng hợp**, không liên quan hồ sơ và đơn hàng thật.
- Không ghi nhận credential hoặc dữ liệu cá nhân trong các trường JSON được cung cấp; không lưu raw chat ngoài repository.

## Tiếp theo

1. Tiến hành đánh giá độc lập báo cáo UAT và tìm lỗi P1/P2 (chưa có bước fail nào được khai báo).
2. Cân nhắc UX dạng card cho 320–412px; thay đổi cần test hồi quy và checkpoint mới.
3. Tiếp tục xác minh Owner/Store JWT-RLS, provider entitlements, durable nonce và model benchmark trước bất kỳ live release.
4. **Rollback:** xóa commit tài liệu khỏi Draft nếu cần; không có thay đổi sản phẩm, n8n, Supabase hoặc production.
