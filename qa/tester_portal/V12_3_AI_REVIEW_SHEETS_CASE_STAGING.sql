-- TIEN404 AI V12.3: safe, single AI-assisted QA submission case in existing Sheets staging module.
-- NOT an AI Agent test endpoint. Does not grant tester roles or enable live messaging.
WITH inserted AS (
 INSERT INTO public.tien404_tester_cases
  (case_id,module_id,title,instructions,sample_prompt,expected_result,readiness,sort_order)
 SELECT 'SHEET-AI-REVIEW-001','sheets','AI QA Studio — báo cáo do chuyên gia tự đánh giá',
  'Chạy bộ tám phép tính mẫu trên trình duyệt, sao chép dữ liệu GIẢ LẬP sang AI bất kỳ để góp ý, sau đó tự kiểm chứng nhận xét và gửi một báo cáo ngắn. Không dùng bot AI SALES thật.',
  'Kiểm tra giá 159000 VND, số lượng 2/25/26, sai SKU, giá khách đưa, tiền không hợp lệ; báo lỗi có bằng chứng.',
  'Báo cáo được đánh dấu self_reported và cần người quản trị nghiệm thu. Kết quả mô phỏng không chứng minh AI Sales/Messenger đã PASS.',
  'ready',70
 WHERE EXISTS(SELECT 1 FROM public.tien404_tester_modules WHERE module_id='sheets' AND readiness='ready')
 ON CONFLICT(case_id) DO NOTHING
 RETURNING case_id
)
SELECT count(*)::int AS new_qa_review_cases FROM inserted;
