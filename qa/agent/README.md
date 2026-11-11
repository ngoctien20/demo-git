# Đánh giá bot trên catalog QA

Phiên bản bộ ca catalog-qa-v1. Các ID nguồn trỏ tới bộ AI_SALES_QA_96_SINGLE_TURN của dự án. Bảy kịch bản dùng catalog cố định T-A và T-B của workflow AI_SALES_AGENT_ISOLATED_READONLY. Lệnh dưới đây chạy offline.

```sh
python -m unittest discover -s qa/agent -v
python qa/agent/evaluate.py qa/agent/recorded.json
python qa/agent/evaluate.py candidate-traces.json --baseline qa/agent/recorded.json
```

Mỗi phần tử đầu vào theo cấu trúc của recorded.json. Chỉ nhập đầu ra thử nghiệm đã khử định danh và danh sách đầy đủ các lần gọi tool từ execution tin cậy. Giữ nguyên loại nguồn, phiên bản, mã execution và câu hỏi. Bộ chấm đối chiếu tool, SKU, giá và số lượng theo cách viết hỗ trợ, đánh cờ dấu hiệu tiết lộ thông tin và tuyên bố đã ghi đơn. Ca thiếu kết quả giữ trạng thái NOT_RUN. Khi so sánh hai phiên bản, mất một ca đã đạt hoặc thay bằng mô phỏng sẽ làm lệnh trả mã lỗi. Mã thoát 0 trên một phần ca chỉ cho biết các ca đã cung cấp đạt các phép kiểm máy. Độ tự nhiên, tính đầy đủ của bằng chứng trace và bảo mật đầu cuối vẫn cần kiểm tra riêng.

Ngày 11/11/2026, đã đọc lại [execution 1909](https://ngoctien20.app.n8n.cloud/workflow/NvQfIffOrZokPBPW/executions/1909) và lưu kết quả đã lược bỏ thông tin phiên. Một ca có phản hồi thật từ model và tool đọc fixture. Sáu ca còn lại chỉ kiểm thử logic chấm bằng đầu vào tổng hợp. Bộ chấm chưa cấp phép promote bot.

Đã chạy lại các workflow sandbox tại [Catalog/Cart 1910](https://ngoctien20.app.n8n.cloud/workflow/ZVmMlwe2g0bPjVEq/executions/1910), [Business Core 1911](https://ngoctien20.app.n8n.cloud/workflow/tjsVobfjKLnv0o6b/executions/1911) và [Extension 1912](https://ngoctien20.app.n8n.cloud/workflow/QR7aYMpLfKDLVgyH/executions/1912). Assert node lần lượt xác nhận 17/17, 22/22, 25/25. Các Data Table node sử dụng get. Các kết quả phản ánh quy tắc sandbox.
