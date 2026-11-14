-- TIEN404 V12.2 | Authenticated Tester Access Request Queue
-- STAGING ONLY. Safe two-step beta registration: existing Auth user requests;
-- an explicitly bootstrapped active Tester Super Admin independently approves.
-- This is NOT public Supabase Auth signup or a privileged invitation endpoint.
CREATE TABLE IF NOT EXISTS public.tien404_tester_requests (
  request_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  desired_module text NOT NULL DEFAULT 'sheets' REFERENCES public.tien404_tester_modules(module_id),
  note text NOT NULL DEFAULT '' CHECK (char_length(note) <= 400),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES auth.users(id),
  CONSTRAINT tester_request_review_pair CHECK (
    (status='pending' AND reviewed_at IS NULL AND reviewed_by IS NULL)
    OR (status IN ('approved','rejected') AND reviewed_at IS NOT NULL AND reviewed_by IS NOT NULL)
  )
);
ALTER TABLE public.tien404_tester_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.tien404_tester_requests FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.tien404_tester_requests TO authenticated;
GRANT INSERT (user_id, desired_module, note) ON TABLE public.tien404_tester_requests TO authenticated;
GRANT UPDATE (status, reviewed_at, reviewed_by, updated_at) ON TABLE public.tien404_tester_requests TO authenticated;

CREATE POLICY tester_request_own_or_staff_read
ON public.tien404_tester_requests FOR SELECT TO authenticated
USING (
  user_id=(SELECT auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.tien404_tester_staff s
    WHERE s.user_id=(SELECT auth.uid())
      AND s.active AND s.staff_role IN ('super_admin','qa_manager')
  )
);

CREATE POLICY tester_request_self_insert
ON public.tien404_tester_requests FOR INSERT TO authenticated
WITH CHECK (
  user_id=(SELECT auth.uid())
  AND status='pending'
  AND reviewed_at IS NULL AND reviewed_by IS NULL
);

CREATE POLICY tester_request_super_admin_review
ON public.tien404_tester_requests FOR UPDATE TO authenticated
USING (
  status='pending'
  AND EXISTS (
    SELECT 1 FROM public.tien404_tester_staff s
    WHERE s.user_id=(SELECT auth.uid())
      AND s.active AND s.staff_role='super_admin'
  )
)
WITH CHECK (
  status IN ('approved','rejected')
  AND reviewed_by=(SELECT auth.uid())
  AND reviewed_at IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.tien404_tester_staff s
    WHERE s.user_id=(SELECT auth.uid())
      AND s.active AND s.staff_role='super_admin'
  )
  AND (
    status='rejected'
    OR EXISTS (
      SELECT 1 FROM public.tien404_tester_access a
      WHERE a.user_id=tien404_tester_requests.user_id
        AND a.access_status='approved'
        AND a.expires_at>now()
    )
  )
);
COMMENT ON TABLE public.tien404_tester_requests IS
  'STAGING private Tester beta interest queue for existing Supabase Auth users; approval requires active Tester Super Admin.';
