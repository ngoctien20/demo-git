# TIEN404 AI V14.1 — Mô hình chi phí kinh doanh (giả định, CHƯA đo thực tế)

**Ngày:** 15/11/2026 · **Trạng thái:** PROPOSED / không phải báo cáo lãi lỗ thực tế.

Không lấy số liệu doanh thu, số lượng khách hoặc chi phí AI từ fixture QA. Chưa gọi API tính phí trong V14.1, chưa đo thời gian nhân viên nhập knowledge cho shop thật và chưa xác minh giá thương mại của các kênh nhắn tin.

## Công thức

- MonthlyVariableShop = `ConversationsPerShop × AverageAITextCostVND + ImageCallsPerShop × CostPerImageVND + StorageVNDPerShop + SupportHoursPerShop × SupportHourlyCostVND + ChannelFeesVNDPerShop`
- MonthlyTotal(N) = `FixedInfraVND + N × MonthlyVariableShop + OtherFixedStaff/Compliance/Tax/PaymentFees`
- OneTimeSetupShop = `SetupHours × SupportHourlyCostVND + OnboardingInfra/VerificationCost`
- GrossMargin phải tính từ giá thuê bao được **phê duyệt** sau khi trừ mọi chi phí thực tế; không mặc định Lite 199k hoặc Plus 349k là giá thương mại chính thức.

## Kịch bản minh họa *hoàn toàn giả định*, không dùng để chốt bảng giá

| Biến | Giả định minh họa | Đã đo? |
|---|---:|---|
| ConversationsPerShop/tháng | 450 | Chưa |
| AverageAITextCostVND/cuộc | 50 ₫ | Chưa |
| ImageCallsPerShop | 0 (chưa bật AI Vision) | Chưa |
| StorageVNDPerShop | 3.000 ₫ | Chưa |
| SupportHoursPerShop/tháng | 0,5 giờ | Chưa |
| SupportHourlyCostVND | 80.000 ₫/giờ | Chưa |
| ChannelFeesVNDPerShop | 0 *chỉ để tách biến phí chưa biết* | Chưa |
| FixedInfraVND/tháng | 600.000 ₫ | Chưa |
| SetupHours lần đầu | 1,5 giờ/shop | Chưa |

Với các giả định trên, chi phí biến đổi **65.500 ₫/shop/tháng**; chưa bao gồm phí kênh nhắn tin, AI Vision, thuế, xử lý thanh toán, hỗ trợ đặc biệt, hoàn tiền và chi phí tăng hạ tầng.

| Quy mô | Tháng (giả định) | Công hỗ trợ/tháng | Nhân sự hỗ trợ theo 160h/FTE | Thiết lập lần đầu |
|---|---:|---:|---:|---:|
| 10 shop | 1.255.000 ₫ | 5 giờ | 0,03 FTE | 1.200.000 ₫ |
| 50 shop | 3.875.000 ₫ | 25 giờ | 0,16 FTE | 6.000.000 ₫ |
| 100 shop | 7.150.000 ₫ | 50 giờ | 0,31 FTE | 12.000.000 ₫ |
| 500 shop | 33.350.000 ₫ | 250 giờ | 1,56 FTE | 60.000.000 ₫ |

**Lưu ý:** Công hỗ trợ dùng công thức giả định đơn giản; ở 500 shop có thể cần thêm đội ngũ, điều phối và SLA. Không được xem 600.000 ₫ hạ tầng là đủ cho 500 shop khi chưa load test.

## Độ nhạy cần chạy trước khi bán

1. Chatbot xử lý 100/450/1.000 hội thoại/shop/tháng; theo dõi token thực tế, model retry, lỗi provider và tỷ lệ phải chuyển nhân viên.
2. Giả định 0%, 10%, 30% hội thoại có ảnh khi Vision được duyệt; đo chi phí ảnh trực tiếp và băng thông.
3. Chi phí nhân sự onboarding 0,5 / 1,5 / 4 giờ, hỗ trợ 0,25 / 0,5 / 2 giờ/shop/tháng.
4. Tenant nhiều store: hạch toán theo store + tenant, phân biệt phí cấp phép, lưu trữ, số lượng hội thoại và chi phí hỗ trợ.
5. Ở Lite phải đo tỷ lệ câu hỏi chỉ cần profile/FAQ trước khi dùng LLM; mục tiêu giảm model calls không có ích, không tin cậy.
6. Plus: giá trị kinh doanh cần chứng minh từ cập nhật kiến thức, câu trả lời tốt hơn, tỷ lệ nhân viên phải tiếp quản thấp hơn, không quảng cáo lời hứa chưa đo.

## Bộ số liệu thật phải thu thập

`tenant_id,store_id,knowledge_version,channel,conversation_id_hash,intent,response_source,model,prompt_version,input_tokens,output_tokens,model_cost_vnd,vision_cost_vnd,latency_ms,result,staff_handoff,knowledge_miss`.

Không ghi PII, nội dung hội thoại thô, credential hoặc ảnh khách vào bảng telemetry phổ thông. Chi phí tổng phải đối soát hóa đơn provider, không đoán từ số token giả định.

## Quyết định đề xuất

- **SALES LITE:** ưu tiên profile/FAQ/chính sách cấu trúc; nhân sự TIEN404 setup, khách không có Bot Designer.
- **SALES PLUS:** duyệt tài liệu knowledge nâng cao, behavior dạng lựa chọn an toàn, báo cáo chất lượng; chưa mở Vision live khi thiếu ngân sách.
- **SALES ENTERPRISE:** tenant nhiều store và kênh riêng chỉ sau Store RLS, phân công nhân sự, SLA và load test hosted.
- **Không mở AI fine-tune/vector RAG** trước khi chứng minh FAQ có cấu trúc không đủ nhu cầu thực tế.

Tất cả đề xuất gói **không thay đổi giá thuê bao hiện hành**.
