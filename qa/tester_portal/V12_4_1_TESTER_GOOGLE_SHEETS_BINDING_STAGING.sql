-- TIEN404 V12.4.1 Tester Google Sheets QA pilot mapping.
-- STAGING ONLY. Binds one approved, assigned tester to an isolated Google workbook.
-- NEVER store OAuth tokens or share a single Google file across tenant accounts.
CREATE TABLE public.tien404_tester_google_sheets (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id),
  sheet_id text NOT NULL CHECK (sheet_id ~ '^[A-Za-z0-9_-]{25,90}$'),
  access_status text NOT NULL DEFAULT 'ready' CHECK (access_status IN ('ready','revoked')),
  expires_at timestamptz NOT NULL,
  shared_at timestamptz NOT NULL DEFAULT now(),
  oauth_verified_at timestamptz,
  model_workflow_id text NOT NULL CHECK (model_workflow_id ~ '^[A-Za-z0-9]{10,30}$'),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.tien404_tester_google_sheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tien404_tester_google_sheets FORCE ROW LEVEL SECURITY;

CREATE POLICY tester_google_sheets_own_read
ON public.tien404_tester_google_sheets
FOR SELECT TO authenticated USING (
  user_id = (SELECT auth.uid())
  AND access_status='ready'
  AND expires_at>now()
  AND EXISTS (
    SELECT 1 FROM public.tien404_tester_access a
    JOIN public.tien404_tester_assignments t ON t.user_id=a.user_id AND t.module_id='sheets' AND t.active
    WHERE a.user_id=(SELECT auth.uid()) AND a.access_status='approved' AND a.expires_at>now()
  )
);
REVOKE ALL ON public.tien404_tester_google_sheets FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.tien404_tester_google_sheets TO authenticated;
-- NO INSERT/UPDATE/DELETE permissions for browser roles.
