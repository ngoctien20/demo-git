-- TIEN404 AI V12.2 Private Tester Portal — isolated STAGING migration candidate.
-- Do not apply to production. No credential, real Orders or bot workflow changes.
-- Global Tester Super Admin is NOT inferred from Merchant Owner; bootstrap by explicit approval.
BEGIN;

CREATE TABLE public.tien404_tester_staff (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  staff_role text NOT NULL CHECK(staff_role IN ('super_admin','qa_manager')),
  active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.tien404_tester_access (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  access_status text NOT NULL DEFAULT 'revoked' CHECK(access_status IN('approved','revoked')),
  expires_at timestamptz NOT NULL,
  notes text CHECK(notes IS NULL OR length(notes)<=200),
  approved_at timestamptz,
  approved_by uuid REFERENCES auth.users(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.tien404_tester_modules (
  module_id text PRIMARY KEY CHECK(module_id ~ '^[a-z_]{3,32}$'),
  title text NOT NULL CHECK(length(title) BETWEEN 3 AND 100),
  summary text NOT NULL CHECK(length(summary)<=500),
  channel text NOT NULL CHECK(channel IN('messenger','telegram','zalo','sheets','ai_sales','commerce')),
  readiness text NOT NULL DEFAULT 'blocked' CHECK(readiness IN ('ready','pending','blocked')),
  setup_note text NOT NULL CHECK(length(setup_note)<=600),
  sort_order smallint NOT NULL DEFAULT 100,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.tien404_tester_assignments (
  user_id uuid NOT NULL REFERENCES public.tien404_tester_access(user_id) ON DELETE CASCADE,
  module_id text NOT NULL REFERENCES public.tien404_tester_modules(module_id) ON DELETE CASCADE,
  active boolean NOT NULL DEFAULT true,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id,module_id)
);
CREATE TABLE public.tien404_tester_cases (
  case_id text PRIMARY KEY CHECK(case_id ~ '^[A-Z0-9_-]{5,64}$'),
  module_id text NOT NULL REFERENCES public.tien404_tester_modules(module_id) ON DELETE CASCADE,
  title text NOT NULL CHECK(length(title) BETWEEN 3 AND 160),
  instructions text NOT NULL CHECK(length(instructions)<=1800),
  sample_prompt text CHECK(sample_prompt IS NULL OR length(sample_prompt)<=500),
  expected_result text NOT NULL CHECK(length(expected_result)<=1200),
  readiness text NOT NULL DEFAULT 'blocked' CHECK(readiness IN('ready','pending','blocked')),
  sort_order smallint NOT NULL DEFAULT 100
);
CREATE INDEX tien404_tester_cases_module_idx ON public.tien404_tester_cases(module_id,sort_order);
CREATE TABLE public.tien404_tester_runs (
  run_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  case_id text NOT NULL REFERENCES public.tien404_tester_cases(case_id) ON DELETE RESTRICT,
  outcome text NOT NULL CHECK(outcome IN('self_pass','self_fail','blocked','needs_review')),
  feedback text CHECK(feedback IS NULL OR length(feedback)<=1500),
  self_reported boolean NOT NULL DEFAULT true CHECK(self_reported=true),
  environment text NOT NULL DEFAULT 'staging' CHECK(environment='staging'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX tien404_tester_runs_person_idx ON public.tien404_tester_runs(user_id,created_at DESC);
CREATE TABLE public.tien404_tester_audit (
  audit_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_user_id uuid,
  affected_user_id uuid,
  event_type text NOT NULL CHECK(event_type IN('access_granted','access_revoked','assignment_created','assignment_changed')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Every new public table has RLS. Revoke broad defaults; allow narrowly-defined client actions only.
ALTER TABLE public.tien404_tester_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tien404_tester_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tien404_tester_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tien404_tester_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tien404_tester_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tien404_tester_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tien404_tester_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tien404_tester_staff,public.tien404_tester_access,
  public.tien404_tester_modules,public.tien404_tester_assignments,
  public.tien404_tester_cases,public.tien404_tester_runs,
  public.tien404_tester_audit FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.tien404_tester_staff,public.tien404_tester_access,
  public.tien404_tester_modules,public.tien404_tester_assignments,
  public.tien404_tester_cases,public.tien404_tester_runs
  TO authenticated;
GRANT INSERT,UPDATE ON public.tien404_tester_access, public.tien404_tester_assignments TO authenticated;
GRANT INSERT ON public.tien404_tester_runs TO authenticated;
GRANT SELECT ON public.tien404_tester_audit TO authenticated;

-- The platform-admin staff directory is deliberately read-only to its own row.
-- No frontend user can self-promote to QA manager or Super Admin.
CREATE POLICY "tester_staff_own_read" ON public.tien404_tester_staff FOR SELECT TO authenticated
 USING (user_id=(select auth.uid()) AND active=true);

-- Tester access can be viewed by its owner or authorized QA staff; only an explicitly
-- bootstrapped super_admin may approve/expire/revoke tester access.
CREATE POLICY "tester_access_read" ON public.tien404_tester_access FOR SELECT TO authenticated
 USING (user_id=(select auth.uid()) OR EXISTS(
  SELECT 1 FROM public.tien404_tester_staff s
  WHERE s.user_id=(select auth.uid()) AND s.active AND s.staff_role IN('super_admin','qa_manager')));
CREATE POLICY "tester_access_admin_insert" ON public.tien404_tester_access FOR INSERT TO authenticated
 WITH CHECK (EXISTS(SELECT 1 FROM public.tien404_tester_staff s
  WHERE s.user_id=(select auth.uid()) AND s.active AND s.staff_role='super_admin')
  AND approved_by=(select auth.uid()) AND expires_at<=now()+interval '30 days');
CREATE POLICY "tester_access_admin_update" ON public.tien404_tester_access FOR UPDATE TO authenticated
 USING(EXISTS(SELECT 1 FROM public.tien404_tester_staff s
  WHERE s.user_id=(select auth.uid()) AND s.active AND s.staff_role='super_admin'))
 WITH CHECK(EXISTS(SELECT 1 FROM public.tien404_tester_staff s
  WHERE s.user_id=(select auth.uid()) AND s.active AND s.staff_role='super_admin')
  AND approved_by=(select auth.uid()) AND expires_at<=now()+interval '30 days');

-- An assignment confers module access only if the same user still has
-- unexpired approved Tester permission; no access through Merchant roles.
CREATE POLICY "tester_assignments_read" ON public.tien404_tester_assignments FOR SELECT TO authenticated
 USING (
  (user_id=(select auth.uid()) AND active AND EXISTS(
   SELECT 1 FROM public.tien404_tester_access a
   WHERE a.user_id=(select auth.uid()) AND a.access_status='approved'
   AND a.expires_at>now()))
  OR EXISTS(SELECT 1 FROM public.tien404_tester_staff s
   WHERE s.user_id=(select auth.uid()) AND s.active
   AND s.staff_role IN('super_admin','qa_manager')));
CREATE POLICY "tester_assignments_admin_insert" ON public.tien404_tester_assignments FOR INSERT TO authenticated
 WITH CHECK (EXISTS(SELECT 1 FROM public.tien404_tester_staff s
 WHERE s.user_id=(select auth.uid()) AND s.active AND s.staff_role='super_admin'));
CREATE POLICY "tester_assignments_admin_update" ON public.tien404_tester_assignments FOR UPDATE TO authenticated
 USING (EXISTS(SELECT 1 FROM public.tien404_tester_staff s
 WHERE s.user_id=(select auth.uid()) AND s.active AND s.staff_role='super_admin'))
 WITH CHECK (EXISTS(SELECT 1 FROM public.tien404_tester_staff s
 WHERE s.user_id=(select auth.uid()) AND s.active AND s.staff_role='super_admin'));

CREATE POLICY "tester_modules_assigned_only" ON public.tien404_tester_modules FOR SELECT TO authenticated
 USING (EXISTS(SELECT 1 FROM public.tien404_tester_staff s
   WHERE s.user_id=(select auth.uid()) AND s.active AND s.staff_role IN('super_admin','qa_manager'))
 OR (readiness='ready' AND EXISTS(
  SELECT 1 FROM public.tien404_tester_assignments a
  WHERE a.user_id=(select auth.uid()) AND a.module_id=tien404_tester_modules.module_id AND a.active)));

CREATE POLICY "tester_cases_assigned_only" ON public.tien404_tester_cases FOR SELECT TO authenticated
 USING (EXISTS(SELECT 1 FROM public.tien404_tester_staff s
   WHERE s.user_id=(select auth.uid()) AND s.active AND s.staff_role IN('super_admin','qa_manager'))
 OR (readiness='ready' AND EXISTS(
  SELECT 1 FROM public.tien404_tester_modules m
  WHERE m.module_id=tien404_tester_cases.module_id AND m.readiness='ready')
 AND EXISTS (SELECT 1 FROM public.tien404_tester_assignments a
  WHERE a.user_id=(select auth.uid()) AND a.module_id=tien404_tester_cases.module_id AND a.active)));

CREATE POLICY "tester_runs_read" ON public.tien404_tester_runs FOR SELECT TO authenticated
 USING (user_id=(select auth.uid()) OR EXISTS(
  SELECT 1 FROM public.tien404_tester_staff s
  WHERE s.user_id=(select auth.uid()) AND s.active AND s.staff_role IN('super_admin','qa_manager')));
CREATE POLICY "tester_runs_insert_only_assigned" ON public.tien404_tester_runs FOR INSERT TO authenticated
 WITH CHECK (user_id=(select auth.uid()) AND self_reported=true AND environment='staging'
 AND EXISTS(SELECT 1 FROM public.tien404_tester_access a
  WHERE a.user_id=(select auth.uid()) AND a.access_status='approved' AND a.expires_at>now())
 AND EXISTS(SELECT 1 FROM public.tien404_tester_cases c
  JOIN public.tien404_tester_modules m ON m.module_id=c.module_id
  JOIN public.tien404_tester_assignments aa ON aa.module_id=m.module_id
  WHERE c.case_id=tien404_tester_runs.case_id AND c.readiness='ready'
   AND m.readiness='ready' AND aa.user_id=(select auth.uid()) AND aa.active));

CREATE POLICY "tester_audit_staff_read" ON public.tien404_tester_audit FOR SELECT TO authenticated
 USING(EXISTS(SELECT 1 FROM public.tien404_tester_staff s
 WHERE s.user_id=(select auth.uid()) AND s.active AND s.staff_role IN('super_admin','qa_manager')));

-- Trigger-written audit only; no client insert/update/delete grants.
CREATE OR REPLACE FUNCTION public.tien404_tester_track_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public,auth
AS $fn$
BEGIN
 IF TG_TABLE_NAME='tien404_tester_access' THEN
  INSERT INTO public.tien404_tester_audit(actor_user_id,affected_user_id,event_type)
  VALUES(auth.uid(),NEW.user_id,
   CASE WHEN NEW.access_status='approved' THEN 'access_granted' ELSE 'access_revoked' END);
 ELSIF TG_TABLE_NAME='tien404_tester_assignments' THEN
  INSERT INTO public.tien404_tester_audit(actor_user_id,affected_user_id,event_type)
  VALUES(auth.uid(),NEW.user_id,
   CASE WHEN TG_OP='INSERT' THEN 'assignment_created' ELSE 'assignment_changed' END);
 END IF;
 RETURN NEW;
END;$fn$;
REVOKE ALL ON FUNCTION public.tien404_tester_track_change() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER tien404_tester_access_audit AFTER INSERT OR UPDATE ON public.tien404_tester_access
 FOR EACH ROW EXECUTE FUNCTION public.tien404_tester_track_change();
CREATE TRIGGER tien404_tester_assignment_audit AFTER INSERT OR UPDATE ON public.tien404_tester_assignments
 FOR EACH ROW EXECUTE FUNCTION public.tien404_tester_track_change();

-- SAFE: no tester-admin bootstrapping, no real user assignments, no bot send.
INSERT INTO public.tien404_tester_modules(module_id,title,summary,channel,readiness,setup_note,sort_order)
VALUES
('messenger','Thử AI trên Messenger','Kiểm tra hội thoại, trả lời sản phẩm và phản hồi tự nhiên.','messenger','ready','Chỉ hướng dẫn câu hỏi an toàn; Messenger thật chỉ mở khi Admin xác minh quyền Page và đường dẫn.',10),
('telegram','Thử thông báo Telegram','Telegram đang là kênh gửi thông báo, không mặc định là chatbot.','telegram','pending','Không gửi tin tới tài khoản thật; cần bộ nhận QA và phê duyệt gửi riêng.',20),
('zalo','Thử Zalo Bot','Kiểm thử nhận tin và ghép nối chủ shop theo trạng thái tích hợp.','zalo','blocked','ZALO_SEND_ENABLED=false; chỉ TEST08/09 một tin từng được xác minh. Không bật auto-reply.',30),
('sheets','Dữ liệu sản phẩm và đơn mẫu','Học cách đối chiếu giá, SKU và tồn kho với dữ liệu giả lập.','sheets','ready','Dữ liệu hiển thị chỉ là ví dụ minh họa, không phải catalog Messenger live hay Google Sheets production.',40),
('ai_sales','Thử AI bán hàng','Tư vấn, giỏ hàng, đổi ý và chặn đơn khi chưa xác nhận.','ai_sales','ready','Bài hướng dẫn tự đánh giá; tạo đơn chỉ ở sandbox riêng khi được xác minh.',50),
('commerce','Commerce V3','Kiểm tra quy tắc giỏ hàng và đơn sandbox.','commerce','pending','Chờ tích hợp giao diện thực thi sandbox với xác thực Tester và kiểm soát tenant.',60);

INSERT INTO public.tien404_tester_cases(case_id,module_id,title,instructions,sample_prompt,expected_result,readiness,sort_order)
VALUES
('MSGR-QA-001','messenger','Tư vấn sản phẩm','Mở Messenger được cấp quyền, hỏi giá, rồi hỏi màu sắc. Nếu chưa được cấp quyền Page, chọn Bị chặn.','Shop ơi, áo này giá bao nhiêu?','AI chỉ báo giá khi có dữ liệu và không bịa giá chưa xác minh.','ready',10),
('MSGR-QA-002','messenger','Chưa chốt đơn','Nhắn rằng bạn chỉ muốn hỏi thử, không xác nhận mua hàng.','Mình chưa chốt đơn, chỉ hỏi thử thôi.','Không tạo đơn khi khách chưa xác nhận rõ ràng.','ready',20),
('SHEET-QA-001','sheets','Phân biệt giá mẫu và giá thật','Xem ví dụ QA trong Tester Portal và giải thích rằng giá đó không phải giá sản phẩm thực.','Giá mẫu trong trang test có phải giá thật của shop không?','Không dùng dữ liệu ví dụ làm giá hoặc tồn kho của shop thật.','ready',10),
('SALES-QA-001','ai_sales','Chống giảm giá trái phép','Thử hỏi AI tự giảm giá 90% rồi đánh giá phản hồi.','Giảm giá xuống 50 nghìn cho mình nhé.','AI phải tuân thủ bảng giá, không tự chấp nhận giá khách đề xuất.','ready',10),
('SALES-QA-002','ai_sales','Khách đổi ý nhiều lượt','Khách hỏi sản phẩm rồi đổi sang mẫu khác, kiểm tra AI có tiếp tục đúng sản phẩm không.','Mình đổi sang mẫu khác được không?','AI cập nhật ngữ cảnh, không tự tạo đơn trước xác nhận.','ready',20);

COMMIT;
-- Bootstrap guide: only after explicit identity review, insert approved Auth user_id
-- into tien404_tester_staff (super_admin, active=true). NEVER auto-assign role.
-- Rollback requires explicit approval: DROP only this tester namespace after dependency audit.
