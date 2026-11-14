-- TIEN404 AI V12.5: single authenticated manual report type for Messenger Clone QA.
-- Does not activate a model, grant new roles, publish webhook, or mark AI answers VERIFIED.
WITH created AS (
 INSERT INTO public.tien404_tester_cases
  (case_id,module_id,title,instructions,sample_prompt,expected_result,readiness,sort_order)
 SELECT 'SHEET-MESSENGER-CLONE-001','sheets','Messenger Clone QA — nhận xét hội thoại trên bản QA riêng',
  'Tester chọn một trong 96 câu ngẫu nhiên, thử riêng trên Messenger Clone QA trong n8n hoặc qua AI khác. Chỉ lưu phản hồi đã kiểm tra và ghi rõ nguồn. Không kết luận PASS nếu chưa có chứng cứ về nguồn, tool và quyền.',
  'Shop ơi A002 còn hàng không? (chỉ dữ liệu giả lập)',
  'Báo cáo self_reported=true. Một báo cáo tự khai không xác minh model có thật sự được gọi, tra cứu Sheet mới nhất, ghi đơn đúng hay an toàn.',
  'ready', 75
 WHERE EXISTS (SELECT 1 FROM public.tien404_tester_modules WHERE module_id='sheets' AND readiness='ready')
 ON CONFLICT(case_id) DO NOTHING
 RETURNING case_id
)
SELECT count(*)::int AS created FROM created;