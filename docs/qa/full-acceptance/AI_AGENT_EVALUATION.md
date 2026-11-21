# AI_AGENT_EVALUATION — Round 1

## 1. Các agent đang có trên n8n

| Agent | Workflow | Model | Tool | Trạng thái |
|---|---|---|---|---|
| Messenger bán hàng V3 | `Z7FdV7uDvApfbURQ` | gpt-5-mini, memory 14 lượt theo `messenger:<page>:<sender>` | đọc Products (Sheet), create_order, update_order_address, manage_order (preview/apply + expected_total), get_order_status (order_id + SĐT), create_support_ticket | **LIVE** trên 1 Page |
| AI_SALES_DEMO Main Agent | `v6PBwcqSapVzACMW` | gpt-5-mini, memory 10 | đọc Sheet, create/update/manage order | Active (chat trigger) |
| Website Consultant | `wgkkmT7q4lm4HyuA` | gpt-5-mini qua OpenAI node | Không có tool; KB router 7 chủ đề `website-kb-v1.1` | Active, public |
| Commerce AI Agent Sandbox | `iyfGUiEsZlNTBWOR` | — | Catalog đọc, multi-SKU preview | Active, chỉ gọi từ 4 caller; Draft≠Published |

## 2. Đối chiếu với quy tắc AI SALES của chủ dự án (đọc prompt + code tool)

| Quy tắc | Messenger V3 | Ghi chú |
|---|---|---|
| Không bịa giá/tồn | Prompt yêu cầu tra Sheet; **tool create_order tự tính lại giá** | Đạt ở thiết kế; parser giá Published lỗi (xem T-N02) |
| Không nhận giá khách đề xuất | Prompt có; tool bỏ qua giá từ khách | Đạt ở thiết kế |
| Đổi SKU/SL cần `expected_total` | manage_order preview → apply với expected_total | Đạt ở thiết kế |
| Đổi tên/SĐT cần xác nhận | Có trong prompt | Chỉ dựa vào LLM |
| Chuẩn hóa SĐT VN | `normPhone` + `^0\d{9}$` | Đạt (không nhận số 11 chữ số cũ, chấp nhận được) |
| VND chính xác | Draft đạt; **Published không đạt** | FAIL |
| Xác nhận trước khi tạo đơn | Chỉ ở prompt ("một câu đặt ngay chưa phải xác nhận") | Không có cổng kỹ thuật; phụ thuộc LLM |
| Không lộ dữ liệu khách khác | get_order_status cần cả mã đơn và SĐT | Đạt ở thiết kế |
| Chống prompt injection | Chỉ bằng prompt; Products được nói là dữ liệu không tin cậy | Chưa test |

## 3. Bộ đánh giá

- `AI_SALES_QA_CASES.csv`, `AI_SALES_QA_96_SINGLE_TURN.csv`, `AI_SALES_36_MULTI_TURN_FOR_LATER.csv`: **không tìm thấy** trong 502 nhánh (tìm theo tên file trong toàn bộ lịch sử đã fetch) và trong Google Drive. Có `qa/n8n/AI_SALES_QA_SANDBOX_V12_4_*.sdk.ts` ở nhánh khác.
- Supabase `tien404_tester_cases`: 137 case với `expected_result`, chỉ có **2** lượt chạy được ghi.
- Kết luận: chưa có bằng chứng đánh giá có hệ thống theo expected outcome → **NOT_TESTED**. Không có tỷ lệ đúng nào được công bố.

## 4. Đề xuất Round 3 (an toàn)

1. Chủ dự án cung cấp 3 file CSV, hoặc đồng ý dùng 137 case trong `tien404_tester_cases` làm nguồn.
2. Chạy đánh giá trên **bản clone** của agent trỏ tới Sheet tổng hợp riêng (không dùng Page thật, không node gửi) — cần phê duyệt vì tạo workflow mới trên n8n và tốn token OpenAI.
3. Chấm theo expected outcome bằng kiểm tra cấu trúc (tool được gọi, tham số, có/không ghi) thay vì để LLM tự chấm.
