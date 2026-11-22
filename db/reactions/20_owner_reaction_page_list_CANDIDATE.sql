-- TIEN404 V21.5 - OWNER-ONLY VERIFIED MESSENGER PAGE LIST (CANDIDATE).
-- Never applied hosted without separate approval. Requires 10_page_reaction_drafts_CANDIDATE.sql.
-- A channel_connections row marked "active" is NOT proof; verified private installation required.
-- This RPC is read-only: it never saves draft, sets consent, publishes, or contacts Meta.
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='45s';
DO $pre$ BEGIN
 IF to_regclass('public.channel_connections') IS NULL OR
    to_regclass('public.page_reaction_drafts') IS NULL OR
    to_regclass('app_private.reaction_page_industries') IS NULL OR
    to_regprocedure('app_private.t404_qa_tenant_allowed(uuid)') IS NULL THEN
   RAISE EXCEPTION 'T404_V215_REACTION_LIST_DEPENDENCY_MISSING';
 END IF;
 IF to_regprocedure('public.list_verified_reaction_pages(uuid)') IS NOT NULL THEN
   RAISE EXCEPTION 'T404_V215_REACTION_LIST_ALREADY_APPLIED';
 END IF;
END $pre$;

CREATE FUNCTION public.list_verified_reaction_pages(p_store uuid)
 RETURNS TABLE(
   connection_id uuid,
   page_name text,
   industry_id text,
   environment text,
   draft_sha text
 )
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $fn$
 WITH owner_scope AS (
   SELECT s.tenant_id, s.id AS store_id
     FROM public.stores s
     JOIN public.store_memberships sm
       ON sm.store_id=s.id AND sm.tenant_id=s.tenant_id
          AND sm.active AND sm.role='owner' AND sm.user_id=auth.uid()
     JOIN public.tenant_memberships tm
       ON tm.tenant_id=s.tenant_id AND tm.user_id=sm.user_id AND tm.active
    WHERE s.id=p_store AND s.active AND auth.uid() IS NOT NULL
      AND app_private.t404_qa_tenant_allowed(s.tenant_id)
 )
 SELECT c.id,
        coalesce(nullif(btrim(c.display_name),''),'Messenger Page') AS page_name,
        pr.industry_id,
        c.environment,
        d.config_sha256
   FROM owner_scope own
   JOIN public.channel_connections c ON
      c.tenant_id=own.tenant_id AND c.store_id=own.store_id
      AND c.channel='messenger' AND c.status='active'
      AND c.environment IN ('demo','staging')
   JOIN public.assistants a ON a.tenant_id=c.tenant_id
      AND a.store_id=c.store_id AND a.id=c.assistant_id AND a.status='active'
   JOIN app_private.reaction_page_industries pr ON
      pr.connection_id=c.id
      AND pr.proof_kind='meta_page_verified_installation'
      AND pr.verified_at<=now() AND pr.verified_at>now()-interval '180 days'
   LEFT JOIN public.page_reaction_drafts d
      ON d.connection_id=c.id AND d.tenant_id=c.tenant_id
      AND d.store_id=c.store_id AND d.industry_id=pr.industry_id
   ORDER BY c.display_name NULLS LAST,c.id
 $fn$;

REVOKE ALL ON FUNCTION public.list_verified_reaction_pages(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_verified_reaction_pages(uuid) TO authenticated;
SELECT 'T404_V215_OWNER_PAGE_LIST_OK' AS marker;
COMMIT;
